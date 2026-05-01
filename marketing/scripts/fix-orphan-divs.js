#!/usr/bin/env node
// One-shot fix for the orphan </div> left by an earlier preloader-removal regex
// that didn't account for varying nesting depth across pages. Idempotent and
// safe to re-run — only removes a </div> that is the FIRST non-empty line after
// <body> with nothing else attached to it.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function* walkHtml(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', 'source-images', 'public', 'scripts'].includes(e.name)) continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) yield* walkHtml(p);
        else if (e.name.endsWith('.html')) yield p;
    }
}

const ORPHAN_RE = /(<body>\s*\n)\s*<\/div>\s*\n/;

let fixed = 0;
for await (const f of walkHtml(ROOT)) {
    const html = await readFile(f, 'utf8');
    if (!ORPHAN_RE.test(html)) continue;
    await writeFile(f, html.replace(ORPHAN_RE, '$1'));
    console.log(`  fixed ${f.replace(ROOT + '/', '')}`);
    fixed++;
}
console.log(`\nFixed ${fixed} file(s).`);
