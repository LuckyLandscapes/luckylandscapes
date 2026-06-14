#!/usr/bin/env node
/**
 * Generate the 5 neighborhood-/area-targeted landing pages and 3 seasonal blog
 * posts. Each page gets its own unique body copy (defined in the data below);
 * shared chrome (head, nav, footer) comes from a single template.
 *
 * Re-run safe: this script overwrites the generated files, so edits to the
 * template/data take effect immediately. Don't hand-edit the generated files —
 * change this script and re-run.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
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
            <button class="nav-toggle" id="nav-toggle" aria-label="Open menu">
                <span></span><span></span><span></span>
            </button>
        </div>
    </nav>
    <div class="mobile-menu-overlay" id="mobile-overlay"></div>
    <div class="mobile-menu" id="mobile-menu">
        <a href="/#about" class="mobile-link">About</a>
        <a href="/#services" class="mobile-link">Services</a>
        <a href="/gallery" class="mobile-link">Gallery</a>
        <a href="/contractors" class="mobile-link">For Contractors</a>
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
                    <a href="/contractors">For Contractors</a>
                    <a href="/blog/">Blog</a>
                    <a href="/#contact">Contact</a>
                </div>
                <div class="footer-nav">
                    <h4>Service Areas</h4>
                    <a href="/areas">All Service Areas →</a>
                    <a href="/areas/east-lincoln">East Lincoln</a>
                    <a href="/areas/northwest-lincoln">Northwest Lincoln</a>
                    <a href="/areas/south-lincoln">South Lincoln</a>
                    <a href="/areas/pine-lake">Pine Lake / Stevens Creek</a>
                    <a href="/areas/hickman">Hickman</a>
                    <a href="/areas/waverly">Waverly</a>
                    <a href="/areas/seward">Seward</a>
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
                    <p><a href="tel:+14024055475">(402) 405-5475</a></p>
                    <p><a href="mailto:rileykopf@luckylandscapes.com">rileykopf@luckylandscapes.com</a></p>
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

// Google "G" mark used on review cards (signals these are real Google reviews).
const GOOGLE_G = `<svg class="review-google-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>`;

// Compact 3-review social-proof strip — reused on area pages. The reviews are
// real Google reviews (also marked up in the homepage LocalBusiness schema).
const REVIEWS_STRIP = `
        <section class="reviews-section">
            <div class="container">
                <div class="reviews-header reveal">
                    <p class="section-label">What Our Customers Say</p>
                    <h2 class="section-title">Rated 5.0 Across Lincoln, NE</h2>
                    <div class="reviews-overall">
                        <div class="reviews-stars">★★★★★</div>
                        <span class="reviews-rating-text">5.0 ★ on Google</span>
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

// "Four-Leaf Guarantee" brand band — turns the Lucky/clover name into a memorable
// promise. Reused on area pages + homepage + service pages.
const FOUR_LEAF = `
        <section class="guarantee-section">
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

function head({ title, description, canonical, schemaType, schema, image = 'https://luckylandscapes.com/images/og-card.png' }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:site_name" content="Lucky Landscapes" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" sizes="96x96" />
    <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
    <link rel="shortcut icon" href="/favicon/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
    <link rel="manifest" href="/favicon/site.webmanifest" />
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
    <link rel="stylesheet" href="/styles.css" />
</head>
<body>

    ${NAV}

    <main>`;
}

function pageEnd() {
    return `    </main>

    ${FOOTER}

    <!-- Sticky Mobile CTA Bar -->
    <div class="sticky-mobile-cta" id="sticky-mobile-cta">
        <a href="/quote" class="btn btn-primary">Free Quote</a>
        <a href="tel:+14024055475" class="sticky-phone-link">📞 (402) 405-5475</a>
    </div>

    <script type="module" src="/main.js"></script>
</body>
</html>`;
}

// =====================================================================
// AREA / NEIGHBORHOOD PAGES
// =====================================================================

const AREAS = [
    {
        slug: 'east-lincoln',
        title: 'Landscaping in East Lincoln, NE — Lucky Landscapes',
        description: 'Trusted landscaping, hardscaping, and lawn care for East Lincoln neighborhoods (68506, 68510, 68507). Free estimates, local crew, 24-hour response.',
        h1: 'Landscaping in <em class="highlight">East Lincoln</em>',
        sub: 'Serving East Lincoln neighborhoods from Eastridge and Holmes Lake to Cathedral and Sheridan Boulevard. Mature trees, established yards, and the kind of properties that deserve real care.',
        zips: ['68506', '68510', '68507', '68505'],
        intro: `<p>East Lincoln is one of our favorite parts of town to work in. The mature tree canopy, established gardens, and Holmes Lake-area properties have personality you can't fake — and they need a crew who knows the difference between maintaining what's there and tearing it out to start over.</p>
        <p>From the brick-paved streets near Sheridan Boulevard to the modern builds off South 70th, we've handled everything from weekly mowing to full hardscape rebuilds in this part of the city. We're a local, owner-operated crew based out of Lincoln — when we say we'll be there Tuesday, we'll be there Tuesday.</p>`,
        whyHere: [
            { icon: '🌳', title: 'We respect mature landscapes', text: 'Many East Lincoln yards have 40+ year-old trees and established beds. We trim, mulch, and edge around them — we don\'t bulldoze them.' },
            { icon: '🪨', title: 'Hardscape that fits the neighborhood', text: 'For older brick homes near Sheridan, we match the historic feel with the right paver style. For new builds, we lean modern.' },
            { icon: '⏱️', title: 'No mowing minimum in Lincoln proper', text: 'Unlike some companies, we\'ll quote a single small job. Useful when you just need help with one spring cleanup or a fence-line trim.' },
        ],
        services: ['lawn-care', 'garden-beds', 'hardscaping', 'property-cleanup', 'landscape-design'],
        faqs: [
            { q: 'Do you service homes in the Eastridge / Holmes Lake area?', a: 'Yes — most of our active accounts are within a 10-minute drive of Holmes Lake. We can typically be on-site for an estimate within a day or two.' },
            { q: 'Can you work around mature trees and established beds?', a: 'Absolutely. We do a lot of "selective refresh" work in East Lincoln — keeping what\'s already great, replacing what\'s tired, and re-mulching beds without disturbing root systems.' },
            { q: 'Do you handle HOA-managed properties?', a: 'Yes. We\'ve worked with several HOA-style communities in the area on shared common-area maintenance and per-property service contracts.' },
        ],
    },
    {
        slug: 'pine-lake',
        title: 'Landscaping in Pine Lake & Stevens Creek, Lincoln NE',
        description: 'Premium landscaping, paver patios, and lawn care for Pine Lake, Stevens Creek, and South Pointe homeowners (68516, 68526). Free quotes from a local Lincoln crew.',
        h1: '<em class="highlight">Pine Lake</em> & Stevens Creek Landscaping',
        sub: 'Premium homes deserve a crew that brings the same level of care to your yard. Pine Lake, Stevens Creek, South Pointe, and the surrounding new-build communities are some of our most-requested service areas.',
        zips: ['68516', '68526'],
        intro: `<p>Pine Lake and Stevens Creek are some of the fastest-growing parts of Lincoln, and the landscapes here reflect it — newer builds, larger lots, and homeowners who care about getting it right the first time. That\'s exactly the kind of work we love.</p>
        <p>Whether you\'ve just moved into a new build with a builder-grade lawn that needs real shape, or you\'re upgrading an established yard with a paver patio, retaining wall, or full design-build, we bring the same crew, same standards, and same accountability — owner-operated, locally based, and reachable directly.</p>`,
        whyHere: [
            { icon: '🏡', title: 'Built for new-construction yards', text: 'Builder-installed sod and beds need real attention in their first 2-3 years. We do soil amendment, overseeding, and bed redesign that turns a builder yard into a real landscape.' },
            { icon: '🔥', title: 'Outdoor living spaces are our specialty', text: 'Pine Lake homeowners want patios, fire pits, and outdoor kitchens that match the home. We design and build them to last decades, not seasons.' },
            { icon: '📐', title: 'Bigger lots = bigger possibilities', text: 'Stevens Creek lots often have 1/4 acre+ to play with. We help you use the whole property — not just the front 20 feet.' },
        ],
        services: ['hardscaping', 'landscape-design', 'garden-beds', 'lawn-care'],
        faqs: [
            { q: 'How long does a paver patio install take in Pine Lake?', a: 'Most patios in this area are 200–500 sq ft. Typical timeline is 4–7 working days from base prep to final sealing, depending on size and access.' },
            { q: 'Can you work with my builder\'s sod warranty?', a: 'Yes. We\'ll work around any active warranty period, and we coordinate with the builder if they\'re still doing yard call-backs.' },
            { q: 'Do you service properties at the higher end of South Pointe?', a: 'Yes — South Pointe and the developments around 70th/Pine Lake Road are well within our service area. No trip charge.' },
        ],
    },
    {
        slug: 'south-lincoln',
        title: 'Landscaping in South Lincoln & Yankee Hill, NE',
        description: 'South Lincoln landscaping, paver patios, and lawn care for Yankee Hill, Wilderness Hills, and surrounding 68512 / 68526 neighborhoods. Free local estimates.',
        h1: 'Landscaping in <em class="highlight">South Lincoln</em>',
        sub: 'Yankee Hill, Wilderness Hills, Wilderness Ridge, and the rest of the south side. We know these neighborhoods because we drive them every week.',
        zips: ['68512', '68526', '68516'],
        intro: `<p>South Lincoln has a mix of established and brand-new neighborhoods — Yankee Hill\'s mature subdivisions, Wilderness Hills\' newer streetscapes, and the high-end builds along the south end of 56th and 70th. Every yard here has different needs, and we tailor our approach accordingly.</p>
        <p>If you\'re south of Pine Lake Road, you\'re in our regular service rotation. We don\'t add a trip charge for being on the south side, and we can usually get an estimator out within 24-48 hours of your quote request.</p>`,
        whyHere: [
            { icon: '🌾', title: 'Lawns that handle the wind', text: 'South Lincoln catches the prairie wind harder than the north side. We pick grass varieties and bed plantings that hold up — not the generic stuff a national chain installs everywhere.' },
            { icon: '🚧', title: 'Drainage solutions for sloped lots', text: 'Many Yankee Hill and Wilderness Hills lots have grade changes that cause runoff issues. Retaining walls, French drains, and re-grading are bread-and-butter for us.' },
            { icon: '⚡', title: 'Fast turnaround', text: 'Our crew is based on the south side of town. For most South Lincoln addresses, we can be on-site for measurements within a day.' },
        ],
        services: ['hardscaping', 'landscape-design', 'lawn-care', 'property-cleanup'],
        faqs: [
            { q: 'I have drainage issues on a sloped lot — can you help?', a: 'Yes. We do a lot of regrading, French drains, and retaining walls on the south side. We\'ll come out, look at the slope and water flow, and recommend the right fix.' },
            { q: 'Do you service the Wilderness Ridge area?', a: 'Yes — Wilderness Ridge and Wilderness Hills are both in our regular rotation. We have several active accounts there.' },
            { q: 'How does pricing compare for south Lincoln vs. central?', a: 'Same pricing. We don\'t add a trip charge for being on the south side. The only places where we have a minimum are Beatrice, Seward, and Fairbury (15+ miles out).' },
        ],
    },
    {
        slug: 'waverly',
        title: 'Waverly NE Landscaping & Lawn Care — Lucky Landscapes',
        description: 'Landscaping and hardscaping services for Waverly, NE (68462). $500 minimum project size, local crew based in Lincoln, free estimates.',
        h1: '<em class="highlight">Waverly, NE</em> Landscaping',
        sub: 'Waverly is just a 15-minute drive from Lincoln — close enough that we cover it as part of our regular service area. Lawn care, garden beds, hardscaping, and full design-build, all from a Lincoln-based crew.',
        zips: ['68462'],
        intro: `<p>Waverly is a great little town to work in — quieter, more space, and a different feel than Lincoln proper. We service residential properties throughout the 68462 zip code, including out toward Davey and the rural acreages off Bluff Road.</p>
        <p>Because Waverly is a 15-minute drive from our Lincoln base, we have a small minimum project size to make trips worthwhile — but for any real landscaping, hardscape, or design project, we\'re happy to come out.</p>`,
        whyHere: [
            { icon: '🚜', title: 'Acreage-friendly', text: 'Many Waverly properties are 1+ acres. We have the equipment for larger mowing, brush clearing, and full property cleanups that smaller in-town crews can\'t handle.' },
            { icon: '🛠️', title: 'Hardscape specialists', text: 'Patios, walls, fire pits — Waverly\'s open lots leave room for real outdoor-living projects. We design and build them to look right with the rural-suburban feel.' },
            { icon: '💲', title: '$500 minimum project size', text: 'Because of the drive, we have a $500 minimum on Waverly jobs. Most projects (a paver patio, fall cleanup, mulch refresh, etc.) easily clear that. We don\'t do single mows out here.' },
        ],
        services: ['landscape-design', 'hardscaping', 'garden-beds', 'property-cleanup'],
        faqs: [
            { q: 'Why is there a $500 minimum for Waverly?', a: 'It\'s a 15-minute drive from our Lincoln base. The minimum makes the trip worthwhile and lets us keep our hourly pricing the same as in-town. Most real landscape projects are well above that anyway.' },
            { q: 'Do you mow lawns in Waverly?', a: 'For larger acreages or as part of a multi-service contract, yes. We don\'t do single small-lot weekly mows in Waverly because the drive doesn\'t pencil out — but if you\'re bundling with cleanup or hardscape, we can include it.' },
            { q: 'How quickly can you start a project in Waverly?', a: 'Most cleanup and lawn jobs we can be on-site within the same week. Hardscape and design projects typically start 1-3 weeks out depending on the season and scope.' },
        ],
    },
    {
        slug: 'northwest-lincoln',
        title: 'Landscaping in Northwest Lincoln & The Highlands, NE',
        description: 'Landscaping, lawn care, and hardscaping for Northwest Lincoln — The Highlands, Capitol Beach, Air Park, and Arnold Heights (68521, 68528). Free estimates from a local Lincoln crew.',
        h1: 'Landscaping in <em class="highlight">Northwest Lincoln</em>',
        sub: 'The Highlands, Capitol Beach, Air Park, and Arnold Heights. Golf-course builds, lakefront lots, and open west-side yards that catch every bit of the Nebraska wind.',
        zips: ['68521', '68528'],
        intro: `<p>Northwest Lincoln has more variety than people give it credit for. The Highlands wraps a golf course with newer builds and big open lots; Capitol Beach has lakefront homes with shoreline beds and grade to manage; Air Park and Arnold Heights are established neighborhoods with mature, settled yards. Different streets, different needs — and we work all of them.</p>
        <p>What ties the northwest side together is exposure. There's less tree cover and more open ground out here than in the older central neighborhoods, so the wind hits harder and lawns dry out faster. We pick grasses, plantings, and watering plans that account for that instead of installing the same generic package everywhere.</p>`,
        whyHere: [
            { icon: '💨', title: 'Plantings that handle the wind', text: 'The open northwest-side lots catch the prairie wind and dry out fast. We choose wind- and drought-tolerant grasses and bed plants that hold up here — not the soft stuff that browns out by July.' },
            { icon: '🌊', title: 'Lakefront and slope work at Capitol Beach', text: 'Shoreline beds, grade changes, and erosion control are common around Capitol Beach. Retaining walls, regrading, and the right plantings keep the waterline tidy and the soil where it belongs.' },
            { icon: '🏡', title: 'Turning Highlands builder yards into real landscapes', text: 'New golf-course-area builds come with thin builder sod and bare beds. We do the soil work, shaping, and planting that make a brand-new yard look established.' },
        ],
        services: ['lawn-care', 'hardscaping', 'landscape-design', 'garden-beds'],
        faqs: [
            { q: 'Do you service homes around Capitol Beach?', a: 'Yes. We do shoreline beds, retaining walls, and grade/erosion work around Capitol Beach, plus regular lawn and bed maintenance. The slope and waterline change how we approach planting and drainage, and we plan for it.' },
            { q: 'My Highlands yard is a new build with thin sod — can you help?', a: 'Absolutely. New-build yards in The Highlands are some of our most common projects. We amend the soil, overseed or re-sod weak areas, shape the beds, and plant so the yard actually fills in instead of staying patchy.' },
            { q: 'Is there a trip charge for the northwest side?', a: 'No. The Highlands, Capitol Beach, Air Park, and Arnold Heights are all inside Lincoln and in our regular rotation — same pricing as the rest of the city, no trip charge.' },
        ],
    },
    {
        slug: 'hickman',
        title: 'Hickman, NE Landscaping & Lawn Care — Lucky Landscapes',
        description: 'Landscaping, lawn care, and hardscaping for Hickman, NE (68372) — acreages, new builds, and family yards just south of Lincoln. Free estimates from a local crew.',
        h1: '<em class="highlight">Hickman, NE</em> Landscaping',
        sub: 'Just 15 minutes south of Lincoln, Hickman is a growing family town with bigger lots and room to do things right. We cover it as part of our regular service area.',
        zips: ['68372'],
        intro: `<p>Hickman has grown fast — families moving south for the Norris schools, bigger lots, and a little more breathing room than in-town Lincoln. That mix of new builds and established acreages is exactly the kind of work we like, and at a 15-minute drive from our Lincoln base, we cover Hickman as part of our normal route.</p>
        <p>Bigger lots open up possibilities you don't always have on a tight city lot — a real patio with a fire pit, a proper bed plan around the whole house, room for the kids and still a yard that looks designed. We help Hickman homeowners use the whole property, not just the strip by the front door.</p>`,
        whyHere: [
            { icon: '🚜', title: 'Equipped for bigger lots and acreages', text: 'Many Hickman properties run from a generous suburban lot to a full acreage. We have the equipment for larger mowing, brush clearing, and full-property cleanups that smaller in-town crews can\'t take on.' },
            { icon: '🏡', title: 'New-build yard transformations', text: 'A lot of Hickman homes are recent builds with builder-grade sod and empty beds. We do the soil work, planting, and shaping that turn a blank new yard into a finished landscape.' },
            { icon: '🔥', title: 'Outdoor living with room to spread out', text: 'Patios, fire pits, retaining walls — Hickman\'s larger lots leave space for real outdoor-living projects. We design and build them to fit the property and last for decades.' },
        ],
        services: ['lawn-care', 'hardscaping', 'landscape-design', 'property-cleanup'],
        faqs: [
            { q: 'Is there a minimum project size for Hickman?', a: 'For most work, no — Hickman is close enough (about 15 minutes) that we treat it like the rest of our service area. We can include regular mowing, especially on larger lots or as part of a maintenance plan.' },
            { q: 'How quickly can you get out for an estimate in Hickman?', a: 'Usually within a day or two. We\'re already running jobs on the south side of Lincoln most days, so swinging down to Hickman for a measurement is easy to fit in.' },
            { q: 'Do you mow larger Hickman lots and acreages?', a: 'Yes. Larger lots and acreages are a good fit for our equipment, whether it\'s regular mowing, a one-time overgrowth knock-down, or a full-property cleanup.' },
        ],
    },
    {
        slug: 'seward',
        title: 'Seward, NE Landscaping & Hardscaping — Lucky Landscapes',
        description: 'Paver patios, retaining walls, landscape design, and cleanups for Seward, NE (68434). A Lincoln-based crew serving Seward for project work, with a small minimum. Free estimates.',
        h1: '<em class="highlight">Seward, NE</em> Landscaping & Hardscaping',
        sub: 'About 25 minutes west of Lincoln, Seward is a town we serve for project work — patios, walls, design-build, and cleanups. A small project minimum keeps the trip worthwhile.',
        zips: ['68434'],
        intro: `<p>Seward is a great town — the Concordia University campus, classic established homes near downtown, and newer builds spreading out around the edges. It's about 25 minutes west of our Lincoln base, so we focus our Seward work on real projects: hardscaping, design-build, bed installs, and cleanups, rather than weekly small-lot mowing.</p>
        <p>For a paver patio, a retaining wall, a full bed redesign, or a property cleanup, the drive is no problem and our pricing stays the same as in Lincoln. A small project minimum (below) just makes sure a trip to Seward is worth the windshield time for both of us.</p>`,
        whyHere: [
            { icon: '🪨', title: 'Project work is worth the drive', text: 'Patios, walls, walkways, and design-build are what we come to Seward for. A real hardscape or landscape project easily justifies the 25-minute trip, and you get the same crew and standards as our Lincoln jobs.' },
            { icon: '🏛️', title: 'Established-home landscaping', text: 'The older homes near downtown and Concordia have character worth matching. We pick paver styles and plantings that fit an established Seward property instead of dropping in a generic suburban package.' },
            { icon: '💲', title: 'A small project minimum', text: 'Because Seward is a 25-minute drive, we ask for a $750 minimum on Seward jobs. Most hardscape, design, and cleanup projects clear that easily — it just keeps the trip worthwhile so our pricing can stay the same as in town.' },
        ],
        services: ['hardscaping', 'landscape-design', 'garden-beds', 'property-cleanup'],
        faqs: [
            { q: 'Why is there a minimum for Seward?', a: 'Seward is about 25 minutes from our Lincoln base, so we ask for a $750 project minimum to make the trip worthwhile and keep our pricing the same as in town. Most patios, walls, bed installs, and cleanups are well above that minimum anyway.' },
            { q: 'Do you mow lawns in Seward?', a: 'Generally not as a standalone weekly service — the drive doesn\'t pencil out for a single small mow. But we can include mowing as part of a larger maintenance plan or alongside a hardscape or cleanup project.' },
            { q: 'How far out do you schedule Seward projects?', a: 'Cleanups can usually happen within a week or two. Hardscape and design-build projects typically start one to three weeks out depending on the season and the scope of the work.' },
        ],
    },
];

// =====================================================================
// CONTENT COMPONENT HELPERS
// Reusable building blocks for richer post bodies. Defined BEFORE the POSTS
// array so post `body` template literals can call them inline, e.g.
//   ${callout({ type: 'warning', title: '…', body: '<p>…</p>' })}
//   ${table({ headers: [...], rows: [[...]] })}
// =====================================================================

function slugify(s) {
    return String(s)
        .replace(/<[^>]+>/g, '')
        .replace(/&[a-z]+;/gi, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const CALLOUT_ICONS = { tip: '💡', warning: '⚠️', info: 'ℹ️', cost: '💲', local: '📍' };

// Styled aside box. `type` ∈ tip|warning|info|cost|local. `body` is raw HTML.
function callout({ type = 'tip', title = '', body = '' }) {
    const icon = CALLOUT_ICONS[type] || CALLOUT_ICONS.tip;
    return `
        <aside class="callout callout--${type}">
            <span class="callout-icon" aria-hidden="true">${icon}</span>
            <div class="callout-body">${title ? `<p class="callout-title">${title}</p>` : ''}${body}</div>
        </aside>`;
}

// Responsive data/comparison table. On mobile it stacks into labeled rows via
// the data-label attributes (styled in styles.css).
function table({ caption = '', headers = [], rows = [] }) {
    const head = headers.map(h => `<th>${h}</th>`).join('');
    const body = rows.map(r => `<tr>${r.map((c, i) => {
        const label = headers[i] ? headers[i].replace(/<[^>]+>/g, '') : '';
        return `<td data-label="${label}">${c}</td>`;
    }).join('')}</tr>`).join('');
    return `
        <div class="post-table-wrap">
            <table class="post-table">${caption ? `
                <caption>${caption}</caption>` : ''}
                <thead><tr>${head}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>`;
}

// Word count + estimated reading time (220 wpm) from a post body's text.
function postStats(post) {
    const text = String(post.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    const minutes = Math.max(1, Math.round(words / 220));
    return { words, minutes };
}

// Inject id="" anchors on every <h2> in a body and return the table-of-contents
// entries. Anchors power the sticky TOC + jump links. Slugs are de-duped.
function buildToc(body) {
    const toc = [];
    const seen = {};
    const html = body.replace(/<h2(\s[^>]*?)?>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
        const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        let id = slugify(text) || 'section';
        if (seen[id] != null) { seen[id] += 1; id = `${id}-${seen[id]}`; } else { seen[id] = 0; }
        toc.push({ id, text });
        return `<h2 id="${id}"${attrs || ''}>${inner}</h2>`;
    });
    return { html, toc };
}

// Format an ISO date (YYYY-MM-DD) as "Month D, YYYY" without timezone drift.
function fmtDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
}

// og:image must be a raster (SVG is unreliable as a social card across platforms),
// so when a post's on-page hero is a generated .svg we fall back to the brand card.
function ogImageFor(post) {
    return post.image && !post.image.endsWith('.svg')
        ? `https://luckylandscapes.com${post.image}`
        : 'https://luckylandscapes.com/images/og-card.png';
}

// =====================================================================
// HERO ILLUSTRATIONS (generated branded SVG, one per post)
// Deterministic flat-vector scenes in the brand palette — no photos, no
// external assets, no licensing. Same output every build (index-based math,
// no Math.random / dates), so the .svg files don't churn in git.
// =====================================================================

const THEMES = {
    bright: { sky: ['#BFE3F2', '#E9F6FB'], sun: 'gold',  hills: ['#B5CFA0', '#8FAF72', '#5A7A40'] },
    warm:   { sky: ['#F8E7C6', '#FCF5E6'], sun: 'gold',  hills: ['#B5CFA0', '#8FAF72', '#5A7A40'] },
    autumn: { sky: ['#F4DCAE', '#FBEFD6'], sun: 'amber', hills: ['#CBB073', '#A98C42', '#6F6A38'] },
    winter: { sky: ['#CAD8E6', '#EDF3F9'], sun: 'pale',  hills: ['#DCE6EE', '#C2D2DE', '#A9BCC9'] },
    rain:   { sky: ['#BFCAD3', '#DCE5EC'], sun: 'cloud', hills: ['#9FB58A', '#7C9A63', '#52703B'] },
};

const POST_VISUALS = {
    'spring-lawn-care-checklist-lincoln-ne':   { theme: 'bright', motif: 'mower' },
    'paver-patio-cost-lincoln-ne':             { theme: 'warm',   motif: 'pavers' },
    'when-to-overseed-lawn-lincoln-ne':        { theme: 'bright', motif: 'seed' },
    'above-ground-pool-base-prep-lincoln-ne':  { theme: 'warm',   motif: 'pool' },
    'fall-cleanup-checklist-lincoln-ne':       { theme: 'autumn', motif: 'leaves' },
    'how-to-choose-a-landscaper-lincoln-ne':   { theme: 'warm',   motif: 'checklist' },
    'mulch-vs-rock-lincoln-ne':                { theme: 'warm',   motif: 'mulchrock' },
    'retaining-wall-cost-lincoln-ne':          { theme: 'warm',   motif: 'wall' },
    'fence-cost-lincoln-ne':                   { theme: 'bright', motif: 'fence' },
    'landscaping-cost-lincoln-ne':             { theme: 'warm',   motif: 'plan' },
    'sod-vs-seed-lincoln-ne':                  { theme: 'bright', motif: 'sodseed' },
    'best-grass-seed-nebraska':                { theme: 'bright', motif: 'grass' },
    'wet-yard-drainage-lincoln-ne':            { theme: 'rain',   motif: 'drainage' },
    'native-drought-tolerant-plants-nebraska': { theme: 'warm',   motif: 'prairie' },
    'winterizing-landscape-lincoln-ne':        { theme: 'winter', motif: 'winter' },
    'lawn-mowing-cost-lincoln-ne':             { theme: 'bright', motif: 'mower' },
    'paver-patio-vs-concrete-lincoln-ne':      { theme: 'warm',   motif: 'pavers' },
    'fire-pit-cost-lincoln-ne':                { theme: 'warm',   motif: 'wall' },
    'modern-landscape-design-lincoln-ne':      { theme: 'warm',   motif: 'plan' },
    'sod-installation-cost-lincoln-ne':        { theme: 'bright', motif: 'sodseed' },
    'when-to-plant-trees-shrubs-nebraska':     { theme: 'autumn', motif: 'prairie' },
    'fence-types-compared-lincoln-ne':         { theme: 'bright', motif: 'fence' },
};

function visualFor(slug) {
    const m = POST_VISUALS[slug] || { theme: 'warm', motif: 'grass' };
    return { ...THEMES[m.theme], motif: m.motif };
}

// ---- small reusable shapes ----
function svgClover(x, y, s, fill, op = 1) {
    return `<g transform="translate(${x},${y}) scale(${s})" opacity="${op}" fill="${fill}"><circle cx="0" cy="-7" r="7"/><circle cx="-7" cy="0" r="7"/><circle cx="7" cy="0" r="7"/><circle cx="0" cy="7" r="7"/><rect x="-1.5" y="6" width="3" height="15" rx="1.5"/></g>`;
}
function svgCloud(x, y) {
    return `<g fill="#AEB9C2"><ellipse cx="${x}" cy="${y}" rx="72" ry="40"/><ellipse cx="${x - 56}" cy="${y + 12}" rx="50" ry="32"/><ellipse cx="${x + 58}" cy="${y + 14}" rx="54" ry="32"/></g>`;
}
function svgBlade(x, y, h, w, fill, lean = 0) {
    const tx = x + lean;
    return `<path d="M${x - w},${y} Q${x - w * 0.4},${y - h * 0.55} ${tx},${y - h} Q${x + w * 0.4},${y - h * 0.55} ${x + w},${y} Z" fill="${fill}"/>`;
}
function svgLeaf(x, y, s, fill, rot) {
    return `<g transform="translate(${x},${y}) rotate(${rot})"><path d="M0,${-s} C${s * 0.85},${-s * 0.4} ${s * 0.85},${s * 0.4} 0,${s} C${-s * 0.85},${s * 0.4} ${-s * 0.85},${-s * 0.4} 0,${-s} Z" fill="${fill}"/><line x1="0" y1="${-s}" x2="0" y2="${s}" stroke="#00000022" stroke-width="1.5"/></g>`;
}
function svgFlower(x, y, petal, center) {
    let p = '';
    for (let k = 0; k < 10; k++) p += `<ellipse cx="0" cy="-16" rx="5" ry="14" fill="${petal}" transform="rotate(${k * 36})"/>`;
    return `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="74" stroke="#5A7A40" stroke-width="5"/>${p}<circle r="9" fill="${center}"/></g>`;
}

function svgMotif(motif) {
    switch (motif) {
        case 'mower':
            return `<g opacity="0.5"><polygon points="0,640 1200,610 1200,662 0,700" fill="#C2DDA8"/><polygon points="0,678 1200,652 1200,704 0,724" fill="#7FA85B"/></g>
  <g transform="translate(470,560)"><line x1="120" y1="20" x2="206" y2="-46" stroke="#3C3C3C" stroke-width="9" stroke-linecap="round"/><rect x="10" y="18" width="132" height="56" rx="10" fill="#5A7A40"/><rect x="24" y="30" width="58" height="20" rx="4" fill="#E0B84C"/><circle cx="38" cy="84" r="20" fill="#2D4A22"/><circle cx="122" cy="84" r="20" fill="#2D4A22"/><circle cx="38" cy="84" r="8" fill="#8FAF72"/><circle cx="122" cy="84" r="8" fill="#8FAF72"/></g>`;
        case 'pavers': {
            let rows = '';
            for (let r = 0; r < 5; r++) {
                const y = 572 + r * 34, inset = 70 - r * 14, pw = (1060 - inset * 2) / 6, off = (r % 2) * (pw / 2);
                for (let c = -1; c < 6; c++) rows += `<rect x="${inset + c * pw + off}" y="${y}" width="${pw - 7}" height="28" rx="3" fill="#DAC9A6" stroke="#B59C72" stroke-width="2"/>`;
            }
            return rows;
        }
        case 'seed': {
            let s = '';
            for (let i = 0; i < 46; i++) { const x = 60 + (i * 131 % 1080), y = 600 + (i * 73 % 130); s += `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="#B98A2E" transform="rotate(${i * 40 % 360} ${x} ${y})"/>`; }
            for (let i = 0; i < 11; i++) s += svgBlade(110 + i * 100, 700, 44 + (i * 53 % 28), 6, '#5A7A40', (i % 3 - 1) * 6);
            return s;
        }
        case 'pool': {
            let base = '';
            for (let i = 0; i < 30; i++) base += `<circle cx="${258 + (i * 121 % 690)}" cy="${602 + (i * 53 % 92)}" r="3" fill="#A89B7E"/>`;
            return `<rect x="240" y="588" width="720" height="118" rx="14" fill="#C9BCA0"/><g opacity="0.5">${base}</g><ellipse cx="600" cy="588" rx="320" ry="86" fill="#B9C3CA"/><ellipse cx="600" cy="580" rx="300" ry="74" fill="#4FA3C7"/><ellipse cx="600" cy="574" rx="300" ry="66" fill="#6FBBD8"/><path d="M330,574 q120,30 270,30 q150,0 270,-30" stroke="#CDEAF4" stroke-width="6" fill="none" opacity="0.7"/>`;
        }
        case 'leaves': {
            const cols = ['#C9772E', '#D89B3A', '#9C5B2A', '#B5832F', '#7C8A3A'];
            let lv = '';
            for (let i = 0; i < 12; i++) lv += svgLeaf(90 + (i * 113 % 1040), 180 + (i * 157 % 470), 18, cols[i % cols.length], i * 57 % 360);
            return lv;
        }
        case 'checklist': {
            let rows = '';
            for (let i = 0; i < 4; i++) rows += `<g transform="translate(28,${64 + i * 40})"><rect width="26" height="26" rx="6" fill="#fff" stroke="#8FAF72" stroke-width="3"/><path d="M5,13 l6,7 l11,-15" stroke="#5A7A40" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="42" y="6" width="${204 - i * 20}" height="12" rx="6" fill="#CFC4A8"/></g>`;
            return `<g transform="translate(440,498)"><rect x="0" y="20" width="320" height="212" rx="14" fill="#F1ECDD" stroke="#CFC4A8" stroke-width="3"/><rect x="120" y="6" width="80" height="34" rx="8" fill="#5A7A40"/>${rows}</g>`;
        }
        case 'mulchrock': {
            let mulch = '';
            for (let i = 0; i < 18; i++) { const x = 140 + (i * 153 % 400), y = 600 + (i * 61 % 110); mulch += `<line x1="${x}" y1="${y}" x2="${x + 26}" y2="${y + 8}" stroke="#5E3E22" stroke-width="4" stroke-linecap="round"/>`; }
            let rock = '';
            for (let i = 0; i < 22; i++) rock += `<circle cx="${670 + (i * 137 % 400)}" cy="${602 + (i * 71 % 108)}" r="${10 + (i % 3) * 4}" fill="#8E969B"/>`;
            return `<rect x="120" y="585" width="430" height="135" rx="10" fill="#7A5230"/><g opacity="0.6">${mulch}</g><rect x="650" y="585" width="430" height="135" rx="10" fill="#AEB4B8"/><g>${rock}</g><g transform="translate(600,560)"><rect x="-4" y="0" width="8" height="62" fill="#5A7A40"/><ellipse cx="0" cy="0" rx="26" ry="12" fill="#6B8E4E" transform="rotate(-30)"/><ellipse cx="0" cy="0" rx="26" ry="12" fill="#6B8E4E"/><ellipse cx="0" cy="0" rx="26" ry="12" fill="#6B8E4E" transform="rotate(30)"/></g>`;
        }
        case 'wall': {
            let blocks = '';
            for (let c = 0; c < 4; c++) { const y = 600 + c * 34, off = (c % 2) * 42; for (let i = 0; i < 8; i++) blocks += `<rect x="${120 + off + i * 84}" y="${y}" width="78" height="30" rx="4" fill="#CDB98E" stroke="#A88F5F" stroke-width="2"/>`; }
            return `<path d="M600,540 L1130,520 L1130,720 L600,720 Z" fill="#7FA85B"/>${blocks}<g transform="translate(180,575)"><rect x="-4" y="0" width="8" height="26" fill="#5A7A40"/><ellipse cx="0" cy="-4" rx="20" ry="9" fill="#6B8E4E" transform="rotate(-25)"/><ellipse cx="0" cy="-4" rx="20" ry="9" fill="#6B8E4E" transform="rotate(25)"/></g>`;
        }
        case 'fence': {
            let pk = '';
            for (let i = 0; i < 16; i++) { const x = 70 + i * 72, fill = i % 2 ? '#B98A52' : '#C49560'; pk += `<rect x="${x}" y="560" width="46" height="150" rx="4" fill="${fill}" stroke="#8A6334" stroke-width="2"/><path d="M${x},560 L${x + 23},538 L${x + 46},560 Z" fill="${fill}" stroke="#8A6334" stroke-width="2"/>`; }
            return `<rect x="40" y="600" width="1130" height="16" fill="#8A6334" opacity="0.55"/><rect x="40" y="668" width="1130" height="16" fill="#8A6334" opacity="0.55"/>${pk}`;
        }
        case 'plan': {
            let grid = '';
            for (let i = 0; i < 13; i++) grid += `<line x1="${270 + i * 52}" y1="478" x2="${270 + i * 52}" y2="712"/>`;
            for (let i = 0; i < 5; i++) grid += `<line x1="258" y1="${490 + i * 46}" x2="942" y2="${490 + i * 46}"/>`;
            return `<g transform="rotate(-4 600 600)"><rect x="250" y="470" width="700" height="250" rx="10" fill="#F6F2E7" stroke="#CFC4A8" stroke-width="3"/><g stroke="#DCD3BA" stroke-width="1.5">${grid}</g><g fill="none" stroke="#6B8E4E" stroke-width="3"><circle cx="370" cy="560" r="34"/><circle cx="370" cy="560" r="18" stroke-dasharray="3 4"/><circle cx="520" cy="640" r="26"/><circle cx="760" cy="560" r="40"/><path d="M760,520 v80 M720,560 h80 M732,532 l56,56 M788,532 l-56,56"/><rect x="600" y="600" width="120" height="80" rx="10" stroke-dasharray="6 5"/></g></g>`;
        }
        case 'sodseed': {
            let rolls = '';
            for (let i = 0; i < 3; i++) { const y = 590 + i * 44; rolls += `<rect x="120" y="${y}" width="360" height="30" rx="14" fill="#7A5230"/><rect x="120" y="${y - 6}" width="360" height="16" rx="8" fill="#6E9A4E"/><ellipse cx="120" cy="${y + 9}" rx="10" ry="18" fill="#5E3E22"/><ellipse cx="120" cy="${y + 3}" rx="9" ry="9" fill="#5A7A40"/>`; }
            let seeds = '';
            for (let i = 0; i < 34; i++) seeds += `<ellipse cx="${670 + (i * 149 % 400)}" cy="${602 + (i * 67 % 108)}" rx="4" ry="2.5" fill="#C9A84E"/>`;
            let spr = '';
            for (let i = 0; i < 8; i++) spr += svgBlade(690 + i * 48, 700, 30, 5, '#6E9A4E');
            return `${rolls}<rect x="650" y="585" width="430" height="135" rx="10" fill="#7A5230"/><g>${seeds}</g>${spr}`;
        }
        case 'grass': {
            const cols = ['#8FAF72', '#6B8E4E', '#5A7A40', '#7FA85B'];
            let g = '';
            for (let i = 0; i < 62; i++) g += svgBlade(15 + i * 19.5, 745, 78 + (i * 53 % 72), 7, cols[i % 4], (i % 5 - 2) * 9);
            return g;
        }
        case 'drainage': {
            let rain = '';
            for (let i = 0; i < 14; i++) rain += `<line x1="${360 + i * 40}" y1="${210 + (i * 37 % 40)}" x2="${346 + i * 40}" y2="${250 + (i * 37 % 40)}" stroke="#7FA8C4" stroke-width="5" stroke-linecap="round" opacity="0.8"/>`;
            let grate = '';
            for (let i = 0; i < 4; i++) grate += `<rect x="${16 + i * 32}" y="14" width="14" height="52" rx="6" fill="#30353A"/>`;
            return `${svgCloud(560, 150)}${rain}<ellipse cx="540" cy="662" rx="300" ry="58" fill="#6FA3C0" opacity="0.85"/><ellipse cx="540" cy="654" rx="250" ry="42" fill="#8FBFD6" opacity="0.7"/><g transform="translate(820,610)"><rect x="0" y="0" width="150" height="80" rx="10" fill="#5A6168"/>${grate}</g><path d="M540,614 q140,-6 270,16" stroke="#8FBFD6" stroke-width="8" fill="none" opacity="0.7"/>`;
        }
        case 'prairie': {
            let g = '';
            for (let c = 0; c < 7; c++) { const cx = 90 + c * 165; for (let i = 0; i < 6; i++) g += svgBlade(cx + i * 8 - 20, 722, 92 + ((c * 13 + i * 7) % 50), 6, '#7FA85B', (i - 3) * 9); }
            g += svgFlower(250, 612, '#9B72B8', '#5A3E1E');
            g += svgFlower(620, 628, '#E0B84C', '#5A3E1E');
            g += svgFlower(900, 612, '#9B72B8', '#5A3E1E');
            return g;
        }
        case 'winter': {
            let flakes = '';
            for (let i = 0; i < 42; i++) flakes += `<circle cx="${40 + (i * 149 % 1130)}" cy="${120 + (i * 97 % 560)}" r="${2 + i % 3}" fill="#ffffff" opacity="0.9"/>`;
            return `<path d="M0,600 Q360,565 740,595 T1200,585 L1200,750 L0,750 Z" fill="#F4F8FB"/><g transform="translate(560,470)"><rect x="-12" y="60" width="24" height="150" rx="6" fill="#6B4F32"/><g stroke="#6B4F32" stroke-width="10" stroke-linecap="round" fill="none"><path d="M0,90 q-40,-20 -70,-60"/><path d="M0,110 q40,-16 78,-54"/><path d="M0,140 q-34,-14 -58,-44"/><path d="M0,150 q34,-12 60,-40"/></g></g>${flakes}`;
        }
        default:
            return '';
    }
}

function heroSvg(v) {
    const [sky1, sky2] = v.sky, [h1, h2, h3] = v.hills;
    const sun = v.sun === 'cloud' ? svgCloud(905, 150)
        : v.sun === 'pale' ? `<circle cx="950" cy="180" r="60" fill="#F0F5FA"/>`
        : `<circle cx="955" cy="178" r="92" fill="${v.sun === 'amber' ? '#D89B3A' : '#E0B84C'}" opacity="0.14"/><circle cx="955" cy="178" r="64" fill="${v.sun === 'amber' ? '#D89B3A' : '#E0B84C'}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750" preserveAspectRatio="xMidYMid slice" role="img">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>
  <rect width="1200" height="750" fill="url(#sky)"/>
  ${sun}
  <path d="M0,470 Q300,410 620,455 T1200,445 L1200,750 L0,750 Z" fill="${h1}"/>
  <path d="M0,545 Q360,495 700,535 T1200,525 L1200,750 L0,750 Z" fill="${h2}"/>
  <path d="M0,615 Q400,580 740,610 T1200,600 L1200,750 L0,750 Z" fill="${h3}"/>
  ${svgMotif(v.motif)}
  ${svgClover(72, 690, 1.5, '#1E3516', 0.16)}
</svg>
`;
}

// =====================================================================
// BLOG POSTS
// =====================================================================

const POSTS = [
    {
        slug: 'spring-lawn-care-checklist-lincoln-ne',
        title: 'Spring Lawn Care Checklist for Lincoln, NE (2026)',
        description: 'A practical spring lawn care checklist for Lincoln, Nebraska homeowners. What to do in March, April, and May — and what to skip.',
        h1: 'The Spring <em class="highlight">Lawn Care Checklist</em> for Lincoln, NE',
        sub: 'A practical month-by-month guide. Skip the influencer YouTube videos shot in Florida — this is what actually works for cool-season grasses in Nebraska.',
        date: '2026-03-18',
        category: 'Lawn Care',
        image: '/images/lawncare/2.webp',
        imageAlt: 'Freshly mowed and edged Lincoln, NE lawn in early spring',
        takeaways: [
            'Late March: do nothing but plan — walking dormant, semi-frozen turf does more harm than the cleanup helps.',
            'Pre-emergent crabgrass control must go down before the soil hits 55°F — usually the first or second week of April here.',
            'First mow at 3.5″ once the grass is 4–5″ tall; save fertilizing and overseeding for early May, not before.',
        ],
        body: `
        <p>Lincoln lawns are mostly cool-season grass — Kentucky bluegrass, fine fescue, perennial ryegrass, sometimes a tall fescue blend. That\'s great news because cool-season grass loves spring. The window from late March to early June is when your lawn does most of its visible growing for the entire year.</p>
        <p>It\'s also when the most damage gets done by overzealous homeowners. Below is what we actually do — and skip — on the lawns we maintain.</p>

        <h2>Late March: Wait. Seriously, wait.</h2>
        <p>The single biggest mistake we see in Lincoln yards is people trying to do "spring cleanup" the first 60° day in March. The ground is still semi-frozen, the grass crowns are dormant, and walking on the turf compacts the soil and breaks dormant blades.</p>
        <p>What to do in late March: walk the property, take photos of problem areas, plan. Don\'t rake. Don\'t mow. Don\'t fertilize.</p>

        <h2>Early to mid April: First real cleanup</h2>
        <p>Once the soil firms up and you\'re consistently above freezing at night, it\'s safe to start. Order of operations:</p>
        <ol>
            <li><strong>Light raking.</strong> Use a leaf rake (not a metal thatch rake) to clear dead leaves and matted thatch. Heavy thatch raking on a still-recovering lawn is too aggressive — wait until May for that.</li>
            <li><strong>Edge beds and walkways.</strong> Crisp edges make the whole property look intentional even before the grass fully greens up.</li>
            <li><strong>Apply pre-emergent.</strong> This is the deadline-sensitive one. Pre-emergent stops crabgrass before it germinates — but it has to go down BEFORE the soil hits 55°F. In Lincoln, that\'s typically the first or second week of April. Miss that window and you\'re fighting crabgrass all summer.</li>
        </ol>

        <h2>Late April: First mow</h2>
        <p>Wait for the grass to be 4-5 inches tall, then mow it down to about 3.5 inches. Don\'t scalp it — the rule of thumb is never cut more than 1/3 of the blade height in a single mow. A scalped lawn in April is a thin lawn in July.</p>
        <p>Mower blade should be sharp. A dull blade tears the grass instead of cutting it, which leaves a yellowish-brown haze across your lawn for a week. We sharpen ours at the start of every season.</p>

        <h2>Early May: Fertilize and overseed</h2>
        <p>Now you can fertilize. We use a slow-release nitrogen blend at 1 lb of N per 1,000 sq ft. Avoid the high-nitrogen "weed and feed" products — they push too much top growth, which weakens roots heading into summer.</p>
        <p>If you have thin spots, this is also a good time to overseed. Tall fescue blends do well in Lincoln; pure Kentucky bluegrass takes longer to establish but looks beautiful once it does. Water lightly twice a day for 2-3 weeks until germination. Spring isn\'t actually the ideal time to overseed in Lincoln, though — for why fall almost always wins, see <a href="/blog/when-to-overseed-lawn-lincoln-ne">when to overseed your lawn in Lincoln</a>.</p>

        <h2>Mid May: Aerate (every 2-3 years)</h2>
        <p>Lincoln\'s heavy clay soil compacts hard. Core aeration (the kind that pulls actual plugs out) once every 2-3 years lets oxygen, water, and fertilizer reach roots. We pair aeration with overseeding — the holes give the new seed somewhere protected to germinate.</p>

        <h2>What to skip in spring</h2>
        <ul>
            <li><strong>Heavy power-raking / dethatching.</strong> Wait until late May at earliest if you have real thatch buildup. Most Lincoln lawns don\'t need it.</li>
            <li><strong>Aggressive pesticide application.</strong> Spot-treat dandelions and clover after the lawn has fully greened up; broad-spectrum applications in April hit beneficial insects before they\'re needed.</li>
            <li><strong>Mowing too short.</strong> A 2-inch lawn in spring will be a 1-inch lawn under summer drought stress. Keep it at 3.5 inches.</li>
        </ul>

        <h2>Want us to handle it?</h2>
        <p>Lucky Landscapes does spring cleanups across Lincoln, including pre-emergent application, first mow, edge work, and overseeding. We typically book up by the second week of April so don\'t wait if you want it done before the season gets ahead of you. When the leaves start dropping, the same crew handles the other big seasonal job — see our <a href="/blog/fall-cleanup-checklist-lincoln-ne">fall yard cleanup checklist</a>.</p>
        `,
        related: ['lawn-care'],
    },
    {
        slug: 'paver-patio-cost-lincoln-ne',
        title: 'How Much Does a Paver Patio Cost in Lincoln, NE? (2026)',
        description: 'Real 2026 pricing for paver patios in Lincoln, Nebraska. Materials, labor, and what affects the final number — from a local landscaping crew.',
        h1: 'How Much Does a <em class="highlight">Paver Patio</em> Cost in Lincoln, NE?',
        sub: 'Honest, current pricing — not the lowballed range you\'ll see on national-chain calculators.',
        date: '2026-04-13',
        category: 'Hardscaping',
        image: '/images/bricklaying/1.webp',
        imageAlt: 'Newly installed paver patio in Lincoln, Nebraska',
        takeaways: [
            'A small standard-paver patio runs $20–$28 per sq ft installed in 2026; premium outdoor-living spaces run $45–$70+.',
            'Price swings most on material, base depth, demolition, pattern, and access — not the pavers themselves.',
            'A bid far below the rest almost always cut the base, fabric, or polymeric sand — and the patio heaves by year 3.',
        ],
        body: `
        <p>The internet will tell you a paver patio costs "$10–$25 per square foot." That\'s technically true and totally useless. The real answer for Lincoln, Nebraska in 2026 looks more like this:</p>

        <h2>The short version</h2>
        ${table({
            caption: 'Installed paver patio pricing — Lincoln, NE (2026)',
            headers: ['Patio tier', 'Installed price', 'Example total'],
            rows: [
                ['<strong>Small / basic</strong><br><span class="post-table-note">Under 200 sq ft, simple shape, standard concrete pavers</span>', '$20–$28 / sq ft', '150 sq ft ≈ <strong>$3,000–$4,200</strong>'],
                ['<strong>Mid-size</strong><br><span class="post-table-note">200–400 sq ft, interlocking or natural stone, some demolition</span>', '$28–$40 / sq ft', '300 sq ft ≈ <strong>$8,400–$12,000</strong>'],
                ['<strong>Premium</strong><br><span class="post-table-note">500+ sq ft, custom shapes, seat walls or fire features</span>', '$45–$70+ / sq ft', '600 sq ft ≈ <strong>$27,000–$42,000+</strong>'],
            ],
        })}
        <p>Those are real Lincoln numbers based on what we actually charge in 2026, not ranges scraped from Texas blogs.</p>
        ${callout({ type: 'warning', title: 'The cheap-bid trap', body: '<p>If a quote comes in 30% under everyone else, the contractor saved that money somewhere you can\'t see — usually a shallower base, no geotextile fabric, or cheap joint sand. The patio looks identical the first season, then heaves after a hard freeze. Always ask a low bidder about base depth, fabric, and polymeric sand.</p>' })}

        <h2>Why the range is so wide</h2>
        <p>Six factors swing the price more than anything else:</p>

        <h3>1. Material choice</h3>
        <p>Standard concrete pavers (e.g. Holland or rectangle) are the cheapest at around $2.50–$4 per sq ft for materials. Interlocking pavers run $4–$8. Natural stone (flagstone, bluestone) jumps to $10–$20 per sq ft just for the material. Travertine and porcelain run even higher.</p>

        <h3>2. Site prep and demolition</h3>
        <p>Building on dirt and grass is the easiest case — we strip sod, dig down 8 inches, compact the base, and lay pavers. Building over an old concrete slab adds $4–$8 per sq ft for breaking and hauling away the concrete. A sloped or wet site adds drainage work that can be $500–$2,000 on its own.</p>

        <h3>3. Base depth (this is where bad contractors save money)</h3>
        <p>Lincoln\'s freeze-thaw cycle is brutal on patios that aren\'t built on a deep, properly compacted base. We do 6 inches of compacted Class 5 base under residential patios and 8+ inches under any patio that\'ll see vehicle traffic. A patio built on a shallow base looks fine for 2 years and starts heaving in year 3.</p>

        <h3>4. Pattern and edging</h3>
        <p>A simple running-bond pattern is fast to lay. Herringbone takes longer because of all the cuts. Custom curved edges with a soldier course (vertical edge pavers) add another 10-15% in labor. The pattern decision changes the final number by a few hundred to a few thousand dollars.</p>

        <h3>5. Add-ons</h3>
        <p>Sealing the patio at the end protects it and brings out color — adds $1.50–$3 per sq ft. Polymeric joint sand (instead of regular sand) adds $1 per sq ft and prevents weeds and insect damage. A built-in seat wall adds $50–$100 per linear foot. A fire pit adds $1,500–$5,000 depending on materials.</p>

        <h3>6. Access</h3>
        <p>Backyard patios that require us to wheelbarrow material through a narrow gate cost more than driveway-adjacent installs. Severely limited access can add $3–$6 per sq ft in labor. We\'ll always tell you up front if access is going to bump the price.</p>

        <h2>What we never compromise on</h2>
        <p>Some Lincoln contractors will quote you 30% below us by skipping the geotextile fabric, going thinner on the base, or using cheaper polymeric sand. The patio looks identical for the first season. Then it starts to settle, weeds push through the joints, and pavers shift after a hard freeze. By year 4 you\'re paying again to have it rebuilt.</p>
        <p>If you get a quote that\'s dramatically below the ranges above, ask the contractor about base depth, fabric, and what kind of polymeric sand they use. Their answers will tell you everything. If you\'re comparing several bids, our guide on <a href="/blog/how-to-choose-a-landscaper-lincoln-ne">how to choose a landscaper in Lincoln</a> lists the exact questions that expose a cut-rate base.</p>

        <h2>What you actually need to give us a real quote</h2>
        <ol>
            <li>Approximate dimensions (length × width is fine).</li>
            <li>What\'s there now (grass, old concrete, gravel, etc.).</li>
            <li>Material preference, even if it\'s just "I like the natural-stone look" or "concrete is fine."</li>
            <li>Photos of the area, especially showing access from the driveway.</li>
        </ol>
        <p>That\'s enough for us to send a written estimate within 24 hours, including options at three price points so you can see exactly where the trade-offs are. Most of our patio work is in south and east Lincoln and the newer <a href="/areas/pine-lake">Pine Lake and Stevens Creek</a> neighborhoods, but we build them citywide.</p>
        `,
        faqs: [
            { q: 'How much does a paver patio cost in Lincoln, NE?', a: 'In 2026, a small standard-paver patio runs about $20–$28 per sq ft installed — so a 150 sq ft patio is roughly $3,000–$4,200. Mid-size patios run $28–$40 per sq ft, and premium 500+ sq ft outdoor living spaces with seat walls or fire features run $45–$70+ per sq ft.' },
            { q: 'Why are some paver patio quotes so much cheaper?', a: 'Almost always because they cut the base. A patio built on a shallow base, without geotextile fabric, or with cheap joint sand looks identical for one season, then heaves and shifts after Lincoln\'s freeze-thaw winters. Ask any low bidder about base depth, fabric, and polymeric sand.' },
            { q: 'How deep should the base be for a patio in Lincoln?', a: 'We use 6 inches of compacted Class 5 base under residential patios and 8+ inches under anything that sees vehicle traffic, compacted in lifts over geotextile fabric. Lincoln\'s freeze-thaw cycle is brutal on shallow bases.' },
            { q: 'What do you need to give me a paver patio quote?', a: 'Approximate dimensions, what is there now (grass, old concrete, gravel), a material preference, and a few photos showing access from the driveway. That is enough for a written estimate within 24 hours.' },
        ],
        related: ['hardscaping'],
    },
    {
        slug: 'when-to-overseed-lawn-lincoln-ne',
        title: 'When to Overseed Your Lawn in Lincoln, NE (Spring vs. Fall)',
        description: 'When to overseed your lawn in Lincoln, Nebraska — and why fall almost always beats spring for cool-season grasses. Practical guide from a local crew.',
        h1: 'When to <em class="highlight">Overseed</em> Your Lawn in Lincoln, NE',
        sub: 'Most homeowners overseed in spring. Most homeowners are wrong. Here\'s when to actually do it — and how to make it work either way.',
        date: '2026-03-09',
        category: 'Lawn Care',
        image: '/images/LawnRestore/after.webp',
        imageAlt: 'Thick, restored cool-season lawn after overseeding in Lincoln',
        takeaways: [
            'Fall (Aug 20–Sep 20) beats spring for overseeding cool-season grass: roughly 85% survival vs. ~50%.',
            'If you overseed in spring, you give up pre-emergent crabgrass control on that area — you can only pick one.',
            'Whenever you do it: core-aerate first, use a tall fescue / Kentucky bluegrass blend, and keep the top inch of soil damp for two weeks.',
        ],
        body: `
        <p>If you\'ve got thin patches in your yard, the gut reaction is to throw seed down the next nice spring weekend. That\'s the most common time people overseed in Lincoln. It\'s also the wrong time — usually.</p>

        <h2>Why fall beats spring (for cool-season grass)</h2>
        <p>Lincoln lawns are almost all cool-season grass: Kentucky bluegrass, fine fescue, perennial ryegrass, sometimes tall fescue. Cool-season grass loves two seasons: spring and fall. But the difference matters:</p>
        <ul>
            <li><strong>Fall (mid-August through September):</strong> Soil is still warm from summer, but air temps are dropping. Days are shorter. Crabgrass and other annual weeds are dying off. New seedlings have 6-8 weeks to establish before frost — and they have zero competition. Survival rate: ~85%+.</li>
            <li><strong>Spring (April):</strong> Soil is still cold, weeds are about to explode, and your new grass has 6-8 weeks before summer heat-stress hits. Survival rate: ~50% in a normal year, less in a hot/dry year. You also can\'t use pre-emergent herbicide because it kills new grass seed too — so you\'re trading weed control for the overseed.</li>
        </ul>
        <p>That\'s why almost every professional lawn-care company in Nebraska does the bulk of their overseeding in late August through mid-September.</p>

        <h2>If you\'re going to do it in spring anyway</h2>
        <p>Sometimes you have to. Maybe you have a damaged area you can\'t live with for another four months. Here\'s how to give spring overseeding the best shot:</p>
        <ol>
            <li><strong>Wait for soil temps above 55°F.</strong> In Lincoln this is usually the second to third week of April. Use a soil thermometer; air temp is misleading.</li>
            <li><strong>Skip the pre-emergent.</strong> If you overseed, you cannot apply pre-emergent crabgrass control to that area in the same spring. Pick one. (You can use post-emergent broadleaf herbicide later — just keep pre-emergent off the seeded area.)</li>
            <li><strong>Core aerate first.</strong> Core aeration creates 2-3" deep holes that protect seed from being washed away or eaten by birds. Drop seed immediately after aerating.</li>
            <li><strong>Use the right blend.</strong> A tall fescue / perennial rye blend germinates fastest (5-10 days) and is the most heat-tolerant. Pure Kentucky bluegrass is gorgeous but takes 14-21 days and won\'t survive June if it\'s a hot year.</li>
            <li><strong>Water shallow and frequent.</strong> Twice a day for 5-10 minutes for the first two weeks. The top inch of soil must stay damp — if it dries out for even half a day, germination drops to nothing.</li>
            <li><strong>Don\'t mow until the new grass hits 4 inches.</strong> Then take only the top inch off. Three weeks of patience.</li>
        </ol>

        <h2>The fall sweet spot</h2>
        <p>For Lincoln, the prime overseeding window is <strong>August 20 through September 20</strong>. By the end of September, soil temperatures are dropping and germination slows considerably. By October you\'re fighting the calendar.</p>
        <p>If you can wait, that\'s the time. Six weeks of cool nights, warm soil, and zero summer competition. You\'ll get a noticeably better result for the same effort.</p>

        <h2>The hybrid approach we use</h2>
        <p>For our maintenance customers with thin lawns, we usually do a light spring overseed (just to fill the worst spots so they\'re not bare for summer) and then a heavy fall overseed when conditions are ideal. Two passes, and the lawn is in dramatically better shape by the second spring. A light spring overseed pairs naturally with the rest of a <a href="/blog/spring-lawn-care-checklist-lincoln-ne">spring lawn care routine</a>; the heavy pass belongs in fall.</p>

        <h2>What seed to use in Lincoln</h2>
        <p>For most Lincoln yards we recommend a tall fescue / Kentucky bluegrass blend, roughly 70/30. The tall fescue gives you fast establishment and drought tolerance; the bluegrass fills in over time and gives you the dark green you actually want to look at. Pure ryegrass is a bad idea long-term — it\'s a short-lived perennial that thins out fast.</p>
        <p>We use Lebanon Pro brand for our customer overseeds. It\'s available retail at most Lincoln nurseries (Campbell\'s, Earl May, etc.) — about $80-110 per 50-pound bag, which covers roughly 7,500 square feet at a normal overseed rate.</p>

        <h2>Want us to handle the fall overseed?</h2>
        <p>Most of our overseeding clients book in July for a late-August service window. If your lawn is thin and you don\'t want to deal with it yourself, get a quote and we\'ll add you to the schedule. Overseeding is usually one piece of a larger <a href="/blog/fall-cleanup-checklist-lincoln-ne">fall cleanup</a> — we often bundle the two on the same visit.</p>
        `,
        related: ['lawn-care'],
    },
    {
        slug: 'above-ground-pool-base-prep-lincoln-ne',
        title: 'Above-Ground Pool Base Prep in Lincoln, NE — The Real Guide',
        description: 'How to properly prep the ground for an above-ground pool in Lincoln, Nebraska. Screenings vs. sand, base depth, level tolerance, and what most installers skip.',
        h1: 'Above-Ground Pool <em class="highlight">Base Prep</em> in Lincoln, NE',
        sub: 'The base under your pool is doing more work than the pool itself. Here\'s how we actually build it — and what big-box installers leave out.',
        date: '2026-05-12',
        category: 'Hardscaping',
        image: '/images/bricklaying/2.webp',
        imageAlt: 'Leveled, compacted aggregate base prepared for an above-ground pool',
        takeaways: [
            'Level matters more than anything: target within 1/2″ across the whole pool, not the manufacturer\'s 1″ maximum.',
            'Build on compacted 1/4-minus screenings with a thin concrete-sand top — never play sand or mason sand.',
            'Strip the sod and topsoil first, and set a 16″ patio block under each leg as cheap insurance against sinking.',
        ],
        body: `
        <p>A 24-foot above-ground pool full of water weighs north of 60,000 pounds. That entire weight sits on a thin liner, which sits on whatever you put under it. If the base is uneven, bumpy, or the wrong material, the pool wall pulls sideways, the legs sink unevenly, and the liner tears or wrinkles where it shouldn\'t.</p>
        <p>The pool manual gives you a one-paragraph prep instruction that assumes you know what "level" actually means at this scale. Most homeowners and big-box delivery crews don\'t. So here\'s the real guide for Lincoln, Nebraska — what materials to use, how deep to go, and what we do on every pool prep we get hired for.</p>

        <h2>How level does it really need to be?</h2>
        <p>Pool manufacturers (Intex, Bestway, Coleman) say "within 1 inch across the diameter." That\'s the absolute outer limit before the pool fails. The real target is <strong>within 1/2 inch</strong>. Here\'s why:</p>
        <ul>
            <li>A 1-inch slope across a 24-foot round pool with the liner full of water puts about <strong>1,400 lbs of lateral force</strong> on the lower side of the wall. That force shows up as a bulge after a few weeks and a frame failure within a season.</li>
            <li>1/2 inch is the sweet spot — barely visible, well within what a transit level can verify, and stable for the life of the pool.</li>
            <li>You can\'t eyeball this. The ground always <em>looks</em> level. Use a 2x4 with a long level on it (rotate around the center pin), a transit, or a laser level rented from Home Depot.</li>
        </ul>

        <h2>The wrong way (which everyone does)</h2>
        <p>The default DIY pool prep in Lincoln looks like:</p>
        <ol>
            <li>Pick the flattest-looking spot in the yard.</li>
            <li>Skim some grass off with a shovel.</li>
            <li>Spread a couple bags of "play sand" or "mason sand" from the hardware store.</li>
            <li>Set the pool up and fill it.</li>
        </ol>
        <p>Every step of that is wrong, and the pool will fail within 1–2 summers. Here\'s why and what we do instead.</p>

        <h2>Step 1: Strip the sod and topsoil</h2>
        <p>Grass and topsoil are organic. They\'ll decompose under the pool over the season, the volume shrinks, and the surface goes uneven. We strip 2–3 inches down to firm subsoil over an area about 2 feet larger than the pool diameter (so for a 24\' pool, prep a 26\' circle).</p>
        <p>If your subsoil is the typical Lincoln heavy clay, that\'s actually great news — clay compacts well and resists pumping water. If you hit something softer (old fill, sandy backfill), the base layer needs to be thicker to compensate.</p>

        <h2>Step 2: Grade level</h2>
        <p>This is where most installs go wrong. We grade with a transit or laser level, working from the center pin outward in 4-foot increments. The target is dead flat — no bow, no dish, no slope. If one side is high we cut into it; we never build it up with loose soil because loose soil compresses.</p>
        <p>It\'s tedious. A proper 24\' pool grade takes 2–3 hours of just leveling. Most homeowners give it 20 minutes and then wonder why the pool wall starts pulling.</p>

        <h2>Step 3: Compacted screenings base (the critical step)</h2>
        <p>Over the level subsoil we lay 2 inches of <strong>1/4-minus screenings</strong> (also called crusher fines, or sometimes "stone dust" depending on the supplier). Screenings are tiny crushed limestone particles that lock together when compacted. They\'re the same material we use as the top course under a paver patio for exactly the same reason — they create a dense, stable, water-permeable surface.</p>
        <p>We compact in two lifts (1 inch at a time) with a plate compactor, water-spraying between passes so the particles bind tightly. The finished base is hard enough that a heavy boot leaves no print.</p>
        <p>You can buy screenings at any Lincoln aggregate yard. Outdoor Solutions in Roca, Stewart Sand & Materials, or Frontier Stone all carry it — typically $35–$45 per yard. A 24\' pool needs about 1.5–2 yards.</p>

        <h2>Step 4: The sand top layer — and why mason sand is wrong</h2>
        <p>On top of the compacted screenings goes a thin (1/2 to 1 inch) layer of <strong>concrete sand</strong> — sometimes called paver sand or leveling sand. Not mason sand. Not play sand. Not all-purpose sand. <strong>Concrete sand specifically.</strong></p>
        <p>Why it matters:</p>
        <ul>
            <li><strong>Mason sand</strong> is too fine. It doesn\'t compact, drains too fast, and shifts under the pool liner. After a wet summer, mason sand under a pool turns into a slurry that leaves footprints, wrinkles, and visible imprints of every leg.</li>
            <li><strong>Play sand</strong> has the same problem plus rounded particles that never lock.</li>
            <li><strong>Concrete sand</strong> has angular, varied particle sizes that lock together when compacted. It supports the liner without shifting and gives a smooth surface without being slippery.</li>
        </ul>
        <p>This single choice — concrete sand vs. mason sand — is the difference between a pool base that looks perfect for 5+ years and one that gets visible footprints after a single summer. Pool manufacturers (Intex, Bestway, Coleman) all specify concrete or "leveling" sand in the fine print of their installation guides for exactly this reason. Most homeowners never read past the first paragraph.</p>

        <h2>Step 5: Optional patio block pads under each leg</h2>
        <p>For long-term peace of mind we recommend 16"x16" pre-cast concrete patio blocks under each pool leg (typically 6–8 blocks for an 18–24\' round). Cost: about $3 each at Menards.</p>
        <p>Why they matter: the pool legs concentrate the structure\'s weight on tiny contact points. Even on a perfect base, those points can punch down 1/2 inch over a wet summer. A 16x16 block spreads that load and stops the legs from sinking. We set each block level with the surrounding sand surface — you should not be able to feel the blocks through the liner once the pool is set.</p>
        <p>This step is "optional" but it\'s $30 of insurance against a $200 leveling fix in year 2. We always recommend it.</p>

        <h2>Common mistakes we see in Lincoln yards</h2>
        <ul>
            <li><strong>Using a tarp on grass.</strong> Some installation guides say to lay a tarp and the pool on grass directly. Don\'t. The grass dies, decomposes, and the base becomes uneven within 30 days.</li>
            <li><strong>"It\'s only a kiddie pool, it doesn\'t matter."</strong> Even a 12-foot 30-inch-deep round pool holds 1,800 gallons — about 15,000 lbs. The physics doesn\'t care about your kid.</li>
            <li><strong>Setting up on a slope and shimming the legs.</strong> Shims under pool legs always fail. The pool wall has to be plumb at the base; shimming creates a torque load that pulls the wall sideways.</li>
            <li><strong>Skipping the compaction step.</strong> Loose screenings settle 15–20% under load. The pool will be level on day 1 and out of level by week 3.</li>
        </ul>

        <h2>Want us to handle it?</h2>
        <p>Pool prep is a half-day to full-day job for our crew depending on yard slope, pool size, and how much excavation is needed. We bundle it with paver walks around the pool or with a fence install if you\'re doing those at the same time, but we\'re happy to quote it standalone.</p>
        <p>Most pool buyers in Lincoln contact us in late April or May — early enough that we can fit the prep ahead of pool delivery. If you\'ve already bought the pool and it\'s sitting in a box, give us a call and we\'ll come out for a free quote.</p>
        `,
        related: ['hardscaping', 'fencing'],
    },
    {
        slug: 'fall-cleanup-checklist-lincoln-ne',
        title: 'Fall Yard Cleanup Checklist for Lincoln, NE (2026)',
        description: 'A month-by-month fall yard cleanup checklist for Lincoln, Nebraska. Leaf strategy, final mow height, the most important fertilizer feeding of the year, and when to schedule.',
        h1: 'The Fall <em class="highlight">Yard Cleanup Checklist</em> for Lincoln, NE',
        sub: 'September through November, in order. What actually matters for cool-season lawns in Nebraska — and the one fall task that does more for your grass than everything you did in spring combined.',
        date: '2026-04-07',
        category: 'Lawn Care',
        image: '/images/lawncare/4.webp',
        imageAlt: 'Autumn leaf cleanup on a maintained Lincoln, NE property',
        takeaways: [
            'Fall is the most important season for a Lincoln lawn — and the one most people half-do.',
            'The single highest-value task all year is the mid-October nitrogen feeding; skip it and you lose next spring\'s color.',
            'Mulch-mow light leaves, rake heavy mats before they smother the grass, and drop the final cut to 2.5–3″.',
        ],
        body: `
        <p>Fall is the most important season for a Lincoln lawn, and it\'s the one most people half-do. The grass out here is cool-season — Kentucky bluegrass, fescue, perennial rye — which means it\'s actively building roots in the fall while everyone\'s assuming the growing year is over. What you do (and don\'t do) from September through November sets up how your lawn looks the entire next year.</p>
        <p>Here\'s the order we work in on the properties we maintain. It\'s built around Lincoln\'s actual frost timing — our average first frost is mid-October, give or take, and the season is functionally over by Thanksgiving.</p>

        <h2>September: The real work month</h2>
        <p>September is when the heavy lifting happens, because the soil is still warm but the air has cooled off. This is the window cool-season grass loves most.</p>
        <ol>
            <li><strong>Overseed thin spots (early-to-mid September).</strong> If your lawn thinned out over the summer, this is the time — soil is warm, weeds are dying off, and seedlings have weeks to establish before frost. We cover the timing in detail in our <a href="/blog/when-to-overseed-lawn-lincoln-ne">guide to overseeding in Lincoln</a>, but the short version: fall beats spring almost every time, and the window closes around September 20.</li>
            <li><strong>Core aerate (pair it with overseeding).</strong> Lincoln\'s clay soil compacts hard over a summer of foot traffic and heat. Pulling cores lets air, water, and seed reach the root zone. If you\'re overseeding, aerate first and drop seed into the holes.</li>
            <li><strong>Keep mowing — don\'t drop the height yet.</strong> Hold at about 3.5 inches through September. The grass is still growing and still needs leaf area to feed the roots it\'s building.</li>
        </ol>

        <h2>October: Leaves and the most important feeding of the year</h2>
        <h3>The leaf strategy nobody tells you</h3>
        <p>Lincoln\'s mature tree canopy — especially on the east side and the older central neighborhoods — drops a lot of leaves, and most of them come down in a three-to-four week stretch in October. You do not have to bag every one of them.</p>
        <ul>
            <li><strong>A light scattering of leaves?</strong> Mulch-mow them. Run the mower over them once or twice and the shredded bits fall between the grass blades and break down into free organic matter. This genuinely improves your soil over a few years.</li>
            <li><strong>A heavy blanket that mats down and hides the grass?</strong> That has to come off. Wet matted leaves smother the lawn, block light, and invite snow mold over winter. Once the layer is thick enough that you can\'t see grass through it, mulching isn\'t enough — rake or blow it out.</li>
            <li><strong>The mistake:</strong> letting a heavy leaf layer sit "until they\'re all down." By the time the last leaf falls, the grass underneath the early pile has been smothered for a month. Do it in two or three passes through October instead of one big cleanup in November.</li>
        </ul>
        <h3>Fall fertilization — the single highest-value lawn task of the year</h3>
        <p>If you do one thing for your lawn all year, make it the fall nitrogen feeding. In the fall, cool-season grass pours its energy into roots and crown reserves instead of top growth. Feed it now and it stores that nitrogen all winter, then explodes green and thick first thing next spring — without the surge of soft, disease-prone top growth that a spring feeding causes.</p>
        <p>Timing: we apply a slow-release nitrogen blend in <strong>mid-October</strong>, roughly 1 lb of N per 1,000 sq ft, while the grass is still green and actively growing. This matters more than your spring fertilizer. It\'s the closest thing to a cheat code in lawn care, and most homeowners skip it because the yard "looks done" by then.</p>

        <h2>Late October / early November: Perennials and beds</h2>
        <ul>
            <li><strong>Cut back the perennials that need it — leave the ones that don\'t.</strong> Floppy, disease-prone, or mushy perennials (peonies, hostas, daylilies, anything with powdery mildew) get cut to a few inches once they\'ve died back. But leave ornamental grasses, coneflowers, black-eyed Susans, and sedum standing — they hold winter interest, the seed heads feed birds, and the stems catch insulating snow over the crown. You can cut those in spring.</li>
            <li><strong>Pull spent annuals and weed the beds one last time.</strong> A weed pulled in November is a few hundred weeds you don\'t fight in May.</li>
            <li><strong>Refresh mulch on exposed beds.</strong> A 2-3 inch layer insulates roots through Lincoln\'s freeze-thaw swings and stops winter heaving on shallow-rooted plants. Don\'t pile it against trunks or stems.</li>
            <li><strong>Clean and store, or have us haul the debris.</strong> All the cut material, leaves, and spent annuals need to go somewhere. A full fall cleanup is exactly the kind of project where it makes sense to <a href="/services/property-cleanup">have a crew handle the haul-off</a> rather than filling 30 paper yard-waste bags yourself.</li>
        </ul>

        <h2>The final mow: when to stop</h2>
        <p>Your last mow of the year should be a little shorter than your summer height — drop to about <strong>2.5 to 3 inches</strong> for the final cut or two. Tall grass laid over by snow mats down and breeds snow mold; slightly shorter grass going into winter avoids that. Don\'t scalp it, though — going below 2 inches exposes the crowns to winter desiccation.</p>
        <p>When do you actually stop? When the grass stops growing — usually <strong>early-to-mid November</strong> in Lincoln, once nighttime temps are consistently below freezing and you\'ve gone a couple weeks without needing to cut. Mowing dormant, frosted grass just tears it up. Make sure the last cut leaves the lawn clean and leaf-free.</p>

        <h2>Don\'t forget the non-lawn stuff</h2>
        <ul>
            <li><strong>Clean the gutters after the leaves are down</strong> — clogged gutters in a Lincoln winter mean ice dams and water backing up under the roofline.</li>
            <li><strong>Disconnect and drain hoses</strong> before the first hard freeze so spigots and lines don\'t crack.</li>
            <li><strong>Cut back and re-edge bed lines</strong> so the property looks intentional all winter, not just abandoned until spring.</li>
        </ul>

        <h2>When to schedule</h2>
        <p>Fall cleanups bunch up fast — everyone wants theirs done in the same three-week leaf-drop window in October. We start booking fall cleanups in <strong>September</strong>, and the prime late-October slots fill first. If you want the leaves gone, the beds put to bed, and that all-important fall feeding done on time, get on the schedule early rather than calling the week before Thanksgiving when the ground\'s already freezing.</p>
        <p>Lucky Landscapes handles full fall cleanups across Lincoln — leaf removal, final mow, bed cutback, mulch refresh, fall fertilization, and haul-off — and we travel to Waverly and the surrounding towns for larger fall cleanup projects too. Get a quote and we\'ll get you on the calendar before the rush.</p>
        `,
        faqs: [
            { q: 'When should I do fall yard cleanup in Lincoln, NE?', a: 'Work through October in two or three passes rather than one big November cleanup. Lincoln\'s average first frost is mid-October and the season is functionally over by Thanksgiving, so don\'t let a heavy leaf layer sit and smother the lawn.' },
            { q: 'What is the most important fall lawn task?', a: 'Fall nitrogen fertilization in mid-October — about 1 lb of N per 1,000 sq ft. Cool-season grass stores it over winter and greens up thick first thing in spring. It matters more than your spring feeding, and most homeowners skip it.' },
            { q: 'How short should the last mow of the year be?', a: 'Drop to about 2.5–3 inches for the final cut or two so tall grass doesn\'t mat under snow and breed snow mold. Don\'t go below 2 inches. Stop mowing once the grass stops growing, usually early-to-mid November.' },
        ],
        related: ['lawn-care', 'property-cleanup'],
    },
    {
        slug: 'how-to-choose-a-landscaper-lincoln-ne',
        title: 'How to Choose a Landscaper in Lincoln, NE (What to Actually Ask)',
        description: 'An honest buyer\'s guide to hiring a landscaper in Lincoln, Nebraska. The exact questions to ask about insurance, base depth, and written quotes — plus the red flags that tell you to walk.',
        h1: 'How to <em class="highlight">Choose a Landscaper</em> in Lincoln, NE',
        sub: 'A straight buyer\'s guide — the questions that actually separate a crew that will still be standing behind the work in five years from one that won\'t.',
        date: '2026-03-04',
        category: 'Hardscaping',
        image: '/images/landscapedesign/1.webp',
        imageAlt: 'Finished professional landscape and hardscape installation in Lincoln',
        takeaways: [
            'The best and worst landscaping look identical for the first season — judge on the questions you ask, not the finished photo.',
            'For hardscape, the make-or-break question is base depth plus geotextile fabric. A vague answer is your answer.',
            'Get the scope in writing, confirm insurance, and treat a bid far below the rest as a warning sign, not a bargain.',
        ],
        body: `
        <p>Hiring a landscaper is weirdly hard to get right, because the worst work and the best work look identical for the first season. A patio built on four inches of base looks exactly like one built on eight — until the third winter, when one of them starts heaving. A bed planted in compacted clay looks the same as one planted in amended soil — until July, when half of it dies.</p>
        <p>So you can\'t judge on the finished photo. You have to judge on the questions you ask before anyone breaks ground. Here\'s what we\'d ask if we were hiring someone — and we say this knowing it holds us to the same standard.</p>

        <h2>The questions that actually matter</h2>
        <h3>1. Are you insured? Can you show me?</h3>
        <p>General liability is the floor. Ask to see the certificate — a legitimate company emails it to you in about two minutes without getting weird about it. If a crew is working around your house, your foundation, your neighbor\'s fence, and a 60,000-pound pool of water, and they aren\'t insured, you are the insurance. This is the single easiest filter and a surprising number of operations fail it.</p>
        <h3>2. For hardscape: how deep is your base, and do you use geotextile fabric?</h3>
        <p>This is the question that separates real hardscapers from guys with a plate compactor. The answer you want for a residential patio in Lincoln: <strong>at least 6 inches of compacted Class 5 base</strong> (8+ inches anywhere vehicles drive), compacted in lifts, over a layer of geotextile fabric that separates the base from the soil below. Lincoln\'s freeze-thaw cycle destroys patios built shallow. If the answer is vague — "oh, we put down some gravel and sand" — or they don\'t mention fabric at all, that\'s your answer. We wrote a whole breakdown of <a href="/blog/paver-patio-cost-lincoln-ne">what a paver patio actually costs in Lincoln</a> and exactly where cheap bids cut the base to hit a lower number.</p>
        <h3>3. Will I get a written, itemized quote — and a defined scope?</h3>
        <p>"I\'ll do the whole thing for $6,000" is not a quote, it\'s a setup for an argument. You want it in writing: dimensions, materials, base depth, what\'s included, what\'s extra, and what the timeline is. A written scope protects both sides. When the work is itemized, you can actually compare two bids instead of guessing why one is $2,000 cheaper (spoiler: it\'s usually the base, the fabric, or the polymeric sand).</p>
        <h3>4. Can I see recent local work — and talk to those customers?</h3>
        <p>Photos are easy to fake or borrow. Ask for two or three recent jobs in or around Lincoln and, ideally, a customer or two you can actually call. A crew that does good work has a backlog of happy people in town who\'ll vouch for them. Drive by a finished patio if you can — a two-year-old install tells you far more than a freshly-laid one.</p>
        <h3>5. Who is actually doing the work?</h3>
        <p>Some companies sell the job with an experienced estimator and then send a rotating subcontracted crew who never talked to you. Ask directly: is this your crew, or is it subbed out? There\'s nothing automatically wrong with subs, but you want to know who\'s standing in your yard and who to call if something\'s off. With us, it\'s an owner-operated local crew — the person who quotes it is connected to the people who build it.</p>
        <h3>6. What happens if something goes wrong after you\'re done?</h3>
        <p>Ask about the warranty and, just as important, whether they\'ll still be around to honor it. Plenty of one-season operations quote cheap, do the work, and are gone by the time a problem shows up. A company that lives and works in Lincoln year-round has its reputation on the line in the same town you live in.</p>

        <h2>Red flags — when to just walk away</h2>
        <ul>
            <li><strong>A quote dramatically below everyone else\'s.</strong> If three bids cluster around $9,000 and one comes in at $5,500, that fourth crew isn\'t a bargain — they\'re leaving something out. On hardscape it\'s almost always the base depth, the fabric, or the joint sand, and you won\'t see the cut until the patio starts moving.</li>
            <li><strong>Cash-only, no paper.</strong> A company that won\'t put the job in writing or take any traceable payment is a company that doesn\'t want a record of what they promised. That\'s a problem when you need them to come back.</li>
            <li><strong>No written scope.</strong> If they won\'t define what\'s included before starting, every disagreement later becomes your word against theirs — and you\'ve already paid a deposit.</li>
            <li><strong>Pressure to decide today.</strong> "This price is only good if you sign right now" is a sales tactic, not a real constraint. Good crews are busy; they\'ll happily hold a fair number while you think.</li>
            <li><strong>They can\'t answer the base-depth question.</strong> For any hardscape project, this is the tell. If they don\'t know or won\'t say, they don\'t build for Lincoln winters.</li>
            <li><strong>No physical visit before quoting a big project.</strong> Anyone quoting a patio or wall sight-unseen off a couple photos is guessing. Slope, drainage, and access all change the number, and a real crew comes to look.</li>
        </ul>

        <h2>How to actually compare bids</h2>
        <p>Get two or three written quotes, then line them up on the things that don\'t show in the finished photo: base depth, fabric, joint sand, drainage, and exactly what\'s included. Once you normalize for those, the prices usually move a lot closer together — and the "expensive" bid often turns out to be the only one that priced the job correctly. Cheapest-up-front is frequently most-expensive-over-five-years, because a failed patio or a dead bed gets paid for twice.</p>

        <h2>Where we land on all this</h2>
        <p>We\'re not going to be the cheapest quote you get, and we\'ll tell you why in writing: we build hardscape on a deep compacted base over fabric, we put the scope on paper, we\'re insured, and it\'s our own local crew doing the work in the same town we live in. If you\'re weighing a few bids and want one that itemizes exactly what you\'re paying for — including the parts you can\'t see once the job\'s done — <a href="/quote">ask us for an estimate</a> and compare line by line. That comparison is usually the whole sales pitch.</p>
        `,
        faqs: [
            { q: 'What should I ask a landscaper before hiring them?', a: 'Whether they are insured (and can show the certificate), how deep their hardscape base is and whether they use geotextile fabric, whether you will get a written itemized quote, who actually does the work, and what happens if something goes wrong after they finish.' },
            { q: 'What are the red flags when hiring a landscaper in Lincoln?', a: 'A quote dramatically below the others, cash-only with no paperwork, no written scope, pressure to sign today, an inability to answer the base-depth question, and quoting a big project sight-unseen off a couple photos.' },
            { q: 'Why is the cheapest quote usually not the best deal?', a: 'On hardscape, the cheapest bid almost always cuts the base depth, fabric, or joint sand — things you cannot see in the finished photo. The patio looks fine for a season, then fails, and you pay to rebuild it. Cheapest up front is often most expensive over five years.' },
        ],
        related: ['hardscaping', 'landscape-design'],
    },
    {
        slug: 'mulch-vs-rock-lincoln-ne',
        title: 'Mulch vs. Rock for Your Landscape Beds in Lincoln, NE',
        description: 'An honest mulch-vs-rock comparison for Lincoln, Nebraska landscape beds. Real local pricing, weed control, heat, soil health, and exactly when each one makes sense.',
        h1: '<em class="highlight">Mulch vs. Rock</em> for Your Landscape Beds in Lincoln, NE',
        sub: 'The "rock is maintenance-free" pitch is half-true and half-marketing. Here\'s the honest trade-off for Lincoln yards — cost, weeds, heat, and what it does to your plants.',
        date: '2026-03-26',
        category: 'Garden Beds',
        image: '/images/mulchgardenbeds/1.webp',
        imageAlt: 'Fresh hardwood mulch in a planted Lincoln, NE garden bed',
        takeaways: [
            'Mulch is far cheaper to install; rock costs more up front but can win over 10 years because it never decomposes.',
            '"Rock is maintenance-free" is a myth — debris collects between the stones, weeds root in it, and the fabric eventually fails.',
            'Heat is the real decider: rock bakes plants and foundations, while mulch cools the soil and feeds it. Beds with plants → mulch.',
        ],
        body: `
        <p>This is the most common bed question we get in Lincoln, and the honest answer is "it depends" — but not in the wishy-washy way contractors usually mean. Mulch and rock are good at genuinely different things, and the wrong choice in the wrong spot will cost you money, kill plants, or both. Here\'s the real breakdown.</p>
        ${table({
            caption: 'Mulch vs. rock at a glance — Lincoln, NE beds',
            headers: ['Factor', 'Mulch', 'Landscape rock'],
            rows: [
                ['Upfront cost', '<strong>Lower</strong> — ~$35–$50/yd, fast to spread', 'Higher — heavy, slow, needs fabric'],
                ['10-year cost', 'Recurring — re-mulch most years', '<strong>Often lower</strong> — never decomposes'],
                ['Maintenance', 'Annual refresh', 'Lower, but not "none" — debris + weeds collect'],
                ['Soil health', '<strong>Improves it</strong> as it breaks down', 'Nothing; fabric starves the soil'],
                ['Heat on plants', '<strong>Cools &amp; insulates</strong>', 'Absorbs &amp; radiates — can bake plants'],
                ['Best for', 'Planted beds, hot exposures, foundations', 'Drainage runs, dry/low-plant strips, fence lines'],
            ],
        })}

        <h2>Upfront cost: rock costs more to install</h2>
        <p>Rock is the more expensive install, often by a wide margin. Real Lincoln numbers for 2026:</p>
        <ul>
            <li><strong>Hardwood mulch</strong> runs roughly $35-$50 a cubic yard at suppliers like Outdoor Solutions in Roca, and it\'s light and fast to spread. A typical residential bed refresh is a few hundred dollars installed.</li>
            <li><strong>Landscape rock</strong> (river rock, decorative gravel, limestone) runs more like $45-$80+ a ton depending on type and size, it\'s far heavier and slower to move, and it almost always needs quality landscape fabric underneath. Material plus fabric plus the labor of spreading several tons by hand pushes a rock install to two, three, sometimes four times the cost of the same bed in mulch.</li>
        </ul>
        <p>So on day one, mulch wins on price, and it\'s not close.</p>

        <h2>Long-term cost: this is where rock makes its case</h2>
        <p>Here\'s the flip side, and it\'s the real argument for rock. Mulch breaks down. In Lincoln you\'re re-mulching most beds <strong>every single year</strong> — usually a refresh in spring — because the old layer decomposes, fades, and thins out. Rock doesn\'t decompose. Put it down once and you\'re not buying it again; you\'re just occasionally blowing leaves off it and pulling the odd weed.</p>
        <p>Run it out five or ten years and the math can flip: the expensive rock install you paid for once may cost less than a decade of annual mulch refreshes. <strong>That\'s the honest case for rock — long-term cost, not "no maintenance."</strong> Which brings us to the myth.</p>

        <h2>The "rock is maintenance-free" myth</h2>
        <p>Rock is lower-maintenance than mulch. It is not maintenance-free, and anyone who tells you otherwise is selling. Here\'s what actually happens to rock beds in Lincoln over time:</p>
        <ul>
            <li><strong>Organic debris collects in the gaps.</strong> Leaves, dust, grass clippings, and our lovely Nebraska wind-blown dirt settle down between the stones. Over a few years that builds into a thin layer of soil sitting right on top of your fabric — and weeds happily root in it. Now you\'re weeding a rock bed, which is far more annoying than weeding mulch.</li>
            <li><strong>The fabric eventually fails or gets exposed.</strong> Sun degrades it, edges curl up, and weeds find the seams. Re-doing a rock bed — pulling stone, replacing fabric, re-laying stone — is a genuinely miserable, expensive job, much worse than topping up mulch.</li>
            <li><strong>Stuff gets into it.</strong> Once leaves and debris are in a rock bed, you can\'t just rake them out the way you would off mulch. A leaf blower helps; a hard cleanup means picking through stone.</li>
        </ul>

        <h2>Weed control: roughly a wash, done right</h2>
        <p>People assume rock wins on weeds. In reality, both control weeds well for the first few years and both eventually let weeds through — just by different routes. Mulch suppresses weeds while it\'s thick, then thins as it breaks down (which is exactly why the annual refresh matters). Rock over good fabric blocks weeds beautifully until debris builds a rooting layer on top. Neither is truly weed-proof in Lincoln; both need occasional attention.</p>

        <h2>Heat: the one that actually kills plants</h2>
        <p>This is the factor most homeowners never think about, and it\'s the most important one for plant health. <strong>Rock absorbs and radiates heat. Mulch insulates and cools.</strong></p>
        <p>On a 95° Lincoln July afternoon — and we get plenty — a rock bed in full sun can hit surface temperatures well over 130°. That heat radiates up into your plants and bakes the soil and roots underneath. It also gets reflected back at whatever\'s behind the bed.</p>
        <ul>
            <li><strong>Rock against a south- or west-facing foundation is a genuinely bad combo.</strong> You\'re creating a heat trap right against the house and cooking any foundation plantings in it. Shrubs that would be fine in mulch struggle or die in hot rock beds.</li>
            <li><strong>Mulch does the opposite</strong> — it keeps soil cooler, holds moisture so you water less, and as it breaks down it actually feeds the soil (more on that next).</li>
            <li><strong>The rule of thumb:</strong> if there are living plants in the bed that you care about — especially on a hot exposure — mulch is almost always the better call. Rock is for spots where heat and dryness don\'t matter.</li>
        </ul>

        <h2>Soil health: only mulch helps</h2>
        <p>Organic mulch breaks down — and that\'s a feature, not just a cost. As it decomposes it feeds soil life, adds organic matter, and slowly improves Lincoln\'s heavy clay into something plants actually want to grow in. Every year you re-mulch, you\'re also amending the bed a little.</p>
        <p>Rock does nothing for soil. Worse, the fabric underneath cuts the bed off from the natural organic cycle entirely. Over years, soil under rock-and-fabric tends to get harder, more compacted, and more lifeless. For a bed you want to keep planting in, that\'s a real long-term downside.</p>

        <h2>So when does each one actually make sense in Lincoln?</h2>
        <h3>Use mulch when:</h3>
        <ul>
            <li>The bed has plants you care about — shrubs, perennials, anything you want to thrive.</li>
            <li>It\'s a hot south- or west-facing exposure, or right against the foundation.</li>
            <li>You want healthier soil over time.</li>
            <li>You\'d rather pay a little each year than a lot once.</li>
        </ul>
        <h3>Use rock when:</h3>
        <ul>
            <li>It\'s a low- or no-plant area: a dry strip along a fence, a side yard, around downspouts, or a drainage swale where you actually want the water-shedding.</li>
            <li>Drainage matters — rock is excellent at moving water away from a problem spot.</li>
            <li>It\'s a high-wind or high-traffic area that blows mulch around or where mulch washes out.</li>
            <li>You genuinely want a one-time install and accept the higher upfront cost and the occasional weed clean-out.</li>
        </ul>

        <h2>What we usually recommend</h2>
        <p>For most Lincoln front-yard and foundation beds — the ones with shrubs and perennials you want to look good — we steer people to quality hardwood mulch and a yearly refresh. It\'s better for the plants, better for the soil, and the annual cost is modest. We save rock for the spots it\'s genuinely better at: drainage runs, dry side yards, low-maintenance fence lines, and areas with little or no planting. Plenty of yards end up with both, used where each one belongs.</p>
        <p>The decision also ties into the overall design — bed shapes, what gets planted, and how the beds relate to any hardscape. If you\'re reworking beds as part of a bigger project, our <a href="/services/landscape-design">landscape design</a> process maps out which beds get mulch, which get rock, and why, before anyone orders a single yard of material. Want a recommendation for your specific yard? <a href="/quote">Get a quote</a> and we\'ll walk it with you.</p>
        `,
        faqs: [
            { q: 'Is mulch or rock cheaper for landscape beds?', a: 'Mulch is far cheaper to install (~$35–$50 a cubic yard, light and fast to spread). Rock costs more up front — it is heavier, slower, and usually needs fabric underneath — but it does not decompose, so over 10 years it can cost less than annual mulch refreshes.' },
            { q: 'Is rock really maintenance-free?', a: 'No. Rock is lower-maintenance than mulch, but organic debris collects between the stones and weeds root in it over time, the fabric eventually fails, and cleaning leaves out of rock is a pain. It is lower-maintenance, not no-maintenance.' },
            { q: 'Should I put rock against my foundation in Lincoln?', a: 'Usually not, especially on a south- or west-facing wall. Rock absorbs and radiates heat — a sunny rock bed can top 130°F and bake foundation plantings. Mulch insulates and keeps soil cooler.' },
            { q: 'When is rock the right choice?', a: 'Low- or no-plant areas: dry strips along a fence, side yards, around downspouts, and drainage swales where you want water to shed. Rock is excellent for drainage and high-wind spots where mulch blows away.' },
        ],
        related: ['garden-beds', 'landscape-design'],
    },
    {
        slug: 'retaining-wall-cost-lincoln-ne',
        title: 'How Much Does a Retaining Wall Cost in Lincoln, NE? (2026)',
        description: 'Real 2026 retaining wall pricing for Lincoln, Nebraska — block, boulder, poured concrete, and timber, per square foot of wall face. What drives the cost and when you need an engineer.',
        h1: 'How Much Does a <em class="highlight">Retaining Wall</em> Cost in Lincoln, NE?',
        sub: 'Priced by the square foot of wall face — not by the running foot. Here\'s what block, boulder, and poured walls actually cost in Lincoln, and the height where the price jumps.',
        date: '2026-05-05',
        category: 'Hardscaping',
        image: '/images/retainingwall/1.webp',
        imageAlt: 'Segmental block retaining wall built in Lincoln, Nebraska',
        takeaways: [
            'Retaining walls are priced by the square foot of wall FACE (height × length), not by the running foot — a taller wall costs far more per foot of length.',
            'Budget $25–$60+ per sq ft of face installed in 2026 depending on material; segmental block is the everyday workhorse.',
            'At about 4 feet of exposed height, an engineered design is typically required — the single biggest cost cliff.',
            'Most of the cost you can\'t see is drainage: gravel backfill, drain tile, and a deep base. Skip it and the wall bows out within a few winters.',
        ],
        body: `
        <p>Like patios, retaining walls get advertised with a per-square-foot range that sounds simple and tells you almost nothing. The real Lincoln answer depends on what you're building the wall out of, how tall it is, and — more than anything — what's happening behind it where you can't see. Here's how the pricing actually works.</p>

        <h2>First, how retaining walls are priced</h2>
        <p>This trips up almost every homeowner: a retaining wall is priced by the <strong>square foot of wall face</strong>, not by its length. The face is height × length. So a wall 30 feet long and 3 feet tall is 90 square feet of face — and it costs far more than a 30-foot wall that's only 1 foot tall, even though both are "30 feet of wall."</p>
        <p>That's because the work that makes a wall last — excavation, base, drainage, backfill — scales with height, not length. A taller wall holds back more soil and water, so it needs a deeper base, more gravel behind it, and (past a point) engineering.</p>

        <h2>Cost by wall type in Lincoln (2026)</h2>
        ${table({
            caption: 'Installed retaining wall pricing per sq ft of wall face — Lincoln, NE (2026)',
            headers: ['Wall type', 'Installed / sq ft of face', 'Best for'],
            rows: [
                ['<strong>Segmental block (SRW)</strong><br><span class="post-table-note">Versa-Lok, Belgard, etc.</span>', '$25–$45', 'Most residential walls — modular, clean, proven'],
                ['<strong>Natural boulder / outcropping</strong>', '$30–$55', 'Rustic look, gradual slopes, larger lots'],
                ['<strong>Poured concrete</strong>', '$40–$60+', 'Tall or structural walls, modern look'],
                ['<strong>Treated timber</strong>', '$18–$30', 'Budget / short walls — shorter lifespan'],
                ['<strong>Mortared natural stone</strong>', '$50–$80+', 'High-end, fully custom appearance'],
            ],
        })}
        <p>To put that in real numbers: that 90-square-foot block wall above lands somewhere around <strong>$2,250–$4,000</strong> installed. A 40-foot, 4-foot-tall block wall (160 sq ft of face) that needs engineering can run <strong>$6,000–$10,000+</strong>.</p>

        <h2>The 4-foot rule — the biggest cost cliff</h2>
        <p>Once a wall holds back more than about <strong>4 feet of exposed height</strong>, it generally has to be engineered — a licensed engineer designs the reinforcement (often geogrid that ties the wall back into the hillside), and the city may require a permit. Below 4 feet, a good contractor builds to manufacturer spec without a stamped plan.</p>
        <p>This is why two walls that look similar can be priced thousands apart: a 3'10" wall and a 4'2" wall are different animals. If your slope needs more than 4 feet of retention, it's often cheaper and stronger to <strong>terrace it</strong> into two shorter walls than to engineer one tall one — and it usually looks better, too.</p>
        ${callout({ type: 'warning', title: 'Drainage is the whole game', body: '<p>The number one reason retaining walls fail in Lincoln is water, not weight. Water builds up behind the wall, freezes, expands, and pushes the wall out. A real wall has clean gravel backfill, a perforated drain tile at the base daylighting to the side, and a compacted base below frost. A wall built straight against backfilled clay with no drainage will bow and lean within a few seasons — and rebuilding costs more than building it right did.</p>' })}

        <h2>What else moves the price</h2>
        <ul>
            <li><strong>Excavation and access.</strong> Tight backyards where we can't get a skid steer in mean hand-digging and hauling — that adds labor fast.</li>
            <li><strong>What's behind and on top of the wall.</strong> Holding back a driveway or a structure (a "surcharge load") requires more reinforcement than holding back an empty slope.</li>
            <li><strong>Caps, steps, and curves.</strong> Finished cap stones, integrated steps, and tight radius curves all add material and labor over a straight wall.</li>
            <li><strong>Tear-out.</strong> Removing a failing timber or block wall before rebuilding adds demolition and disposal.</li>
        </ul>

        <h2>What you need for a real quote</h2>
        <ol>
            <li>Rough length of the wall and how tall it needs to be at its highest point.</li>
            <li>What it's holding back (a slope, a driveway, a patio) and what's at the top.</li>
            <li>Photos of the area and the access route from the street or driveway.</li>
        </ol>
        <p>With that we can give you a written estimate, usually with a block option and an upgrade option so you can see the trade-off. Most of our wall work is tied to a larger project — a patio that needs grade held, or a sloped lot in <a href="/areas/south-lincoln">south Lincoln</a> with drainage issues — and the same crew that builds the wall does the <a href="/services/hardscaping">hardscaping</a> around it.</p>
        `,
        faqs: [
            { q: 'How much does a retaining wall cost in Lincoln, NE?', a: 'In 2026, segmental block walls — the most common residential choice — run about $25–$45 per square foot of wall face installed. A 30-foot wall that is 3 feet tall (90 sq ft of face) lands roughly $2,250–$4,000. Taller engineered walls run $40–$60+ per sq ft.' },
            { q: 'Why are retaining walls priced by the square foot of face, not by length?', a: 'Because the cost is driven by height, not length. A taller wall holds back more soil and water, so it needs a deeper base, more gravel backfill, drainage, and sometimes engineering. Wall face (height × length) captures that; running length alone does not.' },
            { q: 'When does a retaining wall need to be engineered in Nebraska?', a: 'Generally once the wall retains more than about 4 feet of exposed height. Past that, a licensed engineer designs the reinforcement and the city may require a permit. Below 4 feet, a good contractor builds to manufacturer spec. Terracing a tall slope into two shorter walls often avoids the engineering cost.' },
        ],
        related: ['hardscaping', 'landscape-design'],
    },
    {
        slug: 'fence-cost-lincoln-ne',
        title: 'How Much Does a Fence Cost in Lincoln, NE? (2026 Pricing)',
        description: 'What it costs to fence a yard in Lincoln, Nebraska in 2026 — wood privacy, vinyl, chain link, and ornamental steel, priced per linear foot. Gates, permits, and posts set for Nebraska frost.',
        h1: 'How Much Does a <em class="highlight">Fence</em> Cost in Lincoln, NE?',
        sub: 'Priced per linear foot by material. Here\'s what wood, vinyl, chain link, and ornamental steel run in Lincoln — plus the post-depth detail that decides whether your fence survives a Nebraska winter.',
        date: '2026-05-18',
        category: 'Fencing',
        image: '/images/fencing/1.jpg',
        imageAlt: 'Wood privacy fence installed in a Lincoln, Nebraska backyard',
        takeaways: [
            'Fencing is priced per linear foot installed; in 2026 Lincoln, budget roughly $18–$60+ per foot depending on material.',
            'A typical 150-foot backyard fence runs about $3,000 (chain link) to $9,000+ (vinyl or ornamental steel).',
            'Posts must be set below Nebraska\'s ~40″ frost line in concrete, or the fence heaves and leans — this is where cheap installs cut corners.',
            'Gates, sloped ground, tearing out an old fence, and rocky clay digging all add to the base per-foot price.',
        ],
        body: `
        <p>Fencing is one of the easier landscape projects to price, because it mostly comes down to two numbers: how many linear feet you're enclosing and what material you choose. Everything else — gates, slope, tear-out — adds to that base. Here are real Lincoln numbers for 2026.</p>

        <h2>Cost by fence type</h2>
        ${table({
            caption: 'Installed fence pricing per linear foot — Lincoln, NE (2026)',
            headers: ['Fence type', 'Installed / linear ft', '150 ft fenced yard'],
            rows: [
                ['<strong>Chain link (4–6 ft)</strong>', '$18–$30', '≈ $2,700–$4,500'],
                ['<strong>Wood privacy (cedar, 6 ft)</strong>', '$28–$45', '≈ $4,200–$6,750'],
                ['<strong>Vinyl privacy</strong>', '$40–$60', '≈ $6,000–$9,000'],
                ['<strong>Ornamental steel / aluminum</strong>', '$35–$60+', '≈ $5,250–$9,000+'],
            ],
        })}
        <p>Wood is the most popular privacy fence in Lincoln because it's the best balance of price, looks, and longevity. Vinyl costs more up front but never needs staining. Chain link is the budget workhorse for pets and property lines. Ornamental steel is the premium look — and the only one that doesn't block a view.</p>

        <h2>The detail that decides if your fence survives: post depth</h2>
        <p>This is the single most important thing about a fence in Nebraska, and it's invisible once the job's done. Lincoln's frost line is roughly <strong>40 inches</strong>. If fence posts aren't set in concrete <em>below</em> that depth, the freeze-thaw cycle grabs them and heaves them upward over a few winters — and your straight fence starts leaning, gates stop latching, and panels pull apart.</p>
        ${callout({ type: 'warning', title: 'Ask any fence bidder how deep they set posts', body: '<p>The right answer for Lincoln is at least 36–42 inches, in concrete, with the corner and gate posts set deepest because they take the most load. A crew that sets posts 18–24 inches "because it\'s faster" will save you money today and cost you a leaning fence in three years. This is the fence equivalent of skimping on a patio base.</p>' })}

        <h2>What adds to the base price</h2>
        <ul>
            <li><strong>Gates.</strong> A standard walk gate adds roughly $150–$350; a double drive gate is more. Gates need the heaviest posts and the most hardware.</li>
            <li><strong>Slope and grade.</strong> A fence that has to "step down" a hill or rack to follow a slope takes more time than a flat run.</li>
            <li><strong>Tear-out of an old fence.</strong> Pulling and hauling the existing fence and old concrete footings adds labor and disposal.</li>
            <li><strong>Hard digging.</strong> Lincoln's heavy clay is workable; rocky fill or tree roots along the line slow the post holes down.</li>
            <li><strong>Corners and ends.</strong> A long straight run is cheaper per foot than a yard chopped into lots of short segments and corners.</li>
        </ul>

        <h2>Permits, property lines, and 811</h2>
        <p>Two things to handle before anyone digs in Lincoln:</p>
        <ul>
            <li><strong>Call 811 first — always.</strong> Nebraska law requires a free utility locate before digging. We schedule this on every fence job so a post hole doesn't hit a gas or fiber line. Never let anyone skip it.</li>
            <li><strong>Know your zoning and property line.</strong> Lincoln has height limits (typically lower in front yards than side/rear) and your fence needs to sit on your side of the line. If you're in an HOA, check for approval requirements before ordering material. We'll walk the line with you, but the survey pins are the source of truth.</li>
        </ul>

        <h2>Getting a quote</h2>
        <p>For a fast estimate we need the approximate perimeter you want enclosed (a rough sketch or even pacing it off is fine), the material and height you're after, how many gates, and whether there's an existing fence to remove. With that we can usually turn around a written, itemized quote within a day. See our <a href="/services/fencing">fencing page</a> for the styles we install, or <a href="/quote">request an estimate</a> and we'll come measure.</p>
        `,
        faqs: [
            { q: 'How much does it cost to fence a yard in Lincoln, NE?', a: 'In 2026, expect roughly $18–$30 per linear foot for chain link, $28–$45 for a 6-foot cedar privacy fence, $40–$60 for vinyl, and $35–$60+ for ornamental steel — installed. A typical 150-foot backyard runs about $3,000 (chain link) to $9,000+ (vinyl or ornamental).' },
            { q: 'How deep should fence posts be set in Nebraska?', a: 'At least 36–42 inches, in concrete, to get below Lincoln\'s roughly 40-inch frost line. Posts set shallower get heaved upward by the freeze-thaw cycle, and the fence leans within a few winters. Corner and gate posts should be set deepest.' },
            { q: 'Do I need a permit to build a fence in Lincoln?', a: 'Most standard residential fences do not require a building permit, but you must follow city zoning (height limits differ between front and rear yards) and keep the fence on your side of the property line. You must call 811 for a free utility locate before digging, and HOA neighborhoods may require approval.' },
        ],
        related: ['fencing', 'property-cleanup'],
    },
    {
        slug: 'landscaping-cost-lincoln-ne',
        title: 'How Much Does Landscaping Cost in Lincoln, NE? (2026 Guide)',
        description: 'A real budgeting guide to landscaping costs in Lincoln, Nebraska for 2026 — from a few-hundred-dollar bed refresh to a full design-build. What drives the number and how to phase a big project.',
        h1: 'How Much Does <em class="highlight">Landscaping</em> Cost in Lincoln, NE?',
        sub: 'From a $400 mulch refresh to a $50,000 backyard transformation — here\'s how to think about a landscaping budget in Lincoln, and where the money actually goes.',
        date: '2026-03-12',
        category: 'Landscape Design',
        image: '/images/landscapedesign/2.webp',
        imageAlt: 'Completed full-yard landscape design-build project in Lincoln, Nebraska',
        takeaways: [
            'There is no single "landscaping" price — it ranges from a few hundred dollars (bed refresh) to $50k+ (full design-build).',
            'A useful rule of thumb: many homeowners invest 5–10% of their home\'s value into landscaping over time.',
            'Labor and site prep — not the plants — are usually the biggest line items on any real project.',
            'A large project can be phased over 2–3 seasons to spread the cost without losing the overall design.',
        ],
        body: `
        <p>"How much does landscaping cost?" is a little like asking how much a car costs — the honest answer is "what kind, and how much of it?" A weekend bed refresh and a full backyard rebuild are both "landscaping," and they're two orders of magnitude apart. So instead of a fake single number, here's how to actually budget for it in Lincoln.</p>

        <h2>Ballpark ranges by project</h2>
        ${table({
            caption: 'Typical Lincoln, NE landscaping project ranges (2026)',
            headers: ['Project', 'Typical Lincoln range'],
            rows: [
                ['Bed refresh — mulch, edge, cleanup', '$300–$1,500'],
                ['Front-yard bed redesign + planting', '$2,000–$8,000'],
                ['Paver patio or walkway', '$3,000–$15,000'],
                ['Retaining wall', '$3,000–$12,000+'],
                ['Privacy fence', '$3,000–$9,000'],
                ['New lawn (sod or seed)', '$1,500–$8,000'],
                ['Full backyard design-build', '$15,000–$60,000+'],
            ],
        })}
        <p>Most homeowners we work with aren't doing one of these in isolation — they're combining a couple (say, a patio plus the beds around it) into one project, which is usually more cost-effective than hiring out each piece separately a year apart.</p>

        <h2>The 5–10% rule of thumb</h2>
        <p>A common guideline from the landscape industry: plan to invest roughly <strong>5–10% of your home's value</strong> in landscaping over the years you own it. On a $350,000 Lincoln home, that's $17,500–$35,000 of cumulative outdoor investment — not all at once, but across patios, beds, trees, and lawn over time. Done well, quality landscaping is one of the few home improvements that both improves daily life and holds resale value.</p>

        <h2>Where the money actually goes</h2>
        <p>Homeowners often assume plants and materials are the big cost. On most real projects, they're not — <strong>labor and site prep are</strong>. A few things that move the number more than the plant list:</p>
        <ul>
            <li><strong>Site prep and access.</strong> Demolition, hauling out old material, fixing grade, and how easily a crew can get equipment into the yard. A locked-gate backyard with wheelbarrow-only access costs more than an open lot.</li>
            <li><strong>Drainage and grading.</strong> If water doesn't move the right way, that gets solved first — and it's underground work you don't "see" in the finished yard. (See our guide on <a href="/blog/wet-yard-drainage-lincoln-ne">fixing a soggy yard</a>.)</li>
            <li><strong>Material grade.</strong> Standard concrete pavers vs. natural stone, builder-grade plants vs. mature specimens — same design, very different invoice.</li>
            <li><strong>Hardscape vs. softscape.</strong> Patios, walls, and fences (hardscape) cost far more per square foot than beds and lawn (softscape). A design that's heavy on hardscape costs more.</li>
        </ul>

        <h2>Design-build vs. piecing it out</h2>
        <p>You can hire separate people for design, hardscape, planting, and lawn — or hire one crew to design and build the whole thing. For anything beyond a single element, design-build usually wins: one plan that accounts for drainage, sun, and how the spaces connect, built by one accountable crew, with materials ordered once. Piecing it out tends to produce a yard that looks like three projects that don't quite talk to each other — and you pay mobilization costs every time a new crew shows up.</p>

        <h2>How to phase a big project</h2>
        ${callout({ type: 'tip', title: 'You don\'t have to do it all at once', body: '<p>For a large transformation, we\'ll design the whole yard up front, then build it in phases over two or three seasons — hardscape and grading first (the stuff that\'s disruptive and structural), then beds and plantings, then finishing touches. You spread the cost over time, but because every phase follows the same master plan, the finished yard still looks like one intentional design instead of a patchwork.</p>' })}

        <h2>Getting a real number for your yard</h2>
        <p>The ranges above are for budgeting. The only way to get a real price is to walk the actual yard — slope, soil, access, and what you want all change it. We do free on-site estimates across Lincoln and put everything in writing, itemized, so you can see exactly where the budget goes and decide what to do now vs. later. Start with our <a href="/services/landscape-design">landscape design</a> process or <a href="/quote">request an estimate</a>.</p>
        `,
        faqs: [
            { q: 'How much does landscaping cost in Lincoln, NE?', a: 'It depends entirely on scope. A bed refresh runs $300–$1,500, a paver patio $3,000–$15,000, and a full backyard design-build $15,000–$60,000+. A common rule of thumb is to invest 5–10% of your home\'s value in landscaping over time.' },
            { q: 'What is the most expensive part of a landscaping project?', a: 'Usually labor and site prep — not the plants. Demolition, grading, drainage, equipment access, and hardscape (patios, walls, fences) drive the cost far more than the plant list. Hardscape costs much more per square foot than beds and lawn.' },
            { q: 'Can I split a big landscaping project into phases?', a: 'Yes, and it is common. We design the whole yard up front, then build it over two or three seasons — structural work like grading and hardscape first, then planting and finishing. Phasing spreads the cost while keeping the finished result coherent because every phase follows one master plan.' },
        ],
        related: ['landscape-design', 'hardscaping'],
    },
    {
        slug: 'sod-vs-seed-lincoln-ne',
        title: 'Sod vs. Seed for a New Lawn in Lincoln, NE',
        description: 'Sod vs. seed for a new or rebuilt lawn in Lincoln, Nebraska — a real cost comparison, timeline, and which one actually wins for your yard, slope, and budget.',
        h1: '<em class="highlight">Sod vs. Seed</em> for a New Lawn in Lincoln, NE',
        sub: 'Sod is an instant lawn for more money; seed is a cheaper lawn that makes you wait. Here\'s the honest cost-and-timeline trade-off for Lincoln yards.',
        date: '2026-03-30',
        category: 'Lawn Care',
        image: '/images/LawnRestore/before.webp',
        imageAlt: 'Bare graded soil being prepared for a new lawn in Lincoln, Nebraska',
        takeaways: [
            'Sod gives you a finished lawn in a day for roughly 4–6× the cost of seed; seed is cheaper but takes a full season to fill in.',
            'For cool-season grass in Lincoln, the best seeding window is late August–September — not spring.',
            'Sod can be laid almost any frost-free month and is the better call on slopes (it won\'t wash out) and high-traffic yards.',
            'Either way, the result lives or dies on soil prep — grading and loosening compacted clay matters more than the grass itself.',
        ],
        body: `
        <p>When you're starting a lawn from scratch — a new build, a yard you tore up for a project, or a lawn that's beyond saving — you've got two real options: roll out sod or sow seed. Both end in a lawn. They get there very differently, and the right pick depends on your budget, your timeline, and your yard.</p>

        <h2>The cost and timeline, side by side</h2>
        ${table({
            caption: 'Sod vs. seed for a new lawn — Lincoln, NE (2026)',
            headers: ['', 'Sod', 'Seed'],
            rows: [
                ['Installed cost', '$1.00–$2.00 / sq ft', '$0.15–$0.40 / sq ft'],
                ['5,000 sq ft yard', '≈ $5,000–$10,000', '≈ $750–$2,000'],
                ['Usable lawn', '~2–3 weeks to root', '~1 full season to fill in'],
                ['Best install window', 'Any frost-free month', 'Late Aug–Sept (or early spring)'],
                ['On slopes', '<strong>Wins</strong> — no wash-out', 'Risky — seed washes away'],
                ['Variety choice', 'Limited to grower\'s blends', '<strong>Wide</strong> — any blend you want'],
            ],
        })}
        <p>The cost gap is the headline: sod is roughly four to six times the price of seed for the same area. You're paying a sod farm to have already spent a year growing it. What you buy with that money is <em>time</em> — a green, usable lawn almost immediately instead of months of watching dirt.</p>

        <h2>When sod is worth it</h2>
        <ul>
            <li><strong>You want a lawn now.</strong> Selling the house, hosting in six weeks, or just done looking at mud — sod is instant.</li>
            <li><strong>You've got a slope.</strong> Seed on any real grade washes into the gutter with the first hard Nebraska rain. Sod holds the soil from day one.</li>
            <li><strong>High-traffic or pets.</strong> Sod is walkable in a couple weeks; seed needs to be roped off far longer.</li>
            <li><strong>It's the wrong season to seed.</strong> Need a lawn in June? Seeding then fights summer heat. Sod doesn't care about the calendar (as long as you can water it).</li>
        </ul>

        <h2>When seed is the smarter call</h2>
        <ul>
            <li><strong>Budget matters and you can wait.</strong> The savings on a big yard are thousands of dollars.</li>
            <li><strong>You want a specific grass blend.</strong> Seed lets you choose exactly the right tall fescue / bluegrass mix for your sun, shade, and traffic. (See <a href="/blog/best-grass-seed-nebraska">the best grass seed for Nebraska</a>.)</li>
            <li><strong>It's late August or September.</strong> That's the prime seeding window in Lincoln — warm soil, cool air, dying weeds. A fall seeding establishes beautifully. Our <a href="/blog/when-to-overseed-lawn-lincoln-ne">overseeding guide</a> covers the timing in detail.</li>
        </ul>

        ${callout({ type: 'tip', title: 'Whichever you choose, the soil prep is what matters', body: '<p>Both sod and seed fail on bad ground. Lincoln\'s heavy clay needs to be graded so water runs away from the house, then loosened (and often amended with compost) so roots can actually penetrate. Sod laid on hard, unprepped clay roots poorly and stays thin; seed on the same ground washes and struggles. Spend the effort below the surface and either option thrives — skip it and neither will.</p>' })}

        <h2>What we usually recommend in Lincoln</h2>
        <p>For most homeowners on a normal timeline, a quality <strong>fall seeding</strong> gives the best lawn for the money. For slopes, quick turnarounds, or anyone who just wants it done, <strong>sod</strong> earns its premium. And sometimes the answer is both — sod the visible front yard and the slope, seed the big flat backyard. Want a recommendation for your specific yard and budget? <a href="/quote">Get a quote</a> and we'll walk it with you.</p>
        `,
        faqs: [
            { q: 'Is sod or seed cheaper for a new lawn in Lincoln?', a: 'Seed is far cheaper — roughly $0.15–$0.40 per sq ft installed vs. $1.00–$2.00 for sod. On a 5,000 sq ft yard that\'s about $750–$2,000 for seed vs. $5,000–$10,000 for sod. With sod you\'re paying for instant results and time saved.' },
            { q: 'When is the best time to seed a lawn in Lincoln, NE?', a: 'Late August through September. The soil is still warm, the air has cooled, and annual weeds are dying off, so cool-season grass establishes with little competition before frost. Early spring is a workable second choice; summer seeding fights heat and usually fails.' },
            { q: 'Is sod better than seed on a slope?', a: 'Yes. Seed on any real slope washes away with the first hard rain before it can root. Sod holds the soil in place from the day it\'s laid, so for graded or sloped areas it\'s almost always the better choice despite the higher cost.' },
        ],
        related: ['lawn-care', 'landscape-design'],
    },
    {
        slug: 'best-grass-seed-nebraska',
        title: 'The Best Grass Seed for Nebraska Lawns (Lincoln Guide)',
        description: 'Which grass actually thrives in Lincoln, Nebraska — the best cool-season grass types and seed blends for sun, shade, and high traffic, from a local lawn crew.',
        h1: 'The Best <em class="highlight">Grass Seed</em> for Nebraska Lawns',
        sub: 'Lincoln sits in the cool-season grass zone, so the lawn videos shot down South will steer you wrong. Here\'s what actually thrives in Nebraska — and the blend we use.',
        date: '2026-03-23',
        category: 'Lawn Care',
        image: '/images/lawncare/5.webp',
        imageAlt: 'Healthy cool-season turf grass on a Lincoln, NE lawn',
        takeaways: [
            'Lincoln is cool-season grass country: Kentucky bluegrass, turf-type tall fescue, fine fescue, and perennial ryegrass.',
            'A turf-type tall fescue / Kentucky bluegrass blend is the best all-around choice for most Lincoln yards.',
            'Match the seed to the spot: fine fescue for shade, tall fescue for heat and traffic, bluegrass for the deep-green showpiece look.',
            'Skip cheap big-box "contractor mix" — it\'s padded with annual ryegrass and weed seed that thins out fast.',
        ],
        body: `
        <p>Half the lawn advice online is useless in Nebraska because it's written for a different climate. Bermuda, zoysia, and St. Augustine are warm-season grasses for the South — plant them here and they go brown and dormant the moment it cools off, if they survive the winter at all. Lincoln is firmly in the <strong>cool-season grass zone</strong>, which narrows the real options to four grasses worth knowing.</p>

        <h2>The four grasses that work in Lincoln</h2>
        ${table({
            caption: 'Cool-season grasses for Lincoln, NE lawns',
            headers: ['Grass type', 'Strengths', 'Best for'],
            rows: [
                ['<strong>Turf-type tall fescue</strong>', 'Heat &amp; drought tolerant, deep roots, fast to establish', 'Sun, heat, foot traffic — most Lincoln yards'],
                ['<strong>Kentucky bluegrass</strong>', 'Dark green, dense, self-repairs', 'Showpiece lawns in full sun (slow to start)'],
                ['<strong>Fine fescue</strong>', 'Shade tolerant, low water &amp; fertilizer', 'Shady spots under trees'],
                ['<strong>Perennial ryegrass</strong>', 'Germinates fast (5–10 days)', 'Quick cover as part of a blend'],
            ],
        })}

        <h2>The blend we recommend for most yards</h2>
        <p>For a typical Lincoln lawn that gets sun and real use, our go-to is a <strong>turf-type tall fescue / Kentucky bluegrass blend, roughly 70/30</strong>. The tall fescue gives you fast establishment, deep roots, and genuine drought and heat tolerance for July and August. The bluegrass fills in between the fescue clumps over time, knits the lawn together (it spreads by rhizomes, so it self-repairs), and delivers the dark green color people actually want to look at.</p>
        <p>You get the toughness of fescue and the looks and recovery of bluegrass — without the weaknesses of either one alone.</p>

        <h2>Match the seed to the spot</h2>
        <ul>
            <li><strong>Hot, sunny, high-traffic areas</strong> — lean heavier on tall fescue. It takes the heat and bounces back from foot traffic better than bluegrass.</li>
            <li><strong>Shade under mature trees</strong> (common in <a href="/areas/east-lincoln">east Lincoln</a>) — work fine fescue into the mix. Bluegrass and tall fescue both thin out in real shade; fine fescue tolerates it.</li>
            <li><strong>A front-yard showpiece in full sun</strong> — you can push the bluegrass percentage up for that dense, dark, golf-course look, as long as you're patient through a slow establishment.</li>
        </ul>

        ${callout({ type: 'warning', title: 'Avoid the cheap big-box "contractor mix"', body: '<p>The bargain bags of "sun &amp; shade contractor mix" are cheap for a reason: they\'re padded with annual ryegrass (which dies after one season), coarse K-31 pasture-type fescue, and a surprising amount of inert filler and weed seed. They green up fast and look fine for a few months, then thin out and leave you reseeding. Spend a little more on a quality named blend — it\'s the cheapest part of a lawn and the one you live with the longest.</p>' })}

        <h2>Where to buy it locally</h2>
        <p>Lincoln nurseries and garden centers — Campbell's, Earl May, and the like — carry quality named blends and can point you to the right one for sun or shade. We use Lebanon Pro–grade seed for our customer overseeds; a 50-pound bag runs roughly $80–$110 and covers about 7,500 square feet at a normal overseed rate. Whatever you buy, check the label for the named-variety percentages and a low "weed seed / other crop" number.</p>

        <h2>Putting it down</h2>
        <p>The best seed in the world fails if it goes down at the wrong time or onto bad soil. In Lincoln, seed in <strong>late August through September</strong> for the best results, core-aerate first so seed reaches the soil, and keep the top inch damp until it germinates. The full timing playbook is in our <a href="/blog/when-to-overseed-lawn-lincoln-ne">overseeding guide</a>, and if you're starting from bare dirt, weigh <a href="/blog/sod-vs-seed-lincoln-ne">sod vs. seed</a> first. Want us to handle the whole thing? <a href="/quote">Get a quote</a>.</p>
        `,
        faqs: [
            { q: 'What is the best grass seed for a lawn in Lincoln, Nebraska?', a: 'A turf-type tall fescue / Kentucky bluegrass blend (about 70/30) is the best all-around choice for most Lincoln yards. The fescue brings heat tolerance, drought resistance, and fast establishment; the bluegrass fills in, self-repairs, and gives the deep green color. Use fine fescue for shady areas.' },
            { q: 'Can I grow Bermuda or zoysia grass in Nebraska?', a: 'Those are warm-season grasses suited to the South. In Lincoln they go dormant and brown as soon as it cools and often struggle to survive winter. Stick with cool-season grasses — Kentucky bluegrass, tall fescue, fine fescue, and perennial ryegrass.' },
            { q: 'Is cheap contractor grass-seed mix worth it?', a: 'Usually not. Bargain "contractor" or "sun & shade" mixes are padded with annual ryegrass that dies after a season, coarse pasture fescue, and filler or weed seed. They look fine briefly, then thin out. A quality named blend costs a little more and lasts far longer.' },
        ],
        related: ['lawn-care', 'landscape-design'],
    },
    {
        slug: 'wet-yard-drainage-lincoln-ne',
        title: 'How to Fix a Wet, Soggy Yard in Lincoln, NE',
        description: 'Standing water and soggy spots in your Lincoln, Nebraska yard — what causes them and how to fix them. French drains, regrading, dry wells, and swales, with real local costs.',
        h1: 'How to Fix a <em class="highlight">Wet, Soggy Yard</em> in Lincoln, NE',
        sub: 'Lincoln\'s heavy clay soil and flat lots are a recipe for standing water. Here are the fixes that actually work — and how to match the right one to your problem.',
        date: '2026-04-20',
        category: 'Hardscaping',
        image: '/images/retainingwall/1-3.webp',
        imageAlt: 'Drainage and grading work on a Lincoln, NE property',
        takeaways: [
            'Most Lincoln drainage problems come down to two things: heavy clay that won\'t absorb water, and grade that runs toward the house instead of away from it.',
            'Fix the grade first — re-sloping so water runs away from the foundation solves a surprising number of "drainage" complaints.',
            'French drains, dry wells, and swales each solve a different problem; matching the fix to the cause is the whole game.',
            'Water pooling against your foundation isn\'t cosmetic — it\'s a basement and structural risk worth fixing fast.',
        ],
        body: `
        <p>If you've got a corner of the yard that's a swamp for three days after every rain, a soggy strip that never quite dries, or water creeping toward the foundation, you're fighting Lincoln's two built-in disadvantages: <strong>heavy clay soil</strong> that drains slowly, and a lot of <strong>flat or poorly-graded lots</strong> where water has nowhere to go. The good news is every version of this is fixable. The trick is matching the fix to the actual cause.</p>

        <h2>Why Lincoln yards stay wet</h2>
        <p>Three usual suspects, often in combination:</p>
        <ul>
            <li><strong>Clay soil.</strong> Lincoln's clay holds water instead of letting it percolate down. After a big rain it saturates and stays soggy for days.</li>
            <li><strong>Bad grade.</strong> The ground slopes the wrong way — toward the house, or toward a low spot with no outlet — so water collects instead of running off.</li>
            <li><strong>Roof water dumped at the foundation.</strong> Downspouts that empty right at the wall concentrate hundreds of gallons exactly where you least want it.</li>
        </ul>

        <h2>The fixes, cheapest to most involved</h2>
        ${table({
            caption: 'Yard drainage fixes — Lincoln, NE (typical 2026 costs)',
            headers: ['Fix', 'What it solves', 'Typical cost'],
            rows: [
                ['Downspout extensions', 'Roof water dumped at the foundation', '$100–$400'],
                ['Regrading / re-sloping', 'Ground that slopes toward the house', '$500–$3,000'],
                ['French drain', 'Soggy low spots, subsurface water', '$1,000–$4,000'],
                ['Dry well', 'Collected water with nowhere to go', '$800–$2,500'],
                ['Swale', 'Sheet water crossing the yard', '$1,000–$5,000'],
            ],
        })}

        <h3>1. Downspout extensions (do this first)</h3>
        <p>The cheapest fix and shockingly often the only one you need. Getting roof water 6–10 feet away from the foundation — with buried, pop-up, or surface extensions — solves a huge share of "wet basement" and "soggy foundation bed" complaints for a couple hundred dollars. Always rule this out before paying for anything bigger.</p>

        <h3>2. Regrading / re-sloping</h3>
        <p>The gold standard: the ground around your house should fall away from the foundation about 6 inches over the first 10 feet. If it doesn't — or if there's a low birdbath spot in the lawn — reshaping the grade so water sheds where you want it fixes the problem at the source instead of managing the symptom. This is the first thing we look at on any drainage call.</p>

        <h3>3. French drain</h3>
        <p>A perforated pipe in a gravel-filled trench, wrapped in fabric, that collects subsurface water and carries it somewhere safe to daylight. The right tool for a chronically soggy low area or water seeping along a slope. Done right it's invisible (gravel or turf over the top) and lasts decades; done wrong (no fabric, wrong slope) it clogs with silt and quits.</p>

        <h3>4. Dry well</h3>
        <p>A buried gravel-and-basin reservoir that gives collected water somewhere to sit and slowly soak away — useful when there's no lower point on the property to drain to. Often paired with a French drain or downspout line as the destination.</p>

        <h3>5. Swale</h3>
        <p>A shallow, gently-shaped channel — often planted, so it just looks like part of the landscape — that guides sheet water across or around the yard to where you want it. Great for moving water that runs across a lawn during heavy rain without an ugly ditch.</p>

        ${callout({ type: 'warning', title: 'Water at the foundation is not a cosmetic problem', body: '<p>A soggy spot in the back forty is annoying. Water pooling against the foundation is a basement-flooding and structural risk — over time it can cause hydrostatic pressure, cracks, and seepage that cost far more than the drainage fix. If water is collecting against the house, treat it as urgent, not a someday project.</p>' })}

        <h2>Getting it diagnosed</h2>
        <p>Drainage is the one area where a site visit really matters — we need to see where the water comes from, where it pools, and where it could go. We'll walk it after a rain if we can, identify the actual cause, and recommend the least-invasive fix that solves it rather than the most expensive one. It often ties into a regrading or <a href="/services/hardscaping">hardscaping</a> project, but plenty of drainage work stands alone. <a href="/quote">Request an estimate</a> and we'll take a look.</p>
        `,
        faqs: [
            { q: 'Why is my yard always wet and soggy in Lincoln?', a: 'Usually a combination of Lincoln\'s heavy clay soil, which drains slowly, and grade that runs toward the house or into a low spot with no outlet. Downspouts dumping roof water at the foundation make it worse. Identifying which of these is the main cause determines the right fix.' },
            { q: 'What is the cheapest way to fix yard drainage?', a: 'Downspout extensions — getting roof water 6–10 feet from the foundation for $100–$400 — solve a large share of drainage complaints and should always be ruled out first. After that, regrading so the ground slopes away from the house fixes the problem at its source.' },
            { q: 'Do I need a French drain or regrading?', a: 'Regrading fixes water that pools because the ground slopes the wrong way; a French drain handles chronically soggy low spots and subsurface water that grading alone can\'t move. They\'re often used together. A site visit after a rain is the best way to tell which your yard needs.' },
        ],
        related: ['hardscaping', 'property-cleanup'],
    },
    {
        slug: 'native-drought-tolerant-plants-nebraska',
        title: 'Native & Drought-Tolerant Plants for Nebraska Yards',
        description: 'The best native and low-water plants for Lincoln, Nebraska landscapes — tough perennials, grasses, and shrubs that survive our heat, wind, clay, and cold with less work.',
        h1: '<em class="highlight">Native &amp; Drought-Tolerant</em> Plants for Nebraska Yards',
        sub: 'Plants that evolved on the prairie don\'t need babying. Here are the natives and tough perennials we plant in Lincoln for color that survives heat, wind, clay, and a Zone 5 winter.',
        date: '2026-04-28',
        category: 'Garden Beds',
        image: '/images/gardenbed/2.webp',
        imageAlt: 'Native perennial planting in a Lincoln, Nebraska garden bed',
        takeaways: [
            'Lincoln is USDA Zone 5b — plants have to take 95°F summers, prairie wind, clay soil, and sub-zero winters.',
            'Native prairie plants are the lowest-maintenance, lowest-water option, and they feed pollinators on top of it.',
            'Group plants by water need, and put the toughest, driest-loving ones on hot south- and west-facing exposures.',
            'Even drought-tolerant plants need regular water their first year to establish — "low-water" kicks in from year two.',
        ],
        body: `
        <p>The toughest, lowest-maintenance plants you can put in a Lincoln yard are the ones that were already growing here before the city was. Nebraska's prairie natives evolved to handle exactly what kills fussy nursery plants: blazing summer heat, relentless wind, dense clay soil, drought, and brutal winters. Plant them and you get color, pollinators, and resilience — with a fraction of the watering and replacing.</p>

        <h2>Know what you're planting into</h2>
        <p>Lincoln is <strong>USDA hardiness Zone 5b</strong>. A plant here has to survive winter lows around -15°F, summer highs near 100°F, wind that dries everything out, and heavy clay that drains slowly. "Drought-tolerant" and "native" plants are simply the ones built for that — once established, they shrug off the conditions that make you replace annuals every year.</p>

        <h2>Native perennials that thrive here</h2>
        ${table({
            caption: 'Tough Nebraska-native perennials & grasses',
            headers: ['Plant', 'Type', 'Why it works here'],
            rows: [
                ['Purple coneflower (Echinacea)', 'Perennial', 'Tough, long bloom, pollinator magnet'],
                ['Black-eyed Susan (Rudbeckia)', 'Perennial', 'Spreads, blooms for months, deer-resistant'],
                ['Butterfly milkweed (Asclepias)', 'Perennial', 'Monarch host plant, loves poor dry soil'],
                ['Blazing star (Liatris)', 'Perennial', 'Vertical purple spikes, totally drought-proof'],
                ['Little bluestem', 'Grass', 'Native bunchgrass, blue-green → copper fall color'],
                ['Switchgrass (Panicum)', 'Grass', 'Tall screen, holds soil, great winter interest'],
                ['False indigo (Baptisia)', 'Perennial', 'Shrub-sized, deep roots, basically permanent'],
            ],
        })}

        <h2>Tough non-native standbys</h2>
        <p>You don't have to go strictly native to get low-water and bulletproof. These adapted perennials handle Lincoln conditions beautifully and mix well with the natives above:</p>
        <ul>
            <li><strong>Daylily</strong> — nearly indestructible, blooms in poor soil, spreads slowly.</li>
            <li><strong>Sedum / stonecrop</strong> ('Autumn Joy' and friends) — succulent leaves store water; fall color when little else is blooming.</li>
            <li><strong>Russian sage &amp; catmint</strong> — silvery, aromatic, long-blooming, and they laugh at heat and drought.</li>
            <li><strong>Yarrow</strong> — ferny foliage, flat flower heads, thrives on neglect.</li>
            <li><strong>Ornamental grasses</strong> (feather reed grass, fountain grass) — movement, texture, and structure that lasts into winter.</li>
        </ul>

        <h2>Drought-tolerant shrubs</h2>
        <p>For backbone and year-round structure: <strong>ninebark</strong> (great foliage color), <strong>fragrant sumac</strong> (tough groundcover-to-shrub), <strong>juniper</strong> (evergreen, takes any abuse), and <strong>potentilla</strong> (small, long-blooming, bombproof). These anchor a bed so it doesn't disappear in winter.</p>

        ${callout({ type: 'tip', title: 'Right plant, right place — and group by water need', body: '<p>The secret to a low-water yard isn\'t just picking tough plants — it\'s putting them where they want to be. Cluster the driest-loving plants (milkweed, sedum, blazing star, Russian sage) on hot south- and west-facing exposures where rock or pavement radiates heat. Save the spots with a little more moisture for plants that appreciate it. Grouping by water need means you can water generously where it helps and not at all where it doesn\'t.</p>' })}

        ${callout({ type: 'info', title: 'Even "no-water" plants need water year one', body: '<p>Drought tolerance is a property of an <em>established</em> plant. The first growing season, every one of these needs regular water to grow the deep root system that makes it tough later. Water well through the first year; from year two on, most of these get by on rainfall plus the occasional deep soak in a heat wave.</p>' })}

        <h2>Designing it so it looks intentional</h2>
        <p>Native and low-water doesn't have to mean wild and weedy. Repeating a few species in drifts, pairing fine-textured grasses with bold flowers, and giving the bed a clean edge reads as designed, not neglected. If you're reworking beds, this is exactly the kind of thing our <a href="/services/landscape-design">landscape design</a> process maps out — what goes where, grouped by sun and water, so it thrives and looks great. And whatever you plant, mulch the beds: see <a href="/blog/mulch-vs-rock-lincoln-ne">mulch vs. rock</a> for why mulch beats rock around living plants. <a href="/quote">Get a quote</a> for a planting plan.</p>
        `,
        faqs: [
            { q: 'What are the best low-maintenance plants for a Lincoln, NE yard?', a: 'Nebraska prairie natives are the toughest and lowest-water options: purple coneflower, black-eyed Susan, butterfly milkweed, blazing star, little bluestem, and switchgrass. Adapted standbys like daylily, sedum, Russian sage, catmint, and yarrow are also nearly bulletproof here.' },
            { q: 'What USDA hardiness zone is Lincoln, Nebraska?', a: 'Lincoln is in USDA Zone 5b, with winter lows around -15°F. Plants also have to handle summer highs near 100°F, drying wind, and heavy clay soil — which is why native and drought-tolerant species do so well once established.' },
            { q: 'Do drought-tolerant plants still need watering?', a: 'Yes, especially the first growing season. Drought tolerance comes from a deep, established root system, which takes a year to develop. Water regularly through year one; from year two on, most natives and low-water plants get by on rainfall plus occasional deep watering in heat waves.' },
        ],
        related: ['garden-beds', 'landscape-design'],
    },
    {
        slug: 'winterizing-landscape-lincoln-ne',
        title: 'Winterizing Your Landscape in Lincoln, NE',
        description: 'How to put your Lincoln, Nebraska yard to bed for winter — sprinkler blowout, protecting plants, the final lawn feeding, and the hardscape steps that prevent freeze damage.',
        h1: '<em class="highlight">Winterizing</em> Your Landscape in Lincoln, NE',
        sub: 'Lincoln winters swing from 60° to below zero in a week. A few hours of fall prep prevents cracked pipes, heaved plants, and a slow green-up next spring.',
        date: '2026-05-22',
        category: 'Lawn Care',
        image: '/images/lawncare/6.webp',
        imageAlt: 'Lincoln, NE landscape prepared and put to bed for winter',
        takeaways: [
            'Blow out your irrigation system before the first hard freeze — a cracked backflow or line is the most expensive winter mistake.',
            'The fall nitrogen feeding (mid-October) is the highest-value lawn task of the year and sets next spring\'s color.',
            'Mulch beds 2–3″ to buffer Lincoln\'s freeze-thaw swings, which heave shallow-rooted plants right out of the ground.',
            'Drain and disconnect hoses, protect young tree trunks from sunscald and rodents, and water evergreens until the ground freezes.',
        ],
        body: `
        <p>Winter in Lincoln doesn't ease in — it lurches. You'll get a 60° afternoon and a single-digit night in the same week. That freeze-thaw whiplash, not just the cold, is what damages a landscape: it cracks water lines, heaves plants out of the soil, and splits tree bark. A few hours of prep in the fall prevents a spring full of expensive surprises. Here's the checklist we run.</p>

        <h2>1. Blow out the irrigation system (most important)</h2>
        <p>If you have an in-ground sprinkler system, this is non-negotiable in Nebraska. Any water left in the lines, valves, or backflow preventer freezes, expands, and cracks the components — and a split backflow assembly is a few hundred dollars plus a soggy spring repair. The system has to be cleared with compressed air ("blown out") before the first hard freeze.</p>
        ${callout({ type: 'warning', title: 'Don\'t guess at the blowout', body: '<p>A proper blowout needs a real air compressor (a small pancake compressor won\'t move enough volume) and care not to over-pressurize and damage heads. If you don\'t have the right equipment, hire it out — it\'s an inexpensive service and far cheaper than replacing a frozen backflow. The above-ground backflow assembly is the part most likely to freeze and the most expensive to replace.</p>' })}

        <h2>2. The last lawn feeding of the year</h2>
        <p>If you do one fertilizer application all year, make it the fall one. A slow-release nitrogen feeding in <strong>mid-October</strong>, while the grass is still green, gets stored in the roots over winter and powers a thick, early green-up next spring — without the soft, disease-prone growth a spring feeding causes. It's the single highest-value thing you can do for a cool-season lawn, and it's covered in full in our <a href="/blog/fall-cleanup-checklist-lincoln-ne">fall cleanup checklist</a>.</p>

        <h2>3. Put the beds to bed</h2>
        <ul>
            <li><strong>Refresh mulch to 2–3 inches.</strong> Mulch isn't just looks in winter — it insulates roots and buffers the freeze-thaw swings that physically heave shallow-rooted perennials out of the ground. Keep it off plant stems and tree trunks, though.</li>
            <li><strong>Cut back what should be cut, leave what shouldn't.</strong> Trim mushy, disease-prone perennials (peonies, hostas, anything with mildew). Leave ornamental grasses, coneflowers, and sedum standing — they hold winter interest, feed birds, and catch insulating snow.</li>
            <li><strong>Weed one last time.</strong> A weed pulled in November is a few hundred you don't fight in May.</li>
        </ul>

        <h2>4. Protect trees and shrubs</h2>
        <ul>
            <li><strong>Water until the ground freezes.</strong> Evergreens especially keep losing moisture through winter wind. Send everything into winter well-watered — a dry root ball going into a hard freeze is what kills "winter-hardy" plants.</li>
            <li><strong>Wrap young, thin-barked trees.</strong> Maples, lindens, and fruit trees can split from <em>sunscald</em> — winter sun warms the south side of the trunk, then it refreezes at night and the bark cracks. A light-colored trunk wrap for the first few winters prevents it.</li>
            <li><strong>Guard against rodents.</strong> Mice and rabbits chew bark at the base of young trees under snow cover. A mesh guard around the trunk stops them from girdling and killing the tree.</li>
        </ul>

        <h2>5. Hoses, hardscape, and containers</h2>
        <ul>
            <li><strong>Disconnect and drain every hose</strong> before the first hard freeze, and shut off and drain exterior spigots so the line behind the wall doesn't freeze and burst.</li>
            <li><strong>Empty and store ceramic/terracotta pots.</strong> Water left in a glazed pot freezes and cracks it. Empty them or flip and cover them.</li>
            <li><strong>Leave the snow shovel away from the pavers' sealer schedule</strong> — don't seal a patio late in fall; let it wait for spring when there's time to cure. Do clear leaves off hardscape so they don't stain.</li>
        </ul>

        ${callout({ type: 'tip', title: 'A few "don\'ts"', body: '<p>Don\'t fertilize too late (a December feeding does nothing and can hurt). Don\'t pile mulch into a "volcano" against trunks — it traps moisture and invites rot and rodents. And don\'t cut everything in the beds to the ground; the standing stems of grasses and seed-head perennials protect their own crowns and look good against the snow.</p>' })}

        <h2>Want it handled before the freeze?</h2>
        <p>Fall and winter prep bunches up right before the first hard freeze every year, and the calendar is unforgiving once the ground locks up. We handle full fall-to-winter prep across Lincoln — final feeding, mulch, bed cutback, tree protection, and haul-off — usually bundled with a <a href="/blog/fall-cleanup-checklist-lincoln-ne">fall cleanup</a>. <a href="/quote">Get on the schedule</a> before the rush.</p>
        `,
        faqs: [
            { q: 'How do I winterize my yard in Lincoln, Nebraska?', a: 'Blow out the irrigation system before the first hard freeze, give the lawn its fall nitrogen feeding in mid-October, refresh bed mulch to 2–3 inches, water trees and evergreens until the ground freezes, protect young tree trunks from sunscald and rodents, and drain and disconnect all hoses and exterior spigots.' },
            { q: 'When should I blow out my sprinkler system in Nebraska?', a: 'Before the first hard freeze — typically by mid-to-late October in Lincoln. Water left in the lines and backflow preventer freezes and cracks the components. Use a real air compressor or hire the service; it\'s inexpensive compared to replacing a frozen backflow assembly.' },
            { q: 'Why do my plants get pushed out of the ground over winter?', a: 'It\'s called frost heave. Lincoln\'s repeated freeze-thaw cycles expand and contract the soil, which physically lifts shallow-rooted perennials out of the ground and exposes their roots. A 2–3 inch mulch layer insulates the soil and buffers those swings, preventing most heaving.' },
        ],
        related: ['lawn-care', 'garden-beds'],
    },
    {
        slug: 'lawn-mowing-cost-lincoln-ne',
        title: 'How Much Does Lawn Mowing Cost in Lincoln, NE? (2026)',
        description: 'Real 2026 lawn mowing prices in Lincoln, Nebraska — per-mow cost by lot size, weekly vs. bi-weekly, what should be included, and why the cheapest quote usually costs you more.',
        h1: 'How Much Does <em class="highlight">Lawn Mowing</em> Cost in Lincoln, NE?',
        sub: 'Honest per-mow and seasonal pricing for Lincoln yards — what actually drives the number, what should be included in a real quote, and the hidden cost in a lowball bid.',
        date: '2026-05-28',
        category: 'Lawn Care',
        imageAlt: 'Striped, freshly mowed residential lawn in Lincoln, Nebraska',
        takeaways: [
            'Most average Lincoln lots (5,000–10,000 sq ft) run $45–$60 per visit for a full mow, trim, edge, and blow.',
            'Weekly mowing usually costs less per visit than bi-weekly — taller bi-weekly grass takes longer to cut and clean up.',
            'A real quote includes mowing, string-trimming, hard-edge, and blowing clippings off hard surfaces — not just the mow.',
            'The cheapest bid is often a solo operator with no insurance; one accident on your property can cost you far more than the few dollars saved.',
        ],
        body: `
        <p>"How much to mow my yard?" is the most common question we get in the spring, and the honest answer is: it depends on your lot, but the range is narrower than people expect. Below is what residential lawn mowing actually costs in Lincoln in 2026 — the numbers, what drives them, and what a fair quote should include.</p>

        <h2>What lawn mowing costs in Lincoln by lot size</h2>
        <p>Almost every reputable Lincoln crew prices a mow off lot size and complexity (slopes, obstacles, gates, fenced dogs). These are typical per-visit ranges for a full service — mow, trim, edge, and blow:</p>
        ${table({
            caption: 'Typical per-mow pricing in Lincoln, NE (2026)',
            headers: ['Lot size', 'Per-visit range', 'Notes'],
            rows: [
                ['Small in-town lot (under 5,000 sq ft)', '$35–$45', 'Most older near-downtown and University Place lots'],
                ['Average Lincoln lot (5,000–10,000 sq ft)', '$45–$60', 'The bulk of homes east, south, and southeast'],
                ['Large lot (1/4–1/2 acre)', '$60–$90', 'Newer builds in Pine Lake, Stevens Creek, Wilderness Hills'],
                ['Acreage (1+ acre)', '$90+ (quoted)', 'Waverly, Davey, and rural edges — priced on site'],
            ],
        })}
        <p>If a quote comes in far below these, ask what it includes. A $25 "mow" that skips trimming and edging isn't cheaper — it just moves the trim-and-edge work onto you.</p>

        <h2>Weekly vs. bi-weekly: which is cheaper?</h2>
        <p>This surprises people: <strong>weekly mowing is usually the better value per visit.</strong> When grass grows for two weeks instead of one, it's taller and thicker at cut time, which means slower mowing, double-cutting to mulch the clippings, and more cleanup. Many crews charge a few dollars more per bi-weekly visit to cover that — so you pay more per cut and your lawn looks ragged for the back half of every cycle.</p>
        ${callout({ type: 'tip', title: 'The 1/3 rule is why weekly wins', body: '<p>Cool-season Lincoln lawns should never lose more than 1/3 of their blade height in one mow. In the May–June growth surge, a healthy lawn can grow past that in a week — so on a bi-weekly schedule you\'re either scalping it or hauling away a thatch of clippings. Weekly keeps it in the healthy zone and is gentler on the grass.</p>' })}

        <h2>What should be included in the price</h2>
        <p>A real mowing service in Lincoln includes four things on every visit:</p>
        <ol>
            <li><strong>Mow</strong> — at the right height (3.5"+ for cool-season grass), with a sharp blade so it cuts cleanly instead of tearing.</li>
            <li><strong>String-trim</strong> — around fences, trees, beds, AC units, and anything the mower can't reach.</li>
            <li><strong>Hard-edge</strong> — a clean line along driveways, sidewalks, and curbs. This single step is what makes a yard look professionally maintained.</li>
            <li><strong>Blow</strong> — clippings cleared off all hard surfaces so the driveway and walks are clean when we leave.</li>
        </ol>
        <p>If "edging" and "blowing" are line-item upsells rather than standard, that's a sign the headline price is engineered to look low.</p>

        <h2>What makes the number go up or down</h2>
        <ul>
            <li><strong>Obstacles and trim work.</strong> A wide-open lawn mows fast. A yard full of beds, trees, and play sets is mostly trimming — and trimming is the slow part.</li>
            <li><strong>Slopes and ditches.</strong> Steep banks (common on south-side and Yankee Hill lots) can't be ridden and take longer by hand.</li>
            <li><strong>Gates and dogs.</strong> A narrow gate that forces a push-mower in back, or a dog that has to be coordinated around, adds time.</li>
            <li><strong>Frequency and contract.</strong> A full-season weekly account almost always earns a better per-visit rate than one-off mows.</li>
        </ul>

        <h2>Why the cheapest quote usually costs more</h2>
        <p>The lowest bid in Lincoln is almost always a single person with a truck and no insurance. That's fine until a thrown rock cracks your window, a string-trimmer scars your siding, or someone gets hurt on your property — at which point an uninsured "$30 mow" can become a very expensive afternoon. We carry liability insurance on every job, which is part of why our number isn't the rock-bottom one. <a href="/services/lawn-care">See what's included in our lawn care</a>.</p>
        ${callout({ type: 'local', title: 'Lincoln-specific timing', body: '<p>Lincoln\'s cool-season grass grows fastest in May–June and again in September–October, and slows in the July–August heat. A good crew adjusts — weekly in the surge, sometimes stretching to every 10 days in a dry August — so you\'re not paying to cut grass that didn\'t grow. For the full season plan, see our <a href="/blog/spring-lawn-care-checklist-lincoln-ne">spring lawn care checklist</a>.</p>' })}

        <h2>Get a fixed mowing price for your yard</h2>
        <p>We\'ll give you a flat per-visit price for your specific lot — no per-cut surprises, edging and blowing always included. <a href="/quote">Request a free quote</a> and we\'ll get you on the schedule.</p>
        `,
        faqs: [
            { q: 'How much does it cost to mow an average yard in Lincoln, NE?', a: 'Most average Lincoln lots (about 5,000–10,000 sq ft) run $45–$60 per visit for a full service — mowing, string-trimming, hard-edging, and blowing the clippings off hard surfaces. Smaller in-town lots are closer to $35–$45, and quarter-acre-plus lots run $60–$90.' },
            { q: 'Is weekly or bi-weekly mowing cheaper?', a: 'Weekly mowing is usually the better value per visit. On a bi-weekly schedule the grass grows taller and thicker, which takes longer to cut and clean up, so many crews charge more per bi-weekly visit — and the lawn looks overgrown for the second half of each cycle.' },
            { q: 'Do lawn services charge per mow or monthly in Lincoln?', a: 'Both are common. Many homeowners pay per visit during the season; others prefer a flat monthly amount that averages the cost across the year. We can quote either way — a full-season weekly account typically earns the best per-visit rate.' },
            { q: 'What should be included in a lawn mowing price?', a: 'A complete service includes mowing at the correct height, string-trimming around obstacles, hard-edging along driveways and walks, and blowing all clippings off hard surfaces. If edging and blowing are charged as extras, the headline price is misleadingly low.' },
        ],
        related: ['lawn-care', 'property-cleanup'],
    },
    {
        slug: 'paver-patio-vs-concrete-lincoln-ne',
        title: 'Paver Patio vs. Concrete Patio in Lincoln, NE: Which Is Better?',
        description: 'Pavers vs. poured concrete for a patio in Lincoln, Nebraska — cost compared, how each handles freeze-thaw, repairs, lifespan, and resale. An honest breakdown from a local hardscaping crew.',
        h1: '<em class="highlight">Paver Patio</em> vs. Concrete in Lincoln, NE',
        sub: 'The real trade-offs for a Nebraska patio — upfront cost, how each survives our freeze-thaw winters, what happens when something cracks, and which one actually pays off.',
        date: '2026-06-04',
        category: 'Hardscaping',
        imageAlt: 'Paver patio next to a poured concrete slab in a Lincoln, NE backyard',
        takeaways: [
            'Concrete is cheaper upfront ($8–$15/sq ft plain); pavers cost more ($18–$30/sq ft) but last longer and repair cleaner.',
            'Nebraska\'s freeze-thaw cycle cracks concrete slabs over time; a paver patio flexes with the ground and is fixed by lifting and relaying.',
            'When a concrete slab cracks, the patch always shows. When a paver cracks or settles, you swap a few units and it\'s invisible.',
            'For most Lincoln backyards you\'ll keep for 10+ years, pavers win on lifetime cost and resale; concrete wins when budget is the hard constraint.',
        ],
        body: `
        <p>Almost every patio conversation in Lincoln comes down to the same fork: poured concrete or pavers? Both are good options — the right one depends on your budget, how long you'll be in the house, and how you feel about the near-certainty that a Nebraska concrete slab eventually cracks. Here's the honest comparison we give homeowners.</p>

        <h2>Cost compared</h2>
        <p>Concrete is cheaper to install. Pavers cost more because the base prep is deeper and the labor is hands-on. Rough 2026 installed pricing in Lincoln:</p>
        ${table({
            caption: 'Patio cost and durability: concrete vs. pavers in Lincoln',
            headers: ['Factor', 'Poured concrete', 'Paver patio'],
            rows: [
                ['Installed cost (per sq ft)', '$8–$15 plain · $15–$25 stamped', '$18–$30'],
                ['Realistic lifespan', '20–25 yrs (cracks sooner)', '30–50 yrs'],
                ['Freeze-thaw behavior', 'Rigid slab — cracks and heaves', 'Flexes with the ground'],
                ['Repairs', 'Patch is visible; hard to match', 'Lift and relay individual pavers'],
                ['Resale appeal', 'Standard', 'Premium / upgraded look'],
            ],
        })}
        <p>If you want exact numbers for a paver build specifically — base depth, edge restraint, and what drives the price — we broke it down in <a href="/blog/paver-patio-cost-lincoln-ne">how much a paver patio costs in Lincoln</a>.</p>

        <h2>How each handles Nebraska freeze-thaw</h2>
        <p>This is the part that actually matters here. Lincoln goes through dozens of freeze-thaw cycles every winter, and our heavy clay soil swells and shrinks with moisture. A poured slab is one rigid piece — when the ground moves underneath it, it has nowhere to go but crack. You can control where (with control joints) but not whether.</p>
        <p>A paver patio is dozens of small units sitting on a deep compacted-gravel base with sand between them. When the ground moves, the pavers move with it and stay intact. If a section does settle over the years, it didn't fail — it just needs to be lifted and re-leveled, which is a routine fix, not a teardown.</p>
        ${callout({ type: 'warning', title: 'Base prep is everything', body: '<p>A paver patio is only as good as the base under it. The failures we get called to fix are almost always thin or skipped base prep — pavers laid on a few inches of sand with no compacted gravel below. Done right (proper excavation, compacted road base, edge restraint), a Lincoln paver patio stays flat for decades. Done cheap, it ripples in two winters. Ask any installer exactly how deep their base is.</p>' })}

        <h2>What happens when something goes wrong</h2>
        <p>Nothing outdoors in Nebraska lasts forever untouched, so the real question is what a repair looks like. With concrete, a crack or a spalled surface means patching — and the patch never quite matches the color or texture, so the repair is permanently visible. Bad enough, and you're tearing out and re-pouring the whole slab.</p>
        <p>With pavers, you pull the affected units, fix the base, and drop them (or a few replacements) back in. Because the rest of the patio is the same pavers, the repair disappears. Keeping a small stack of leftover pavers from the original install makes this trivial years down the road.</p>

        <h2>Looks and resale</h2>
        <p>Stamped concrete can look great when new, but it fades and the pattern wears at high-traffic spots. Pavers hold their color and texture, come in a huge range of styles, and read as a premium feature to buyers. In Lincoln's competitive resale neighborhoods — Pine Lake, Stevens Creek, the Highlands — a quality paver patio is a selling point in a way a plain slab isn't.</p>

        <h2>So which should you choose?</h2>
        <ul>
            <li><strong>Choose concrete</strong> if upfront budget is the hard limit, the patio is utilitarian (a slab under a grill or shed), or you're not planning to stay in the home long.</li>
            <li><strong>Choose pavers</strong> if you'll keep the house 10+ years, you want an outdoor living space that lasts and adds value, or you simply don't want to watch a slab crack. Over a 25-year horizon, pavers usually win on total cost once you factor in concrete repairs and replacement.</li>
        </ul>
        ${callout({ type: 'tip', title: 'A middle path', body: '<p>Some homeowners pour a concrete pad where it\'s purely functional and spend the paver budget on the patio people actually see and use. There\'s no rule that says the whole yard has to be one material.</p>' })}

        <h2>Not sure which fits your yard?</h2>
        <p>We install both, so our recommendation isn\'t tied to selling you one or the other — it\'s tied to your lot, your budget, and how long you\'ll be there. <a href="/quote">Get a free on-site estimate</a> and we\'ll walk it with you, or <a href="/services/hardscaping">see our hardscaping work</a> first.</p>
        `,
        faqs: [
            { q: 'Are pavers worth it over concrete in Nebraska?', a: 'For most homeowners staying 10+ years, yes. Pavers cost more upfront but flex with Nebraska\'s freeze-thaw soil instead of cracking like a rigid concrete slab, last 30–50 years, repair invisibly, and add more resale value. Concrete is the better pick when upfront budget is the hard constraint or the patio is purely utilitarian.' },
            { q: 'Do paver patios crack like concrete?', a: 'No. A concrete slab is one rigid piece, so when the ground shifts it cracks. A paver patio is dozens of separate units on a compacted gravel base — when the ground moves, the pavers move with it and stay intact. If a section settles over the years, it\'s lifted and re-leveled rather than cracked.' },
            { q: 'Which is cheaper, pavers or concrete?', a: 'Concrete is cheaper to install — roughly $8–$15 per square foot for plain concrete versus $18–$30 for pavers in Lincoln. Over a 25-year span, though, pavers often come out ahead once you factor in concrete crack repairs and eventual slab replacement.' },
            { q: 'How long does a paver patio last in Lincoln, NE?', a: 'A properly built paver patio — deep compacted base, edge restraint, the right pavers — lasts 30 to 50 years in Lincoln. The key is base prep: failures almost always trace back to thin or skipped base work, not the pavers themselves.' },
        ],
        related: ['hardscaping', 'landscape-design'],
    },
    {
        slug: 'fire-pit-cost-lincoln-ne',
        title: 'Outdoor Fire Pit Cost & Ideas for Lincoln, NE (2026)',
        description: 'What an outdoor fire pit costs in Lincoln, Nebraska in 2026 — prefab kits vs. custom stone, wood-burning vs. gas, what drives the price, and the local rules to know before you build.',
        h1: 'Outdoor <em class="highlight">Fire Pit</em> Cost & Ideas for Lincoln, NE',
        sub: 'Prefab kit or custom stone? Wood or gas? What a built-in fire pit actually costs here, what changes the number, and the Lincoln rules worth checking first.',
        date: '2026-06-11',
        category: 'Hardscaping',
        imageAlt: 'Built-in stone fire pit on a paver patio in a Lincoln, Nebraska backyard',
        takeaways: [
            'A paver/block prefab fire pit kit, professionally installed, runs about $1,500–$3,500.',
            'A custom wood-burning stone or block fire pit typically runs $3,500–$6,500; gas units run $5,000–$9,000+ with the gas line.',
            'Wood-burning is cheaper and simpler; gas is push-button and cleaner but costs more and needs a plumbed line.',
            'Lincoln allows recreational fires with rules on size, placement, and burn bans — confirm current City of Lincoln / fire department guidance before you build.',
        ],
        body: `
        <p>A fire pit is one of the highest-payback things you can add to a Lincoln backyard — it stretches the usable season from March through November and turns a patio into a place people actually gather. Here's what one costs in 2026, the choices that move the price, and the local rules to check before you light it.</p>

        <h2>What an outdoor fire pit costs in Lincoln</h2>
        ${table({
            caption: 'Installed fire pit pricing in Lincoln, NE (2026)',
            headers: ['Type', 'Installed cost', 'Best for'],
            rows: [
                ['Prefab paver/block kit (wood-burning)', '$1,500–$3,500', 'A clean, durable pit on a budget'],
                ['Custom stone or block (wood-burning)', '$3,500–$6,500', 'A built-in feature matched to your patio'],
                ['Gas (natural gas or propane)', '$5,000–$9,000+', 'Push-button convenience, no smoke or ash'],
            ],
        })}
        <p>Those numbers assume professional installation on a stable, level base. A loose ring of blocks dropped on the grass is cheaper, but it shifts, scorches the lawn, and looks it — most homeowners who want a fire pit want one that's built in and permanent.</p>

        <h2>Wood-burning vs. gas</h2>
        <p>This is the first real decision, and it drives everything downstream.</p>
        <ul>
            <li><strong>Wood-burning</strong> is cheaper to build, gives you the real crackle and a bigger flame, and has no fuel plumbing. The trade-offs are smoke, ash cleanup, hauling firewood, and needing to fully extinguish it.</li>
            <li><strong>Gas</strong> (natural gas or propane) lights with a switch, throws no smoke or sparks, and shuts off instantly — great for families and tighter lots. It costs more because you're paying for the burner, the safety components, and running a gas line from the house (a licensed plumber job).</li>
        </ul>
        ${callout({ type: 'tip', title: 'Natural gas vs. propane', body: '<p>If your home already has natural gas, tapping it means you never refill a tank — convenient and cheaper to run, but it ties the pit to a fixed location and a plumber-run line. Propane is more flexible to place and easier to add later, but you manage tanks. For a permanent built-in near the house, natural gas usually makes more sense in Lincoln.</p>' })}

        <h2>What drives the price up or down</h2>
        <ul>
            <li><strong>Materials.</strong> A standard concrete-block kit is the budget end; natural stone, premium pavers, or a stone veneer with a flagstone cap pushes it up.</li>
            <li><strong>Size and seating wall.</strong> A simple 36"–48" pit is one price; add a curved seating wall around it and you're building a small hardscape, not just a pit.</li>
            <li><strong>Gas line length.</strong> The farther the pit sits from the gas meter, the more trenching and pipe — a real line item on gas builds.</li>
            <li><strong>Base and patio.</strong> Setting a pit on an existing patio is simple; building the patio and the pit together is a combined project (often the smart way to do it).</li>
        </ul>

        <h2>Lincoln rules worth knowing before you build</h2>
        <p>Lincoln generally allows recreational fires (a fire pit, chiminea, or similar) on private property, but with common-sense rules — limits on the size of the fire, a minimum distance from structures and property lines, adult supervision, and a ban during declared burn bans or air-quality alerts. Gas appliances and any gas line will need the proper plumbing permit and inspection.</p>
        ${callout({ type: 'warning', title: 'Confirm the current rules', body: '<p>Local fire and burning rules change and are enforced by the City of Lincoln and Lincoln Fire &amp; Rescue. Before you build — especially for placement near a fence or house, or any gas connection — confirm the current requirements with the City. We build to keep clearances safe and code-friendly, but the homeowner should verify local rules for their specific lot.</p>' })}

        <h2>Pair it with the patio</h2>
        <p>The fire pits that look best and cost the least per square foot are the ones designed with the patio, not added as an afterthought. If you're already considering a patio, building the pit at the same time shares the base prep and gives you one cohesive space. See <a href="/blog/paver-patio-vs-concrete-lincoln-ne">pavers vs. concrete for the patio itself</a>, or browse our <a href="/services/hardscaping">hardscaping services</a>.</p>

        <h2>Get a fire pit quote</h2>
        <p>Tell us your space, your fuel preference, and your budget, and we\'ll design a fire pit that fits the yard and the way you\'ll use it. <a href="/quote">Request a free on-site estimate</a>.</p>
        `,
        faqs: [
            { q: 'How much does a built-in fire pit cost in Lincoln, NE?', a: 'A professionally installed prefab paver or block fire pit runs about $1,500–$3,500. A custom wood-burning stone or block pit typically runs $3,500–$6,500, and a gas fire pit runs $5,000–$9,000 or more once you include running the gas line.' },
            { q: 'Should I get a wood-burning or gas fire pit?', a: 'Wood-burning is cheaper to build and gives you a real flame and crackle, at the cost of smoke, ash, and hauling firewood. Gas lights with a switch, makes no smoke or sparks, and shuts off instantly, but costs more because of the burner and the plumbed gas line. Families on tighter lots often prefer gas; budget-minded buyers who want a big flame prefer wood.' },
            { q: 'Are fire pits legal in Lincoln, Nebraska?', a: 'Lincoln generally allows recreational fires on private property with rules on fire size, distance from structures and property lines, adult supervision, and no burning during a declared burn ban or air-quality alert. Gas connections require the proper plumbing permit. Always confirm the current requirements with the City of Lincoln and Lincoln Fire & Rescue before building.' },
            { q: 'Is it cheaper to build a fire pit with a patio?', a: 'Usually, yes — per square foot. Building the fire pit and patio together shares the excavation and base prep and produces one cohesive space, rather than retrofitting a pit onto an existing patio later. If you\'re already planning a patio, it\'s the most cost-effective time to add the pit.' },
        ],
        related: ['hardscaping', 'landscape-design'],
    },
    {
        slug: 'modern-landscape-design-lincoln-ne',
        title: 'Modern Landscape Design Ideas for Lincoln, NE (2026)',
        description: 'Modern landscape design ideas that actually work in Lincoln, Nebraska — clean lines, low-maintenance native plantings, hardscape-forward yards, and what design-build costs. From a local crew.',
        h1: 'Modern <em class="highlight">Landscape Design</em> Ideas for Lincoln, NE',
        sub: 'Clean lines, low-maintenance plantings, and outdoor living that survives Nebraska. What a modern Lincoln yard looks like in 2026 — and how to get there.',
        date: '2026-06-14',
        category: 'Landscape Design',
        imageAlt: 'Modern landscape design plan for a Lincoln, Nebraska backyard',
        takeaways: [
            'Modern in Nebraska means clean geometry, fewer plant varieties in bigger drifts, and hardscape doing the heavy lifting — not fussy, high-water beds.',
            'Lean on native and drought-tolerant plantings: they read modern, survive our swings, and cut watering and maintenance.',
            'Structure first (patios, walls, edging, paths), plants second — the bones are what make a yard look designed year-round.',
            'A design-build approach (one crew designs and builds it) avoids the gap where a pretty plan meets a contractor who can\'t execute it.',
        ],
        body: `
        <p>"Modern" landscaping gets thrown around a lot, and half the photos people send us are gorgeous yards shot in Arizona or the Pacific Northwest that would die or look out of place in Nebraska. Modern design absolutely works in Lincoln — but it has to be built for our clay soil, wind, and 100°-to-below-zero swings. Here's what a genuinely modern Lincoln yard looks like in 2026, and how we approach designing one.</p>

        <h2>What "modern" actually means here</h2>
        <p>Modern landscape design isn't a style you bolt on — it's a set of principles. In Lincoln they translate to:</p>
        <ul>
            <li><strong>Clean geometry.</strong> Straight lines, defined rectangles, intentional curves — not the wavy, do-everything beds of the early 2000s.</li>
            <li><strong>Restraint.</strong> Fewer plant varieties, repeated in bigger groups ("drifts"), instead of one of everything. It reads calmer and more designed.</li>
            <li><strong>Hardscape doing real work.</strong> Patios, walls, steel or stone edging, and clean paths give the yard structure that looks good in February, not just June.</li>
            <li><strong>Low maintenance on purpose.</strong> Modern yards lean on plants that thrive on neglect here, so the design still looks intentional in year three.</li>
        </ul>

        <h2>Plantings: native, structural, and drought-tolerant</h2>
        <p>The fastest way to make a Lincoln yard look modern <em>and</em> survive is to lean on native and drought-tolerant plants used structurally. Ornamental grasses (little bluestem, switchgrass, feather reed grass) give movement and winter structure. Coneflower, sedum, catmint, and Russian sage give long bloom with almost no fuss. Massed in clean drifts rather than dotted around, they look designed instead of wild. They also cut your water and maintenance — see our guide to <a href="/blog/native-drought-tolerant-plants-nebraska">native and drought-tolerant plants for Nebraska yards</a>.</p>
        ${callout({ type: 'tip', title: 'The "matrix" look, done right', body: '<p>The modern prairie/matrix style — big sweeps of grasses and perennials — is having a moment and it suits Nebraska perfectly. The trick is editing: 4–6 species repeated, with crisp edges and a hardscape frame, so it reads intentional and not like a field reclaiming your yard.</p>' })}

        <h2>Hardscape is the backbone</h2>
        <p>Modern yards are hardscape-forward. The structure is what makes them look finished year-round, and it's where a good crew earns its keep:</p>
        <ul>
            <li><strong>Large-format pavers</strong> with tight, clean joints — or poured concrete with crisp control joints — for patios and paths.</li>
            <li><strong>Clean edging</strong> (steel, aluminum, or a tidy paver soldier course) to separate beds, lawn, and gravel with a sharp line.</li>
            <li><strong>Block or natural-stone walls</strong> that double as seating and define levels on our sloped lots.</li>
            <li><strong>Gravel and ground-cover panels</strong> to reduce lawn and add texture without adding upkeep.</li>
        </ul>
        <p>Because our freeze-thaw winters are hard on rigid surfaces, how it's built matters as much as how it's drawn — see <a href="/blog/paver-patio-vs-concrete-lincoln-ne">pavers vs. concrete in Lincoln</a> before you commit a patio material.</p>

        <h2>Outdoor living and the finishing touches</h2>
        <p>Modern design treats the backyard as another room. A clean patio, a built-in <a href="/blog/fire-pit-cost-lincoln-ne">fire pit</a>, a seating wall, and simple low-voltage path or uplighting turn a flat lawn into a space you actually use from spring through fall. Lighting in particular is the detail people forget — it makes the design work after dark and is worth planning for early, even if you add it later.</p>

        <h2>What modern design-build costs in Lincoln</h2>
        <p>A modern look isn't necessarily more expensive — restraint can cost less than a busy, plant-heavy yard — but the hardscape drives the budget. Most full design-build yard transformations in Lincoln land anywhere from the mid-four-figures for a focused project (one patio, clean beds, edging) to $20,000+ for a complete back-to-front redesign with walls, patio, and planting. We give a fixed price after walking the property. For a broader cost breakdown, see <a href="/blog/landscaping-cost-lincoln-ne">how much landscaping costs in Lincoln</a>.</p>
        ${callout({ type: 'local', title: 'Design-build beats design-only', body: '<p>A common, expensive mistake: paying a designer for a beautiful plan, then handing it to whoever bids lowest to build. The plan and the build drift apart and the result disappoints. We design and build the same project, so what you approve is what gets installed — and we flag during design anything that won\'t hold up in Nebraska.</p>' })}

        <h2>Start with a plan</h2>
        <p>The best modern yards start with the bones — structure, levels, and flow — before a single plant is chosen. We do that planning in person, on your actual lot, accounting for your soil, slope, and how you'll use the space. See our <a href="/services/landscape-design">landscape design &amp; build service</a> or <a href="/quote">request a free design consultation</a>.</p>
        `,
        faqs: [
            { q: 'Does modern landscape design work in Nebraska\'s climate?', a: 'Yes — as long as it\'s built for it. Modern design in Lincoln means clean geometry and hardscape structure paired with native, drought-tolerant plantings that handle our clay soil, wind, and temperature swings. The mistake is copying designs from milder climates that won\'t survive here.' },
            { q: 'Is modern landscaping more expensive?', a: 'Not necessarily. Restraint — fewer plant varieties, clean lines — can cost less than a busy, plant-heavy yard. The budget is usually driven by how much hardscape (patios, walls, edging) you include. Most full design-build transformations in Lincoln range from the mid-four-figures to $20,000+ depending on scope.' },
            { q: 'What plants give a modern look but survive Lincoln winters?', a: 'Ornamental grasses like little bluestem and feather reed grass, plus coneflower, sedum, catmint, and Russian sage, massed in clean drifts. They\'re native or drought-tolerant, give long seasonal interest and winter structure, and need very little maintenance once established.' },
            { q: 'Should I hire a designer and a separate builder?', a: 'We recommend design-build — one crew that designs and installs the project — so the finished yard matches the approved plan and nothing gets lost in translation. Paying for a plan and then handing it to a separate low bidder is where most disappointing results come from.' },
        ],
        related: ['landscape-design', 'hardscaping'],
    },
    {
        slug: 'sod-installation-cost-lincoln-ne',
        title: 'How Much Does Sod Installation Cost in Lincoln, NE? (2026)',
        description: 'Real 2026 sod installation pricing in Lincoln, Nebraska — installed cost per square foot, what proper prep includes, sod vs. seed, and what makes the price move. From a local crew.',
        h1: 'How Much Does <em class="highlight">Sod Installation</em> Cost in Lincoln, NE?',
        sub: 'Installed cost per square foot, what real prep includes, and when sod is worth it over seed. Honest 2026 pricing from a Lincoln crew.',
        date: '2026-05-25',
        category: 'Lawn Care',
        imageAlt: 'Fresh rolls of sod being installed on a prepared Lincoln, NE lawn',
        takeaways: [
            'Professionally installed sod in Lincoln typically runs about $1.25–$2.50 per square foot, including prep and the sod itself.',
            'Most of the cost — and the result — is in the prep: grading, tilling, and soil work, not the sod rolls.',
            'Sod gives you an instant, erosion-proof lawn; seed is cheaper but takes a full season and careful watering to fill in.',
            'Small or hard-to-access yards cost more per square foot; big open areas cost less.',
        ],
        body: `
        <p>Sod gets you a finished, green, walk-on-it-soon lawn in an afternoon instead of babysitting seed for a season. The catch is that it costs more upfront — and how much depends far more on the prep than on the grass itself. Here's what sod installation actually costs in Lincoln in 2026.</p>

        <h2>What sod installation costs in Lincoln</h2>
        <p>For professionally installed sod — meaning prep plus delivery plus laying — typical Lincoln pricing in 2026 looks like this:</p>
        ${table({
            caption: 'Installed sod pricing in Lincoln, NE (2026)',
            headers: ['Project', 'Installed cost (per sq ft)', 'Notes'],
            rows: [
                ['Large open area (5,000+ sq ft)', '$1.25–$1.75', 'Best per-foot rate — easy access, efficient'],
                ['Typical yard section (1,000–5,000 sq ft)', '$1.50–$2.25', 'The most common range'],
                ['Small or tight area (under 1,000 sq ft)', '$2.00–$2.50+', 'Mobilization and hand-work raise the per-foot cost'],
            ],
        })}
        <p>As a rough feel: re-sodding a 2,000 sq ft front yard usually lands somewhere around $3,000–$4,500 installed, depending on how much prep and grading it needs. We quote a fixed number after seeing the site.</p>

        <h2>The prep is where the money (and the result) is</h2>
        <p>People assume they're paying for sod. They're mostly paying for everything that happens <em>before</em> the sod goes down — and that's exactly where cheap installs fail. Proper prep includes:</p>
        <ol>
            <li><strong>Killing or removing the old lawn/weeds</strong> so they don't grow up through the new sod.</li>
            <li><strong>Grading</strong> for drainage and a smooth surface — pulling soil away from the house and eliminating low spots.</li>
            <li><strong>Tilling and amending</strong> Lincoln's heavy clay so roots can actually penetrate, instead of laying sod on a hard pan where it struggles to knit in.</li>
            <li><strong>Rolling and laying tight</strong> with staggered seams, then a starter watering.</li>
        </ol>
        ${callout({ type: 'warning', title: 'Sod on bad prep is wasted money', body: '<p>The most common sod failure we get called to fix is beautiful rolls laid over un-tilled clay and rough grade. It looks great for two weeks, then the seams shrink, low spots pond, and the roots never tie in. If a quote is suspiciously cheap, ask what prep is included — that\'s almost always what got skipped.</p>' })}

        <h2>Sod vs. seed — which is worth it?</h2>
        <p>Sod costs more upfront but buys you time, certainty, and erosion control: an instant lawn you can use in 2–3 weeks, no muddy season, and no bare patches washing out on a slope. Seed is much cheaper but takes a full growing season to fill in and needs consistent watering and protection. The right pick depends on your timeline, slope, and budget — we break it down fully in <a href="/blog/sod-vs-seed-lincoln-ne">sod vs. seed for a new lawn in Lincoln</a>.</p>

        <h2>What moves the price</h2>
        <ul>
            <li><strong>Prep needed.</strong> A bare, roughly level dirt lot is cheap to sod; tearing out an old weedy lawn and regrading adds labor.</li>
            <li><strong>Access.</strong> A backyard reached only through a narrow gate means wheelbarrowing everything by hand — slower, pricier.</li>
            <li><strong>Grade and drainage work.</strong> If the yard needs real regrading or a drainage fix first, that's its own line item.</li>
            <li><strong>Sod type.</strong> Standard Kentucky bluegrass blend is the norm here; specialty blends cost more.</li>
            <li><strong>Size.</strong> Bigger areas spread the fixed mobilization cost out, so the per-foot rate drops.</li>
        </ul>

        <h2>Get a fixed sod quote</h2>
        <p>We'll look at your yard, tell you honestly whether sod or seed makes more sense, and give you a flat installed price that includes the prep — not a per-foot teaser that balloons later. See our <a href="/services/lawn-care">lawn care services</a> or <a href="/quote?category=lawn">request a free quote</a>.</p>
        `,
        faqs: [
            { q: 'How much does it cost to sod a yard in Lincoln, NE?', a: 'Professionally installed sod in Lincoln typically runs about $1.25–$2.50 per square foot including prep and the sod itself, so a 2,000 sq ft front yard usually lands around $3,000–$4,500 installed. Larger open areas cost less per foot; small or hard-to-access yards cost more.' },
            { q: 'Why is sod installation more than just the price of the sod?', a: 'Because most of the cost — and the result — is in the prep: killing the old lawn, grading for drainage, and tilling and amending Lincoln\'s heavy clay so the roots can knit in. Sod laid over un-prepped clay looks good briefly, then the seams shrink and the roots never establish. The prep is what you\'re really paying for.' },
            { q: 'Is sod or seed better for a new lawn in Lincoln?', a: 'Sod gives you an instant, usable, erosion-proof lawn in 2–3 weeks but costs more upfront. Seed is much cheaper but takes a full growing season and careful watering to fill in. Sod is the better choice for slopes, tight timelines, and high-traffic areas; seed can work when budget matters most and you can wait.' },
            { q: 'How soon can you walk on or mow new sod?', a: 'Keep traffic light for the first 2–3 weeks while the roots knit into the soil, and hold off mowing until it\'s rooted enough that a gentle tug doesn\'t lift it — usually around two to three weeks, then mow high on a sharp blade.' },
        ],
        related: ['lawn-care', 'landscape-design'],
    },
    {
        slug: 'when-to-plant-trees-shrubs-nebraska',
        title: 'The Best Time to Plant Trees & Shrubs in Nebraska (Lincoln Guide)',
        description: 'When to plant trees and shrubs in Nebraska for the best survival — why fall usually wins, the spring window, the summer danger zone, and how to plant so they make it through a Lincoln winter.',
        h1: 'The Best Time to Plant <em class="highlight">Trees &amp; Shrubs</em> in Nebraska',
        sub: 'Fall vs. spring, the summer danger zone, and how to give a new tree the best shot at surviving its first Lincoln winter.',
        date: '2026-06-07',
        category: 'Garden Beds',
        imageAlt: 'Newly planted tree with mulch ring in a Lincoln, Nebraska yard',
        takeaways: [
            'Fall (mid-September to late October) is usually the best time to plant trees and shrubs in Lincoln — roots establish in warm soil while the top is dormant.',
            'Early spring is the second-best window; summer is the riskiest time because heat and transplant shock work against a new root system.',
            'Dig the hole 2–3× as wide as the root ball but no deeper — planting too deep is the #1 killer of new trees here.',
            'Mulch in a flat ring (never a volcano against the trunk) and water deeply and infrequently, especially heading into the first winter.',
        ],
        body: `
        <p>"When should I plant this tree?" is one of the most common questions we get, and the answer surprises people: for most trees and shrubs in Nebraska, <strong>fall beats spring.</strong> Timing matters more than almost anything else for whether a new plant thrives or limps along for years. Here's how to get it right in Lincoln's climate.</p>

        <h2>Fall is the best window (mid-September to late October)</h2>
        <p>It feels backwards to plant as everything's going dormant, but it's exactly why fall works. In fall, the soil is still warm from summer while the air is cooling. The tree stops pushing leaves and pours its energy into <em>roots</em> instead — establishing a strong system before winter. Then it gets a full, cool, rainy spring to keep rooting before the next summer's heat ever tests it.</p>
        <p>Plant in fall and you're giving the tree two root-growing seasons (this fall and next spring) before its first real summer. That head start is the whole game.</p>
        ${callout({ type: 'local', title: 'The Lincoln fall window', body: '<p>Aim for <strong>mid-September through late October</strong> — early enough that roots get 4–6 weeks to establish before the ground freezes, late enough that the plant has gone dormant up top. Evergreens are the exception: plant them a little earlier (late summer to early fall) since they keep losing moisture through winter and need more time to root in.</p>' })}

        <h2>Spring is a solid second choice</h2>
        <p>Early spring — after the ground thaws but before the heat arrives, roughly April into early May — is the next-best window. The tree has the whole growing season ahead of it. The catch is that a spring-planted tree hits its first Nebraska summer with a young, shallow root system, so it needs much more attentive watering through July and August than a fall-planted one.</p>

        <h2>Avoid the summer danger zone</h2>
        <p>Planting in the heat of summer (late June through August) is the riskiest time. The plant is trying to push top growth and recover from transplant shock at the same time the heat is pulling moisture out of it faster than its cut-back roots can replace. It can be done with diligent watering, but you're fighting the season the whole way. If you can wait for fall, wait.</p>

        <h2>How to plant so it actually survives</h2>
        <p>Timing gets the plant in the ground; technique keeps it alive. The fundamentals:</p>
        <ol>
            <li><strong>Dig wide, not deep.</strong> The hole should be 2–3 times as wide as the root ball but only as deep as the root ball is tall. Roots spread out, not down — a wide hole in our compacted clay gives them room to run.</li>
            <li><strong>Don't plant too deep.</strong> The root flare (where the trunk widens into roots) should sit at or slightly above grade. Burying the flare is the single most common way new trees die slowly in Lincoln yards.</li>
            <li><strong>Loosen and backfill with native soil.</strong> Skip the heavy amendments — you want roots to grow into the surrounding clay, not circle inside a cushy pocket they never leave.</li>
            <li><strong>Mulch in a flat ring, not a volcano.</strong> Two to three inches of mulch over the root zone, pulled back a few inches from the trunk. Mulch piled against the bark traps moisture and invites rot and rodents.</li>
            <li><strong>Water deeply and infrequently.</strong> A long, slow soak that wets the whole root ball, then let it dry slightly before the next one. That trains roots to go deep instead of staying shallow.</li>
        </ol>
        ${callout({ type: 'warning', title: 'Water it into winter', body: '<p>The most common reason a "hardy" tree dies its first winter isn\'t the cold — it\'s going into a hard freeze dry. Keep watering a fall-planted tree (especially evergreens) right up until the ground freezes. A well-hydrated root ball survives winter; a dry one desiccates. This is part of the same routine as <a href="/blog/winterizing-landscape-lincoln-ne">winterizing the rest of your landscape</a>.</p>' })}

        <h2>Pick plants that belong here</h2>
        <p>The best timing won't save a plant that doesn't suit Nebraska. Choose species rated for our zone and conditions, and lean toward natives and proven performers that handle clay soil, wind, and our swings — the same logic behind our guide to <a href="/blog/native-drought-tolerant-plants-nebraska">native and drought-tolerant plants for Nebraska yards</a>. A tree that fits the site needs far less babying than a trendy one that's barely hanging on.</p>

        <h2>Want it planted right?</h2>
        <p>We plant trees, shrubs, and full beds across Lincoln — sited, dug, and mulched the way that gives them the best shot, at the right time of year. See our <a href="/services/garden-beds">garden beds &amp; planting service</a> or <a href="/quote?category=garden">request a free quote</a>.</p>
        `,
        faqs: [
            { q: 'When is the best time to plant trees in Nebraska?', a: 'For most trees and shrubs in Lincoln, fall — roughly mid-September through late October — is the best time. The soil is still warm so roots establish, while the top is dormant, and the plant then gets a full cool spring to keep rooting before its first summer. Early spring is the second-best window; summer is the riskiest.' },
            { q: 'Can I plant a tree in the summer in Lincoln?', a: 'You can, but it\'s the hardest time. Summer heat and transplant shock work against a young root system, so it takes diligent deep watering to pull a summer planting through. If you can wait for fall, the tree will establish far more easily.' },
            { q: 'Why do newly planted trees die in Nebraska?', a: 'The two most common causes are planting too deep (burying the root flare, which slowly suffocates the tree) and going into winter dry. Plant with the root flare at grade, mulch in a flat ring rather than a volcano against the trunk, and keep watering until the ground freezes the first winter.' },
            { q: 'How wide should I dig the hole for a new tree?', a: 'Dig the hole two to three times as wide as the root ball, but no deeper than the root ball is tall. Roots spread outward, and a wide hole loosens Lincoln\'s compacted clay so they can establish — while keeping the tree from settling too deep.' },
        ],
        related: ['garden-beds', 'landscape-design'],
    },
    {
        slug: 'fence-types-compared-lincoln-ne',
        title: 'Wood vs. Chain Link vs. Ornamental Fence in Lincoln, NE',
        description: 'Compare the main fence types for a Lincoln, Nebraska yard — wood privacy, chain link, and ornamental iron. Cost, privacy, maintenance, lifespan, and which fits your goal. From a local installer.',
        h1: 'Wood vs. Chain Link vs. <em class="highlight">Ornamental</em> Fence in Lincoln',
        sub: 'Privacy, budget, or curb appeal? A straight comparison of the fence types we install in Lincoln — what each does best, what it costs to own, and how it holds up to Nebraska.',
        date: '2026-05-31',
        category: 'Fencing',
        imageAlt: 'Wood privacy fence in a Lincoln, Nebraska backyard',
        takeaways: [
            'Wood privacy is the go-to for backyards — full privacy and a warm look, at the cost of periodic staining and a 15–20 year lifespan.',
            'Chain link is the budget-friendly, low-maintenance pick for containing pets and kids when privacy isn\'t the goal.',
            'Ornamental iron/aluminum is the curb-appeal and durability choice — see-through, long-lived, low-maintenance, but the priciest.',
            'In Nebraska the install matters as much as the material: posts have to be set deep and in concrete to survive freeze-thaw and wind.',
        ],
        body: `
        <p>"What kind of fence should I get?" almost always comes down to one question: what's the fence <em>for</em>? Privacy, keeping the dog in, defining the yard, or curb appeal? Each material wins at a different job. Here's a straight comparison of the fence types we install in Lincoln, with the trade-offs that actually matter here.</p>

        <h2>The quick comparison</h2>
        ${table({
            caption: 'Fence types compared for Lincoln, NE',
            headers: ['Type', 'Best for', 'Maintenance', 'Lifespan'],
            rows: [
                ['Wood privacy', 'Full backyard privacy + warm look', 'Stain/seal every 2–3 yrs', '15–20 yrs'],
                ['Chain link', 'Budget, pets/kids, low upkeep', 'Almost none', '20+ yrs'],
                ['Ornamental iron/aluminum', 'Curb appeal + durability', 'Very low', '30+ yrs'],
                ['Picket (wood)', 'Front-yard charm, defining space', 'Stain/seal periodically', '15–20 yrs'],
            ],
        })}
        <p>For real dollar figures on each, see our <a href="/blog/fence-cost-lincoln-ne">fence cost guide for Lincoln</a> — this post is about choosing the right type, not the exact price.</p>

        <h2>Wood privacy fence</h2>
        <p>The default for Lincoln backyards, and for good reason: a 6-foot wood privacy fence gives you a full visual screen, blocks wind, and has a warm, classic look that suits most homes. It's mid-priced and endlessly customizable — board-on-board, shadowbox, lattice top, different heights.</p>
        <p>The trade-off is upkeep. Wood needs to be cleaned and re-stained or sealed every couple of years to fight Nebraska's sun, snow, and swings; skip it and it grays, warps, and shortens its life. Plan on 15–20 years with good maintenance.</p>
        ${callout({ type: 'tip', title: 'Shadowbox = neighbor-friendly privacy', body: '<p>A shadowbox (board-on-both-sides) wood fence looks finished from both yards and lets a little air through, which actually helps it survive Nebraska wind better than a solid wall that catches every gust. It\'s a popular middle ground when a fence sits on a shared property line.</p>' })}

        <h2>Chain link fence</h2>
        <p>When privacy isn't the point, chain link is hard to beat on value. It's the cheapest option, lasts 20+ years, and needs essentially zero maintenance. It's the practical pick for containing a dog or kids, fencing a back lot line, or anywhere you want a boundary without spending on looks. Black vinyl-coated chain link looks far better than bare galvanized and "disappears" against a yard — a small upgrade worth considering.</p>

        <h2>Ornamental iron &amp; aluminum</h2>
        <p>If curb appeal and longevity are the goal, ornamental (steel or aluminum) is the top of the range. It's elegant, see-through (great for showing off a yard or pool area while still enclosing it), extremely durable, and nearly maintenance-free — 30+ years without much fuss. It's the most expensive per foot, and it doesn't provide privacy, but for a front yard, a pool enclosure, or a decorative boundary, nothing else looks like it.</p>

        <h2>What matters in Nebraska: the install</h2>
        <p>Here's the part homeowners underestimate — the material matters less than how the fence is set. Nebraska's freeze-thaw cycle heaves shallow posts right out of the ground, and our wind leans on anything that isn't anchored properly. A fence that lasts here has:</p>
        <ul>
            <li><strong>Posts set deep</strong> — below the frost line — and in <strong>concrete</strong>, so winter heave and wind can't move them.</li>
            <li><strong>Proper spacing and bracing</strong> so long runs and gates don't sag.</li>
            <li><strong>Gates hung to stay square</strong> through the seasons, not just on install day.</li>
        </ul>
        <p>A cheap fence set in shallow, dirt-tamped holes looks fine for a year and then starts leaning. We set posts deep and in concrete on every job — it's the difference between a fence that lasts its full life and one you're fixing in three winters.</p>
        ${callout({ type: 'warning', title: 'Check the line and the rules first', body: '<p>Before any fence goes in, the property line should be confirmed and you should check whether your neighborhood or HOA has fence rules (height, material, or "good side out" requirements). Lincoln also has placement and permit considerations depending on the project. We help sort this out before we dig — it\'s far cheaper than moving a finished fence.</p>' })}

        <h2>So which should you choose?</h2>
        <ul>
            <li><strong>Want privacy?</strong> Wood privacy (or a shadowbox for shared lines).</li>
            <li><strong>Want it cheap and low-maintenance to contain pets/kids?</strong> Chain link, ideally black vinyl-coated.</li>
            <li><strong>Want curb appeal and decades of durability?</strong> Ornamental iron or aluminum.</li>
            <li><strong>Front-yard charm?</strong> A wood picket.</li>
        </ul>
        <p>Still not sure? We'll walk your yard, talk through the goal and budget, and give you a fixed-price quote on the type that fits. See our <a href="/services/fencing">fence installation service</a> or <a href="/quote?category=fence">request a free quote</a>.</p>
        `,
        faqs: [
            { q: 'What is the cheapest type of fence in Lincoln, NE?', a: 'Chain link is the most budget-friendly fence to install and owns the lowest lifetime cost because it needs almost no maintenance. It doesn\'t provide privacy, so it\'s best for containing pets and kids or marking a boundary. Black vinyl-coated chain link looks much better than bare galvanized for a small upgrade.' },
            { q: 'What is the best fence for privacy?', a: 'A 6-foot wood privacy fence is the standard choice for full backyard privacy in Lincoln — it blocks sightlines and wind and has a warm, classic look. A shadowbox style looks finished from both sides and handles Nebraska wind better than a solid panel. The trade-off is staining or sealing every couple of years.' },
            { q: 'How long does a fence last in Nebraska?', a: 'It depends on material and installation: wood lasts about 15–20 years with regular staining, chain link 20+ years, and ornamental iron or aluminum 30+ years. In Nebraska the install is decisive — posts set deep and in concrete survive freeze-thaw and wind, while shallow-set posts heave and lean within a few years regardless of the material.' },
            { q: 'Do I need a permit to build a fence in Lincoln, NE?', a: 'Lincoln has placement, height, and (in some cases) permit considerations, and many neighborhoods or HOAs add their own fence rules. It\'s worth confirming the property line and the local requirements before installing. We help sort out placement and rules before we dig so the finished fence doesn\'t have to be moved.' },
        ],
        related: ['fencing', 'property-cleanup'],
    },
];

// =====================================================================
// TEMPLATES
// =====================================================================

const SERVICE_LABELS = {
    'lawn-care':         { title: 'Lawn Care', icon: '🌿', desc: 'Mowing, seasonal cleanups, leaf removal, year-round maintenance.' },
    'garden-beds':       { title: 'Garden & Beds', icon: '🌺', desc: 'Garden bed installation, mulching, edging, plant transplants.' },
    'hardscaping':       { title: 'Hardscaping', icon: '🧱', desc: 'Paver patios, walkways, retaining walls, outdoor living.' },
    'fencing':           { title: 'Fencing', icon: '🪵', desc: 'Wood privacy, picket, chain link & ornamental iron — posts set deep for Nebraska weather.' },
    'property-cleanup':  { title: 'Property Cleanup', icon: '🧹', desc: 'Junk removal, debris hauling, overgrown yard restoration.' },
    'landscape-design':  { title: 'Landscape Design', icon: '🎨', desc: 'Concept-to-completion outdoor design and build.' },
};

function areaSchema(area) {
    const areaName = area.h1.replace(/<[^>]+>/g, '').trim();
    const url = `https://luckylandscapes.com/areas/${area.slug}`;
    const offers = (area.services || []).map(s => ({
        '@type': 'Offer',
        itemOffered: {
            '@type': 'Service',
            name: SERVICE_LABELS[s].title,
            url: `https://luckylandscapes.com/services/${s}`,
        },
    }));
    const faqs = (area.faqs || []).map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
    }));
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
                '@id': `${url}#business`,
                name: `Lucky Landscapes — ${areaName}`,
                parentOrganization: { '@id': 'https://luckylandscapes.com/#business' },
                url,
                telephone: '+1-402-405-5475',
                email: 'rileykopf@luckylandscapes.com',
                priceRange: '$$',
                image: 'https://luckylandscapes.com/images/og-card.png',
                logo: 'https://luckylandscapes.com/images/Icon.png',
                description: area.description,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Lincoln',
                    addressRegion: 'NE',
                    addressCountry: 'US',
                },
                geo: { '@type': 'GeoCoordinates', latitude: 40.8136, longitude: -96.7026 },
                hasMap: 'https://www.google.com/maps?cid=2884806323034838689',
                areaServed: [
                    { '@type': 'Place', name: areaName },
                    ...(area.zips || []).map(zip => ({ '@type': 'PostalCodeRange', name: `ZIP ${zip}`, postalCode: zip })),
                ],
                openingHoursSpecification: [
                    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'], opens: '07:00', closes: '19:00' },
                    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '08:00', closes: '17:00' },
                ],
                hasOfferCatalog: {
                    '@type': 'OfferCatalog',
                    name: `Landscaping Services in ${areaName}`,
                    itemListElement: offers,
                },
                // aggregateRating intentionally omitted: GSC flags "Invalid object type
                // for field <parent_node>" when the rating sits on a type without backing
                // Review nodes. Reviews live on the homepage LocalBusiness only.
                sameAs: [
                    'https://www.google.com/maps?cid=2884806323034838689',
                    'https://www.facebook.com/luckylandscapes',
                    'https://www.instagram.com/lucky.landscapes/',
                ],
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://luckylandscapes.com/' },
                    { '@type': 'ListItem', position: 2, name: 'Service Areas', item: 'https://luckylandscapes.com/areas' },
                    { '@type': 'ListItem', position: 3, name: areaName, item: url },
                ],
            },
            ...(faqs.length ? [{ '@type': 'FAQPage', mainEntity: faqs }] : []),
        ],
    };
}

// Strip HTML from an area's h1 for use as a plain display label.
function areaLabel(area) {
    return area.h1.replace(/<[^>]+>/g, '').trim();
}

function areasHubSchema() {
    const url = 'https://luckylandscapes.com/areas';
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'CollectionPage',
                '@id': `${url}#webpage`,
                url,
                name: 'Landscaping Service Areas — Lincoln, NE',
                description: 'The Lincoln, NE neighborhoods and surrounding towns Lucky Landscapes serves.',
                isPartOf: { '@id': 'https://luckylandscapes.com/#website' },
                about: { '@id': 'https://luckylandscapes.com/#business' },
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://luckylandscapes.com/' },
                    { '@type': 'ListItem', position: 2, name: 'Service Areas', item: url },
                ],
            },
            {
                '@type': 'ItemList',
                name: 'Lucky Landscapes Service Areas',
                itemListElement: AREAS.map((a, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    name: areaLabel(a),
                    url: `https://luckylandscapes.com/areas/${a.slug}`,
                })),
            },
        ],
    };
}

// Service Areas hub page (/areas) — a rankable "areas we serve" landing page that
// links out to every neighborhood/town page. Gives the area pages a real parent
// (the breadcrumb points here) and a single discoverable hub.
function renderAreasHub() {
    const canonical = 'https://luckylandscapes.com/areas';
    const title = 'Landscaping Service Areas in Lincoln, NE — Lucky Landscapes';
    const description = 'The Lincoln, NE neighborhoods and surrounding towns Lucky Landscapes serves — East & Northwest Lincoln, Pine Lake, South Lincoln, Hickman, Waverly, Seward, and more. Free local estimates, 24-hour response.';
    const cards = AREAS.map(a => `
                    <a href="/areas/${a.slug}" class="home-service-card">
                        <div class="home-service-icon">📍</div>
                        <h3>${areaLabel(a)}</h3>
                        <p>${a.description}</p>
                        <span class="home-service-link">View this area →</span>
                    </a>`).join('');

    return `${head({ title, description, canonical, schema: areasHubSchema() })}

        <section class="svc-hero">
            <div class="svc-hero-bg"></div>
            <div class="container">
                <div class="svc-hero-content">
                    <div class="hero-badge">
                        <img src="/images/Icon.png" alt="" />
                        <span>Lincoln, NE &amp; Surrounding Areas</span>
                    </div>
                    <h1>Landscaping <em class="highlight">Service Areas</em></h1>
                    <p class="hero-sub">We're a local, owner-run crew based in Lincoln. Here's where we work — every Lincoln neighborhood plus the surrounding towns. Same crew, same fixed-price quotes, same 24-hour response across all of them.</p>
                    <div class="hero-buttons">
                        <a href="/quote" class="btn btn-primary btn-lg">Get a Free Estimate</a>
                        <a href="tel:+14024055475" class="btn btn-outline btn-lg">📞 (402) 405-5475</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="svc-features">
            <div class="container">
                <div class="svc-features-header reveal">
                    <p class="section-label">Where we work</p>
                    <h2 class="section-title">Lincoln &amp; the Towns Around It</h2>
                </div>
                <div style="max-width: 760px; margin: 0 auto 1rem; line-height: 1.7; text-align:center;">
                    <p>Lucky Landscapes serves all of Lincoln and the nearby communities of Lancaster County. We don't add a trip charge anywhere inside Lincoln, and we cover the surrounding towns for project work (a small minimum applies on the farther ones). Pick your area below for the local details, or just <a href="/quote">request a free estimate</a> — we'll come look in person.</p>
                </div>
            </div>
        </section>

        <section class="home-services-section">
            <div class="home-services-bg"></div>
            <div class="container">
                <div class="home-services-header reveal">
                    <p class="section-label section-label--light">Service Areas</p>
                    <h2 class="section-title section-title--light">Find Your Neighborhood</h2>
                </div>
                <div class="home-services-grid stagger-children">${cards}
                </div>
            </div>
        </section>
${REVIEWS_STRIP}
${FOUR_LEAF}

        <section class="svc-cta">
            <div class="container">
                <div class="svc-cta-content reveal">
                    <h2>Don't see your exact neighborhood?</h2>
                    <p>If you're in or around Lincoln, we almost certainly cover you. Tell us your address and project — free estimate, 24-hour response, no obligation.</p>
                    <div class="hero-buttons">
                        <a href="/quote" class="btn btn-primary btn-lg">Request My Free Estimate</a>
                        <a href="tel:+14024055475" class="btn btn-outline btn-lg">📞 Call Now</a>
                    </div>
                </div>
            </div>
        </section>

${pageEnd()}`;
}

function postSchema(post) {
    const url = `https://luckylandscapes.com/blog/${post.slug}`;
    const { words, minutes } = postStats(post);
    const image = ogImageFor(post);
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'BlogPosting',
                '@id': `${url}#post`,
                headline: post.title.replace(' — Lucky Landscapes', ''),
                datePublished: post.date,
                dateModified: post.date,
                author: { '@type': 'Organization', '@id': 'https://luckylandscapes.com/#business', name: 'Lucky Landscapes' },
                publisher: {
                    '@type': 'Organization',
                    name: 'Lucky Landscapes',
                    logo: { '@type': 'ImageObject', url: 'https://luckylandscapes.com/images/Icon.png' },
                },
                description: post.description,
                image,
                articleSection: post.category,
                keywords: [post.category, 'Lincoln NE', 'landscaping'].join(', '),
                wordCount: words,
                timeRequired: `PT${minutes}M`,
                inLanguage: 'en-US',
                mainEntityOfPage: { '@type': 'WebPage', '@id': url },
                isPartOf: { '@id': 'https://luckylandscapes.com/blog/#blog' },
                about: { '@id': 'https://luckylandscapes.com/#business' },
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://luckylandscapes.com/' },
                    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://luckylandscapes.com/blog/' },
                    { '@type': 'ListItem', position: 3, name: post.title.replace(' — Lucky Landscapes', ''), item: url },
                ],
            },
            ...((post.faqs || []).length ? [{
                '@type': 'FAQPage',
                mainEntity: post.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
            }] : []),
        ],
    };
}

function renderArea(area) {
    const canonical = `https://luckylandscapes.com/areas/${area.slug}`;
    const services = area.services.map(s => `
                    <a href="/services/${s}" class="home-service-card">
                        <div class="home-service-icon">${SERVICE_LABELS[s].icon}</div>
                        <h3>${SERVICE_LABELS[s].title}</h3>
                        <p>${SERVICE_LABELS[s].desc}</p>
                        <span class="home-service-link">Learn More →</span>
                    </a>`).join('');
    const why = area.whyHere.map(w => `
                    <div class="about-card">
                        <div class="about-card-icon" style="font-size:1.6rem; display:flex; align-items:center; justify-content:center;">${w.icon}</div>
                        <h3>${w.title}</h3>
                        <p>${w.text}</p>
                    </div>`).join('');
    const faqs = area.faqs.map((f, i) => `
                    <details class="faq-item"${i === 0 ? ' open' : ''}>
                        <summary class="faq-question">${f.q}</summary>
                        <div class="faq-answer"><p>${f.a}</p></div>
                    </details>`).join('');

    return `${head({ title: area.title, description: area.description, canonical, schema: areaSchema(area) })}

        <section class="svc-hero">
            <div class="svc-hero-bg"></div>
            <div class="container">
                <div class="svc-hero-content">
                    <div class="hero-badge">
                        <img src="/images/Icon.png" alt="" />
                        <span>Service Area • ZIP ${area.zips.join(', ')}</span>
                    </div>
                    <h1>${area.h1}</h1>
                    <p class="hero-sub">${area.sub}</p>
                    <div class="hero-buttons">
                        <a href="/quote" class="btn btn-primary btn-lg">Request a Free Estimate</a>
                        <a href="tel:+14024055475" class="btn btn-outline btn-lg">📞 (402) 405-5475</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="svc-features">
            <div class="container">
                <div class="svc-features-header reveal">
                    <p class="section-label">About this area</p>
                    <h2 class="section-title">Local Crew, Local Knowledge</h2>
                </div>
                <div style="max-width: 760px; margin: 0 auto; line-height: 1.7;">
                    ${area.intro}
                </div>
            </div>
        </section>

        <section class="about-section">
            <div class="container">
                <div class="about-header reveal">
                    <p class="section-label">Why homeowners here pick us</p>
                    <h2 class="section-title">A Few Things That Matter Out Here</h2>
                </div>
                <div class="about-grid stagger-children">${why}
                </div>
            </div>
        </section>

        <section class="home-services-section">
            <div class="home-services-bg"></div>
            <div class="container">
                <div class="home-services-header reveal">
                    <p class="section-label section-label--light">Services We Offer Here</p>
                    <h2 class="section-title section-title--light">All Our Services Cover This Area</h2>
                </div>
                <div class="home-services-grid stagger-children">${services}
                </div>
            </div>
        </section>

        <section class="faq-section">
            <div class="container">
                <div class="faq-header reveal">
                    <p class="section-label">FAQ</p>
                    <h2 class="section-title">Common Questions From This Area</h2>
                </div>
                <div class="faq-grid stagger-children">${faqs}
                </div>
            </div>
        </section>
${REVIEWS_STRIP}
${FOUR_LEAF}

        <section class="svc-cta">
            <div class="container">
                <div class="svc-cta-content reveal">
                    <h2>Ready to talk?</h2>
                    <p>Free estimate, 24-hour response, no obligation. Tell us about your project and we'll come look in person.</p>
                    <div class="hero-buttons">
                        <a href="/quote" class="btn btn-primary btn-lg">Request My Free Estimate</a>
                        <a href="tel:+14024055475" class="btn btn-outline btn-lg">📞 Call Now</a>
                    </div>
                </div>
            </div>
        </section>

${pageEnd()}`;
}

// Blog post card — shared by the index grid and the "more from the blog"
// related rail. Carries data-* attributes the index uses for live filtering.
function postCard(p) {
    const { minutes } = postStats(p);
    const img = p.image || '/images/banner.jpg';
    const cleanTitle = p.title.replace(' — Lucky Landscapes', '');
    const haystack = `${cleanTitle} ${p.description} ${(p.takeaways || []).join(' ')}`
        .replace(/<[^>]+>/g, '').replace(/"/g, '&quot;');
    return `
                <a class="blog-card" href="/blog/${p.slug}" data-title="${cleanTitle.replace(/"/g, '&quot;')}" data-category="${p.category}" data-date="${p.date}" data-keywords="${haystack}">
                    <div class="blog-card-media">
                        <img src="${img}" alt="${(p.imageAlt || cleanTitle).replace(/"/g, '&quot;')}" loading="lazy" width="400" height="260" />
                        <span class="blog-card-chip">${p.category}</span>
                    </div>
                    <div class="blog-card-body">
                        <p class="blog-card-meta"><time datetime="${p.date}">${fmtDate(p.date)}</time> · ${minutes} min read</p>
                        <h3 class="blog-card-title">${cleanTitle}</h3>
                        <p class="blog-card-desc">${p.description}</p>
                        <span class="blog-card-link">Read more →</span>
                    </div>
                </a>`;
}

function renderPost(post) {
    const canonical = `https://luckylandscapes.com/blog/${post.slug}`;
    const cleanTitle = post.title.replace(' — Lucky Landscapes', '');
    const ogImage = ogImageFor(post);
    const { minutes } = postStats(post);
    const { html: bodyHtml, toc } = buildToc(post.body);

    const related = (post.related || []).map(s => `
                    <a href="/services/${s}" class="home-service-card">
                        <div class="home-service-icon">${SERVICE_LABELS[s].icon}</div>
                        <h3>${SERVICE_LABELS[s].title}</h3>
                        <p>${SERVICE_LABELS[s].desc}</p>
                        <span class="home-service-link">Learn More →</span>
                    </a>`).join('');

    // Related posts: same category first, then most-recent others, excluding self.
    const relatedPosts = POSTS
        .filter(p => p.slug !== post.slug)
        .sort((a, b) => {
            const sa = a.category === post.category ? 0 : 1;
            const sb = b.category === post.category ? 0 : 1;
            if (sa !== sb) return sa - sb;
            return b.date.localeCompare(a.date);
        })
        .slice(0, 3);

    const tocHtml = toc.length >= 3 ? `
                <aside class="post-toc-wrap">
                    <details class="post-toc" open>
                        <summary class="post-toc-title">On this page</summary>
                        <nav class="post-toc-nav"><ol>${toc.map(t => `
                            <li><a href="#${t.id}">${t.text}</a></li>`).join('')}
                        </ol></nav>
                    </details>
                </aside>` : '';

    const takeawaysHtml = (post.takeaways || []).length ? `
                    <div class="key-takeaways">
                        <p class="key-takeaways-title">The short version</p>
                        <ul>${post.takeaways.map(t => `
                            <li>${t}</li>`).join('')}
                        </ul>
                    </div>` : '';

    const faqsHtml = (post.faqs || []).length ? `
        <section class="faq-section">
            <div class="container">
                <div class="faq-header reveal">
                    <p class="section-label">FAQ</p>
                    <h2 class="section-title">Common Questions</h2>
                </div>
                <div class="faq-grid stagger-children">${post.faqs.map((f, i) => `
                    <details class="faq-item"${i === 0 ? ' open' : ''}>
                        <summary class="faq-question">${f.q}</summary>
                        <div class="faq-answer"><p>${f.a}</p></div>
                    </details>`).join('')}
                </div>
            </div>
        </section>` : '';

    return `${head({ title: post.title, description: post.description, canonical, schema: postSchema(post), image: ogImage })}

        <div class="reading-progress" aria-hidden="true"><i id="reading-progress"></i></div>

        <nav class="post-breadcrumb" aria-label="Breadcrumb">
            <div class="container">
                <a href="/">Home</a><span class="post-breadcrumb-sep">/</span><a href="/blog/">Blog</a><span class="post-breadcrumb-sep">/</span><span class="post-breadcrumb-current">${cleanTitle}</span>
            </div>
        </nav>

        <header class="post-header">
            <div class="container post-header-inner">
                <p class="post-eyebrow"><span class="blog-chip blog-chip--solid">${post.category}</span></p>
                <h1 class="post-title">${post.h1}</h1>
                <p class="post-sub">${post.sub}</p>
                <div class="post-meta">
                    <span class="post-meta-author"><img src="/images/Icon.png" alt="" class="post-meta-avatar" />Lucky Landscapes crew</span>
                    <span class="post-meta-dot" aria-hidden="true">·</span>
                    <time datetime="${post.date}">${fmtDate(post.date)}</time>
                    <span class="post-meta-dot" aria-hidden="true">·</span>
                    <span>${minutes} min read</span>
                </div>
            </div>
        </header>

        <div class="container post-hero-img">
            <img src="${post.image || '/images/banner.jpg'}" alt="${(post.imageAlt || cleanTitle).replace(/"/g, '&quot;')}" width="1200" height="600" fetchpriority="high" />
        </div>

        <div class="container post-layout">${tocHtml}
            <article class="post-body" id="post-body">
                ${takeawaysHtml}
                <div class="prose">${bodyHtml}
                </div>
                <div class="post-author">
                    <img src="/images/Icon.png" alt="" class="post-author-avatar" />
                    <div>
                        <p class="post-author-name">Written by the Lucky Landscapes crew</p>
                        <p class="post-author-bio">We're an owner-operated landscaping company in Lincoln, NE. Everything here is what we actually do on the job — written by the people doing it, not an AI content farm or a national chain.</p>
                    </div>
                </div>
                <div class="post-cta">
                    <p>Got a project in mind?</p>
                    <a href="/quote" class="btn btn-primary btn-lg">Request a Free Estimate</a>
                </div>
            </article>
        </div>
${faqsHtml}
        <section class="related-posts">
            <div class="container">
                <div class="related-posts-header reveal">
                    <p class="section-label">Keep reading</p>
                    <h2 class="section-title">More From the Blog</h2>
                </div>
                <div class="blog-grid blog-grid--related stagger-children">${relatedPosts.map(p => postCard(p)).join('')}
                </div>
            </div>
        </section>

        <section class="home-services-section">
            <div class="home-services-bg"></div>
            <div class="container">
                <div class="home-services-header reveal">
                    <p class="section-label section-label--light">Related services</p>
                    <h2 class="section-title section-title--light">More From Lucky Landscapes</h2>
                </div>
                <div class="home-services-grid stagger-children">${related}
                </div>
            </div>
        </section>

        <script>
        (function () {
            var fill = document.getElementById('reading-progress');
            var article = document.getElementById('post-body');
            var links = [].slice.call(document.querySelectorAll('.post-toc-nav a'));
            var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
            function progress() {
                if (!fill) return;
                var doc = document.documentElement;
                var end = article ? article.offsetTop + article.offsetHeight : doc.scrollHeight;
                var max = end - window.innerHeight;
                var top = window.scrollY || doc.scrollTop || 0;
                fill.style.width = (max > 0 ? Math.min(100, Math.max(0, (top / max) * 100)) : 0) + '%';
            }
            function spy() {
                if (!heads.length) return;
                var pos = (window.scrollY || 0) + 130, cur = null;
                for (var i = 0; i < heads.length; i++) { if (heads[i].offsetTop <= pos) cur = heads[i]; }
                links.forEach(function (a) { a.classList.toggle('active', !!cur && a.getAttribute('href') === '#' + cur.id); });
            }
            window.addEventListener('scroll', function () { progress(); spy(); }, { passive: true });
            window.addEventListener('resize', progress, { passive: true });
            progress(); spy();
        })();
        </script>

${pageEnd()}`;
}

// =====================================================================
// BUILD
// =====================================================================

await mkdir(join(ROOT, 'areas'), { recursive: true });
await mkdir(join(ROOT, 'blog'), { recursive: true });
await mkdir(join(ROOT, 'public', 'images', 'blog'), { recursive: true });

// Generate a unique branded hero illustration (SVG) per post and point the post
// at it. Runs BEFORE any rendering so cards / hero / schema all use the new image.
// Set `usePhoto: true` on a post (with a raster `image`) to keep a real photo instead.
for (const post of POSTS) {
    if (post.usePhoto && post.image) continue;
    await writeFile(join(ROOT, 'public', 'images', 'blog', `${post.slug}.svg`), heroSvg(visualFor(post.slug)));
    post.image = `/images/blog/${post.slug}.svg`;
}
console.log('  svg   ', `${POSTS.filter(p => !p.usePhoto).length} hero illustrations → public/images/blog/`);

for (const area of AREAS) {
    const path = join(ROOT, 'areas', `${area.slug}.html`);
    await writeFile(path, renderArea(area));
    console.log('  area  ', `areas/${area.slug}.html`);
}

await writeFile(join(ROOT, 'areas', 'index.html'), renderAreasHub());
console.log('  hub   ', 'areas/index.html');

for (const post of POSTS) {
    const path = join(ROOT, 'blog', `${post.slug}.html`);
    await writeFile(path, renderPost(post));
    console.log('  post  ', `blog/${post.slug}.html`);
}

// =====================================================================
// BLOG INDEX (/blog/index.html)
// =====================================================================

const sortedPosts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
const featured = sortedPosts[0];
const featuredStats = postStats(featured);
const featuredTitle = featured.title.replace(' — Lucky Landscapes', '');
const catCounts = {};
POSTS.forEach(p => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });
const blogCats = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a] || a.localeCompare(b));

const blogIndex = `${head({
    title: 'Lucky Landscapes Blog — Lincoln, NE Landscaping Tips & Pricing',
    description: 'Practical landscaping, lawn care, and hardscape advice for Lincoln, Nebraska homeowners. Real local pricing, seasonal guides, and contractor honesty.',
    canonical: 'https://luckylandscapes.com/blog/',
    schema: {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Blog',
                '@id': 'https://luckylandscapes.com/blog/#blog',
                name: 'Lucky Landscapes Blog',
                description: 'Practical landscaping, lawn care, and hardscape advice for Lincoln, Nebraska homeowners.',
                url: 'https://luckylandscapes.com/blog/',
                publisher: { '@id': 'https://luckylandscapes.com/#business' },
                blogPost: [...POSTS].sort((a, b) => b.date.localeCompare(a.date)).map(p => ({
                    '@type': 'BlogPosting',
                    headline: p.title.replace(' — Lucky Landscapes', ''),
                    url: `https://luckylandscapes.com/blog/${p.slug}`,
                    datePublished: p.date,
                    description: p.description,
                    image: ogImageFor(p),
                })),
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://luckylandscapes.com/' },
                    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://luckylandscapes.com/blog/' },
                ],
            },
        ],
    },
})}

        <section class="svc-hero">
            <div class="svc-hero-bg"></div>
            <div class="container">
                <div class="svc-hero-content">
                    <div class="hero-badge">
                        <img src="/images/Icon.png" alt="" />
                        <span>Lincoln, NE Landscaping Blog</span>
                    </div>
                    <h1>Real <em class="highlight">Landscaping Advice</em><br />for Lincoln Homeowners</h1>
                    <p class="hero-sub">Seasonal guides, honest pricing, and the kind of info we wish more contractors would just publish. Written by our crew, for our city.</p>
                </div>
            </div>
        </section>

        <section class="blog-featured-section" id="blog-featured">
            <div class="container">
                <a class="blog-featured" href="/blog/${featured.slug}">
                    <div class="blog-featured-media">
                        <img src="${featured.image || '/images/banner.jpg'}" alt="${(featured.imageAlt || featuredTitle).replace(/"/g, '&quot;')}" width="760" height="500" fetchpriority="high" />
                        <span class="blog-featured-flag">★ Latest</span>
                    </div>
                    <div class="blog-featured-body">
                        <p class="blog-card-meta"><span class="blog-card-chip blog-card-chip--inline">${featured.category}</span> <time datetime="${featured.date}">${fmtDate(featured.date)}</time> · ${featuredStats.minutes} min read</p>
                        <h2 class="blog-featured-title">${featuredTitle}</h2>
                        <p class="blog-featured-desc">${featured.description}</p>
                        <span class="blog-card-link">Read the article →</span>
                    </div>
                </a>
            </div>
        </section>

        <section class="blog-list-section">
            <div class="container">
                <div class="blog-controls">
                    <div class="blog-search-wrap">
                        <svg class="blog-search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        <input id="blog-search" type="search" class="blog-search" placeholder="Search articles…" aria-label="Search articles" autocomplete="off" />
                    </div>
                    <div class="blog-sort-wrap">
                        <label for="blog-sort" class="blog-sort-label">Sort</label>
                        <select id="blog-sort" class="blog-sort" aria-label="Sort articles">
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                        </select>
                    </div>
                </div>

                <div class="blog-filters" role="group" aria-label="Filter by category">
                    <button type="button" class="blog-filter active" data-cat="all" aria-pressed="true">All</button>${blogCats.map(c => `
                    <button type="button" class="blog-filter" data-cat="${c}" aria-pressed="false">${c}</button>`).join('')}
                </div>

                <p class="blog-count"><span id="blog-count">${POSTS.length} articles</span></p>

                <div class="blog-grid" id="blog-grid">${sortedPosts.map(p => postCard(p)).join('')}
                </div>

                <div class="blog-empty" id="blog-empty" style="display:none;">
                    <p>No articles match your search. Try a different keyword or category.</p>
                </div>
            </div>
        </section>

        <script>
        (function () {
            var grid = document.getElementById('blog-grid');
            if (!grid) return;
            var cards = [].slice.call(grid.querySelectorAll('.blog-card'));
            var search = document.getElementById('blog-search');
            var sortSel = document.getElementById('blog-sort');
            var chips = [].slice.call(document.querySelectorAll('.blog-filter'));
            var countEl = document.getElementById('blog-count');
            var emptyEl = document.getElementById('blog-empty');
            var featuredEl = document.getElementById('blog-featured');
            var activeCat = 'all', q = '';

            function apply() {
                var visible = 0;
                cards.forEach(function (c) {
                    var okCat = activeCat === 'all' || c.getAttribute('data-category') === activeCat;
                    var hay = (c.getAttribute('data-title') + ' ' + c.getAttribute('data-keywords') + ' ' + c.getAttribute('data-category')).toLowerCase();
                    var okQ = !q || hay.indexOf(q) !== -1;
                    var show = okCat && okQ;
                    c.style.display = show ? '' : 'none';
                    if (show) visible++;
                });
                if (countEl) countEl.textContent = visible + (visible === 1 ? ' article' : ' articles');
                if (emptyEl) emptyEl.style.display = visible === 0 ? '' : 'none';
                if (featuredEl) featuredEl.style.display = (activeCat === 'all' && !q) ? '' : 'none';
            }
            function sortCards(mode) {
                cards.slice().sort(function (a, b) {
                    var da = a.getAttribute('data-date'), db = b.getAttribute('data-date');
                    return mode === 'oldest' ? da.localeCompare(db) : db.localeCompare(da);
                }).forEach(function (c) { grid.appendChild(c); });
            }
            if (search) search.addEventListener('input', function () { q = this.value.trim().toLowerCase(); apply(); });
            if (sortSel) sortSel.addEventListener('change', function () { sortCards(this.value); });
            chips.forEach(function (ch) {
                ch.addEventListener('click', function () {
                    chips.forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
                    this.classList.add('active'); this.setAttribute('aria-pressed', 'true');
                    activeCat = this.getAttribute('data-cat');
                    apply();
                });
            });
            apply();
        })();
        </script>

${pageEnd()}`;

await writeFile(join(ROOT, 'blog', 'index.html'), blogIndex);
console.log('  index ', 'blog/index.html');

// =====================================================================
// SITEMAP (public/sitemap.xml)
// Auto-generated from the static page list + AREAS + POSTS so adding a
// blog post or area page can never silently fall out of the sitemap.
// Don't hand-edit public/sitemap.xml — change this block and re-run.
// =====================================================================

const SITEMAP_STATIC = [
    { loc: '/',                              lastmod: '2026-05-21', changefreq: 'weekly',  priority: '1.0' },
    { loc: '/quote',                         lastmod: '2026-05-05', changefreq: 'monthly', priority: '0.9' },
    { loc: '/gallery',                       lastmod: '2026-05-05', changefreq: 'weekly',  priority: '0.8' },
    { loc: '/areas',                         lastmod: '2026-06-14', changefreq: 'monthly', priority: '0.7' },
    { loc: '/services/landscape-design',     lastmod: '2026-05-05', changefreq: 'monthly', priority: '0.9' },
    { loc: '/services/lawn-care',            lastmod: '2026-05-05', changefreq: 'monthly', priority: '0.9' },
    { loc: '/services/hardscaping',          lastmod: '2026-05-05', changefreq: 'monthly', priority: '0.9' },
    { loc: '/services/fencing',              lastmod: '2026-05-11', changefreq: 'monthly', priority: '0.9' },
    { loc: '/services/garden-beds',          lastmod: '2026-05-05', changefreq: 'monthly', priority: '0.8' },
    { loc: '/services/property-cleanup',     lastmod: '2026-05-05', changefreq: 'monthly', priority: '0.8' },
    { loc: '/contractors',                   lastmod: '2026-06-11', changefreq: 'monthly', priority: '0.8' },
    // /team deliberately omitted — unlisted + noindexed (young-crew age-objection concern); reachable by direct link only.
    { loc: '/careers',                       lastmod: '2026-05-05', changefreq: 'monthly', priority: '0.4' },
    { loc: '/privacy',                       lastmod: '2026-05-05', changefreq: 'yearly',  priority: '0.2' },
    { loc: '/terms',                         lastmod: '2026-05-05', changefreq: 'yearly',  priority: '0.2' },
];

const sitemapUrls = [
    ...SITEMAP_STATIC,
    // Blog index lastmod tracks the newest post so it updates whenever content does.
    { loc: '/blog/', lastmod: sortedPosts[0].date, changefreq: 'weekly', priority: '0.7' },
    ...AREAS.map(a => ({ loc: `/areas/${a.slug}`, lastmod: '2026-05-05', changefreq: 'monthly', priority: '0.8' })),
    ...sortedPosts.map(p => ({ loc: `/blog/${p.slug}`, lastmod: p.date, changefreq: 'yearly', priority: '0.6' })),
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Auto-generated by scripts/build-content-pages.js — do not hand-edit. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>
    <loc>https://luckylandscapes.com${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

await writeFile(join(ROOT, 'public', 'sitemap.xml'), sitemapXml);
console.log('  sitemap', `public/sitemap.xml (${sitemapUrls.length} urls)`);

// =====================================================================
// llms.txt (public/llms.txt)
// Machine-readable site overview for AI assistants (ChatGPT, Perplexity,
// Claude, agent tools) per the llmstxt.org convention. Auto-generated from
// the same AREAS + POSTS data as the sitemap so content can never fall out
// of sync. Don't hand-edit public/llms.txt — change this block and re-run.
// Note: Google does NOT consume this file; it's a low-cost complement for
// non-Google AI engines. The real local-AI levers are the Google Business
// Profile, review velocity, and LocalBusiness/Service schema.
// =====================================================================

const LLMS_ORIGIN = 'https://luckylandscapes.com';

const LLMS_SERVICES = [
    { loc: '/services/lawn-care',         name: 'Lawn Care',        desc: 'Mowing, edging, trimming, blowing, bagging, and leaf cleanup — weekly, bi-weekly, monthly, one-time, or seasonal.' },
    { loc: '/services/garden-beds',       name: 'Garden Beds',      desc: 'New bed installation, mulch and rock refresh, edging, weed barrier, planting, transplanting, and weeding.' },
    { loc: '/services/hardscaping',       name: 'Hardscaping',      desc: 'Paver patios, retaining walls, walkways, fire pits, bed edging, and above-ground pool base prep.' },
    { loc: '/services/fencing',           name: 'Fencing',          desc: 'Wood privacy, picket, chain link, prefab ornamental, and custom ornamental iron fencing — install, tear-out, and permits.' },
    { loc: '/services/property-cleanup',  name: 'Property Cleanup', desc: 'Spring and fall cleanups, leaf and brush removal, storm debris, and haul-away.' },
    { loc: '/services/landscape-design',  name: 'Landscape Design', desc: 'Custom landscape design and design-build for residential and commercial properties.' },
];

const llmsAreaLabel = (slug) => slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const llmsTxt = `# Lucky Landscapes

> Full-service residential and commercial landscaping, hardscaping, and lawn care company based in Lincoln, Nebraska. Locally owned and operated, free estimates, fast quotes.

Lucky Landscapes LLC serves Lincoln, NE and the surrounding Lancaster County area (including Waverly and Emerald). We handle lawn care, garden beds, hardscaping (paver patios, retaining walls, fire pits, above-ground pool base prep), fencing, property cleanup, and landscape design. Pricing is custom per project — homeowners and businesses can request a free quote at ${LLMS_ORIGIN}/quote.

## Services

${LLMS_SERVICES.map(s => `- [${s.name}](${LLMS_ORIGIN}${s.loc}): ${s.desc}`).join('\n')}

## Service Areas

${AREAS.map(a => `- [${llmsAreaLabel(a.slug)}](${LLMS_ORIGIN}/areas/${a.slug}): ${a.description}`).join('\n')}

## Guides, Costs & Seasonal Advice

${sortedPosts.map(p => `- [${p.title}](${LLMS_ORIGIN}/blog/${p.slug}): ${p.description}`).join('\n')}

## Company

- [Get a Free Quote](${LLMS_ORIGIN}/quote): Request a custom estimate for any service.
- [Project Gallery](${LLMS_ORIGIN}/gallery): Photos of completed landscaping and hardscaping projects around Lincoln.
- [Careers](${LLMS_ORIGIN}/careers): Open crew and landscaping positions in Lincoln, NE.

## Optional

- [Privacy Policy](${LLMS_ORIGIN}/privacy)
- [Terms of Service](${LLMS_ORIGIN}/terms)
`;

await writeFile(join(ROOT, 'public', 'llms.txt'), llmsTxt);
console.log('  llms  ', `public/llms.txt (${LLMS_SERVICES.length} services, ${AREAS.length} areas, ${sortedPosts.length} posts)`);

console.log(`\n✓ Generated ${AREAS.length} area pages + ${POSTS.length} blog posts + 1 blog index + sitemap + llms.txt`);
