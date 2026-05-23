#!/usr/bin/env node
/**
 * Idempotent transformer that syncs the shared "chrome" (top nav, mobile menu,
 * footer, and the sticky mobile CTA bar) across the hand-authored HTML pages so
 * every page matches the homepage. Run after editing the canonical blocks below.
 *
 *   - Nav + mobile menu: adds Blog so it's reachable from every page. Our Team
 *     is intentionally NOT in the nav — it's footer-only (demoted so the site
 *     doesn't lead with the crew). Also fixes the old property-cleanup mobile
 *     "Services" → /quote bug, since the whole menu is replaced.
 *   - Footer: adds the "Service Areas" column + Blog quick link + social icons.
 *   - Sticky mobile CTA: injected before </body> if missing.
 *
 * Skips index.html (its hero nav is transparent `navbar` not `navbar scrolled`,
 * and its footer/sticky bar are already canonical) plus the generated areas/blog
 * pages (those come from build-content-pages.js, which carries the same blocks).
 *
 * Re-runnable: replaces the whole <nav>/<footer> blocks by regex, so formatting
 * differences between pages don't matter and a second run is a no-op.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const NAV = `<nav class="navbar scrolled" id="navbar">
        <div class="container">
            <a href="/" class="nav-logo">
                <img src="/images/Icon.png" alt="Lucky Landscapes Clover" />
                <span class="nav-logo-text">Lucky <span>Landscapes</span></span>
            </a>
            <div class="nav-links">
                <a href="/#about" class="nav-link">About</a>
                <a href="/#services" class="nav-link">Services</a>
                <a href="/gallery" class="nav-link">Gallery</a>
                <a href="/blog/" class="nav-link">Blog</a>
                <a href="/#contact" class="nav-link">Contact</a>
                <a href="/quote" class="btn btn-primary nav-cta">Get a Quote</a>
            </div>
            <button class="nav-toggle" id="nav-toggle" aria-label="Open menu"><span></span><span></span><span></span></button>
        </div>
    </nav>`;

const MOBILE_MENU = `<div class="mobile-menu-overlay" id="mobile-overlay"></div>
    <div class="mobile-menu" id="mobile-menu">
        <a href="/#about" class="mobile-link">About</a>
        <a href="/#services" class="mobile-link">Services</a>
        <a href="/gallery" class="mobile-link">Gallery</a>
        <a href="/blog/" class="mobile-link">Blog</a>
        <a href="/#contact" class="mobile-link">Contact</a>
        <a href="/quote" class="btn btn-primary mobile-cta-btn">Get a Quote</a>
    </div>`;

const FOOTER = `<footer class="footer">
        <div class="container">
            <div class="footer-top">
                <div class="footer-brand">
                    <a href="/" class="footer-logo">
                        <img src="/images/Icon.png" alt="Lucky Landscapes" />
                        <span class="footer-logo-text">Lucky <span>Landscapes</span></span>
                    </a>
                    <p class="footer-tagline">Creating outdoor spaces you'll feel lucky to have.</p>
                </div>
                <div class="footer-nav">
                    <h4>Quick Links</h4>
                    <a href="/#about">About</a>
                    <a href="/#services">Services</a>
                    <a href="/gallery">Gallery</a>
                    <a href="/blog/">Blog</a>
                    <a href="/team">Our Team</a>
                    <a href="/#contact">Contact</a>
                </div>
                <div class="footer-nav">
                    <h4>Service Areas</h4>
                    <a href="/areas/east-lincoln">East Lincoln</a>
                    <a href="/areas/pine-lake">Pine Lake / Stevens Creek</a>
                    <a href="/areas/south-lincoln">South Lincoln</a>
                    <a href="/areas/waverly">Waverly</a>
                </div>
                <div class="footer-nav">
                    <h4>Services</h4>
                    <a href="/services/lawn-care">Lawn Care</a>
                    <a href="/services/garden-beds">Garden &amp; Beds</a>
                    <a href="/services/hardscaping">Hardscaping</a>
                    <a href="/services/fencing">Fencing</a>
                    <a href="/services/property-cleanup">Property Cleanup</a>
                    <a href="/services/landscape-design">Landscape Design</a>
                </div>
                <div class="footer-contact">
                    <h4>Contact</h4>
                    <p>(402) 405-5475</p>
                    <p>rileykopf@luckylandscapes.com</p>
                    <p>Lincoln, NE &amp; Surrounding Areas</p>
                    <div class="footer-social">
                        <a href="https://www.facebook.com/luckylandscapes" aria-label="Facebook"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg></a>
                        <a href="https://www.instagram.com/lucky.landscapes/" aria-label="Instagram"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg></a>
                        <a href="https://www.tiktok.com/@lucky.landscapes" aria-label="TikTok"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg></a>
                        <a href="https://www.youtube.com/@luckylandscapes" aria-label="YouTube"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A21 21 0 0 0 1 12c0 1.8 0 5.45.46 8.58a2.78 2.78 0 0 0 1.94 2 19.79 19.79 0 0 0 8.6.46 21 21 0 0 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 20.65 20.65 0 0 0 .45-3.09 21 21 0 0 0 .45-3.09 20.76 20.76 0 0 0-.45-3.09 20.65 20.65 0 0 0-.45-3.09z" /><polygon points="10 15 16 12 10 9 10 15" /></svg></a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2026 Lucky Landscapes. All rights reserved.</p>
                <div class="footer-bottom-links">
                    <a href="/privacy">Privacy Policy</a>
                    <a href="/terms">Terms of Service</a>
                </div>
            </div>
        </div>
    </footer>`;

const STICKY_CTA = `    <!-- Sticky Mobile CTA Bar -->
    <div class="sticky-mobile-cta" id="sticky-mobile-cta">
        <a href="/quote" class="btn btn-primary">Free Quote</a>
        <a href="tel:+14024055475" class="sticky-phone-link">📞 (402) 405-5475</a>
    </div>
`;

// Pages whose chrome we sync. index.html is intentionally excluded (transparent
// hero nav + already-canonical footer/sticky bar); areas/ and blog/ come from
// build-content-pages.js. privacy/terms get the same treatment so the whole site
// is consistent.
const TARGETS = [
    'quote.html', 'gallery.html', 'team.html', 'careers.html', 'privacy.html', 'terms.html',
    'services/lawn-care.html', 'services/garden-beds.html', 'services/hardscaping.html',
    'services/fencing.html', 'services/property-cleanup.html', 'services/landscape-design.html',
];

const NAV_RE = /<nav class="navbar scrolled"[\s\S]*?<\/nav>/;
const MOBILE_RE = /<div class="mobile-menu-overlay"[\s\S]*?<div class="mobile-menu"[^>]*>[\s\S]*?<\/div>/;
const FOOTER_RE = /<footer class="footer">[\s\S]*?<\/footer>/;

async function process(file) {
    const before = await readFile(file, 'utf8');
    let html = before;
    const issues = [];

    if (NAV_RE.test(html)) html = html.replace(NAV_RE, NAV);
    else issues.push('nav not matched');

    if (MOBILE_RE.test(html)) html = html.replace(MOBILE_RE, MOBILE_MENU);
    else issues.push('mobile-menu not matched');

    if (FOOTER_RE.test(html)) html = html.replace(FOOTER_RE, FOOTER);
    else issues.push('footer not matched');

    if (!html.includes('sticky-mobile-cta')) {
        html = html.replace('</body>', `${STICKY_CTA}\n</body>`);
    }

    if (html !== before) {
        await writeFile(file, html);
        return { status: 'updated', issues };
    }
    return { status: 'unchanged', issues };
}

let updated = 0, unchanged = 0, warned = 0;
for (const rel of TARGETS) {
    const { status, issues } = await process(join(ROOT, rel));
    const warn = issues.length ? `  ⚠ ${issues.join(', ')}` : '';
    if (issues.length) warned++;
    console.log(`  ${status.padEnd(10)} ${rel}${warn}`);
    if (status === 'updated') updated++; else unchanged++;
}
console.log(`\nUpdated: ${updated}   Unchanged: ${unchanged}   Warnings: ${warned}`);
