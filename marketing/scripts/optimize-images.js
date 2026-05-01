#!/usr/bin/env node
/**
 * Image optimizer for marketing/public/images/
 *
 * Reads originals from `source-images/` and writes web-ready versions to
 * `public/images/`, preserving the same relative path. Originals stay
 * untouched so we can re-encode later at different sizes.
 *
 * Default profile (override per-folder via PROFILES below):
 *   - max width 1600px (preserve aspect)
 *   - WebP quality 75
 *   - PNGs that look like artwork/logos (small color count) stay PNG
 *
 * Usage:
 *   node scripts/optimize-images.js                # process everything
 *   node scripts/optimize-images.js path/to/file   # process a single file
 *   node scripts/optimize-images.js --force        # re-encode even if dest is fresh
 */

import { readdir, mkdir, stat, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'source-images');
const DEST = join(ROOT, 'public', 'images');

// Per-folder size + quality profile. Falls back to DEFAULT.
const PROFILES = {
    DEFAULT:        { maxW: 1600, q: 75 },
    // Hero/banner images — show large, compress moderately.
    'banner.jpg':   { maxW: 1920, q: 72 },
    // OG card must be exactly 1200x630 (Facebook spec).
    'og-card.png':  { maxW: 1200, maxH: 630, q: 82, format: 'jpeg', renameTo: 'og-card.png' },
    // Logo — used everywhere, keep transparent PNG, small.
    'Icon.png':     { maxW: 512, q: 90, format: 'png' },
    // Project photos — slightly higher quality since they're hero of the gallery.
    landscapedesign:{ maxW: 1600, q: 76 },
    lawncare:       { maxW: 1600, q: 76 },
    retainingwall:  { maxW: 1600, q: 76 },
    fireplace:      { maxW: 1600, q: 76 },
    bricklaying:    { maxW: 1600, q: 76 },
    gardenbed:      { maxW: 1600, q: 76 },
    mulchgardenbeds:{ maxW: 1600, q: 76 },
    megandeck:      { maxW: 1600, q: 76 },
    LawnRestore:    { maxW: 1600, q: 78 },
    team:           { maxW: 900,  q: 80 },
    // Favicons folder — tiny PNGs, copy as-is.
    favicons:       { passthrough: true },
    favicon:        { passthrough: true },
};

const RASTER_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const PASSTHROUGH_EXTS = new Set(['.svg', '.ico', '.gif', '.mp4', '.mov', '.webmanifest']);

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const targets = args.filter(a => !a.startsWith('--'));

function getProfile(relPath) {
    const top = relPath.split('/')[0];
    const file = basename(relPath);
    return PROFILES[file] || PROFILES[top] || PROFILES.DEFAULT;
}

async function* walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(p);
        else yield p;
    }
}

async function processFile(srcPath) {
    const rel = relative(SRC, srcPath);
    const profile = getProfile(rel);
    const ext = extname(srcPath).toLowerCase();
    const destPath = join(DEST, profile.renameTo ? join(dirname(rel), profile.renameTo) : rel);

    await mkdir(dirname(destPath), { recursive: true });

    // Pure passthrough for non-raster assets and explicit folders.
    if (profile.passthrough || PASSTHROUGH_EXTS.has(ext) || !RASTER_EXTS.has(ext)) {
        await copyFile(srcPath, destPath);
        return { src: srcPath, dest: destPath, action: 'copied' };
    }

    if (!FORCE && existsSync(destPath)) {
        const [s, d] = await Promise.all([stat(srcPath), stat(destPath)]);
        // Skip if destination is newer than source AND already smaller.
        if (d.mtimeMs >= s.mtimeMs && d.size < s.size) {
            return { src: srcPath, dest: destPath, action: 'skipped' };
        }
    }

    const srcStat = await stat(srcPath);

    let pipeline = sharp(srcPath, { failOn: 'none' }).rotate(); // honor EXIF orientation
    const meta = await sharp(srcPath, { failOn: 'none' }).metadata();

    const maxW = profile.maxW || 1600;
    const maxH = profile.maxH;
    if ((meta.width && meta.width > maxW) || (maxH && meta.height && meta.height > maxH)) {
        pipeline = pipeline.resize({
            width: maxW,
            height: maxH,
            fit: maxH ? 'cover' : 'inside',
            withoutEnlargement: true,
        });
    }

    // Output format — preserve the destination extension by default.
    const destExt = extname(destPath).toLowerCase();
    const outFormat = profile.format || (destExt === '.png' ? 'png' : destExt === '.jpg' || destExt === '.jpeg' ? 'jpeg' : 'webp');

    if (outFormat === 'webp') {
        pipeline = pipeline.webp({ quality: profile.q ?? 75, effort: 5 });
    } else if (outFormat === 'jpeg') {
        pipeline = pipeline.jpeg({ quality: profile.q ?? 80, mozjpeg: true });
    } else if (outFormat === 'png') {
        // For logos/artwork — palette + max compression.
        pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality: profile.q ?? 90 });
    } else if (outFormat === 'avif') {
        pipeline = pipeline.avif({ quality: profile.q ?? 60, effort: 5 });
    }

    await pipeline.toFile(destPath);
    const destStat = await stat(destPath);

    return {
        src: srcPath,
        dest: destPath,
        action: 'optimized',
        srcBytes: srcStat.size,
        destBytes: destStat.size,
    };
}

function fmt(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function main() {
    if (!existsSync(SRC)) {
        console.error(`source-images/ not found at ${SRC}`);
        console.error(`Drop your high-res originals there, then re-run.`);
        process.exit(1);
    }

    const files = [];
    if (targets.length) {
        for (const t of targets) files.push(t.startsWith('/') ? t : join(SRC, t));
    } else {
        for await (const f of walk(SRC)) files.push(f);
    }

    let totalSrc = 0, totalDest = 0, optimized = 0, copied = 0, skipped = 0, failed = 0;

    for (const f of files) {
        try {
            const r = await processFile(f);
            const rel = relative(ROOT, f);
            if (r.action === 'optimized') {
                optimized++;
                totalSrc += r.srcBytes;
                totalDest += r.destBytes;
                const pct = Math.round((1 - r.destBytes / r.srcBytes) * 100);
                console.log(`  ${rel}  ${fmt(r.srcBytes)} → ${fmt(r.destBytes)}  (-${pct}%)`);
            } else if (r.action === 'copied') {
                copied++;
            } else if (r.action === 'skipped') {
                skipped++;
            }
        } catch (err) {
            failed++;
            console.error(`  FAIL ${relative(ROOT, f)} — ${err.message}`);
        }
    }

    console.log(``);
    console.log(`Optimized: ${optimized}    Copied: ${copied}    Skipped: ${skipped}    Failed: ${failed}`);
    if (totalSrc > 0) {
        const pct = Math.round((1 - totalDest / totalSrc) * 100);
        console.log(`Total: ${fmt(totalSrc)} → ${fmt(totalDest)}  (-${pct}%)`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
