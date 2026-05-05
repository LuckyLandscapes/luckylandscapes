#!/usr/bin/env node
/**
 * One-time SEO cleanup: strip ".html" from URLs declared in HTML files.
 *
 * Cloudflare Pages 308-redirects /foo.html → /foo. Our sitemap, canonical
 * tags, og:url, JSON-LD, and internal hrefs all wrote ".html" URLs, which
 * caused Google Search Console to flag pages as "Page with redirect" and
 * "Alternate page with proper canonical tag" — wasting crawl budget and
 * blocking indexing.
 *
 * This script rewrites the URL declarations in every .html file under
 * marketing/ (root + services + areas + blog) to the clean URL form that
 * Cloudflare actually serves.
 *
 * Idempotent: safe to re-run.
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function walkHtml(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'public') continue;
            files.push(...(await walkHtml(full)));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            files.push(full);
        }
    }
    return files;
}

// Build-time JS files that emit HTML containing URLs — keep these in sync so
// regenerating content pages doesn't reintroduce .html URLs.
const BUILD_SCRIPTS = [
    join(__dirname, 'build-content-pages.js'),
    join(__dirname, 'rewrite-quote.js'),
];

function cleanUrls(text) {
    let out = text;
    let changes = 0;

    // Absolute URLs on our domain: https://luckylandscapes.com/<path>.html → strip .html
    // Lookahead ensures the .html is followed by " ' # ? or ` (URL terminator / template close), not more letters.
    out = out.replace(/(https:\/\/luckylandscapes\.com\/[\w\-/]+)\.html(?=[#"'?`])/g, (_, p1) => {
        changes++;
        return p1;
    });

    // Relative href URLs starting with /: href="/foo.html" → href="/foo"
    out = out.replace(/(href="\/[\w\-/]+)\.html(?=[#"?])/g, (_, p1) => {
        changes++;
        return p1;
    });

    // Template-string interpolations in build scripts: `...${slug}.html` (followed by ` " or `)
    out = out.replace(/(\$\{[\w.]+\})\.html(?=[`"'])/g, (_, p1) => {
        changes++;
        return p1;
    });

    return { out, changes };
}

async function main() {
    const files = [...(await walkHtml(ROOT)), ...BUILD_SCRIPTS];
    let totalChanges = 0;
    let touchedFiles = 0;

    for (const file of files) {
        let before;
        try {
            before = await readFile(file, 'utf8');
        } catch {
            continue; // BUILD_SCRIPTS may not all exist
        }
        const { out, changes } = cleanUrls(before);
        if (changes > 0) {
            await writeFile(file, out, 'utf8');
            console.log(`  ${file.replace(ROOT, '.')}: ${changes} URL(s) cleaned`);
            totalChanges += changes;
            touchedFiles++;
        }
    }

    console.log(`\nDone. ${totalChanges} URL replacements across ${touchedFiles} file(s).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
