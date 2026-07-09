# CLAUDE.md — Lucky Landscapes

Two separate apps in one repo, both **in production with a real crew using
them daily** — treat every change as live-site surgery. This file is the
brief. Deep feature notes live in [docs/dev-notes.md](docs/dev-notes.md)
(Grep it before touching any feature it covers); app-code invariants live in
[luckyapp/AGENTS.md](luckyapp/AGENTS.md) (read it before editing luckyapp).

**Last updated:** 2026-07-09 (added campaign-discount "you save" pricing +
recurring billing — see dev-notes.md).

## Business context — read before strategic / non-trivial work

[`docs/company.md`](docs/company.md) · [`docs/services-pricing.md`](docs/services-pricing.md) ·
[`docs/operations.md`](docs/operations.md) · [`docs/finances.md`](docs/finances.md) ·
[`docs/strategy.md`](docs/strategy.md). These are the source of truth for
everything that isn't code. A `TODO:` section = unknown — ask, don't invent.
Macoy holds an informal 30% (handshake); Riley Kopf owns/runs the company.

## Repo layout

```
/
├── CLAUDE.md        ← this brief
├── docs/            ← business docs + dev-notes.md (relocated deep-dives)
├── marketing/       ← Vite + vanilla JS public site → luckylandscapes.com (Cloudflare Pages)
└── luckyapp/        ← Next.js 16 + Supabase internal app → app.luckylandscapes.com (Vercel)
```

## marketing/ — public site

- **Stack:** Vite 7, vanilla JS, static HTML entry points (every page must be
  in `vite.config.js` `rollupOptions.input`). GSAP + ScrollTrigger + Lenis
  wired via `gsap.ticker` in `main.js`.
- **Hosting:** Cloudflare Pages (root dir `marketing`, build `npm run build`,
  output `dist`), production branch `main`. `_redirects` enforces non-www;
  `_headers` = CSP/security + long image cache. **CSP must keep
  `https://*.supabase.co` in img-src + connect-src** or gallery photos break.
- **Clean URLs:** declared URLs (canonical, og, JSON-LD, sitemap, hrefs) never
  contain `.html`; files on disk do. Fixer: `node scripts/seo-clean-urls.js`.

```bash
cd marketing
npm run dev / build / preview
npm run qa                # build + SEO integrity check — run before deploy
npm run optimize-images   # source-images/ → public/images/ (fallback pipeline)
node scripts/build-content-pages.js  # areas + blog + sitemap.xml + llms.txt (data-driven — edit POSTS/AREAS arrays, never the outputs)
node scripts/inject-head.js          # analytics/keys block into all pages (idempotent; keys live in HEAD_BLOCK)
node scripts/sync-chrome.js          # nav/footer/sticky-CTA re-sync (skips footer--slim)
node scripts/inject-svc-trust.js     # reviews strip + guarantee into service pages
```

> **`npm run build` does NOT run the codegen scripts.** After editing any of
> them (or the POSTS/AREAS data), run the script first, then build. New pages
> also need a `vite.config.js` entry. Blog posts: unique `date` per post
> (never reuse), auto-generated SVG heroes via `POST_VISUALS`, sitemap +
> llms.txt regenerate automatically — never hand-edit those outputs.

**Conversion conventions (2026-06 audit — don't regress):** `/team` stays
unlisted + noindex and **no faces/ages/team links anywhere public** — the crew
is young (Riley is 19) and age-based objections kill quotes before they
happen; this rule regressed once via a footer link, don't let it again.
`/contractors` is the GC lane; no rot-prone trust claims (no review
counts/dates, no seasonal strings, no "3+ years", no "100% satisfaction");
it's a **24-hour RESPONSE**, never "24-hour quote". Contact modal posts to
`LEADS_INTAKE_URL` (success only on 2xx); quote page keeps the slim footer,
phone-only sticky bar, ≥16px inputs; primary buttons use `--clover-dark`
#5A7A40 (WCAG AA) — never raw `--clover` as a text background.

**Marketing facts:** ICP = wealthier homeowners wanting hardscape (walls,
pavers, grading, drainage) — but Lucky still takes mulch/rock/maintenance
jobs; target the ICP without excluding the small stuff. **No photos from
sub work under other contractors may be used** — only Lucky's own jobs.
GBP is a **service-area business** (Google reclassified from storefront;
the old Place ID is dead — rank tracking matches by name, see the local-rank
notes in dev-notes.md). First paid Meta campaign: full playbook with
verified-2026 platform facts in
[docs/meta-ads-campaign-001.md](docs/meta-ads-campaign-001.md) — ad copy
there follows the same conventions (24-hour response, no prices, no faces,
no "repair" wording).

**Content is luckyapp-managed:** the gallery + fixed image slots load from
`app.luckylandscapes.com/api/marketing/{gallery,images}` — **remote REPLACES
static** on success; the hardcoded `projectData` array and static image
pipeline are the outage fallback, never delete them. Quote form posts to
luckyapp `/api/leads/public`. Hero video files are immutable-cached —
**never overwrite in place, ship a new filename** (encode recipes + CF Pages
25 MiB cap: see dev-notes.md).

## luckyapp/ — the business app

- **Stack:** Next.js 16 + React 19 App Router, Supabase (Postgres/Auth/
  Storage/Realtime), Stripe, Resend, Google Calendar, jsPDF. Deploys on
  Vercel. **Read [luckyapp/AGENTS.md](luckyapp/AGENTS.md) first** — Next 16
  breaks from training data; consult `node_modules/next/dist/docs/`.
- `npm run dev / build / lint` from `luckyapp/`. **No test runner in either
  app** — verification is `npm run build` + manually exercising the feature.
- **Dual-mode data layer:** `src/lib/data.js` is the single DataProvider;
  every entity needs BOTH the Supabase path and the localStorage/demo path,
  plus snake↔camel conversion at the boundary. `isSupabaseConnected()` decides.
- **Tenancy:** every query scoped `.eq('org_id', …)` on top of RLS (fail
  closed). Auth in `src/lib/auth.js`; API routes authenticate via
  `authenticateRequest` + client `apiFetch` (see AGENTS.md security section).
- **Domain logic:** money math in `src/lib/finance.js`; PDFs in
  `generateQuotePdf.js`; Stripe server-side only in `stripeServer.js`.
- **Migrations:** numbered SQL in `luckyapp/supabase/migrations/`, run **in
  order, by hand, in the Supabase SQL editor**. Prefixes are a sort key, not
  unique (dupes at 006/007/023/024). Latest is `049_recurring_billing` (unrun
  until Macoy applies it); next is `050_`. `FULL_REBUILD.sql` is deprecated —
  never use it. Details: `migrations/README.md`.
- **Backups:** daily encrypted pg_dump + full Storage download via GitHub
  Actions (`.github/workflows/supabase-backup.yml`) — restore notes in the
  workflow header; also keeps the free-tier project from auto-pausing. Don't
  break the storage step; the DB dump alone leaves dead media URLs.

## Don't-regress index (the expensive lessons — detail in dev-notes.md / AGENTS.md)

- **Quote total includes delivery** (mig 036): `quote.total` = line items +
  delivery. Never add `+ deliveryFee` at a read site.
- **"Mark Paid" must insert a `payments` row** (mig 038 backfilled) or
  cash-basis revenue silently desyncs. Duplicate/overpayment defenses: webhook
  self-heals + flags `DUPLICATE`; `pnlForRange` excludes flagged rows — the
  note format and the filter regex must change together.
- **Clock integrity** (mig 046): one open segment/shift, one open shift/member;
  all paid/break math routes through `computeShiftPaidBreak`. Don't re-implement.
- **Measure tool:** Google removed `DrawingManager` — drawing is hand-rolled;
  any `g.drawing.*` reference crashes the page. Overpass + parcel lookups go
  through the server proxies, never client-direct.
- **Local rank grid:** ranks come from real Maps SERP via the server route
  (Bright Data → DataForSEO). **Never reintroduce Places API for ranking** — it
  ranks by name relevance and was confirmed wrong.
- **Customer never sees material prices** — `CustomerCatalogCard` structurally
  can't render them; keep quote PDF / public quote / sign page on
  customer-shape data.
- **Demo mode** is a per-tab sessionStorage flag (`demoGuard()` on server-only
  actions). The `/pay` Stripe charge + send-email buttons are still unguarded —
  close that before promoting the demo publicly.
- **Public tokens are URL-safe hex** — preserve that property.
- **Tappable addresses:** always `<AddressLink>`, never a hand-rolled maps link.
- **Campaign discount "you save" is display-only** (`src/lib/pricing.js`,
  `listUnitPrice` = regular pre-discount price on line items): it must NEVER change
  `total`/deposits/revenue — only `unitPrice` (the discounted charge) moves money.
  Legit *because* the regular price is a real off-campaign rate — don't let it become
  a price Lucky never charges (FTC fake-former-price). Detail in AGENTS.md quick map.
- **Recurring billing: the cron never records payments** (mig 049). The
  `recurring-billing` cron creates the invoice + fires the off-session charge with
  `metadata.invoice_id`; the **webhook's existing invoice branch** records the
  `payments` row + marks it paid. Recording in both double-counts cash-basis revenue.
  Card + autopay consent are written by the webhook on `setup_intent.succeeded`, never
  trusted from the client. Detail in AGENTS.md quick map.

## Working here

- The crew's phones are the target hardware — check mobile layout for
  anything they touch (crew cockpit, clock, mileage, schedule).
- Riley is non-technical: features need to work from a phone in the field,
  and admin flows must survive "clicked the button twice".
- End every response with **Next steps** (what Macoy must run/set/eyeball)
  and anything needed for the change to work.
- Be critical: if an idea is bad, say why and propose better.
- Keep docs current: decision/plan changes → update the relevant doc +
  dev-notes.md for new feature deep-dives + bump this file's date.
