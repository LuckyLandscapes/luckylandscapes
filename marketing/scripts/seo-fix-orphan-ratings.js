#!/usr/bin/env node
/**
 * Strip aggregateRating from JSON-LD blocks that don't have a sibling Review
 * array. Preserves the original pretty-print / minified formatting of each
 * block — does a textual splice rather than a parse-and-restringify.
 *
 * Google Search Console flags "Invalid object type for field '<parent_node>'"
 * when aggregateRating sits on a type Google's rich-results validator doesn't
 * accept (Service is not on the list — only Product, LocalBusiness, Recipe,
 * etc.) or when there are no Review nodes to back the aggregate.
 *
 * Our homepage's LocalBusiness has aggregateRating + 3 Review nodes, which is
 * valid; that block stays untouched. Service + area pages had aggregateRating
 * grafted on with no Reviews — strip those.
 *
 * Idempotent: safe to re-run.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
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

function processHtml(html) {
    const blockRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let totalRemoved = 0;

    const out = html.replace(blockRe, (full, body) => {
        // Skip blocks that contain a Review array — those legitimately back
        // their aggregateRating (homepage LocalBusiness).
        if (/"review"\s*:\s*\[/.test(body)) return full;

        // aggregateRating in our codebase is always nested in a parent that
        // already has prior properties — so it has a leading comma. The block
        // only contains scalar key-values, so [^{}]* matches its body cleanly.
        let newBody = body.replace(
            /,\s*"aggregateRating"\s*:\s*\{[^{}]*\}/g,
            () => {
                totalRemoved++;
                return '';
            }
        );

        // Defensive fallback: if it ever ends up first (no leading comma),
        // strip a trailing comma instead.
        newBody = newBody.replace(
            /"aggregateRating"\s*:\s*\{[^{}]*\}\s*,/g,
            () => {
                totalRemoved++;
                return '';
            }
        );

        return `<script type="application/ld+json">${newBody}</script>`;
    });

    return { out, totalRemoved };
}

async function main() {
    const files = await walkHtml(ROOT);
    let totalRemoved = 0;
    let touched = 0;
    for (const file of files) {
        const before = await readFile(file, 'utf8');
        const { out, totalRemoved: n } = processHtml(before);
        if (n > 0) {
            await writeFile(file, out, 'utf8');
            console.log(`  ${file.replace(ROOT, '.')}: ${n} orphan aggregateRating removed`);
            totalRemoved += n;
            touched++;
        }
    }
    console.log(`\nDone. Removed ${totalRemoved} orphan aggregateRating field(s) across ${touched} file(s).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
