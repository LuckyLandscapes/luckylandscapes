import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

// AI auto-fill for marketing gallery uploads. Two modes:
//
// • mode: 'photo' (default) — vision over a single photo → { title,
//   description, tags }. Used for standalone photos and for per-photo titles
//   inside a project. An optional `hint` (anything the user already typed in
//   the description box) is expanded into proper copy instead of ignored.
// • mode: 'project' — writes ONE shared description for a multi-photo project.
//   Inputs: `hint` (the owner's typed notes), `projectName`, `category`, and
//   optionally a representative photo. Returns { description }. The client
//   applies this same description to every photo in the batch so a project
//   card reads consistently on the public site.
//
// PROVIDERS (auto-detected by env var):
// • GEMINI_API_KEY — Google Gemini (FREE tier). Get a key at
//   https://aistudio.google.com/app/apikey. PREFERRED when both keys are set.
// • ANTHROPIC_API_KEY — Claude Haiku 4.5 via api.anthropic.com. Paid fallback,
//   ~$0.001-0.003/photo. NOT covered by Claude Max (that's separate billing).
//
// Auth: requires a valid Supabase session token so a leaked URL can't be used
// to burn API credit. Token comes in as a Bearer header.

const TAG_OPTIONS = [
  'Hardscaping', 'Landscaping', 'Lawn Care', 'Garden Beds',
  'Retaining Walls', 'Fencing', 'Outdoor Living', 'Construction',
  'Seasonal Cleanup', 'Maintenance', 'Custom Build',
];

// Per-photo caption prompt. `hint` is whatever the user already typed (we
// expand it rather than overwrite); `category` grounds the tag choice.
function buildPhotoPrompt({ hint, category }) {
  const ctx = [];
  if (category) ctx.push(`This photo is filed under the category "${category}".`);
  if (hint) ctx.push(`The owner jotted these notes: "${hint}". Build on them — expand into proper copy, do not contradict or ignore them.`);
  const ctxBlock = ctx.length ? `\n\nContext:\n${ctx.join('\n')}` : '';
  return `You're writing photo captions for a landscaping company's public website portfolio. Look at this photo and respond with valid JSON only — no prose, no code fences.${ctxBlock}

{
  "title": "3-7 words, specific. Examples: 'Backyard Stone Fire Pit', 'Front Yard Mulch Refresh', 'Curved Paver Walkway', 'Maple St Retaining Wall'. NEVER use 'Untitled', 'Photo', 'Project', or generic words.",
  "description": "1-2 sentences (max 200 chars). Describe what's visible. Use 'we' (first person plural). Don't invent details you can't see.",
  "tags": ["1-3 strings from this exact list: ${TAG_OPTIONS.map(t => `"${t}"`).join(', ')}"]
}

If the photo is unclear, blurry, or doesn't show landscaping work, return:
{"title": "", "description": "", "tags": []}`;
}

// Project description prompt. The owner types a few words; we turn it into
// polished, customer-facing copy for the whole project card.
function buildProjectPrompt({ hint, category, projectName, hasImage }) {
  const lines = [];
  if (projectName) lines.push(`Project name: "${projectName}".`);
  if (category) lines.push(`Category: "${category}".`);
  if (hint) lines.push(`The owner's notes about this project: "${hint}".`);
  if (hasImage) lines.push(`A representative photo of the finished work is attached.`);
  return `You're writing the description for a landscaping company's project on their public website portfolio. ${lines.join(' ')}

Write 2-4 sentences of polished, customer-facing marketing copy describing this project and the work done. Use "we" (first person plural, e.g. "We rebuilt..."). Build on the owner's notes — expand them into proper prose, don't contradict or ignore them. Don't invent specifics you weren't given (no made-up client names, exact dimensions, or prices). Keep it warm and concrete.

Respond with valid JSON only — no prose, no code fences:
{"description": "..."}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Provider implementations — each returns { rawText, usage, provider } or
// throws on failure. They take a ready-made `prompt` and an OPTIONAL image
// (project mode can run text-only on the owner's notes alone).
// ─────────────────────────────────────────────────────────────────────────

// Allowed Gemini models the client can request. GA / generally-available only
// — preview models (gemini-3-flash-preview, gemini-3.1-pro-preview) are gated
// on free-tier keys and were the cause of "half the models don't work". Keep
// in sync with GEMINI_MODEL_OPTIONS on the client page.
const GEMINI_ALLOWED = new Set([
  'gemini-3.1-flash-lite',  // GA — cheapest, default
  'gemini-3.5-flash',       // GA — better writing quality
  'gemini-2.5-flash',       // GA — stable backup
  'gemini-flash-latest',    // alias — always points at a current Flash
]);
const GEMINI_DEFAULT = 'gemini-3.1-flash-lite';
// Fallback chain when the requested model is unavailable. All GA, cheapest →
// most-stable, ending on the -latest alias which Google never lets 404.
const GEMINI_FALLBACK_ORDER = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];
// HTTP statuses where switching to a different model might succeed: not-found
// (404), access / preview-gating (403), bad-model (400), per-model quota
// (429). Anything else (401 auth, 5xx) is structural — don't waste retries.
const GEMINI_RETRYABLE = new Set([400, 403, 404, 429]);

async function suggestViaGemini({ apiKey, base64, mediaType, requestedModel, prompt }) {
  const parts = [];
  if (base64) parts.push({ inline_data: { mime_type: mediaType, data: base64 } });
  parts.push({ text: prompt });
  // responseMimeType forces strict JSON so we don't parse out of prose / fences.
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 500,
      responseMimeType: 'application/json',
    },
  });

  // Attempt order: user's pick first, then the fallback chain (deduped).
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
    // Try the next model only when this one might be model-specific. Bail on
    // structural errors so we don't fire the whole chain pointlessly.
    if (!GEMINI_RETRYABLE.has(res.status)) break;
  }
  throw new Error(lastErr || 'Gemini: all models failed');
}

async function suggestViaAnthropic({ apiKey, base64, mediaType, prompt }) {
  const content = [];
  if (base64) content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
  content.push({ type: 'text', text: prompt });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content }],
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
    // Project descriptions run a touch longer than per-photo captions; 400
    // chars comfortably holds 2-4 sentences.
    description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 400) : '',
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
  // A valid token only proves the caller has SOME account on the shared Supabase
  // project (a demo/self-signup user, a future second tenant, etc.). Require an
  // active org membership before spending Gemini/Anthropic credit on their behalf.
  const { data: member } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const mode = body?.mode === 'project' ? 'project' : 'photo';
  const hint = typeof body?.hint === 'string' ? body.hint.trim().slice(0, 600) : '';
  const projectName = typeof body?.projectName === 'string' ? body.projectName.trim().slice(0, 120) : '';
  const category = typeof body?.category === 'string' ? body.category.trim().slice(0, 60) : '';

  // Image is required for photo mode; optional for project mode (the owner's
  // notes alone can drive a description).
  let mediaType = 'image/jpeg';
  let base64 = '';
  const raw = String(body?.imageBase64 || '');
  if (raw) {
    base64 = raw;
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
  }
  if (mode === 'photo' && !base64) {
    return NextResponse.json({ error: 'missing_image' }, { status: 400 });
  }
  if (mode === 'project' && !base64 && !hint) {
    return NextResponse.json(
      { error: 'missing_input', message: 'Type a few words about the project (or attach a photo) so the AI has something to work from.' },
      { status: 400 }
    );
  }

  // Optional model override from the client. Validated against GEMINI_ALLOWED
  // inside the provider helper so callers can't burn cash on arbitrary models.
  const requestedModel = typeof body?.model === 'string' ? body.model.trim() : '';

  const prompt = mode === 'project'
    ? buildProjectPrompt({ hint, category, projectName, hasImage: !!base64 })
    : buildPhotoPrompt({ hint, category });

  try {
    const aiResult = provider === 'gemini'
      ? await suggestViaGemini({ apiKey: geminiKey, base64, mediaType, requestedModel, prompt })
      : await suggestViaAnthropic({ apiKey: anthropicKey, base64, mediaType, prompt });

    const out = extractAndValidate(aiResult.rawText);
    if (out.error) {
      return NextResponse.json({ ...out, provider: aiResult.provider }, { status: 502 });
    }
    return NextResponse.json({
      ...out,
      mode,
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
