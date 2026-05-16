import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

// Public, unauthenticated read endpoint for the marketing site gallery.
// The static marketing site (luckylandscapes.com) fetches this on the
// gallery + homepage pages and falls back to its bundled projectData if
// the fetch fails or returns no items. CORS is wide-open because the
// marketing site is a separate origin.
//
// Caching: Vercel edge caches for 60s and may serve stale up to 5m while
// revalidating in the background. That gives Riley near-instant updates
// while keeping read load off the database.

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
      { items: [] },
      { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } }
    );
  }

  const { data, error } = await supabase
    .from('marketing_gallery')
    .select('id, title, description, tags, image_url, image_width, image_height, before_image_url, sort_order, created_at')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/marketing/gallery] query failed', error);
    return NextResponse.json(
      { items: [], error: 'query_failed' },
      { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } }
    );
  }

  const items = (data || []).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    imageUrl: row.image_url,
    width: row.image_width || null,
    height: row.image_height || null,
    beforeImageUrl: row.before_image_url || null,
    isBeforeAfter: !!row.before_image_url,
    createdAt: row.created_at,
  }));

  return NextResponse.json(
    { items, count: items.length, generatedAt: new Date().toISOString() },
    { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_HEADER } }
  );
}
