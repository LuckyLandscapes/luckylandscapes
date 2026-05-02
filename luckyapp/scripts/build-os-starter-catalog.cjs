#!/usr/bin/env node
/**
 * Build the Outdoor Solutions starter catalog from the legacy scrape data.
 *
 * Inputs:
 *   - src/lib/outdoorSolutionsProducts.js — live URL/image/price scrape
 *     keyed by normalized product slug
 *   - src/lib/seedOutdoorSolutionsLincoln.js — older curated list with
 *     colors, descriptions, and notes we want to preserve
 *
 * Output:
 *   - src/lib/outdoorSolutionsStarterCatalog.js — single export, items in
 *     the post-031 materials schema (supplierName, unit, unitCost, etc.)
 *
 * What gets dropped:
 *   - Pond accessories, fountains, basins, aerators (Lucky doesn't install)
 *   - Fire pit burners (different niche)
 *   - Items with no parseable price
 *   - Sold-out items in the legacy seed
 *
 * Run once locally; the output is committed to source. Re-run when
 * outdoorSolutionsProducts.js is re-scraped from the OS website.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Helpers ────────────────────────────────────────────────────────────────────

// The legacy data files use ESM `export const`. We can't `require` them
// directly under Node's default CJS resolution. Easiest reliable workaround:
// rewrite to `module.exports.` and stash as a .cjs in a tmp dir, then
// `require` that copy.
function loadEsm(file) {
  let src = fs.readFileSync(file, 'utf8');
  // `export const X = ...` → `module.exports.X = ...`
  src = src.replace(/export\s+const\s+/g, 'module.exports.');
  // `export function fn(...) {...}` → `function fn(...) {...}\nmodule.exports.fn = fn;`
  src = src.replace(/export\s+function\s+([A-Za-z0-9_]+)/g,
    (_, name) => `function ${name}`);
  const tmp = path.join(os.tmpdir(), `lucky-shim-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`);
  fs.writeFileSync(tmp, src);
  try { return require(tmp); }
  finally { try { fs.unlinkSync(tmp); } catch {} }
}

const PRODUCTS = loadEsm(path.resolve(__dirname, '../src/lib/outdoorSolutionsProducts.js')).OUTDOOR_SOLUTIONS_PRODUCTS;
const LEGACY = loadEsm(path.resolve(__dirname, '../src/lib/seedOutdoorSolutionsLincoln.js')).OUTDOOR_SOLUTIONS_CATALOG;

// Normalize a name the same way the scraper did, so we can join the legacy
// curated metadata onto product entries.
function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Drop these source categories — Lucky's quotes don't include them. Fire
// pits and fire pit burners ARE included (Lucky installs them); pond
// installs are excluded.
const DROP_SOURCE_CATEGORIES = new Set([
  'pond-supplies',
  'pond-pond-category',
  'pond-accessories-pond-supplies',
  'pond-basalt-columns',
  'pond-water-feature-treatments',
  'pond-fountain-basins',
  'pond-filterfalls',
  'pond-fast-falls',
  'pond-aerators-ionizers',
  'pond-pump-vaults',
  'pond-pond-skimmers',
  'pond-pond-linerunderlayment',
  'pond-eco-blox',
  // top-level category landing pages (no actual product)
  'mulches', 'topsoils', 'construction-materials', 'landscape-rock',
  'cobblestoneandminiboulders', 'boulders', 'flagstone', 'pavers',
  'edging', 'steps', 'drystack-walls', 'retaining-walls', 'accessories',
  'landscape-fabric', 'grass-seed-by-miller-seed-co-straw-blanket',
]);

// Source categories whose items are infrastructure customers don't pick
// (substrate sand, adhesives, fabric, gas-plumbing for fire pits). We
// still import them — the salesperson uses them for cost — but flag
// is_customer_visible=false so they stay out of quote galleries.
const INTERNAL_SOURCE_CATEGORIES = new Set([
  'landscape-fabric',
  'accessories',
  'fire-pit-burners',  // burner kits, vent kits, propane conversion — plumbing
]);

// We keep the source-category list as a denylist for top-level pages, but the
// REAL filter is "drop any product whose URL ends with /category/...". Those
// aren't products, they're index pages.
function isCategoryIndex(p) {
  return p.url && /\/category\//.test(p.url);
}

// Parse priceText into a numeric unit cost and our unit identifier. Returns
// { cost, unit } or null if the price can't be parsed.
function parsePriceText(text) {
  if (!text) return null;
  const t = String(text).trim();

  // "$.034 / lb"  → bulk material, convert to per-ton
  let m = t.match(/^\$([\d.]+)\s*\/\s*lb$/i);
  if (m) {
    const perLb = parseFloat(m[1]);
    if (!Number.isFinite(perLb)) return null;
    return { cost: +(perLb * 2000).toFixed(2), unit: 'ton' };
  }

  // "$55 / cubic yd"
  m = t.match(/^\$([\d.]+)\s*\/\s*cubic\s*yd$/i);
  if (m) return { cost: parseFloat(m[1]), unit: 'cu yd' };

  // "$X / sq ft"
  m = t.match(/^\$([\d.]+)\s*\/\s*sq\s*ft$/i);
  if (m) return { cost: parseFloat(m[1]), unit: 'sqft' };

  // "$X Each" or "$X.YZ Each"
  m = t.match(/^\$([\d.]+)\s*Each$/i);
  if (m) return { cost: parseFloat(m[1]), unit: 'each' };

  // Fallback: items with multi-price strings ("$35 Solid Colors/ $50
  // Reflective Each", "$100 pair Each"). Take the first $-amount and
  // call it 'each'. Better to import with an approximate price than skip.
  m = t.match(/\$([\d.]+)/);
  if (m) return { cost: parseFloat(m[1]), unit: 'each' };

  return null;
}

// Pretty product name from URL slug ("aromatic-cedar" → "Aromatic Cedar Mulch").
// Falls back to title-casing the key. Appends the category word for mulch/rock
// since OS slugs often omit it ("black" → "Black Mulch").
function nameFromKey(key, p) {
  // Prefer the URL slug — strip trailing slash first, THEN take last segment
  // (the previous order ate the whole URL when it ended with `/`).
  const url = (p.url || '').replace(/\/+$/, '');
  const slug = url ? url.split('/').pop() : key;
  let name = slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
  // Suffix the category word when the slug is too terse.
  const cat = p.category || '';
  if (cat === 'Mulch' && !/mulch/i.test(name)) name = `${name} Mulch`;
  if (cat === 'Rock' && !/rock|chip|cobble|granite|marble|pebble|stone|obsidian|sunset|creek/i.test(name)) name = `${name} Rock`;
  return name;
}

// Build an index of legacy curated metadata by normalized name so we can
// pull color/description/notes onto matching scraped products.
const legacyByKey = new Map();
for (const item of LEGACY) {
  const key = normalizeName(item.name);
  if (!legacyByKey.has(key)) legacyByKey.set(key, item);
}

// Build the output ───────────────────────────────────────────────────────────

const out = [];
let skippedPond = 0;
let skippedNoPrice = 0;
let skippedCategoryIndex = 0;
let skippedSoldOut = 0;

for (const [key, p] of Object.entries(PRODUCTS)) {
  if (isCategoryIndex(p)) { skippedCategoryIndex++; continue; }
  // Drop pond categories — Lucky doesn't install ponds.
  if (/^pond-/.test(p.sourceCategory || '')) { skippedPond++; continue; }
  if (DROP_SOURCE_CATEGORIES.has(p.sourceCategory) && !p.priceText) { skippedPond++; continue; }

  const parsed = parsePriceText(p.priceText);
  if (!parsed) { skippedNoPrice++; continue; }

  // Try to enrich with legacy metadata (color, description, etc.) by name match
  const legacy = legacyByKey.get(key) || legacyByKey.get(normalizeName(nameFromKey(key, p))) || null;
  if (legacy?.soldOut) { skippedSoldOut++; continue; }

  // Re-categorize items the OS scrape lumped into 'Other' that are actually
  // their own thing on Lucky's quote sheet.
  let category = p.category || 'Other';
  if (p.sourceCategory === 'fire-pits') category = 'Fire Pits';
  // Fireglass + Tumbled Lava Stones are decorative fill the customer picks
  // by color; promote them out of 'Other' into 'Fire Pits' too.
  if (p.sourceCategory === 'fire-pit-burners' && /fireglass|lava\s*stone/i.test(key)) {
    category = 'Fire Pits';
  }

  const name = legacy?.name || nameFromKey(key, p);
  const isInternal = INTERNAL_SOURCE_CATEGORIES.has(p.sourceCategory) && category !== 'Fire Pits';

  const item = {
    name,
    category,
    unit: parsed.unit,
    unitCost: parsed.cost,
    imageUrl: p.image || null,
    supplierUrl: p.url || null,
  };
  if (isInternal) item.isCustomerVisible = false;
  if (legacy?.subcategory) item.subcategory = legacy.subcategory;
  if (legacy?.color) item.color = legacy.color;
  if (legacy?.texture) item.texture = legacy.texture;
  if (legacy?.description) item.description = legacy.description;
  if (legacy?.coveragePerUnit) item.coveragePerUnit = legacy.coveragePerUnit;
  if (legacy?.notes) item.notes = legacy.notes;

  out.push(item);
}

// Dedupe by normalized name within category — picks first occurrence
const seen = new Set();
const deduped = out.filter(item => {
  const k = `${item.category}|${normalizeName(item.name)}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

// Sort: by category, then favorite-ish (mulches first), then alphabetical
const CATEGORY_ORDER = ['Mulch', 'Soil & Amendments', 'Sand & Gravel', 'Rock', 'Boulders', 'Flagstone', 'Pavers', 'Edging', 'Retaining Wall', 'Sod & Seed', 'Fire Pits', 'Other'];
deduped.sort((a, b) => {
  const ca = CATEGORY_ORDER.indexOf(a.category); const cb = CATEGORY_ORDER.indexOf(b.category);
  if (ca !== cb) return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb);
  return a.name.localeCompare(b.name);
});

// Generate the JS module ─────────────────────────────────────────────────────

const banner = [
  '// AUTO-GENERATED — do not edit by hand.',
  '// Source: scripts/build-os-starter-catalog.cjs',
  `// Generated: ${new Date().toISOString().slice(0, 10)}`,
  '//',
  '// One-shot starter import for the catalog after the 030–032 rebuild. The',
  '// catalog page calls importStarterCatalog() to bulk-upsert these items',
  '// against the Outdoor Solutions supplier. After import, run "Refresh',
  '// prices" to fetch live prices/stock from each item\'s supplier_url.',
  '//',
  '// Pond, fire-pit, and water-feature categories are intentionally',
  `// excluded — Lucky doesn't install those. Add by hand if needed.`,
  '',
];

const body = [
  'export const OUTDOOR_SOLUTIONS_STARTER_CATALOG = ',
  JSON.stringify(deduped, null, 2),
  ';',
  '',
  `export const STARTER_CATALOG_COUNT = ${deduped.length};`,
  '',
];

const outPath = path.resolve(__dirname, '../src/lib/outdoorSolutionsStarterCatalog.js');
fs.writeFileSync(outPath, banner.concat(body).join('\n'));

// Summary ────────────────────────────────────────────────────────────────────

const byCategory = {};
for (const i of deduped) byCategory[i.category] = (byCategory[i.category] || 0) + 1;

console.log(`Wrote ${deduped.length} items to ${path.relative(process.cwd(), outPath)}`);
console.log(`Skipped: ${skippedPond} pond/fire, ${skippedNoPrice} no-price, ${skippedCategoryIndex} category indexes, ${skippedSoldOut} sold-out`);
console.log('\nBy category:');
for (const [cat, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(20)} ${n}`);
}
