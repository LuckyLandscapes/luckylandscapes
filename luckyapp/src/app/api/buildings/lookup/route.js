import { NextResponse } from 'next/server';

// GET /api/buildings/lookup?s=&w=&n=&e=   (bounding box: south, west, north, east)
//
// Server-side proxy for the OSM Overpass API, used by the /measure "Detect
// Buildings" tool. Doing this server-side (instead of the browser calling
// Overpass directly) fixes the "bugs out often" problem in three ways:
//   1. Mirror fallback — overpass-api.de is frequently overloaded (429/504).
//      The community mirrors are far more reliable BUT don't send CORS headers,
//      so a browser fetch to them fails. The server has no CORS constraint, so
//      we can fall through to them.
//   2. Controlled User-Agent — overpass-api.de 406s requests from default/library
//      UAs; we send a real identifying UA (good Overpass etiquette, and avoids the
//      bot filter).
//   3. One retry surface — we try each endpoint in order until one returns JSON.
//
// Response: { ok: true, buildings: [{ id, building, geometry: [{lat,lng}, ...] }], source }
//           { ok: false, error }   (error 'too_large' when the bbox is too big)

export const maxDuration = 30; // Overpass can take several seconds; give headroom over Vercel's default.

// Tried in order; first JSON response wins. overpass-api.de first (best data
// freshness), then community mirrors that tend to be up when it's overloaded.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const ATTEMPT_TIMEOUT_MS = 12000;
const USER_AGENT = 'LuckyLandscapes-Measure/1.0 (+https://luckylandscapes.com)';

async function tryMirror(url, query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      body: 'data=' + encodeURIComponent(query),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, error: `status ${res.status}` };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) return { ok: false, error: `non-json (${res.status})` };
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err)) };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // Note: Number(null) === 0, so a missing param must be coerced to NaN explicitly
  // or the "required" check below would pass with a bogus 0 and trip the size guard.
  const num = (k) => {
    const v = searchParams.get(k);
    return v == null || v === '' ? NaN : Number(v);
  };
  const s = num('s');
  const w = num('w');
  const n = num('n');
  const e = num('e');
  if (![s, w, n, e].every(Number.isFinite)) {
    return NextResponse.json({ ok: false, error: 'bbox params s,w,n,e are required' }, { status: 400 });
  }
  // Guard against a zoomed-way-out request that would return a huge payload and
  // hammer Overpass. ~0.15° is comfortably larger than the measure tool's normal
  // z18-20 viewport but rejects a whole-city pull.
  if (Math.abs(n - s) > 0.15 || Math.abs(e - w) > 0.15) {
    return NextResponse.json({ ok: false, error: 'too_large' }, { status: 400 });
  }

  const query = `[out:json][timeout:20];(way["building"](${s},${w},${n},${e}););out geom;`;

  const errors = [];
  for (const url of OVERPASS_MIRRORS) {
    const r = await tryMirror(url, query);
    if (r.ok) {
      const buildings = (r.data.elements || [])
        .filter((el) => el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 3)
        .map((el) => ({
          id: el.id,
          building: el.tags?.building || 'yes',
          geometry: el.geometry.map((p) => ({ lat: p.lat, lng: p.lon })),
        }));
      return NextResponse.json({ ok: true, buildings, source: url }, { headers: { 'Cache-Control': 'no-store' } });
    }
    errors.push({ url, error: r.error });
  }

  return NextResponse.json(
    { ok: false, error: 'overpass_unreachable', details: errors },
    { status: 502 },
  );
}
