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
- Latest migration on disk is `029_job_workday_set.sql` (multi-day jobs as a `scheduled_dates JSONB` workday set). `028` was deliberately skipped — an earlier multi-day-range model was superseded before deploy. Next one should be `030_…`.
- `FULL_REBUILD.sql` is **deprecated** — it only covers 001–013 and is missing 14 newer tables (payments, contracts, time_segments, contractors, etc.). Always run the numbered files in order; do not use the rebuild script.

### Public payment links
Invoice public-pay tokens are URL-safe hex generated via `window.crypto.getRandomValues` (with a Math.random fallback) — see `makeUrlSafeToken` in `data.js`. Migration `015_fix_public_token_url_safe.sql` exists because earlier tokens were not URL-safe; preserve the URL-safe property when changing token logic.

### Time tracking — shift + segment model
A "shift" is one `time_entries` row. Within the shift, the worker moves between `time_segments` of kind `'job' | 'travel' | 'break'`, recorded in real time. New API in [`src/lib/data.js`](luckyapp/src/lib/data.js): `startShift`, `switchSegment`, `endShift`, `annotateOpenSegment`. Legacy `clockIn` / `clockOut` are kept as wrappers — they still create a single shift but ALSO open a segment so segment-based job costing stays consistent. `time_entries.break_minutes` is recomputed as the sum of break-segment durations on `endShift`, so legacy payroll math keeps working. Per-job labor cost (in [`src/lib/finance.js`](luckyapp/src/lib/finance.js)) prefers `'job'`-kind segments when present, falling back to `time_entries.job_id` for entries without segments. Schema: [`024_time_segments.sql`](luckyapp/supabase/migrations/024_time_segments.sql).

### Tax tooling — mileage, 1099, Schedule C
Three separate features make up the year-end tax surface:

1. **Mileage log** — `mileage_entries` table ([`025_mileage.sql`](luckyapp/supabase/migrations/025_mileage.sql)) captures one row per trip with date / miles / purpose / addresses / odometer / optional start+end photos. Photos go to the existing `receipts` bucket under a `mileage/` folder. Page at [`(dashboard)/mileage/page.js`](luckyapp/src/app/(dashboard)/mileage/page.js).

2. **Contractors / 1099** — `contractors` table ([`026_contractors.sql`](luckyapp/supabase/migrations/026_contractors.sql)) holds W-9 info (full SSN/EIN, address, classification, signed-W-9 photo). Payments are not a separate table; `job_expenses` and `company_expenses` got a nullable `contractor_id` FK so existing expense flows tag a contractor. The same migration extends `contracts` with a `party_type` ('customer' | 'contractor') so the existing signing infrastructure can be reused for independent contractor agreements (signing flow not yet wired).

3. **Schedule C export + 1099 totals + quarterly estimator** at [`(dashboard)/tax/page.js`](luckyapp/src/app/(dashboard)/tax/page.js). Aggregation lives in [`src/lib/finance.js`](luckyapp/src/lib/finance.js) `buildScheduleC` — maps every COGS_CATEGORIES + OPEX_CATEGORIES item to a Schedule C line via `COGS_TO_SCHEDULE_C` / `OPEX_TO_SCHEDULE_C`. Honors a configurable `entityStartDate` because the LLC was formed 2026-03-01 and pre-formation activity belongs on a personal sole-prop Schedule C, not the LLC return. The page also surfaces a **federal 1040-ES quarterly banner** with the next due date and a rough YTD-net × 25% placeholder (NOT a real calc — disclaimer makes that explicit). YTD net comes from `getPnL('ytd', 'completed')`; the 'ytd' period is in [`finance.js`](luckyapp/src/lib/finance.js) `getPeriodRange`.

**Tax IDs** (full SSN/EIN) are stored in `contractors.tax_id`. They're row-level-secured per org and never exposed in any public route — but if you ever build a join that touches contractors from a public token endpoint, audit it.

### A/R collection — auto-dunning + dashboard surface
Three layers, all sharing the same email template in [`src/lib/invoiceReminder.js`](luckyapp/src/lib/invoiceReminder.js):

1. **Daily cron** at [`/api/cron/auto-dunning`](luckyapp/src/app/api/cron/auto-dunning/route.js), scheduled in `vercel.json`. Sends one reminder per outstanding invoice that is **3+ days past due** and has not been reminded in the last 7 days. Both thresholds are env-overridable (`DUNNING_MIN_DAYS_OVERDUE`, `DUNNING_MIN_DAYS_BETWEEN`). Tone is auto-picked from `pickTone(daysOver)`: friendly ≤30d, firm 31–60d, urgent 60+d.
2. **Manual one-click** from the "Send Payment Reminders" panel on [`/finance`](luckyapp/src/app/(dashboard)/finance/page.js) → `POST /api/send-invoice-reminder`. Same template, same audit log row in `invoice_reminders`.
3. **Dashboard A/R aging strip** on [`/dashboard`](luckyapp/src/app/(dashboard)/dashboard/page.js) — five-bucket aging with a "Send Reminders" CTA that deep-links to /finance. Shown only when `aging.totalAR > 0`.

When changing the reminder cadence, change it in **both** the cron defaults and the descriptive copy on /finance + /dashboard so the displayed expectation matches what the system actually does.

### Job profitability — per-job margin + reality check on completion
The job detail page banner at [`(dashboard)/jobs/[id]/page.js`](luckyapp/src/app/(dashboard)/jobs/[id]/page.js) shows revenue − materials − equipment − labor − other = profit, **plus a margin %** color-coded by tier:
- `≥30%` → on target (green, matches `docs/finances.md` gross margin target)
- `15-29%` → below target (gold)
- `0-14%` → thin margin (orange)
- `<0%` → losing money (red)

When the user clicks **Complete** on a job whose margin is below 30%, a **reality-check modal** intercepts and shows the actual numbers before the status flips. It's a soft warning, not a hard block — `handleStatusChange('completed', { skipMarginCheck: true })` bypasses it. If a source quote exists, a variance row under the banner compares actual revenue + materials against quoted revenue + `quote.materialsCost`. The constant `TARGET_MARGIN_PCT = 30` is the single source of truth — change it there to retune the threshold.


## When finished with response
Have a section in your response called "Next Steps" to guide the user on what to do next, and a section called things needed to complete for the changes to work, if none are needed state that.

## Critical thinking
If you think an idea is bad, tell me why, be very upfront and critical, don't suger coat it, provide a better alternative if you have one, and always have an idea of how you would improve the app. Reminder you are a developer, act like one, question things, point out problems, and propose solutions, you can code what i can code in minutes when it would take me days.

## Updating Claude file and docs
Update the docs as we go, if you see any inconsistencies or missing information, update the docs. If we have a change in our workflow or the way we do things, update the docs. If you find a better way to do things, update the docs.