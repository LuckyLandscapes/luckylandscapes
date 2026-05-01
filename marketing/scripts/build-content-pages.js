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
                <a href="/gallery.html" class="nav-link">Gallery</a>
                <a href="/blog/" class="nav-link">Blog</a>
                <a href="/#contact" class="nav-link">Contact</a>
                <a href="/quote.html" class="btn btn-primary nav-cta">Get a Quote</a>
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
        <a href="/gallery.html" class="mobile-link">Gallery</a>
        <a href="/blog/" class="mobile-link">Blog</a>
        <a href="/#contact" class="mobile-link">Contact</a>
        <a href="/quote.html" class="btn btn-primary mobile-cta-btn">Get a Quote</a>
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
                    <a href="/gallery.html">Gallery</a>
                    <a href="/team.html">Our Team</a>
                    <a href="/#contact">Contact</a>
                </div>
                <div class="footer-nav">
                    <h4>Services</h4>
                    <a href="/services/lawn-care.html">Lawn Care</a>
                    <a href="/services/garden-beds.html">Garden &amp; Beds</a>
                    <a href="/services/hardscaping.html">Hardscaping</a>
                    <a href="/services/property-cleanup.html">Property Cleanup</a>
                    <a href="/services/landscape-design.html">Landscape Design</a>
                </div>
                <div class="footer-contact">
                    <h4>Contact</h4>
                    <p>(402) 405-5475</p>
                    <p>rileykopf@luckylandscapes.com</p>
                    <p>Lincoln, NE &amp; Surrounding Areas</p>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2026 Lucky Landscapes. All rights reserved.</p>
                <div class="footer-bottom-links">
                    <a href="/privacy.html">Privacy Policy</a>
                    <a href="/terms.html">Terms of Service</a>
                </div>
            </div>
        </div>
    </footer>`;

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
        slug: 'beatrice',
        title: 'Beatrice NE Landscaping & Hardscape Projects — Lucky Landscapes',
        description: 'Landscape design, hardscaping, and large project work in Beatrice, NE (68310). $1,000 minimum — Lincoln-based crew willing to travel for the right job.',
        h1: 'Landscaping in <em class="highlight">Beatrice, NE</em>',
        sub: 'Beatrice is a 45-minute drive from Lincoln — far enough that we focus on bigger projects out here. Hardscape, design-build, and full property transformations.',
        zips: ['68310'],
        intro: `<p>We don\'t do mowing in Beatrice — the drive is too long for small recurring jobs to make sense. But for a paver patio, retaining wall, full landscape redesign, or any project north of $1,000, we\'re happy to travel.</p>
        <p>Beatrice has a lot of properties with mature trees, large lots, and the kind of yards that benefit from a real landscape investment. If you\'ve been getting the runaround from out-of-town contractors who quote you and then disappear, we\'d love to be your local-ish alternative.</p>`,
        whyHere: [
            { icon: '🧱', title: 'Hardscape specialists', text: 'Most of our Beatrice work is hardscaping — patios, walls, fire features, walkways. We bring the same crew and standards we\'d bring to any Lincoln project.' },
            { icon: '🌲', title: 'Designs for mature properties', text: 'Beatrice yards often have established trees and old beds. We design around them, not over them — keeping mature landscaping intact wherever possible.' },
            { icon: '💰', title: '$1,000 minimum project size', text: 'Travel time means we focus on real projects out here. No mowing, no $200 cleanups — but for any full project, you get the same Lincoln pricing without inflated travel charges.' },
        ],
        services: ['hardscaping', 'landscape-design', 'garden-beds'],
        faqs: [
            { q: 'Do you do regular lawn maintenance in Beatrice?', a: 'No — the drive (45 min each way) doesn\'t work for weekly mowing. We focus on one-time and large project work. If you need recurring lawn service, a local Beatrice crew will serve you better.' },
            { q: 'What\'s the typical project minimum?', a: '$1,000. Most real landscape and hardscape projects are well above that. Travel costs are baked into normal pricing — no separate charges.' },
            { q: 'How long does a project visit usually take?', a: 'For a quote, we\'ll typically come out for 30-45 minutes to walk the property and discuss options. We come prepared with rough pricing for common project types so you get useful numbers, not a vague follow-up.' },
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
        <p>If you have thin spots, this is also a good time to overseed. Tall fescue blends do well in Lincoln; pure Kentucky bluegrass takes longer to establish but looks beautiful once it does. Water lightly twice a day for 2-3 weeks until germination.</p>

        <h2>Mid May: Aerate (every 2-3 years)</h2>
        <p>Lincoln\'s heavy clay soil compacts hard. Core aeration (the kind that pulls actual plugs out) once every 2-3 years lets oxygen, water, and fertilizer reach roots. We pair aeration with overseeding — the holes give the new seed somewhere protected to germinate.</p>

        <h2>What to skip in spring</h2>
        <ul>
            <li><strong>Heavy power-raking / dethatching.</strong> Wait until late May at earliest if you have real thatch buildup. Most Lincoln lawns don\'t need it.</li>
            <li><strong>Aggressive pesticide application.</strong> Spot-treat dandelions and clover after the lawn has fully greened up; broad-spectrum applications in April hit beneficial insects before they\'re needed.</li>
            <li><strong>Mowing too short.</strong> A 2-inch lawn in spring will be a 1-inch lawn under summer drought stress. Keep it at 3.5 inches.</li>
        </ul>

        <h2>Want us to handle it?</h2>
        <p>Lucky Landscapes does spring cleanups across Lincoln, including pre-emergent application, first mow, edge work, and overseeding. We typically book up by the second week of April so don\'t wait if you want it done before the season gets ahead of you.</p>
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
        <p>If you get a quote that\'s dramatically below the ranges above, ask the contractor about base depth, fabric, and what kind of polymeric sand they use. Their answers will tell you everything.</p>

        <h2>What you actually need to give us a real quote</h2>
        <ol>
            <li>Approximate dimensions (length × width is fine).</li>
            <li>What\'s there now (grass, old concrete, gravel, etc.).</li>
            <li>Material preference, even if it\'s just "I like the natural-stone look" or "concrete is fine."</li>
            <li>Photos of the area, especially showing access from the driveway.</li>
        </ol>
        <p>That\'s enough for us to send a written estimate within 24 hours, including options at three price points so you can see exactly where the trade-offs are.</p>
        `,
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
        <p>For our maintenance customers with thin lawns, we usually do a light spring overseed (just to fill the worst spots so they\'re not bare for summer) and then a heavy fall overseed when conditions are ideal. Two passes, and the lawn is in dramatically better shape by the second spring.</p>

        <h2>What seed to use in Lincoln</h2>
        <p>For most Lincoln yards we recommend a tall fescue / Kentucky bluegrass blend, roughly 70/30. The tall fescue gives you fast establishment and drought tolerance; the bluegrass fills in over time and gives you the dark green you actually want to look at. Pure ryegrass is a bad idea long-term — it\'s a short-lived perennial that thins out fast.</p>
        <p>We use Lebanon Pro brand for our customer overseeds. It\'s available retail at most Lincoln nurseries (Campbell\'s, Earl May, etc.) — about $80-110 per 50-pound bag, which covers roughly 7,500 square feet at a normal overseed rate.</p>

        <h2>Want us to handle the fall overseed?</h2>
        <p>Most of our overseeding clients book in July for a late-August service window. If your lawn is thin and you don\'t want to deal with it yourself, get a quote and we\'ll add you to the schedule.</p>
        `,
        related: ['lawn-care'],
    },
];

// =====================================================================
// TEMPLATES
// =====================================================================

const SERVICE_LABELS = {
    'lawn-care':         { title: 'Lawn Care', icon: '🌿', desc: 'Mowing, seasonal cleanups, leaf removal, year-round maintenance.' },
    'garden-beds':       { title: 'Garden & Beds', icon: '🌺', desc: 'Garden bed installation, mulching, edging, plant transplants.' },
    'hardscaping':       { title: 'Hardscaping', icon: '🧱', desc: 'Paver patios, walkways, retaining walls, outdoor living.' },
    'property-cleanup':  { title: 'Property Cleanup', icon: '🧹', desc: 'Junk removal, debris hauling, overgrown yard restoration.' },
    'landscape-design':  { title: 'Landscape Design', icon: '🎨', desc: 'Concept-to-completion outdoor design and build.' },
};

function areaSchema(area) {
    return {
        '@context': 'https://schema.org',
        '@type': 'LandscapingBusiness',
        name: 'Lucky Landscapes',
        url: `https://luckylandscapes.com/areas/${area.slug}.html`,
        telephone: '+1-402-405-5475',
        areaServed: { '@type': 'Place', name: area.h1.replace(/<[^>]+>/g, '').trim() },
        address: { '@type': 'PostalAddress', addressLocality: 'Lincoln', addressRegion: 'NE', addressCountry: 'US' },
    };
}

function postSchema(post) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title.replace(' — Lucky Landscapes', ''),
        datePublished: post.date,
        dateModified: post.date,
        author: { '@type': 'Organization', name: 'Lucky Landscapes' },
        publisher: { '@type': 'Organization', name: 'Lucky Landscapes', logo: { '@type': 'ImageObject', url: 'https://luckylandscapes.com/images/Icon.png' } },
        description: post.description,
        mainEntityOfPage: `https://luckylandscapes.com/blog/${post.slug}.html`,
    };
}

function renderArea(area) {
    const canonical = `https://luckylandscapes.com/areas/${area.slug}.html`;
    const services = area.services.map(s => `
                    <a href="/services/${s}.html" class="home-service-card">
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
                        <a href="/quote.html" class="btn btn-primary btn-lg">Request a Free Estimate</a>
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

        <section class="svc-cta">
            <div class="container">
                <div class="svc-cta-content reveal">
                    <h2>Ready to talk?</h2>
                    <p>Free estimate, 24-hour response, no obligation. Tell us about your project and we'll come look in person.</p>
                    <div class="hero-buttons">
                        <a href="/quote.html" class="btn btn-primary btn-lg">Request My Free Estimate</a>
                        <a href="tel:+14024055475" class="btn btn-outline btn-lg">📞 Call Now</a>
                    </div>
                </div>
            </div>
        </section>

${pageEnd()}`;
}

function renderPost(post) {
    const canonical = `https://luckylandscapes.com/blog/${post.slug}.html`;
    const related = (post.related || []).map(s => `
                    <a href="/services/${s}.html" class="home-service-card">
                        <div class="home-service-icon">${SERVICE_LABELS[s].icon}</div>
                        <h3>${SERVICE_LABELS[s].title}</h3>
                        <p>${SERVICE_LABELS[s].desc}</p>
                        <span class="home-service-link">Learn More →</span>
                    </a>`).join('');

    const dateFmt = new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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
                    <a href="/quote.html" class="btn btn-primary btn-lg">Request a Free Estimate</a>
                </div>
            </div>
        </article>

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
    schema: { '@context': 'https://schema.org', '@type': 'Blog', name: 'Lucky Landscapes Blog', url: 'https://luckylandscapes.com/blog/' },
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
                <a href="/blog/${p.slug}.html" style="display:block; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid var(--gray-200); border-radius: 1rem; text-decoration:none; color: inherit; transition: all .2s;">
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
