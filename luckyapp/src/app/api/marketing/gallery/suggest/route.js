import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

// AI auto-fill for marketing gallery uploads. Riley uploads a photo, clicks
// "Auto-fill from photo", and Claude Haiku 4.5 vision returns a suggested
// title, description, and tag set so he doesn't have to write metadata by
// hand for every photo. Output is plain JSON the client can drop straight
// into the upload-form fields; the user can still edit before submitting.
//
// Cost: ~$0.001–$0.003 per photo with Haiku 4.5. 100 photos/year < $0.30.
// Auth: requires a valid Supabase session token so a leaked public URL can't
// be used to burn API credits. Token comes in as a Bearer header.

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

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'not_configured', message: 'AI auto-fill is not configured. Set ANTHROPIC_API_KEY in Vercel env vars to enable.' },
      { status: 503 }
    );
  }

  // Auth — verify a valid Supabase session token. Bare-public would let any
  // visitor burn the org's API credit by hitting this endpoint with random
  // images.
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
  // Accept data URLs and raw base64. Detect media type from the data URL when
  // present so HEIC / PNG / etc. get a proper media_type on the Claude call.
  let mediaType = 'image/jpeg';
  let base64 = raw;
  const m = raw.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (m) {
    mediaType = m[1].toLowerCase();
    base64 = m[2];
  }
  // Hard cap to keep requests inside Vercel's 4.5MB body limit + Claude's
  // 5MB image limit. Phone photos compressed by the client land ~300KB.
  if (base64.length > 5_500_000) {
    return NextResponse.json({ error: 'image_too_large' }, { status: 413 });
  }

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[gallery/suggest] Claude API error', aiRes.status, errText.slice(0, 500));
      return NextResponse.json(
        { error: 'ai_failed', status: aiRes.status, detail: errText.slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await aiRes.json();
    const text = data?.content?.[0]?.text || '';

    // Tolerate stray prose around the JSON (Claude usually obeys but be safe).
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'no_json', raw: text.slice(0, 200) }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: 'invalid_json_response', raw: text.slice(0, 200) }, { status: 502 });
    }

    // Validate tags against the allowed set.
    const tagSet = new Set(TAG_OPTIONS);
    const cleanTags = Array.isArray(parsed.tags)
      ? parsed.tags.filter(t => typeof t === 'string' && tagSet.has(t)).slice(0, 3)
      : [];

    return NextResponse.json({
      title: typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 80) : '',
      description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 240) : '',
      tags: cleanTags,
      usage: data?.usage || null,
    });
  } catch (err) {
    console.error('[gallery/suggest] request failed', err);
    return NextResponse.json({ error: 'request_failed', message: err.message }, { status: 500 });
  }
}
