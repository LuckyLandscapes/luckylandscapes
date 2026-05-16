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

// Allowed Gemini models the client can request. Keep this list in sync with
// GEMINI_MODEL_OPTIONS on the client page so the dropdown only offers
// models the server will accept. Google ages models out — when one is
// deprecated, swap the entry here (the client uses the same option keys).
const GEMINI_ALLOWED = new Set([
  'gemini-3.1-flash-lite',   // cheapest current — $0.25/$1.50 per MTok
  'gemini-3-flash-preview',  // smarter — $0.50/$3.00 per MTok
  'gemini-3.1-pro-preview',  // SOTA reasoning — $2.00/$12.00 per MTok
  'gemini-2.5-flash',        // last-gen stable backup
  'gemini-flash-latest',     // alias — always points at the newest Flash
]);
const GEMINI_DEFAULT = 'gemini-3.1-flash-lite';
// Fallback chain when the requested model 404s (only happens if Google
// pulls a model mid-session). Cheapest → most expensive so we don't
// silently upgrade users into a pricier tier.
const GEMINI_FALLBACK_ORDER = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

async function suggestViaGemini({ apiKey, base64, mediaType, requestedModel }) {
  // responseMimeType forces strict JSON output so we don't have to extract
  // from prose / code fences.
  const body = JSON.stringify({
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
  });

  // Build the model attempt list: user's pick first, then fallback chain
  // (skipping the picked model and any duplicates).
  const primary = (requestedModel && GEMINI_ALLOWED.has(requestedModel)) ? requestedModel : GEMINI_DEFAULT;
  const seen = new Set();
  const attempts = [primary, ...GEMINI_FALLBACK_ORDER].filter(m => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });

  let lastErr = null;
  for (const model of attempts) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { rawText: text, usage: data?.usageMetadata || null, provider: `gemini:${model}` };
    }
    const errText = await res.text();
    lastErr = `Gemini ${model} ${res.status}: ${errText.slice(0, 300)}`;
    // Only retry on 404 (deprecated / unknown model). Other errors are
    // structural (bad request, quota) — no point trying another model.
    if (res.status !== 404) break;
  }
  throw new Error(lastErr || 'Gemini: all models failed');
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

  // Optional model override from the client. Server validates against the
  // allowed set inside the provider helper so callers can't burn cash on
  // arbitrary models they don't have access to.
  const requestedModel = typeof body?.model === 'string' ? body.model.trim() : '';

  try {
    const aiResult = provider === 'gemini'
      ? await suggestViaGemini({ apiKey: geminiKey, base64, mediaType, requestedModel })
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
