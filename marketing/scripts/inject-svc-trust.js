#!/usr/bin/env node
/**
 * Idempotent: inserts a 3-review social-proof strip + the "Four-Leaf Guarantee"
 * band into each service page, immediately before the final <section class="svc-cta">.
 * Service pages previously showed reviews only inside JSON-LD (invisible to humans);
 * organic traffic lands here, so the trust signal belongs on-page.
 *
 * Re-runnable: skips any file that already contains the guarantee band.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const GOOGLE_G = `<svg class="review-google-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>`;

const REVIEWS_STRIP = `        <section class="reviews-section">
            <div class="container">
                <div class="reviews-header reveal">
                    <p class="section-label">What Our Customers Say</p>
                    <h2 class="section-title">Rated 5.0 Across Lincoln, NE</h2>
                    <div class="reviews-overall">
                        <div class="reviews-stars">★★★★★</div>
                        <span class="reviews-rating-text">5.0 ★ · 10+ Google reviews</span>
                    </div>
                </div>
                <div class="reviews-grid stagger-children">
                    <div class="review-card">
                        <div class="review-stars">★★★★★</div>
                        <p class="review-text">"Riley and his crew will create the <strong>yard of your dreams</strong>. My flower beds look amazing!"</p>
                        <div class="review-author">
                            <div class="review-avatar">SS</div>
                            <div><p class="review-name">Sparrow Spaulding</p><p class="review-date">Google review</p></div>
                            ${GOOGLE_G}
                        </div>
                    </div>
                    <div class="review-card">
                        <div class="review-stars">★★★★★</div>
                        <p class="review-text">"They were hard working and did a <strong>great job on our retaining wall</strong>. Great price."</p>
                        <div class="review-author">
                            <div class="review-avatar">JC</div>
                            <div><p class="review-name">Jeff Chapelle</p><p class="review-date">Google review</p></div>
                            ${GOOGLE_G}
                        </div>
                    </div>
                    <div class="review-card">
                        <div class="review-stars">★★★★★</div>
                        <p class="review-text">"Reasonable price. Great experience overall. Quality work — <strong>10/10 recommendation</strong>."</p>
                        <div class="review-author">
                            <div class="review-avatar">DG</div>
                            <div><p class="review-name">Darcie Gallagher-Brandt</p><p class="review-date">Google review</p></div>
                            ${GOOGLE_G}
                        </div>
                    </div>
                </div>
                <div class="reviews-cta" style="text-align:center; margin-top:2.5rem;">
                    <a href="https://www.google.com/maps?cid=2884806323034838689" target="_blank" rel="noopener" class="btn btn-secondary">See All Google Reviews</a>
                </div>
            </div>
        </section>`;

const FOUR_LEAF = `        <section class="guarantee-section">
            <div class="container">
                <div class="guarantee-header reveal">
                    <p class="section-label section-label--light">Our Promise</p>
                    <h2 class="section-title section-title--light">Don't Leave Your Yard to Luck</h2>
                    <p class="guarantee-sub">That's our job. Every project we take on is backed by the Four-Leaf Guarantee.</p>
                </div>
                <div class="guarantee-grid stagger-children">
                    <div class="guarantee-card"><span class="guarantee-leaf">🍀</span><h3>On Time, Every Time</h3><p>We tell you when we'll be there — and we show up.</p></div>
                    <div class="guarantee-card"><span class="guarantee-leaf">🍀</span><h3>Fixed Price, No Surprises</h3><p>A written quote with no hidden fees bolted on at the end.</p></div>
                    <div class="guarantee-card"><span class="guarantee-leaf">🍀</span><h3>Fully Insured</h3><p>Your property is protected from the first day to the last.</p></div>
                    <div class="guarantee-card"><span class="guarantee-leaf">🍀</span><h3>Not Done 'Til You're Happy</h3><p>We walk the finished job with you. If it's not right, we fix it.</p></div>
                </div>
            </div>
        </section>`;

const TARGETS = [
    'services/lawn-care.html', 'services/garden-beds.html', 'services/hardscaping.html',
    'services/drainage.html',
    'services/fencing.html', 'services/property-cleanup.html', 'services/landscape-design.html',
];

const SVC_CTA_RE = /(\n\s*)<section class="svc-cta">/;

let updated = 0, skipped = 0, warned = 0;
for (const rel of TARGETS) {
    const file = join(ROOT, rel);
    const before = await readFile(file, 'utf8');
    if (before.includes('guarantee-section')) {
        console.log(`  skipped    ${rel} (already has trust block)`);
        skipped++;
        continue;
    }
    if (!SVC_CTA_RE.test(before)) {
        console.log(`  ⚠ WARN     ${rel} (no svc-cta section found)`);
        warned++;
        continue;
    }
    const block = `\n${REVIEWS_STRIP}\n\n${FOUR_LEAF}\n`;
    const html = before.replace(SVC_CTA_RE, `${block}$1<section class="svc-cta">`);
    await writeFile(file, html);
    console.log(`  updated    ${rel}`);
    updated++;
}
console.log(`\nUpdated: ${updated}   Skipped: ${skipped}   Warnings: ${warned}`);
