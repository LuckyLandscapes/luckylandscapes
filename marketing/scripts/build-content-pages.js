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
                        <span class="reviews-rating-text">5.0 · 7 Google Reviews</span>
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
];

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
        date: '2026-04-15',
        category: 'Lawn Care',
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
        date: '2026-04-22',
        category: 'Hardscaping',
        body: `
        <p>The internet will tell you a paver patio costs "$10–$25 per square foot." That\'s technically true and totally useless. The real answer for Lincoln, Nebraska in 2026 looks more like this:</p>

        <h2>The short version</h2>
        <ul>
            <li><strong>Small basic patio (under 200 sq ft, simple shape, standard concrete pavers):</strong> $20–$28 per sq ft installed. So a 150 sq ft patio is roughly <strong>$3,000–$4,200</strong>.</li>
            <li><strong>Mid-size patio (200–400 sq ft, mid-grade interlocking or natural stone, some demolition):</strong> $28–$40 per sq ft. So a 300 sq ft patio is roughly <strong>$8,400–$12,000</strong>.</li>
            <li><strong>Premium patio (500+ sq ft, custom shapes, premium materials, integrated seat walls or fire features):</strong> $45–$70+ per sq ft. So a 600 sq ft outdoor living space is <strong>$27,000–$42,000+</strong>.</li>
        </ul>
        <p>Those are real Lincoln numbers based on what we actually charge in 2026, not ranges scraped from Texas blogs.</p>

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
        date: '2026-04-08',
        category: 'Lawn Care',
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
        date: '2026-05-21',
        category: 'Lawn Care',
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
        date: '2026-05-21',
        category: 'Hardscaping',
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
        date: '2026-05-21',
        category: 'Garden Beds',
        body: `
        <p>This is the most common bed question we get in Lincoln, and the honest answer is "it depends" — but not in the wishy-washy way contractors usually mean. Mulch and rock are good at genuinely different things, and the wrong choice in the wrong spot will cost you money, kill plants, or both. Here\'s the real breakdown.</p>

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
                '@type': ['LocalBusiness', 'LandscapingBusiness'],
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
                    { '@type': 'ListItem', position: 2, name: 'Service Areas', item: 'https://luckylandscapes.com/#service-areas' },
                    { '@type': 'ListItem', position: 3, name: areaName, item: url },
                ],
            },
            ...(faqs.length ? [{ '@type': 'FAQPage', mainEntity: faqs }] : []),
        ],
    };
}

function postSchema(post) {
    const url = `https://luckylandscapes.com/blog/${post.slug}`;
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
                image: 'https://luckylandscapes.com/images/og-card.png',
                articleSection: post.category,
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

function renderPost(post) {
    const canonical = `https://luckylandscapes.com/blog/${post.slug}`;
    const related = (post.related || []).map(s => `
                    <a href="/services/${s}" class="home-service-card">
                        <div class="home-service-icon">${SERVICE_LABELS[s].icon}</div>
                        <h3>${SERVICE_LABELS[s].title}</h3>
                        <p>${SERVICE_LABELS[s].desc}</p>
                        <span class="home-service-link">Learn More →</span>
                    </a>`).join('');

    const dateFmt = new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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

    return `${head({ title: post.title, description: post.description, canonical, schema: postSchema(post) })}

        <section class="svc-hero">
            <div class="svc-hero-bg"></div>
            <div class="container">
                <div class="svc-hero-content">
                    <div class="hero-badge">
                        <img src="/images/Icon.png" alt="" />
                        <span>${post.category} • Published ${dateFmt}</span>
                    </div>
                    <h1>${post.h1}</h1>
                    <p class="hero-sub">${post.sub}</p>
                </div>
            </div>
        </section>

        <article class="svc-features">
            <div class="container" style="max-width: 760px; line-height: 1.7;">
                ${post.body}

                <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--gray-200); text-align: center;">
                    <a href="/quote" class="btn btn-primary btn-lg">Request a Free Estimate</a>
                </div>
            </div>
        </article>
${faqsHtml}
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

${pageEnd()}`;
}

// =====================================================================
// BUILD
// =====================================================================

await mkdir(join(ROOT, 'areas'), { recursive: true });
await mkdir(join(ROOT, 'blog'), { recursive: true });

for (const area of AREAS) {
    const path = join(ROOT, 'areas', `${area.slug}.html`);
    await writeFile(path, renderArea(area));
    console.log('  area  ', `areas/${area.slug}.html`);
}

for (const post of POSTS) {
    const path = join(ROOT, 'blog', `${post.slug}.html`);
    await writeFile(path, renderPost(post));
    console.log('  post  ', `blog/${post.slug}.html`);
}

// =====================================================================
// BLOG INDEX (/blog/index.html)
// =====================================================================

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
                blogPost: POSTS.map(p => ({
                    '@type': 'BlogPosting',
                    headline: p.title.replace(' — Lucky Landscapes', ''),
                    url: `https://luckylandscapes.com/blog/${p.slug}`,
                    datePublished: p.date,
                    description: p.description,
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

        <section class="svc-features">
            <div class="container" style="max-width: 760px;">
                ${POSTS.map(p => `
                <a href="/blog/${p.slug}" style="display:block; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid var(--gray-200); border-radius: 1rem; text-decoration:none; color: inherit; transition: all .2s;">
                    <p class="section-label" style="margin-bottom:.5rem;">${p.category} • ${new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <h2 style="font-size: 1.5rem; margin: 0 0 .5rem;">${p.title.replace(' — Lucky Landscapes', '')}</h2>
                    <p style="color: var(--gray-600); margin:0;">${p.description}</p>
                </a>`).join('')}
            </div>
        </section>

${pageEnd()}`;

await writeFile(join(ROOT, 'blog', 'index.html'), blogIndex);
console.log('  index ', 'blog/index.html');

console.log(`\n✓ Generated ${AREAS.length} area pages + ${POSTS.length} blog posts + 1 blog index`);
