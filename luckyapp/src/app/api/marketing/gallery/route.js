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

  // Fire both queries in parallel — gallery items and category metadata
  // hit different tables so there's no dependency.
  const [galleryRes, categoriesRes] = await Promise.all([
    supabase
      .from('marketing_gallery')
      .select('id, title, description, tags, image_url, image_width, image_height, before_image_url, sort_order, is_featured, is_cover, project_name, created_at')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('marketing_categories')
      .select('name, display_name, cover_image_url, icon, is_visible, sort_order')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true }),
  ]);

  if (galleryRes.error) {
    console.error('[api/marketing/gallery] gallery query failed', galleryRes.error);
    return NextResponse.json(
      { items: [], categories: [], error: 'query_failed' },
      { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } }
    );
  }

  // Categories failure is non-fatal — we just degrade to auto-derive on
  // the public site. Logged so it's findable in Vercel.
  if (categoriesRes.error) {
    console.warn('[api/marketing/gallery] categories query failed (continuing without)', categoriesRes.error);
  }

  const items = (galleryRes.data || []).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    imageUrl: row.image_url,
    width: row.image_width || null,
    height: row.image_height || null,
    beforeImageUrl: row.before_image_url || null,
    isBeforeAfter: !!row.before_image_url,
    isFeatured: !!row.is_featured,
    isCover: !!row.is_cover,
    projectName: row.project_name || null,
    createdAt: row.created_at,
  }));

  // Only visible categories are returned. Empty array means the public site
  // falls back to auto-derive (every tag becomes a tile, existing behavior).
  // As soon as Riley enables even one category in the manage UI, the public
  // site switches to showing ONLY his curated picks.
  const categories = (categoriesRes.data || []).map(row => ({
    name: row.name,
    displayName: row.display_name || row.name,
    coverImageUrl: row.cover_image_url || null,
    icon: row.icon || null,
    sortOrder: row.sort_order ?? 0,
  }));

  return NextResponse.json(
    { items, categories, count: items.length, generatedAt: new Date().toISOString() },
    { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_HEADER } }
  );
}
