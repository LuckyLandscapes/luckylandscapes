import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

// Public, unauthenticated read endpoint for the marketing site's editable
// image slots. The static marketing site (luckylandscapes.com) fetches this
// on every page and swaps the src/alt on any <img data-ll-img="<slot_key>">
// it finds, falling back to the bundled image if the fetch fails or the slot
// has no override. CORS is wide-open because the marketing site is a separate
// origin.
//
// Single-tenant by design (mirrors /api/marketing/gallery): we don't filter by
// org_id — the marketing site is Lucky's. If a second org ever sets the same
// slot_key, the most-recently-updated row wins (we build the map in
// updated_at order so later rows overwrite earlier ones).
//
// Caching: Vercel edge caches 60s, serves stale up to 5m while revalidating —
// near-instant updates for Riley, minimal DB load.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const CACHE_HEADER = 'public, s-maxage=60, stale-while-revalidate=300';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { slots: {} },
      { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } }
    );
  }

  const { data, error } = await supabase
    .from('marketing_images')
    .select('slot_key, image_url, alt, image_width, image_height, updated_at')
    .order('updated_at', { ascending: true });

  if (error) {
    console.error('[api/marketing/images] query failed', error);
    return NextResponse.json(
      { slots: {}, error: 'query_failed' },
      { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } }
    );
  }

  // Map keyed by slot_key. Later (newer) rows overwrite earlier ones.
  const slots = {};
  for (const row of (data || [])) {
    if (!row.slot_key || !row.image_url) continue;
    slots[row.slot_key] = {
      url: row.image_url,
      alt: row.alt || '',
      width: row.image_width || null,
      height: row.image_height || null,
    };
  }

  return NextResponse.json(
    { slots, count: Object.keys(slots).length, generatedAt: new Date().toISOString() },
    { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_HEADER } }
  );
}
