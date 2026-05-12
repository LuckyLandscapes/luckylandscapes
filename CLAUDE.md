# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Business context — read before strategic / non-trivial work

When the user asks anything about the business itself (services, pricing, margins, hiring, what to build next, what to prioritize), read the relevant file in [`docs/`](docs/) first. These are the source of truth for everything that isn't in the code:

- [`docs/company.md`](docs/company.md) — identity, team, brand voice, service area
- [`docs/services-pricing.md`](docs/services-pricing.md) — what we sell, how we price, margins
- [`docs/operations.md`](docs/operations.md) — crew, equipment, vendors, seasonal cadence, software stack
- [`docs/finances.md`](docs/finances.md) — revenue model, cost structure, current snapshot
- [`docs/strategy.md`](docs/strategy.md) — current goals, constraints, open strategic questions

If a section is still `TODO:`, treat it as unknown — don't invent. Ask the user, or note the gap in your answer.

## Repository layout — two distinct apps

This repo contains **two separate applications** with their own dependencies, build tools, and runtimes. Each lives in its own top-level folder; the repo root holds only this file, [`docs/`](docs/), and the two app directories. Always confirm which one you are touching before editing.

```
/
├── CLAUDE.md
├── docs/                    # business context (company, pricing, finances, ops, strategy)
├── marketing/               # Vite + vanilla JS public marketing site → luckylandscapes.com
└── luckyapp/                # Next.js + Supabase internal business app → Vercel
```

### 1. [`marketing/`](marketing/) — Public marketing site
- **Stack:** Vite 7 + vanilla JS + multiple static HTML entry points. No framework.
- **Animation:** GSAP (with ScrollTrigger) + Lenis smooth scroll, wired together via `gsap.ticker` in [`marketing/main.js`](marketing/main.js).
- **Entry points** (declared in [`marketing/vite.config.js`](marketing/vite.config.js)): `index.html`, `team.html`, `careers.html`, `gallery.html`, `quote.html`, `privacy.html`, `terms.html`, plus five service pages under [`marketing/services/`](marketing/services/).
- **Quote form backend:** luckyapp `POST /api/leads/public` ([`luckyapp/src/app/api/leads/public/route.js`](luckyapp/src/app/api/leads/public/route.js)). Submissions create a `customers` row tagged `'lead'` (source `'website'`) — deduped by email per org, repeat inquiries append to the existing customer's notes. Photos are decoded from base64 in the request body, uploaded to the `quote-media` Storage bucket under `leads/<orgId>/<customerId>/`, and written to `quote_media` rows with `quote_id = NULL` (allowed since migration 023) so they show up in the customer's media gallery as soon as a quote is built for them. Notifications fan out via `notifyOrg()` ([`src/lib/notify.js`](luckyapp/src/lib/notify.js)) — in-app feed row + Resend email + web push to owners/admins. The constants live at the top of [`marketing/main.js`](marketing/main.js): `LEADS_INTAKE_URL` is the active endpoint; `QUOTES_SCRIPT_URL` is left as an empty kill switch (paste a deployed Apps Script URL there to dual-write again, e.g. during a Vercel outage — see [`marketing/scripts/SETUP-INSTRUCTIONS.md`](marketing/scripts/SETUP-INSTRUCTIONS.md)). Marketing main.js compresses photos client-side to ~200–400KB before encoding so payloads stay under Vercel's 4.5MB body cap.
- **Site config (analytics + 3rd-party keys):** `window.LL_CONFIG` is injected into the `<head>` of every HTML page by [`marketing/scripts/inject-head.js`](marketing/scripts/inject-head.js). Four keys: `ga4` (GA4 measurement ID), `clarity` (Microsoft Clarity project ID), `geoapify` (address autocomplete API key), `turnstile` (Cloudflare Turnstile site key). When a key is empty or contains `XXXX`, that integration is a no-op — the page works without it. **To set keys:** edit the placeholder values inside the `<script>` tag of `inject-head.js` (the constant `HEAD_BLOCK`) and re-run `node scripts/inject-head.js` to update all 12 HTML files at once. The script is idempotent and uses a `<!-- LL:HEAD-INJECT -->` sentinel to find/replace the block.
- **Image pipeline:** Originals live in [`marketing/source-images/`](marketing/source-images/) (do not commit at full quality if they're huge — the script will re-encode on demand). Run `npm run optimize-images` ([`scripts/optimize-images.js`](marketing/scripts/optimize-images.js)) to produce the web-ready versions in `public/images/` — uses `sharp` with per-folder quality profiles. To add new gallery photos: drop a high-res original into `source-images/<folder>/<n>.jpg` (or `.webp`), then run `npm run optimize-images` and commit both the source and optimized output. Re-runnable safely; pass `--force` to re-encode unchanged files.
- **Hosting:** **Cloudflare Pages**, project connected to GitHub `LuckyLandscapes/luckylandscapes`. Production branch: `main` → `https://luckylandscapes.com`. Any non-`main` branch automatically gets a preview deployment at `https://<branch>.<project>.pages.dev`. CF Pages dashboard settings: **Root directory: `marketing`**, build command: `npm run build`, build output directory: `dist`. [`marketing/public/_redirects`](marketing/public/_redirects) enforces non-www canonical — CF Pages reads it natively (Netlify-compatible syntax). [`marketing/public/_headers`](marketing/public/_headers) sets security headers (incl. CSP) + long image cache. Rollback: CF Pages dashboard retains every prior deployment; one-click rollback. Domain DNS is also on Cloudflare. **For 70%+ image savings on top of the local pipeline:** turn on Cloudflare Polish (Pro plan) or CF Images — auto-converts to AVIF on the fly without code changes.
- **Clean URLs (no `.html` in declared URLs).** CF Pages 308-redirects `/foo.html` → `/foo`. Every URL we *declare* (canonical tags, `og:url`, JSON-LD `url` / `@id`, sitemap `<loc>`, internal `<a href>`) must use the clean form without `.html`, otherwise Google Search Console flags pages as "Page with redirect" / "Alternate page with proper canonical tag" and won't index them. The page **files** still end in `.html` on disk (Vite needs that for entry resolution) — it's only the URL strings that drop the extension. Build-time emitters in [`marketing/scripts/build-content-pages.js`](marketing/scripts/build-content-pages.js) and [`marketing/scripts/rewrite-quote.js`](marketing/scripts/rewrite-quote.js) follow the same convention. If `.html` URLs ever creep back in, run [`node scripts/seo-clean-urls.js`](marketing/scripts/seo-clean-urls.js) — idempotent, walks every `.html` and the build scripts and strips `.html` from canonical/og/JSON-LD/href URLs.

### 2. `luckyapp/` — Internal business app (separate Next.js project)
- **Stack:** Next.js 16 + React 19 (App Router), Supabase (Postgres + Auth + Storage + Realtime), Stripe (payments), Resend (transactional email), Google Calendar API, jsPDF (PDF generation).
- **Read [`luckyapp/AGENTS.md`](luckyapp/AGENTS.md) before editing.** Next.js 16 has breaking changes from prior versions; consult `luckyapp/node_modules/next/dist/docs/` rather than relying on prior knowledge.
- **Routing:** App Router, with the authenticated UI grouped under [`src/app/(dashboard)/`](luckyapp/src/app/(dashboard)/) (calendar, catalog, contractors, contracts, crew-dashboard, crew-schedule, customers, dashboard, finance, invoices, jobs, measure, mileage, quotes, reports, settings, tax, team). Public surfaces: `login`, `auth`, `pay`, `quote`, `sign`, `offline`. Server endpoints live under [`src/app/api/`](luckyapp/src/app/api/).
- **Deploy:** Vercel (`luckyapp/vercel.json`). The `/sw.js` service worker is explicitly set to `no-store` so updates ship immediately.

## Common commands

### Marketing site (run from `marketing/`)
```bash
cd marketing
npm run dev               # Vite dev server on http://localhost:3000 (auto-opens)
npm run build             # Build to marketing/dist/
npm run preview           # Preview the built dist/
npm run optimize-images   # Re-encode source-images/ → public/images/ (run after adding new photos)
node scripts/inject-head.js  # Re-inject the analytics/preconnect block into every HTML page (idempotent)
```

### luckyapp (run from `luckyapp/`)
```bash
cd luckyapp
npm run dev       # Next dev server
npm run build     # Production build
npm start         # Run production build
npm run lint      # ESLint (eslint-config-next)
```
There is no test runner configured in either app.

## luckyapp architecture — things worth knowing up front

### Dual-mode data layer (Supabase + localStorage)
[`src/lib/supabase.js`](luckyapp/src/lib/supabase.js) exports `isSupabaseConnected()`. When `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent, the client is `null` and the entire app runs in **demo mode against `localStorage`** (keys prefixed `lucky_`). [`src/lib/data.js`](luckyapp/src/lib/data.js) is the single `DataProvider` context that branches on `connected` for every read/write and converts between snake_case (Postgres) and camelCase (React) at the boundary. When adding a new entity, you must implement **both** the Supabase path and the localStorage path, and add the camel/snake conversion if the column names differ.

### Auth and tenancy
Auth state comes from [`src/lib/auth.js`](luckyapp/src/lib/auth.js); every Supabase query is scoped by `orgId` (multi-tenant via RLS). Session is persisted under the storage key `lucky-app-auth`. Don't strip `orgId` filters — RLS will already block cross-tenant reads, but the queries are written to fail closed.

### Domain logic location
Pure business logic (P&L, AR aging, job profitability) lives in [`src/lib/finance.js`](luckyapp/src/lib/finance.js) and is imported into `data.js`. PDF generation lives in [`src/lib/generateQuotePdf.js`](luckyapp/src/lib/generateQuotePdf.js). Google Calendar sync is in [`src/lib/googleCalendar.js`](luckyapp/src/lib/googleCalendar.js). Stripe **server-side** logic is in [`src/lib/stripeServer.js`](luckyapp/src/lib/stripeServer.js) — never import this from a `'use client'` file.

### Database migrations
SQL migrations are numbered files in [`luckyapp/supabase/migrations/`](luckyapp/supabase/migrations/) and **must be run in order** in the Supabase SQL editor. Notes from [`migrations/README.md`](luckyapp/supabase/migrations/README.md):
- 001 and 002 overlap; 001 uses `CREATE TABLE IF NOT EXISTS` so running 001 then 002 is safe.
- Four prefixes are duplicated — `006_` (`break_minutes` + `job_media`), `007_` (`invoices` + `job_priority`), `023_` (`contracts` + `quote_media_nullable_quote_id`), and `024_` (`contracts_pdf_and_storage` + `time_segments`). Treat the numeric prefix as a sort key, not a uniqueness guarantee — when adding a new migration, check what's already present and run duplicates in alphabetical order within the prefix.
- Latest migrations on disk: `029_job_workday_set.sql`, then the catalog rebuild trio — `030_suppliers_table.sql`, `031_materials_rebuild.sql` (DROPS and recreates materials with supplier_id FK + tax_rate + customer-visible flag), `032_selected_materials.sql` (adds JSONB columns to quotes + contracts), `033_subcontract_support.sql` (`customers.customer_type` + `jobs.work_authorization`/`work_order_*`/`site_contact_*` for sub work), `034_payroll_classification.sql` (`team_members.payroll_classification` w2/1099/owner — burden config piggybacks on existing `organizations.settings` JSONB, no schema change there), `035_deposit_options.sql` (`deposit_type` + `deposit_percentage` on quotes + contracts — adds percentage-of-total deposit mode alongside the legacy materials+delivery sum), `036_quote_total_includes_delivery.sql` (one-shot backfill: `quotes.total = total + delivery_fee` so `quote.total` is now the customer-facing grand total — see "Quote total now includes delivery" below), `037_team_member_dob.sql` (`team_members.date_of_birth` for FLSA child-labor compliance flags), and `038_backfill_payment_rows.sql` (one-shot backfill: synthesize a `payments` row for every invoice with `amount_paid > 0` and no existing payment history — fixes legacy "Mark Paid" invoices that never created a payment row, so they now show up in cash-basis revenue). `028` was deliberately skipped. Next one should be `039_…`.
- `FULL_REBUILD.sql` is **deprecated** — it only covers 001–013 and is missing every newer table and column. Always run the numbered files in order; do not use the rebuild script.

### Database backups — daily encrypted dump via GitHub Actions
Supabase free tier has **no automated backups and no point-in-time recovery** — those are Pro-tier ($25/mo). Lucky rolls its own via [`.github/workflows/supabase-backup.yml`](.github/workflows/supabase-backup.yml), which runs daily at 07:00 UTC and:

1. `pg_dump`s the whole database (`--clean --if-exists --no-owner --no-acl`) — schema + data, restorable into any Postgres.
2. Walks every Storage bucket via the `/storage/v1` REST API ([`luckyapp/scripts/backup-storage.mjs`](luckyapp/scripts/backup-storage.mjs), zero deps, native fetch) and downloads every file. **This is load-bearing** — the DB dump alone leaves dead URLs for `quote-media`, `receipts`, `contract-pdfs`, and the new `mileage/` + work-order folders.
3. Tarballs both, encrypts with `gpg --symmetric --cipher-algo AES256` against `BACKUP_PASS`, uploads as a 90-day GitHub Actions artifact.

**Required repo secrets** (Settings → Secrets and variables → Actions):
- `SUPABASE_DB_URL` — Session pooler connection string from Supabase dashboard → Project Settings → Database. **Port 5432, NOT 6543** — `pg_dump` needs session mode, not transaction mode.
- `SUPABASE_URL` — `https://<project-ref>.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY` — service_role JWT (anon key won't see all files due to RLS).
- `BACKUP_PASS` — long random passphrase. **Save in 1Password or similar — losing it means losing every backup.**

**Side benefit:** the daily `pg_dump` query keeps the project active, dodging the free-tier 7-day auto-pause that would otherwise break the marketing site's quote form whenever Lucky goes a week without dashboard activity.

**Restore instructions** are in the workflow file's header comment. Restore is rare enough that the inverse-of-backup-storage script isn't pre-built — write it when actually needed.

**When to upgrade to Pro ($25/mo):** once Lucky has ~10+ paying contracts/month, the math flips. Pro gets daily managed backups with 7-day retention, PITR within that window, no auto-pause, and one-click restore via dashboard. Until then this setup is genuinely sufficient.

### Catalog system — suppliers, materials, customer view, selected materials on quotes/contracts
Rebuilt in 030–032. Source files live in [`src/app/(dashboard)/catalog/page.js`](luckyapp/src/app/(dashboard)/catalog/page.js), [`src/components/MaterialFormModal.js`](luckyapp/src/components/MaterialFormModal.js), [`src/components/CustomerCatalogCard.js`](luckyapp/src/components/CustomerCatalogCard.js), [`src/components/SelectMaterialsModal.js`](luckyapp/src/components/SelectMaterialsModal.js), [`src/components/ImportMaterialsModal.js`](luckyapp/src/components/ImportMaterialsModal.js), [`src/lib/catalog.js`](luckyapp/src/lib/catalog.js), [`src/lib/csvCatalog.js`](luckyapp/src/lib/csvCatalog.js).

Key concepts:
- **Suppliers are first-class.** Materials have a `supplier_id` FK (NOT NULL). Each supplier owns a `default_tax_rate` (default 0.0725 for Lincoln/Lancaster). The catalog page surfaces a "Suppliers" management modal. The "Add 3 default suppliers" button (also in `data.js`'s `seedDefaultSuppliers`) bootstraps Outdoor Solutions / Menards / Home Depot in one click.
- **Tax-aware cost basis.** `getMaterialActualCost(material, supplier)` in [`src/lib/catalog.js`](luckyapp/src/lib/catalog.js) returns `unit_cost × (1 + COALESCE(material.tax_rate, supplier.default_tax_rate))`. This is what feeds job-cost reports — assumes NE Option 1 sales tax (contractor pays tax at supplier; doesn't charge tax to customer). If Riley elects Option 2 or 3, this calc needs to change.
- **Internal vs Customer view tabs** on the catalog page. Customer view: photo, name, category, color, texture, coverage, description. Hides cost, supplier name, SKU, notes, stock, margin. Toggle persists in localStorage. Present mode (slideshow) defaults to customer view; pressing `i` toggles an internal pricing overlay.
- **Customer never sees prices on materials anywhere.** This is enforced by:
  - `is_customer_visible` flag on each material (default true; toggle off to hide)
  - `CustomerCatalogCard` component, which structurally cannot render price fields
  - The materials gallery sections of the quote PDF, public quote view, and contract sign page all use customer-shape data
- **Selected materials on quotes and contracts.** Both tables have `selected_materials JSONB` (migration 032). The shape is a snapshot — `{ materialId, name, category, imageUrl, color, texture, coveragePerUnit, unit, quantity, notes, snapshottedAt }` — so historical PDFs survive material renames/deletions. Salespeople pick from the catalog inside the quote builder (via `SelectMaterialsModal`); the gallery renders into the quote PDF, the public `/quote/[token]` page, the contract sign page (signing approves these specific products), and the contract detail page in the dashboard. `buildContractFromQuote()` carries the gallery from quote → contract automatically.
- **Manual price refresh, not cron.** [`/api/catalog/refresh-batch`](luckyapp/src/app/api/catalog/refresh-batch/route.js) fans out to [`/api/catalog/lookup`](luckyapp/src/app/api/catalog/lookup/route.js) (the JSON-LD scraper) sequentially with a 500ms delay. The "Refresh prices" button on the catalog opens a modal where the user picks which suppliers to scope. There's no cron — explicitly to control cost while keeping Lucky App free vs. Jobber. CLI alternative: [`scripts/refresh-catalog-prices.js`](luckyapp/scripts/refresh-catalog-prices.js) (`node scripts/refresh-catalog-prices.js --supplier=os --dry-run`). Outdoor Solutions Lincoln (the Roca, NE store — see [`docs/operations.md`](docs/operations.md)) refreshes reliably; Menards and Home Depot use Akamai/PerimeterX bot detection so a chunk will always 403/429.
- **CSV import.** [`ImportMaterialsModal`](luckyapp/src/components/ImportMaterialsModal.js) accepts paste-or-upload CSV. Required columns: `supplier_name, name, category, unit, unit_cost`. Suppliers must already exist (matched by exact name). Two-step flow: paste → Validate (dry-run report with insert/update/skip counts and per-row error messages) → Apply. The hardcoded [`seedOutdoorSolutionsLincoln.js`](luckyapp/src/lib/seedOutdoorSolutionsLincoln.js) is no longer auto-imported but kept on disk as legacy reference.
- **What was deliberately dropped** in 031: `image` + `image_emoji` (only `image_url` remains), `cost_low` + `cost_high` (single `unit_cost`), `unit_alt`, `supplier` (text — replaced by `supplier_id` FK), `sold_out` (replaced by `is_active`).

### Public payment links
Invoice public-pay tokens are URL-safe hex generated via `window.crypto.getRandomValues` (with a Math.random fallback) — see `makeUrlSafeToken` in `data.js`. Migration `015_fix_public_token_url_safe.sql` exists because earlier tokens were not URL-safe; preserve the URL-safe property when changing token logic.

### Deposits — two modes on quotes + contracts
Migration 035 added `deposit_type` (`'materials_delivery'` | `'percentage'`) and `deposit_percentage` to both `quotes` and `contracts`. Pure helpers live in [`src/lib/deposit.js`](luckyapp/src/lib/deposit.js): `computeQuoteDeposit(record)` (handles both camelCase + snake_case), `formatDepositLabel(record)`, `isPercentageDeposit(record)`, plus `DEPOSIT_TYPES` and `DEPOSIT_PERCENTAGE_PRESETS = [10, 25, 33, 50]` for the quick-pick buttons.

- **Mode 1 — `materials_delivery`** (legacy default): deposit = `materials_cost + delivery_fee`. Right when Lucky has to front material costs upfront — covers hard cash out the door.
- **Mode 2 — `percentage`**: deposit = `total × deposit_percentage / 100`. Right for labor-heavy work with no big material buy upfront. Calculator runs against `quote.total` (line-item subtotal); doesn't include the materials_cost field at all.

Shared UI in [`src/components/DepositCard.js`](luckyapp/src/components/DepositCard.js) — used by both `(dashboard)/quotes/new/page.js` and `(dashboard)/quotes/[id]/edit/page.js`. Mode toggle is segmented buttons; switching modes preserves the unused side's inputs so flipping back doesn't lose data.

When a contract is generated from a quote, [`buildContractFromQuote`](luckyapp/src/lib/contractTemplate.js) snapshots `depositType` + `depositPercentage` into the contract row (alongside the existing `depositAmount` dollar snapshot) and bakes the right phrasing into the contract body — `"(representing 25% of the total contract price)"` vs `"(covering materials and delivery)"`. The frozen body is what the customer agrees to, so a future quote edit doesn't rewrite history.

Stripe deposit intents ([`/api/stripe/quote-deposit-intent`](luckyapp/src/app/api/stripe/quote-deposit-intent/route.js)) call `computeQuoteDeposit()` server-side and pass `deposit_type` + `deposit_percentage` through to the webhook metadata so payment-row notes read `"deposit (25% of total) via card"` instead of always-`"materials + delivery"`. **Invoice deposit crediting** in `(dashboard)/invoices/page.js` also uses the helper — replacing this with `materialsCost + deliveryFee` would break credit math for percentage-mode quotes.

### Quote total now includes delivery (migration 036)
Before 036, `quotes.total` was the line-item subtotal only; `delivery_fee` lived in a separate column and got silently rolled into the materials+delivery deposit but never appeared in the customer-facing "Estimated Total" or in percentage-deposit math. Net effect: in percentage mode, delivery was never billed at all (revenue leak). Fixed by storing `total = line_items + delivery_fee` on every save. Read sites all use `quote.total` directly so they're correct without further changes; the PDF, public quote view, and dashboard detail page show a "Subtotal / Delivery / Total" breakdown when delivery > 0. **If you change the write path** (`(dashboard)/quotes/new/page.js`, `(dashboard)/quotes/[id]/edit/page.js`), keep `total: subtotal + deliveryFee`. Don't introduce a `total + deliveryFee` add at any read site — the value is already baked in.

### Quote builder UX — autosave, save-as-draft, and materials cost auto-fill
- **Crash-recovery autosave** in [`(dashboard)/quotes/new/page.js`](luckyapp/src/app/(dashboard)/quotes/new/page.js) writes the in-flight quote to `localStorage` key `lucky_quote_draft_inprogress` with an 800ms debounce, including step number. On mount, if a draft <7 days old exists, a "Resume your unfinished quote?" banner offers Restore/Discard. Clears on successful submit. NOT a replacement for "Save as Draft" — that explicitly commits to Postgres so the row appears on `/quotes`.
- **Save as Draft button** appears in the page header on step ≥2 (after a customer is picked). It calls the existing `handleSubmit` which always sets `status: 'draft'`, so partial quotes land in `/quotes` and can be resumed via the existing `/quotes/[id]/edit` flow.
- **Materials cost auto-fill** uses `computeSelectedMaterialsCost(selectedMaterials, materials, suppliers)` from [`src/lib/catalog.js`](luckyapp/src/lib/catalog.js). The helper looks up each snapshot's `materialId` in the live catalog and sums `quantity × actual cost (incl. tax)`. Snapshots are deliberately price-free (customer-shape data), so the lookup goes back to the materials table. Materials deleted since the snapshot are skipped silently. UI: "Use as materials cost" button appears under the selected-materials grid in both new and edit quote pages — explicit click so the salesperson stays in control of overrides.

### Auto-extend job assigned_to when crew clocks in mid-job
When a crew member starts a shift on a job they weren't originally on (`startShift` or `switchSegment` in [`src/lib/data.js`](luckyapp/src/lib/data.js)), an `ensureMemberOnJob(memberId, jobId)` helper appends them to `jobs.assigned_to` if absent. Best-effort — wrapped in try/catch so a failed update doesn't block the shift start. Per-job labor cost in [`src/lib/finance.js`](luckyapp/src/lib/finance.js) already prefers `time_segments.job_id` over `time_entries.job_id` and `assigned_to`, so the cost math was already right; this fix is just so the schedule UI / PDFs accurately list everyone who actually worked the job.

### Material calculator — cubic yards / weight / bags
[`/calculator`](luckyapp/src/app/(dashboard)/calculator/page.js) is a standalone tool. Pure helpers in [`src/lib/materialCalc.js`](luckyapp/src/lib/materialCalc.js): `cubicYardsFromAreaAndDepth`, `weightLbsForVolume`, `summarize({ sqft, depthInches, materialId })`. 13 material presets with industry-average lbs/cu yd densities (mulch ~900, topsoil ~2200, river rock ~2800, etc.). Outputs cu yd / cu ft / lbs / tons / bag count for bagged materials. Includes a "Delivery sizing" hint based on tonnage. To prefill `sqft` from elsewhere, set `sessionStorage.lucky_calc_prefill_sqft` before navigating.

### Multi-stop route optimizer
[`/routing`](luckyapp/src/app/(dashboard)/routing/page.js) uses [`src/lib/routeOptimizer.js`](luckyapp/src/lib/routeOptimizer.js) — pure JS nearest-neighbor TSP on Haversine distances. Free path: addresses → Nominatim (OSM, no key, ~1 req/sec) → `nearestNeighborTsp` → ordered list + Google Maps deep link with multi-stop waypoints. For Lucky's typical 5-15 stops/day in/around Lincoln, ~5-10% longer than true optimum — well inside traffic noise. Shop address persists in `localStorage`. Pulls all jobs scheduled for the selected date plus calendar events that have a customer; jobs with `scheduledDate` arrays (workdaySet) are matched if the date is in the array. **No paid APIs.** If accuracy ever becomes an issue, swap in OpenRouteService's free `/optimization` endpoint (500 req/day) before considering Google Routes API.

### Minor compliance flags (DOB on team_members)
Migration 037 added `team_members.date_of_birth`. Helpers in [`src/lib/minorCompliance.js`](luckyapp/src/lib/minorCompliance.js): `computeAge`, `isMinor`, `ageTier`, `getComplianceWarnings`, plus the `HAZARDOUS_TASKS_UNDER_18` and `HOUR_CAPS_UNDER_16` reference data. **NOT a payroll-tax field** — non-family W-2 employees owe full FICA/FUTA regardless of age (the family-employment exemption applies only to children of sole-prop owners, which doesn't fit Riley's crew). Used for FLSA child-labor flags: hazardous-task restrictions (chainsaws, chippers, riding mowers >20HP per 29 CFR 570.50–570.68) and under-16 hour caps (29 CFR 570.35). Surfaced in the team page member rows (age pill + "No chainsaw / chipper / riding mower" warning for minors) and the Add Team Member modal (DOB field with live age warning). Half of Lucky's crew are HS juniors per [`docs/company.md`](docs/company.md), so this is load-bearing for compliance.

### Global modal + menu scroll lock
[`<BodyScrollLock />`](luckyapp/src/components/BodyScrollLock.js) is mounted once in [`root-providers.js`](luckyapp/src/app/root-providers.js). Watches the DOM via MutationObserver for any `.modal-overlay`, `.sidebar-mobile-overlay`, `[role="dialog"][aria-modal="true"]`, or `[data-menu-scroll]` and toggles `body { overflow: hidden }` plus a paddingRight compensation for the disappearing scrollbar. **One-time setup covers every modal AND popup menu globally** — individual surfaces do not need to call anything. New modals work for free as long as they render a `.modal-overlay` backdrop; new popup menus work as long as they tag the scrollable container with `data-menu-scroll`.

### Global menu scroll redirect
[`<MenuScrollRedirect />`](luckyapp/src/components/MenuScrollRedirect.js), also mounted in [`root-providers.js`](luckyapp/src/app/root-providers.js), redirects mouse-wheel scroll into any open popup menu so the user doesn't have to hover the dropdown to scroll a long list. **Opt-in via `data-menu-scroll`** on the scrollable container (must be `overflow-y:auto`). Currently applied to the customer dropdown on `/measure` and the customer-search dropdown in [`EventModal.js`](luckyapp/src/components/EventModal.js). Listener uses `capture: true, passive: false` so it intercepts before Google Maps' wheel-zoom handler when the dropdown sits over the satellite view. If multiple `[data-menu-scroll]` elements are mounted, the last one in DOM order wins. Pairs with `BodyScrollLock` (above): the lock pins the page while the menu is open, the redirect feeds wheel events into the menu regardless of cursor placement, and a global CSS rule `[data-menu-scroll] { overscroll-behavior: contain; }` in [`globals.css`](luckyapp/src/app/globals.css) prevents scroll chaining when the cursor sits inside the menu and hits its scroll boundary.

### Refresh-to-deleted-page fix
After clicking Delete on `/quotes/[id]`, `/jobs/[id]`, etc., the data layer's local state updates synchronously while `router.push('/list')` is still pending. That brief render flashed the "X not found" empty state. Fix in each detail page is one line: add `if (!entity && deleting) return null;` before the not-found fallback. The `deleting` state is already tracked everywhere except customers (which I added). Pattern is grep-able as `if (!quote && deleting)` etc.

### Time tracking — shift + segment model
A "shift" is one `time_entries` row. Within the shift, the worker moves between `time_segments` of kind `'job' | 'travel' | 'break'`, recorded in real time. New API in [`src/lib/data.js`](luckyapp/src/lib/data.js): `startShift`, `switchSegment`, `endShift`, `annotateOpenSegment`. Legacy `clockIn` / `clockOut` are kept as wrappers — they still create a single shift but ALSO open a segment so segment-based job costing stays consistent. `time_entries.break_minutes` is recomputed as the sum of break-segment durations on `endShift`, so legacy payroll math keeps working. Per-job labor cost (in [`src/lib/finance.js`](luckyapp/src/lib/finance.js)) prefers `'job'`-kind segments when present, falling back to `time_entries.job_id` for entries without segments. Schema: [`024_time_segments.sql`](luckyapp/supabase/migrations/024_time_segments.sql).

### Tax tooling — mileage, 1099, Schedule C
Three separate features make up the year-end tax surface:

1. **Mileage log** — `mileage_entries` table ([`025_mileage.sql`](luckyapp/supabase/migrations/025_mileage.sql)) captures one row per trip with date / miles / purpose / addresses / odometer / optional start+end photos. Photos go to the existing `receipts` bucket under a `mileage/` folder. Page at [`(dashboard)/mileage/page.js`](luckyapp/src/app/(dashboard)/mileage/page.js).

2. **Contractors / 1099** — `contractors` table ([`026_contractors.sql`](luckyapp/supabase/migrations/026_contractors.sql)) holds W-9 info (full SSN/EIN, address, classification, signed-W-9 photo). Payments are not a separate table; `job_expenses` and `company_expenses` got a nullable `contractor_id` FK so existing expense flows tag a contractor. The same migration extends `contracts` with a `party_type` ('customer' | 'contractor') so the existing signing infrastructure can be reused for independent contractor agreements (signing flow not yet wired).

3. **Schedule C export + 1099 totals + quarterly estimator** at [`(dashboard)/tax/page.js`](luckyapp/src/app/(dashboard)/tax/page.js). Aggregation lives in [`src/lib/finance.js`](luckyapp/src/lib/finance.js) `buildScheduleC` — maps every COGS_CATEGORIES + OPEX_CATEGORIES item to a Schedule C line via `COGS_TO_SCHEDULE_C` / `OPEX_TO_SCHEDULE_C`. Honors a configurable `entityStartDate` because the LLC was formed 2026-03-01 and pre-formation activity belongs on a personal sole-prop Schedule C, not the LLC return. The page also surfaces a **federal 1040-ES quarterly banner** with the next due date and a rough YTD-net × 25% placeholder (NOT a real calc — disclaimer makes that explicit). YTD net comes from `getPnL('ytd', 'completed')`; the 'ytd' period is in [`finance.js`](luckyapp/src/lib/finance.js) `getPeriodRange`.

**Tax IDs** (full SSN/EIN) are stored in `contractors.tax_id`. They're row-level-secured per org and never exposed in any public route — but if you ever build a join that touches contractors from a public token endpoint, audit it.

### Cash-basis revenue + payment-method tracking + Stripe fees
Revenue in the P&L can be computed two ways via the `basis` arg on [`buildPnL`](luckyapp/src/lib/finance.js) / [`getPnL`](luckyapp/src/lib/data.js):

- **`'completed'` (accrual basis)** — sum of completed-job revenue dated in period. Best for "did we earn it?" Right when measuring delivery throughput.
- **`'paid'` (cash basis)** — sum of `payments.amount` with `paid_at` in period, filtered to `status === 'succeeded'`. Picks up quote deposits, partial invoice payments, and anything else that hit the bank. Best for "did we get the money?"

The dashboard and `/reports` both **default to cash basis** because that's what owners intuitively mean by "revenue". The dashboard headline shows "Collected (30 days)" and surfaces "Earned: $X" as a sub-line when accrual ≠ cash (clarifies the gap without forcing a basis toggle on the home screen).

**Stripe / processor fees** are tracked separately. The webhook ([`/api/stripe/webhook`](luckyapp/src/app/api/stripe/webhook/route.js)) already pulls the actual fee from each charge's `balance_transaction` and stores it on `payments.processor_fee` + `payments.net_amount` — this is per-charge, exact, not estimated. `pnlForRange` sums those fees in-period and:
1. Adds them to OpEx (regardless of basis — fees are real outflows)
2. Returns `processorFees` as a top-level field so `/reports` can show them as a dedicated P&L line ("Payment processing fees (Stripe)")
3. Surfaces them on `/finance` under the "Payments Collected" sidebar card with a "Net to your bank" subtotal

**Payment-method breakdown** lives on `/finance` ([`(dashboard)/finance/page.js`](luckyapp/src/app/(dashboard)/finance/page.js)) — period-aware card showing collected $ by method (card / ACH / cash / check / Venmo / Zelle / other) with a horizontal bar gauge. Pulls from `pnl.paymentsByMethod` so it stays in lockstep with the P&L.

**Important: "Mark Paid" creates a payment row** ([`(dashboard)/invoices/[id]/page.js`](luckyapp/src/app/(dashboard)/invoices/[id]/page.js) `handleMarkPaid`). Before migration 038, that button only updated `invoices.amount_paid` without inserting into `payments`, which silently broke cash-basis revenue for every invoice marked paid through the legacy flow. Now it inserts a `method='other'` row (using `invoice.payment_method` if set) so the invoice immediately shows up in cash revenue + payment-method breakdown. **Don't revert** — anyone touching this code needs to keep the payment-row insert in lockstep with the invoice update, or cash-basis revenue will desync from the dashboard "Outstanding" badge.

If `payments` is empty (data-layer not wired through yet), cash-basis revenue returns $0 — `buildPnL` accepts an optional `payments=[]` default so legacy callers don't crash, but they'll show no cash revenue.

### A/R collection — auto-dunning + dashboard surface
Three layers, all sharing the same email template in [`src/lib/invoiceReminder.js`](luckyapp/src/lib/invoiceReminder.js):

1. **Daily cron** at [`/api/cron/auto-dunning`](luckyapp/src/app/api/cron/auto-dunning/route.js), scheduled in `vercel.json`. Sends one reminder per outstanding invoice that is **3+ days past due** and has not been reminded in the last 7 days. Both thresholds are env-overridable (`DUNNING_MIN_DAYS_OVERDUE`, `DUNNING_MIN_DAYS_BETWEEN`). Tone is auto-picked from `pickTone(daysOver)`: friendly ≤30d, firm 31–60d, urgent 60+d.
2. **Manual one-click** from the "Send Payment Reminders" panel on [`/finance`](luckyapp/src/app/(dashboard)/finance/page.js) → `POST /api/send-invoice-reminder`. Same template, same audit log row in `invoice_reminders`.
3. **Dashboard A/R aging strip** on [`/dashboard`](luckyapp/src/app/(dashboard)/dashboard/page.js) — five-bucket aging with a "Send Reminders" CTA that deep-links to /finance. Shown only when `aging.totalAR > 0`.

When changing the reminder cadence, change it in **both** the cron defaults and the descriptive copy on /finance + /dashboard so the displayed expectation matches what the system actually does.

### Subcontract work — GC-as-customer + per-job authorization gate
Lucky often gets hired by another contractor (GC) to work on someone else's property. The end-property-owner signs the GC's agreement, not Lucky's, so the existing "signed customer contract required before job can start" gate doesn't fit. Migration [`033_subcontract_support.sql`](luckyapp/supabase/migrations/033_subcontract_support.sql) adds:

- **`customers.customer_type`** (`'homeowner'` default | `'business'` | `'general_contractor'`). The GC IS the customer in Lucky's system — they're who Lucky bills. End-property-owner is captured per-job as a site contact, NOT as a separate customer record. UI: type picker in the customer add/edit modals + a small pill on the customer list rows. `CUSTOMER_TYPES` and `customerTypeMeta()` are exported from [`(dashboard)/customers/page.js`](luckyapp/src/app/(dashboard)/customers/page.js) and reused by [`(dashboard)/customers/[id]/page.js`](luckyapp/src/app/(dashboard)/customers/[id]/page.js).
- **`jobs.work_authorization`** (`'contract'` default | `'subcontract'` | `'verbal'`) controls how the start-job gate works:
  - `'contract'` — existing behavior: requires `linkedContract.status === 'signed'` (only when a contract is implied by `quoteId` or a `contracts` row).
  - `'subcontract'` — requires `work_order_url` (uploaded photo of PO/email/work order in the existing `receipts` bucket under `<orgId>/work-order/`) OR `work_order_notes` (typed authorization details). Don't drop the gate entirely; replace it with a lower-friction equivalent so there's still proof if the GC disputes the bill later.
  - `'verbal'` — requires `work_order_notes`. Used for trusted repeat customers; the typed reason IS the audit trail.
- **`jobs.site_contact_name` / `site_contact_phone`** — homeowner contact when working through a GC. Surfaced as a separate row in the customer card on the job detail page so the crew has the homeowner's number on site.
- **`jobs.work_order_url` / `work_order_path` / `work_order_notes`** — proof of authorization for non-contract jobs. Visible on the job detail page so the crew can see the agreed scope.

The gate logic and UI live in [`(dashboard)/jobs/[id]/page.js`](luckyapp/src/app/(dashboard)/jobs/[id]/page.js) — search for `workAuth`, `blockStart`, `gateMessage`, and the `WORK_AUTH_OPTIONS` array. The job edit modal exposes all the new fields with conditional sections (work-order upload only shows for subcontract; site contact only for subcontract).

**Workflow gap not yet closed:** there's no "New Job" button — jobs are still created via `convertQuoteToJob`. For sub work, current workflow is: create a quote for the GC → convert to job → edit the job to flip `workAuthorization` to `'subcontract'`. A future enhancement would be a direct "Create Job" button on `/jobs` that skips the quote step entirely.

### Job profitability — per-job margin + reality check on completion
The job detail page banner at [`(dashboard)/jobs/[id]/page.js`](luckyapp/src/app/(dashboard)/jobs/[id]/page.js) shows revenue − materials − equipment − labor − other = profit, **plus a margin %** color-coded by tier:
- `≥30%` → on target (green, matches `docs/finances.md` gross margin target)
- `15-29%` → below target (gold)
- `0-14%` → thin margin (orange)
- `<0%` → losing money (red)

When the user clicks **Complete** on a job whose margin is below 30%, a **reality-check modal** intercepts and shows the actual numbers before the status flips. It's a soft warning, not a hard block — `handleStatusChange('completed', { skipMarginCheck: true })` bypasses it. If a source quote exists, a variance row under the banner compares actual revenue + materials against quoted revenue + `quote.materialsCost`. The constant `TARGET_MARGIN_PCT = 30` is the single source of truth — change it there to retune the threshold.

### Historical backfill — typed form (Riley's path) + CSV import (power users)
Two paths because Riley's not going to touch a CSV. The typed form is the primary surface; the CSV importer is the fallback for big migrations.

- **`/jobs` → "Add Past Job" button** ([`AddPastJobModal`](luckyapp/src/components/AddPastJobModal.js)) — single-job typed form. Pick existing customer or "Add new" (just first/last name); pick a past date; type title + revenue + optional cost buckets. **Save & add another** keeps the same customer + date so logging a string of jobs for one client is fast. Calls `addHistoricalJob` on the data layer, which is the single-row equivalent of `bulkImportHistoricalJobs`.
- **`/jobs` → "Import CSV" button** ([`ImportHistoricalJobsModal`](luckyapp/src/components/ImportHistoricalJobsModal.js)) — bulk path. Two-step paste/upload → validate → apply, modeled on `ImportMaterialsModal`.
- **`/finance` → "New Expense" button** — already takes any date, so logging past overhead just means picking a past date in the date field. The page subtitle calls this out so it's discoverable.
- **`/finance` → "Import History" button** ([`ImportHistoricalExpensesModal`](luckyapp/src/components/ImportHistoricalExpensesModal.js)) — bulk path for overhead.

Pure parsing + validation for the CSV path lives in [`src/lib/csvHistoricalImport.js`](luckyapp/src/lib/csvHistoricalImport.js).

- **Historical jobs CSV** — required: `date_completed, customer_name, title, revenue`. Optional: `address, description, materials_cost, equipment_cost, labor_cost, other_cost, notes`. Each row creates a `jobs` row with `status='completed'` + `completed_at = date_completed at noon UTC`. Customer is matched by full name (case-insensitive) within the org; missing customers are created with the name only (other fields blank, `tags=['imported']`, `source='imported'`). Cost columns spawn `job_expenses` rows: `materials_cost`→`materials`, `equipment_cost`→`equipment`, `labor_cost`/`other_cost`→`other`. We don't have a synthetic-labor pathway because labor cost is computed from `time_entries` — importing labor as an `other` expense gets per-job profit math right at the cost of mis-categorizing it on the bucket breakdown. Dates accept `YYYY-MM-DD` or `M/D/YYYY` (Sheets' default export). Money fields strip `$` and `,` before parseFloat.
- **Historical expenses CSV** — required: `date, category, amount`. Optional: `vendor, description, recurring, recurring_interval`. Each row lands in `company_expenses` (overhead). Category must match the existing `company_expenses.category` CHECK constraint: `vehicle, insurance, rent, utilities, software, marketing, office_supplies, fuel, payroll_tax, other`.
- **Per-job expense backfill is intentionally NOT in the expenses CSV.** Matching legacy line items to a specific job by customer+date is too brittle on Google Sheet data. If you need per-job historical costs, supply them as the optional cost columns on the **jobs** CSV — that's the only path that ties expenses to a specific imported job.
- **The `addJob` localStorage path force-sets `status='scheduled'`** (existing quirk, not worth churning callers). The bulk-import wraps with an `updateJob` call to restore `status='completed'` + the historical `completed_at` so demo-mode imports work the same as Supabase-mode.

### Measure tool — satellite, parcel pull, building detect, AR walk
The measure page at [`(dashboard)/measure/page.js`](luckyapp/src/app/(dashboard)/measure/page.js) is the differentiating feature for selling the app. Four input methods feed the same `shapes` model (areas + exclusions, all in sqft):

1. **Manual draw** — polygon / rectangle / circle / freehand on Google Maps satellite imagery. The original mode.
2. **Pull Parcel** — hits [`/api/parcel/lookup`](luckyapp/src/app/api/parcel/lookup/route.js) which queries free Nebraska public GIS endpoints in order: Lancaster County (Lincoln) → NE statewide TaxParcels2023 FeatureServer. Both are public, key-free ArcGIS REST services. The point-in-polygon query uses the current map centre. Returns the parcel polygon as a blue draggable candidate with owner/address/parcel-id surfaced; user accepts as an area shape.
3. **Detect Buildings** — Overpass API (free OSM) returns all `way["building"]` polygons in the current map bounds. They become orange candidates that subtract from area on accept.
4. **AR Walk** — `/measure/walk` ([`(dashboard)/measure/walk/page.js`](luckyapp/src/app/(dashboard)/measure/walk/page.js)) uses WebXR Hit-Test + three.js to let a salesperson stand on the property and tap to drop perimeter anchor points. Computes polygon area on the XZ ground plane via shoelace, hands the result back via `sessionStorage['lucky_measure_walk_result']` = `{ sqft, points: [{x,z}], capturedAt, source: 'webxr-walk' }`. The measure page picks it up on mount, drops a purple draggable schematic at the current map centre (no compass heading captured, so rotation is arbitrary — user drags to align), and accepts as an area shape. **Android Chrome only** — iOS Safari does not support WebXR; the walk page shows a fallback message there. Drift on WebXR's visual-inertial odometry is ~1% over distance, so the UI labels this an estimate.

All four methods feed the same candidate flow: candidates get `kind: 'building' | 'parcel' | 'walk'`, and `acceptCandidate` converts to `'exclusion'` (building) or `'area'` (parcel + walk). No paid services or subscriptions — every external endpoint used is free public GIS, OSM, or browser-native WebXR.


## When finished with response
Have a section in your response called "Next Steps" to guide the user on what to do next, and a section called things needed to complete for the changes to work, if none are needed state that.

## Critical thinking
If you think an idea is bad, tell me why, be very upfront and critical, don't suger coat it, provide a better alternative if you have one, and always have an idea of how you would improve the app. Reminder you are a developer, act like one, question things, point out problems, and propose solutions, you can code what i can code in minutes when it would take me days.

## Updating Claude file and docs
Update the docs as we go, if you see any inconsistencies or missing information, update the docs. If we have a change in our workflow or the way we do things, update the docs. If you find a better way to do things, update the docs.