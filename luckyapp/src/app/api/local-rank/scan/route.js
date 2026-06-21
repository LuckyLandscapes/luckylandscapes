import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';

// POST /api/local-rank/scan   body: { keyword, lat, lng, maxN? }
//
// Returns the REAL Google Maps local-pack results a searcher standing at
// (lat,lng) would see, ordered as Google ranks them:
//   { provider, results: [{ id, name, address }] }   // index 0 = rank #1
//
// WHY THIS IS A SERVER ROUTE (not a client Places API call):
// The Google Places API ranks by text/name relevance, NOT the consumer map
// pack — it systematically misreports rank (a business 4th in the real pack can
// vanish while a literally-named competitor tops it). The only way to get the
// rank a real user sees is to read the actual Google Maps SERP at a precise
// lat/lng. That requires a SERP provider, and the provider key must never touch
// the client — hence this proxy (mirrors the /api/buildings/lookup pattern).
//
// Provider-agnostic via env, so you can start free and upgrade with one var:
//   • Bright Data SERP (chosen): recurring 5,000 free req/mo. Set
//       BRIGHTDATA_API_TOKEN  + BRIGHTDATA_SERP_ZONE
//     (Dashboard → Proxies & Scraping → create a "SERP API" zone → copy the
//      zone name + your account API token.)
//   • DataForSEO (cheap upgrade, returns rank natively): set
//       DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD
// If neither is set the route returns 503 with a setup hint (the UI shows it).

export const maxDuration = 30;

const BRIGHTDATA_API_TOKEN = process.env.BRIGHTDATA_API_TOKEN;
const BRIGHTDATA_SERP_ZONE = process.env.BRIGHTDATA_SERP_ZONE || 'serp_api';
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

const ZOOM = '14z'; // viewport zoom for the @lat,lng origin — local-area, not street-level
const ATTEMPT_TIMEOUT_MS = 22000;

// Encode the query for the Google Maps path segment (spaces → '+').
const encodeQueryPath = (kw) => String(kw).trim().split(/\s+/).map(encodeURIComponent).join('+');

async function fetchJson(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

// ── Bright Data SERP (direct API) ───────────────────────────────────────────
async function viaBrightData(keyword, lat, lng, maxN) {
  const mapsUrl =
    `https://www.google.com/maps/search/${encodeQueryPath(keyword)}` +
    `/@${lat.toFixed(6)},${lng.toFixed(6)},${ZOOM}?brd_json=1`;
  const res = await fetchJson('https://api.brightdata.com/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BRIGHTDATA_API_TOKEN}` },
    body: JSON.stringify({ zone: BRIGHTDATA_SERP_ZONE, url: mapsUrl, format: 'raw' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Bright Data ${res.status}: ${t.slice(0, 240)}`);
  }
  // With format:'raw' + brd_json=1 the body IS the parsed SERP JSON. Some plans
  // return it as a JSON string — handle both.
  let data = await res.json().catch(() => null);
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { /* leave as-is */ } }
  if (data && typeof data.body === 'string') { try { data = JSON.parse(data.body); } catch { /* leave */ } }
  return normalizeOrdered(data, maxN);
}

// ── DataForSEO (fallback, returns rank_absolute natively) ────────────────────
async function viaDataForSeo(keyword, lat, lng, maxN) {
  const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
  const res = await fetchJson('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify([{
      keyword,
      location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},${ZOOM}`,
      language_code: 'en',
    }]),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`DataForSEO ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  return items
    .filter((it) => it && (it.title || it.name))
    .sort((a, b) => (a.rank_absolute || 1e9) - (b.rank_absolute || 1e9))
    .slice(0, maxN)
    .map((it) => ({
      id: it.place_id || it.cid || it.feature_id || null,
      name: it.title || it.name || '',
      address: it.address || '',
    }))
    .filter((r) => r.name);
}

// Defensive extraction: SERP parsed-JSON shapes vary by provider/version, so we
// locate the first array of business-shaped objects and keep its order (= rank).
function firstBusinessArray(obj) {
  const KEYS = ['organic', 'maps', 'local_results', 'results', 'businesses', 'places', 'snack_pack', 'list'];
  const looksBiz = (x) => x && typeof x === 'object' && (x.name || x.title || x.business_name);
  for (const k of KEYS) {
    if (Array.isArray(obj?.[k]) && obj[k].length && looksBiz(obj[k][0])) return obj[k];
  }
  let found = null;
  const seen = new Set();
  const visit = (o, depth) => {
    if (found || depth > 5 || !o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    for (const v of Object.values(o)) {
      if (found) return;
      if (Array.isArray(v) && v.length && looksBiz(v[0])) { found = v; return; }
      if (v && typeof v === 'object') visit(v, depth + 1);
    }
  };
  visit(obj, 0);
  return found || [];
}

function normalizeOrdered(data, maxN) {
  return firstBusinessArray(data)
    .slice(0, maxN)
    .map((it) => ({
      id: it.fid || it.place_id || it.cid || it.data_id || it.feature_id || null,
      name: it.name || it.title || it.business_name || '',
      address: it.address || it.full_address || '',
    }))
    .filter((r) => r.name);
}

export async function POST(request) {
  // Owner/admin tool — each call can consume a paid Bright Data / DataForSEO
  // SERP request, so it must never be anonymously scriptable (billing DoS).
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  let body;
  try { body = await request.json(); } catch { body = null; }
  const keyword = body?.keyword;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const maxN = Math.min(Math.max(Number(body?.maxN) || 20, 1), 20);

  if (!keyword || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'bad_request', message: 'keyword, lat, lng are required' }, { status: 400 });
  }

  try {
    if (BRIGHTDATA_API_TOKEN) {
      const results = await viaBrightData(keyword, lat, lng, maxN);
      return NextResponse.json({ provider: 'brightdata', results }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
      const results = await viaDataForSeo(keyword, lat, lng, maxN);
      return NextResponse.json({ provider: 'dataforseo', results }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({
      error: 'not_configured',
      message: 'No SERP provider configured. Set BRIGHTDATA_API_TOKEN + BRIGHTDATA_SERP_ZONE (free tier) — or DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD — in the environment, then redeploy.',
    }, { status: 503 });
  } catch (err) {
    const msg = err?.name === 'AbortError' ? 'The SERP provider timed out.' : (err?.message || String(err));
    return NextResponse.json({ error: 'provider_failed', message: msg }, { status: 502 });
  }
}
