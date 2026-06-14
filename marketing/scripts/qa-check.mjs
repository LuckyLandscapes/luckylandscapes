#!/usr/bin/env node
/**
 * Pre-deploy SEO QA validator. Run AFTER `npm run build` (it scans dist/).
 *
 *   npm run qa          # build first, then run this
 *   node scripts/qa-check.mjs
 *
 * Catches the SEO regressions that actually hurt rankings:
 *   - Broken internal links (404s kill crawl + UX)
 *   - ".html" in declared URLs (GSC flags these as "Page with redirect")
 *   - Malformed JSON-LD (rich results silently disappear)
 *   - Missing <link rel="canonical">
 *   - Sitemap URLs that don't resolve to a real page
 *
 * Exits non-zero if any issue is found, so it can gate a deploy.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
async function exists(p) { try { await stat(p); return true; } catch { return false; } }

// Resolve a site-absolute page path to a dist file (clean-URL aware).
async function resolvesPath(path) {
  let p = path.split('#')[0].split('?')[0];
  if (p === '' || p === '/') return exists(join(DIST, 'index.html'));
  p = p.replace(/^\//, '');
  if (p.endsWith('/')) return exists(join(DIST, p, 'index.html'));
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return exists(join(DIST, p)); // asset with extension
  if (await exists(join(DIST, p + '.html'))) return true;
  if (await exists(join(DIST, p, 'index.html'))) return true;
  return false;
}

if (!await exists(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const files = await walk(DIST);
const problems = [], dotHtml = [], jsonLdBad = [], noCanonical = [], sitemapMisses = [];
const internalTargets = new Map(); // target -> first page that links it

for (const f of files) {
  const html = await readFile(f, 'utf8');
  const rel = relative(DIST, f).replace(/\\/g, '/');

  const can = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!can) noCanonical.push(rel);
  else if (/\.html(\b|$)/.test(can[1])) dotHtml.push(`${rel} canonical=${can[1]}`);

  for (const b of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(b[1]); } catch (e) { jsonLdBad.push(`${rel}: ${e.message}`); }
  }

  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const h = m[1];
    if (/^(https?:|mailto:|tel:|javascript:|data:)/.test(h) || h.startsWith('#') || !h.startsWith('/')) continue;
    if (/\.html(\b|[?#]|$)/.test(h)) dotHtml.push(`${rel} link=${h}`);
    if (/^\/(images|favicon|assets)\//.test(h) || /\.(css|js|png|jpe?g|webp|svg|ico|xml|txt|webmanifest|mp4)$/i.test(h.split('?')[0])) continue;
    if (!internalTargets.has(h)) internalTargets.set(h, rel);
  }
}

for (const [t, from] of internalTargets) if (!await resolvesPath(t)) problems.push(`${t}  (linked from ${from})`);

let sitemapCount = 0;
try {
  const sm = await readFile(join(DIST, 'sitemap.xml'), 'utf8');
  const locs = [...sm.matchAll(/<loc>https:\/\/luckylandscapes\.com([^<]*)<\/loc>/g)].map(m => m[1] || '/');
  sitemapCount = locs.length;
  for (const l of locs) if (!await resolvesPath(l)) sitemapMisses.push(l);
} catch { /* no sitemap */ }

const groups = [
  ['Broken internal links', problems],
  ['.html-in-URL convention violations', dotHtml],
  ['Malformed JSON-LD blocks', jsonLdBad],
  ['Pages missing canonical', noCanonical],
  ['Sitemap URLs not resolving', sitemapMisses],
];
console.log(`Scanned ${files.length} HTML files, ${internalTargets.size} distinct internal links, ${sitemapCount} sitemap urls.\n`);
let total = 0;
for (const [label, arr] of groups) {
  console.log(`${arr.length ? '✗' : '✓'} ${label}: ${arr.length}`);
  arr.slice(0, 25).forEach(x => console.log('     ' + x));
  total += arr.length;
}
console.log(`\n${total === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${total} issue(s) found`}`);
process.exit(total === 0 ? 0 : 1);
