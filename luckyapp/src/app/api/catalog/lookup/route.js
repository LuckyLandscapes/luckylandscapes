import { NextResponse } from 'next/server';

// POST /api/catalog/lookup
// Body: { url: string }
// Fetches a supplier product page server-side and parses the embedded JSON-LD
// schema.org block (Home Depot and Menards both ship one) for `offers.price`
// and `offers.availability`. We do this server-side so the browser doesn't hit
// CORS, and so we can set a desktop User-Agent — both vendors return a stub
// page to bot-shaped UAs which omits the JSON-LD.
//
// Returns { ok, price, currency, stockStatus, name, raw } on success;
// { ok: false, error } otherwise. Stock is mapped to the same shape the
// catalog stores: in_stock | low_stock | out_of_stock | unknown.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function mapAvailability(availability) {
  if (!availability) return 'unknown';
  const a = String(availability).toLowerCase();
  if (a.includes('instock') || a.includes('in_stock')) return 'in_stock';
  if (a.includes('limitedavailability') || a.includes('limited')) return 'low_stock';
  if (a.includes('outofstock') || a.includes('out_of_stock') || a.includes('soldout') || a.includes('sold_out')) return 'out_of_stock';
  if (a.includes('discontinued')) return 'out_of_stock';
  return 'unknown';
}

// Walks any JSON-LD payload (which can be a single object, an array, or a
// @graph wrapper) and yields every node that looks like a Product.
function* productNodes(node) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) yield* productNodes(n);
    return;
  }
  if (typeof node !== 'object') return;
  const t = node['@type'];
  if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) yield node;
  if (node['@graph']) yield* productNodes(node['@graph']);
}

function extractFromHtml(html) {
  // Pull every <script type="application/ld+json"> block. There can be more
  // than one (breadcrumb + product), so we collect, parse, and pick the first
  // Product node we find.
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of blocks) {
    let parsed;
    try { parsed = JSON.parse(raw.trim()); } catch { continue; }
    for (const product of productNodes(parsed)) {
      const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const price = offers?.price ?? offers?.lowPrice ?? null;
      return {
        name: product.name || null,
        price: price != null ? Number(price) : null,
        currency: offers?.priceCurrency || 'USD',
        stockStatus: mapAvailability(offers?.availability),
      };
    }
  }
  return null;
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const url = body?.url;
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 });
  }
  // Only allow the suppliers we actually use, so this endpoint can't be turned
  // into an open proxy.
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid url' }, { status: 400 });
  }
  const allowed = ['homedepot.com', 'www.homedepot.com', 'menards.com', 'www.menards.com'];
  if (!allowed.some(d => host === d || host.endsWith('.' + d))) {
    return NextResponse.json({ ok: false, error: 'Supplier not supported for live lookup' }, { status: 400 });
  }

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not.A/Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Fetch failed: ' + (err.message || err) }, { status: 502 });
  }
  if (!res.ok) {
    // 403/429 from HD/Menards is bot-detection on the supplier CDN — common
    // when running from a datacenter IP. The UI handles this by falling back
    // to the "Find at Lincoln Suppliers" deep-link chips so the user can
    // verify in the browser instead.
    const friendly = res.status === 403 || res.status === 429
      ? 'Supplier blocked the lookup (bot detection). Open the supplier page directly to check stock.'
      : `Supplier returned ${res.status}`;
    return NextResponse.json({ ok: false, error: friendly, status: res.status }, { status: 502 });
  }

  const html = await res.text();
  const data = extractFromHtml(html);
  if (!data) {
    return NextResponse.json({
      ok: false,
      error: 'No product data found on page (it may be a search result or the supplier did not embed JSON-LD).',
    }, { status: 422 });
  }

  return NextResponse.json({ ok: true, ...data, checkedAt: new Date().toISOString() });
}
