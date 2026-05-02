#!/usr/bin/env node
/**
 * Refresh material prices and stock from supplier sites in batch.
 *
 * Usage:
 *   node scripts/refresh-catalog-prices.js                  # all materials
 *   node scripts/refresh-catalog-prices.js --supplier=os    # only OS items
 *   node scripts/refresh-catalog-prices.js --supplier=menards
 *   node scripts/refresh-catalog-prices.js --dry-run        # don't write
 *
 * Requires env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (NOT anon — this script bypasses RLS)
 *   APP_ORIGIN (e.g. https://app.luckylandscapes.com or http://localhost:3000)
 *
 * The script hits the live /api/catalog/lookup endpoint, so APP_ORIGIN
 * must point to a running Next.js instance that has the same Supabase
 * env wired up.
 */

const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const supplierArg = (args.find(a => a.startsWith('--supplier=')) || '').replace('--supplier=', '').toLowerCase();
const dryRun = args.includes('--dry-run');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const SUPPLIER_NAME_PATTERNS = {
  os: /outdoor.solutions/i,
  outdoor: /outdoor.solutions/i,
  menards: /menards/i,
  menard: /menards/i,
  homedepot: /home.depot/i,
  hd: /home.depot/i,
};

function pad(s, n) { return String(s).padEnd(n).slice(0, n); }
function fmtMoney(n) { return n == null ? '—' : `$${Number(n).toFixed(2)}`; }

async function main() {
  console.log(`Refresh against ${APP_ORIGIN} (${dryRun ? 'DRY RUN' : 'LIVE'}${supplierArg ? `, supplier=${supplierArg}` : ''})\n`);

  // Pull suppliers + materials
  const { data: suppliers, error: supErr } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('is_active', true);
  if (supErr) { console.error(supErr); process.exit(1); }

  let supplierFilterIds = null;
  if (supplierArg) {
    const pattern = SUPPLIER_NAME_PATTERNS[supplierArg] || new RegExp(supplierArg, 'i');
    supplierFilterIds = suppliers.filter(s => pattern.test(s.name)).map(s => s.id);
    if (supplierFilterIds.length === 0) {
      console.error(`No supplier matches "${supplierArg}". Known suppliers:`, suppliers.map(s => s.name).join(', '));
      process.exit(1);
    }
  }

  let q = supabase.from('materials').select('id, name, supplier_id, supplier_url, unit_cost, stock_status, image_url').not('supplier_url', 'is', null);
  if (supplierFilterIds) q = q.in('supplier_id', supplierFilterIds);
  const { data: materials, error: matErr } = await q;
  if (matErr) { console.error(matErr); process.exit(1); }

  console.log(`Materials with supplier URL: ${materials.length}`);
  if (materials.length === 0) return;

  let ok = 0, fail = 0, changed = 0;

  // Header
  console.log(`\n${pad('Material', 38)} ${pad('Old → New', 24)} ${pad('Stock', 18)} Result`);
  console.log('─'.repeat(98));

  for (const m of materials) {
    process.stdout.write(`${pad(m.name, 38)} `);
    try {
      const res = await fetch(`${APP_ORIGIN}/api/catalog/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: m.supplier_url }),
      });
      const data = await res.json();
      if (!data.ok) {
        console.log(`${pad('—', 24)} ${pad('—', 18)} ✗ ${data.error || res.status}`);
        fail++;
        await sleep(500);
        continue;
      }
      const priceLine = `${fmtMoney(m.unit_cost)} → ${fmtMoney(data.price)}`;
      const stockLine = `${m.stock_status || '—'} → ${data.stockStatus}`;
      const willChange = (data.price != null && Number(data.price) !== Number(m.unit_cost)) || data.stockStatus !== m.stock_status;
      console.log(`${pad(priceLine, 24)} ${pad(stockLine, 18)} ${willChange ? (dryRun ? '(would update)' : '✓ updated') : '·'}`);
      ok++;
      if (willChange) changed++;

      if (!dryRun && willChange) {
        const patch = {
          stock_status: data.stockStatus,
          stock_last_checked: data.checkedAt,
          last_price_check: data.checkedAt,
        };
        if (data.price != null) patch.unit_cost = data.price;
        if (data.image && !m.image_url) patch.image_url = data.image;
        const { error: upErr } = await supabase.from('materials').update(patch).eq('id', m.id);
        if (upErr) {
          console.log(`  └─ update failed: ${upErr.message}`);
        }
      }
    } catch (err) {
      console.log(`${pad('—', 24)} ${pad('—', 18)} ✗ ${err.message || err}`);
      fail++;
    }
    await sleep(500);
  }

  console.log('\n' + '─'.repeat(98));
  console.log(`Done. ${ok} OK · ${changed} changed${dryRun ? ' (dry run, nothing written)' : ''} · ${fail} failed.`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => { console.error(err); process.exit(1); });
