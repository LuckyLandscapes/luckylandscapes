# Blog Content Calendar — what to publish next

> Created 2026-06-14. The blog now has 22 posts (see the `POSTS` array in [`marketing/scripts/build-content-pages.js`](../marketing/scripts/build-content-pages.js)). This is the backlog to draw from so we publish **~1 post/week at a natural cadence** instead of dumping a batch (which looks auto-generated and hurts SEO — see [[feedback_blog_post_dates]]). Each new post: unique spread-out date, FAQ schema, internal links, a `POST_VISUALS` entry. Run `npm run qa` before deploy.

## Why a calendar (not just "write more")
Fresh, useful, locally-specific content is one of the few reliably-positive on-site SEO levers and feeds the GBP "weekly post" habit. But velocity has to look human. One quality post a week beats ten in a day. Pull the next item, write it well, ship it, cross it off.

## Priority backlog (roughly highest-value first)

| # | Working title | Category | Primary keyword / intent | Notes |
|---|---|---|---|---|
| 1 | When to Aerate Your Lawn in Lincoln, NE | Lawn Care | "lawn aeration Lincoln" / when | Core-aeration timing, clay soil; pairs with overseeding post |
| 2 | Paver Walkway & Path Cost in Lincoln, NE | Hardscaping | "paver walkway cost" | Distinct from patio cost; high commercial intent |
| 3 | Grub & Lawn Pest Control in Lincoln, NE | Lawn Care | "grubs in lawn Nebraska" | Problem/solution; seasonal (mid-summer) |
| 4 | How Much Does a Landscape Design Cost in Lincoln? | Landscape Design | "landscape design cost" | Thin category (2 posts); high intent |
| 5 | French Drain & Yard Drainage Cost in Lincoln | Hardscaping | "french drain cost Nebraska" | Cost angle on existing drainage topic |
| 6 | Best Privacy Trees & Shrubs for Nebraska Yards | Garden Beds | "privacy trees Nebraska" | Plant-selection; evergreen |
| 7 | Retaining Wall Materials Compared (Block vs Boulder vs Timber) | Hardscaping | "retaining wall materials" | Comparison; complements wall-cost post |
| 8 | How to Prep a Yard for a New Lawn in Lincoln | Lawn Care | "new lawn prep" | Funnels to sod/seed posts |
| 9 | Xeriscaping & Low-Water Yards in Lincoln, NE | Garden Beds | "xeriscaping Nebraska" | Ties to native-plants + water savings |
| 10 | Outdoor Fire Pit Safety & Local Rules (Lincoln) | Hardscaping | "fire pit rules Lincoln" | Complements fire-pit cost post; verify current city code |
| 11 | Spring vs. Fall: When to Tackle Big Landscape Projects | Landscape Design | "best time landscaping project" | Seasonal planning; broad |
| 12 | How to Get Rid of an Overgrown Yard in Lincoln | Property Cleanup | "overgrown yard cleanup" | Thin category; problem/solution |
| 13 | Mulch Calculator: How Much Mulch Do I Need? | Garden Beds | "how much mulch" | Practical/tool-style; could embed a simple calc |
| 14 | Gravel & Rock Landscaping Ideas for Lincoln Yards | Garden Beds | "rock landscaping ideas" | Visual/idea post; modern-yard adjacent |
| 15 | What to Look for in a Hardscaping Contractor | Hardscaping | "hardscape contractor" | Trust/consideration; pairs with choose-a-landscaper |

## Cadence guidance
- **~1/week.** Spread `date` values realistically; never reuse a date.
- **Vary the category** so no single cluster balloons. Current balance: Lawn Care 8, Hardscaping 8, Garden Beds 3, Landscape Design 2, Fencing 1. Favor the thin ones (Fencing, Landscape Design, Garden Beds, Property Cleanup) to round out topical coverage.
- **Cross-link** every new post to 1–2 existing posts + the relevant service page, and add a contextual link to it from that service page's FAQ (the pattern used for the 2026-06 batch).
- **Repurpose each post as a GBP post** the week it goes live (see [`gbp-local-seo-playbook.md`](gbp-local-seo-playbook.md) §2) — double the mileage.

## How to add one (mechanical)
1. Append an object to `POSTS` in `build-content-pages.js` (copy an existing one's shape; include `faqs`).
2. Add its `POST_VISUALS` entry (`{ theme, motif }` — themes/motifs are at the top of the script).
3. Add `blog/<slug>.html` to `vite.config.js` `rollupOptions.input`.
4. `node scripts/build-content-pages.js && node scripts/inject-head.js && npm run qa`.
5. Commit + push (Cloudflare Pages auto-deploys `main`).
