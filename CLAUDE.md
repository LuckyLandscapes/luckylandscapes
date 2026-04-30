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

This repo contains **two separate applications** with their own dependencies, build tools, and runtimes. Always confirm which one you are touching before editing.

### 1. Root (`/`) — Public marketing site
- **Stack:** Vite 7 + vanilla JS + multiple static HTML entry points. No framework.
- **Animation:** GSAP (with ScrollTrigger) + Lenis smooth scroll, wired together via `gsap.ticker` in `main.js`.
- **Entry points** (declared in `vite.config.js`): `index.html`, `team.html`, `careers.html`, `gallery.html`, `quote.html`, `privacy.html`, `terms.html`, plus five service pages under `services/`.
- **Quote form backend:** Google Apps Script. The deployed Web App URL is pasted into a `QUOTES_SCRIPT_URL` constant in `main.js`. See `scripts/SETUP-INSTRUCTIONS.md` for redeployment steps. Photos go to a Drive folder, submissions to a Google Sheet, and notifications via Gmail — all owned by the script's executing Google account.
- **Hosting:** static deploy via `dist/`. `public/_redirects` enforces the non-www canonical domain.

### 2. `luckyapp/` — Internal business app (separate Next.js project)
- **Stack:** Next.js 16 + React 19 (App Router), Supabase (Postgres + Auth + Storage + Realtime), Stripe (payments), Resend (transactional email), Google Calendar API, jsPDF (PDF generation).
- **Read [`luckyapp/AGENTS.md`](luckyapp/AGENTS.md) before editing.** Next.js 16 has breaking changes from prior versions; consult `luckyapp/node_modules/next/dist/docs/` rather than relying on prior knowledge.
- **Routing:** App Router, with the authenticated UI grouped under [`src/app/(dashboard)/`](luckyapp/src/app/(dashboard)/) (calendar, catalog, crew-dashboard, crew-schedule, customers, dashboard, finance, invoices, jobs, measure, quotes, reports, settings, team). Public surfaces: `login`, `auth`, `pay`, `offline`. Server endpoints live under [`src/app/api/`](luckyapp/src/app/api/).
- **Deploy:** Vercel (`luckyapp/vercel.json`). The `/sw.js` service worker is explicitly set to `no-store` so updates ship immediately.

## Common commands

### Root marketing site (run from repo root)
```bash
npm run dev       # Vite dev server on http://localhost:3000 (auto-opens)
npm run build     # Build to dist/
npm run preview   # Preview the built dist/
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
SQL migrations are numbered files in [`luckyapp/supabase/migrations/`](luckyapp/supabase/migrations/) and **must be run in order** in the Supabase SQL editor. Two notes from `migrations/README.md`:
- 001 and 002 overlap; 001 uses `CREATE TABLE IF NOT EXISTS` so running 001 then 002 is safe.
- Two files share the `006_` prefix (`006_break_minutes.sql` and `006_job_media.sql`) and two share `007_` (`007_invoices.sql` and `007_job_priority.sql`). Treat the numeric prefix as a sort key, not a uniqueness guarantee — when adding a new migration, check what's already present.
- `FULL_REBUILD.sql` is a from-scratch rebuild; do not run it against a populated database.

### Public payment links
Invoice public-pay tokens are URL-safe hex generated via `window.crypto.getRandomValues` (with a Math.random fallback) — see `makeUrlSafeToken` in `data.js`. Migration `015_fix_public_token_url_safe.sql` exists because earlier tokens were not URL-safe; preserve the URL-safe property when changing token logic.


## When finished with response
Have a section in your response called "Next Steps" to guide the user on what to do next, and a section called things needed to complete for the changes to work, if none are needed state that.

## Critical thinking
If you think an idea is bad, tell me why, be very upfront and critical, don't suger coat it, provide a better alternative if you have one, and always have an idea of how you would improve the app.

## Updating Claude file and docs
Update the docs as we go, if you see any inconsistencies or missing information, update the docs. If we have a change in our workflow or the way we do things, update the docs. If you find a better way to do things, update the docs.