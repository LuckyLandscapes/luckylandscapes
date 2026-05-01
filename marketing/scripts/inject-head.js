#!/usr/bin/env node
/**
 * Idempotent transformer that runs across all HTML pages.
 *
 *   1. Removes the <div class="preloader" ...> block (we killed the preloader).
 *   2. Injects the shared analytics + preconnect block right before </head>,
 *      using a sentinel comment to avoid double-injection.
 *
 * Re-runnable: if you change the snippet, bump the SENTINEL version and
 * re-run — the old block will be replaced.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SENTINEL_START = '<!-- LL:HEAD-INJECT v2 -->';
const SENTINEL_END = '<!-- LL:HEAD-INJECT-END -->';
// Older sentinel(s) we want to clean up if found.
const SENTINEL_LEGACY = ['<!-- LL:HEAD-INJECT v1 -->'];

const HEAD_BLOCK = `${SENTINEL_START}
    <!-- Preconnect to critical third parties -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" />
    <link rel="preconnect" href="https://www.clarity.ms" />
    <link rel="dns-prefetch" href="https://script.google.com" />
    <link rel="dns-prefetch" href="https://api.geoapify.com" />

    <!-- LUCKY LANDSCAPES site config — paste your real keys here.
         GA4:       analytics.google.com → Admin → Data Streams (format: G-XXXXXXXXXX)
         Clarity:   clarity.microsoft.com → Project → Settings → Setup (10-char string)
         Geoapify:  myprojects.geoapify.com → Free tier 3k req/day → API key (address autocomplete)
         Turnstile: dash.cloudflare.com → Turnstile → New site (anti-bot widget on the quote/contact forms) -->
    <script>
      window.LL_CONFIG = {
        ga4:       'G-Z21C16KEMN ,
        clarity:   'wk50251l6r',
        geoapify:  'bb034a0dcb2d4c91b7daf7e7f2d8665c',
        turnstile: '0x4AAAAAADG09UVeBSCovaYq'
      };
    </script>

    <!-- GA4 loader — only fires when a real ID is set. -->
    <script>
      (function () {
        var id = window.LL_CONFIG && window.LL_CONFIG.ga4;
        if (!id || id.indexOf('XXXX') !== -1) return;
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', id, { anonymize_ip: true });
      })();
    </script>

    <!-- Microsoft Clarity loader — only fires when a real ID is set. -->
    <script>
      (function (c, l, a, r, i, t, y) {
        var id = window.LL_CONFIG && window.LL_CONFIG.clarity;
        if (!id || id.indexOf('XXXX') !== -1) return;
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + id;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script');
    </script>
    ${SENTINEL_END}
`;

async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'source-images' || entry.name === 'public' || entry.name === 'scripts') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(p);
    else if (entry.name.endsWith('.html')) yield p;
  }
}

// Match the entire preloader block: optional leading comment, the outer
// <div class="preloader" id="preloader"> ... and exactly four nested </div>
// closings. Re-runnable so the script is idempotent.
const PRELOADER_RE = /\s*<!--[^>]*?[Pp][Rr][Ee][Ll][Oo][Aa][Dd][Ee][Rr][^>]*?-->\s*(?:<div class="preloader" id="preloader">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)?/g;
const PRELOADER_FALLBACK_RE = /\s*<div class="preloader" id="preloader">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
const ORPHAN_DIV_RE = /\s*<!--[^>]*?[Pp][Rr][Ee][Ll][Oo][Aa][Dd][Ee][Rr][^>]*?-->\s*<\/div>(?=\s*<!--|\s*<nav|\s*<header)/g;
const SENTINEL_RE = new RegExp(`\\s*${SENTINEL_START.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\s\\S]*?${SENTINEL_END}\\s*`, 'g');
const SENTINEL_LEGACY_RES = SENTINEL_LEGACY.map(s => new RegExp(`\\s*${s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\s\\S]*?${SENTINEL_END}\\s*`, 'g'));

async function process(file) {
  const before = await readFile(file, 'utf8');
  let html = before;

  // Remove any prior injection (current sentinel + any legacy versions).
  html = html.replace(SENTINEL_RE, '\n');
  for (const re of SENTINEL_LEGACY_RES) html = html.replace(re, '\n');

  // Strip preloader DOM (and any leftover orphan closing div from prior runs).
  html = html.replace(ORPHAN_DIV_RE, '');
  html = html.replace(PRELOADER_RE, '');
  html = html.replace(PRELOADER_FALLBACK_RE, '');

  // Inject head block right before </head>.
  if (!html.includes(SENTINEL_START)) {
    html = html.replace(/(\s*)<\/head>/, (m, indent) => `\n    ${HEAD_BLOCK}${indent}</head>`);
  }

  if (html !== before) {
    await writeFile(file, html);
    return 'updated';
  }
  return 'unchanged';
}

async function main() {
  let updated = 0, unchanged = 0;
  for await (const f of walkHtml(ROOT)) {
    const result = await process(f);
    const rel = f.replace(ROOT + '/', '');
    console.log(`  ${result.padEnd(10)} ${rel}`);
    if (result === 'updated') updated++;
    else unchanged++;
  }
  console.log(`\nUpdated: ${updated}    Unchanged: ${unchanged}`);
}

main().catch(e => { console.error(e); process.exit(1); });
