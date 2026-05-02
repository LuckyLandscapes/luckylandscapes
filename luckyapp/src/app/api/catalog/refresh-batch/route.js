import { NextResponse } from 'next/server';

// POST /api/catalog/refresh-batch
// Body: { materialIds: string[], origin?: string }
//
// Server-side fan-out wrapper around /api/catalog/lookup. The caller passes
// material IDs; we pull each material's supplier_url from Supabase, hit
// lookup sequentially with a small delay between requests, and return
// per-material results.
//
// We deliberately do NOT write the results back to the DB here — that
// would couple this route to RLS / org context. The caller (catalog page
// or CLI script) does the writes via the user-scoped Supabase client.
//
// The 500ms delay reduces our chance of getting Akamai-flagged on
// Menards/HD; OS doesn't bot-protect, so for OS-only batches you could
// shrink it. We accept the conservative default for simplicity.

const PER_REQUEST_DELAY_MS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getServiceSupabase() {
  // Lazy import — the catalog page calls this with the user's bearer token
  // forwarded; the CLI uses the service-role key. The shared helper picks
  // the right one based on env.
  const { getServiceSupabase: get } = await import('@/lib/stripeServer');
  return get();
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const ids = Array.isArray(body?.materialIds) ? body.materialIds : null;
  if (!ids || ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'materialIds required' }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ ok: false, error: 'Too many materials in one batch (max 200). Split it up.' }, { status: 400 });
  }

  const supabase = await getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: 'DB not configured' }, { status: 500 });

  const { data: rows, error } = await supabase
    .from('materials')
    .select('id, name, supplier_url, unit_cost, stock_status, image_url')
    .in('id', ids);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Build the absolute URL to /api/catalog/lookup. Fetch needs a full URL
  // when called from a server-side route in Next 16.
  const origin = (body.origin && typeof body.origin === 'string')
    ? body.origin
    : new URL(request.url).origin;
  const lookupUrl = `${origin}/api/catalog/lookup`;

  const results = [];
  for (const row of (rows || [])) {
    const r = { id: row.id, name: row.name, ok: false, oldPrice: row.unit_cost, oldStock: row.stock_status };
    if (!row.supplier_url) {
      r.error = 'No supplier URL';
      results.push(r);
      continue;
    }
    try {
      const res = await fetch(lookupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: row.supplier_url }),
      });
      const data = await res.json();
      if (!data.ok) {
        r.error = data.error || `Lookup failed (${res.status})`;
      } else {
        r.ok = true;
        r.newPrice = data.price;
        r.newStock = data.stockStatus;
        r.checkedAt = data.checkedAt;
        r.image = data.image && !row.image_url ? data.image : null;
      }
    } catch (err) {
      r.error = err.message || String(err);
    }
    results.push(r);
    await sleep(PER_REQUEST_DELAY_MS);
  }

  return NextResponse.json({ ok: true, results });
}
