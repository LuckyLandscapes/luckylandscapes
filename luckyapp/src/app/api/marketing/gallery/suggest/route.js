import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

// AI auto-fill for marketing gallery uploads. Riley uploads a photo, clicks
// "Auto-fill from photo", and a vision model returns a suggested title,
// description, and tag set so he doesn't have to write metadata by hand for
// every photo. Output is plain JSON the client drops straight into the form;
// the user can still edit before submitting.
//
// PROVIDERS (auto-detected by env var):
// • GEMINI_API_KEY — Google Gemini 2.0 Flash, FREE tier 1500 req/day,
//   15 req/min. Get a key at https://aistudio.google.com/app/apikey.
//   PREFERRED when both keys are set.
// • ANTHROPIC_API_KEY — Claude Haiku 4.5 via api.anthropic.com.
//   ~$0.001-0.003/photo (100 photos ≈ $0.15). NOT covered by Claude Max
//   subscription — that's separate from the API. Used only if Gemini key
//   is missing.
//
// Auth: requires a valid Supabase session token so a leaked URL can't be
// used to burn API credit. Token comes in as a Bearer header.

const TAG_OPTIONS = [
  'Hardscaping', 'Landscaping', 'Lawn Care', 'Garden Beds',
  'Retaining Walls', 'Fencing', 'Outdoor Living', 'Construction',
  'Seasonal Cleanup', 'Maintenance', 'Custom Build',
];

const PROMPT = `You're writing photo captions for a landscaping company's public website portfolio. Look at this photo and respond with valid JSON only — no prose, no code fences.

{
  "title": "3-7 words, specific. Examples: 'Backyard Stone Fire Pit', 'Front Yard Mulch Refresh', 'Curved Paver Walkway', 'Maple St Retaining Wall'. NEVER use 'Untitled', 'Photo', 'Project', or generic words.",
  "description": "1-2 sentences (max 200 chars). Describe what's visible. Use 'we' (first person plural). Don't invent details you can't see.",
  "tags": ["1-3 strings from this exact list: ${TAG_OPTIONS.map(t => `"${t}"`).join(', ')}"]
}

If the photo is unclear, blurry, or doesn't show landscaping work, return:
{"title": "", "description": "", "tags": []}`;

// ─────────────────────────────────────────────────────────────────────────
// Provider implementations — each returns { title, description, tags, usage }
// or throws on failure.
// ─────────────────────────────────────────────────────────────────────────

async function suggestViaGemini({ apiKey, base64, mediaType }) {
  // Gemini 2.0 Flash — free tier 1500 RPD. responseMimeType forces strict JSON
  // output so we don't have to extract from prose / code fences.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mediaType, data: base64 } },
          { text: PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 400,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { rawText: text, usage: data?.usageMetadata || null, provider: 'gemini' };
}

async function suggestViaAnthropic({ apiKey, base64, mediaType }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  return { rawText: text, usage: data?.usage || null, provider: 'anthropic' };
}

function extractAndValidate(rawText) {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { error: 'no_json', raw: rawText.slice(0, 200) };
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { error: 'invalid_json_response', raw: rawText.slice(0, 200) };
  }
  const tagSet = new Set(TAG_OPTIONS);
  const cleanTags = Array.isArray(parsed.tags)
    ? parsed.tags.filter(t => typeof t === 'string' && tagSet.has(t)).slice(0, 3)
    : [];
  return {
    title: typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 80) : '',
    description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 240) : '',
    tags: cleanTags,
  };
}

export async function POST(request) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  // Gemini wins when both are set — free tier covers Lucky's volume easily.
  const provider = geminiKey ? 'gemini' : (anthropicKey ? 'anthropic' : null);
  if (!provider) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message: 'AI auto-fill is not configured. Set GEMINI_API_KEY (free at aistudio.google.com) or ANTHROPIC_API_KEY in Vercel env vars to enable.',
      },
      { status: 503 }
    );
  }

  // Auth — verify a valid Supabase session token.
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'missing_auth' }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'db_not_configured' }, { status: 500 });
  }
  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: 'invalid_auth' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const raw = String(body?.imageBase64 || '');
  if (!raw) {
    return NextResponse.json({ error: 'missing_image' }, { status: 400 });
  }
  // Accept data URLs and raw base64. Detect media type from the data URL.
  let mediaType = 'image/jpeg';
  let base64 = raw;
  const m = raw.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (m) {
    mediaType = m[1].toLowerCase();
    base64 = m[2];
  }
  // Hard cap to keep requests inside Vercel's 4.5MB body limit + provider
  // image limits. Phone photos compressed client-side land ~300KB.
  if (base64.length > 5_500_000) {
    return NextResponse.json({ error: 'image_too_large' }, { status: 413 });
  }

  try {
    const aiResult = provider === 'gemini'
      ? await suggestViaGemini({ apiKey: geminiKey, base64, mediaType })
      : await suggestViaAnthropic({ apiKey: anthropicKey, base64, mediaType });

    const out = extractAndValidate(aiResult.rawText);
    if (out.error) {
      return NextResponse.json({ ...out, provider: aiResult.provider }, { status: 502 });
    }
    return NextResponse.json({
      ...out,
      provider: aiResult.provider,
      usage: aiResult.usage,
    });
  } catch (err) {
    console.error('[gallery/suggest] request failed', err);
    return NextResponse.json(
      { error: 'request_failed', provider, message: err.message },
      { status: 502 }
    );
  }
}
