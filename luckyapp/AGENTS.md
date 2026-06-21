<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Security conventions (added 2026-06-21 audit — do not regress)

- **Every API route that mutates data, reads cross-tenant data, or triggers a paid/3rd-party call MUST authenticate.** Use `authenticateRequest(request)` from `src/lib/apiAuth.js` (`if (!auth.ok) return auth.response;`), then scope DB queries with `.eq('org_id', auth.orgId)` — never trust `orgId`/recipient/ids from the body. The matching client call must use `apiFetch` from `src/lib/apiClient.js` (NOT bare `fetch`) so the session token is attached. The only intentionally-public routes are `/api/leads/public` (Turnstile-gated), `/api/marketing/gallery`, `/api/marketing/images`, and the token-validated `/api/{invoices,quotes,contracts}/public/[token]`. `/api/marketing/gallery/suggest` requires a valid token AND an active `team_members` row.
- **Cron routes fail CLOSED.** `auto-dunning` + `cleanup-quote-media` require Vercel's un-forgeable `x-vercel-cron` header OR `Authorization: Bearer ${CRON_SECRET}`; in production they 401 otherwise. Don't reintroduce an `if (cronSecret)` wrapper that skips the check when the env var is missing.
- **Private storage buckets are served via SIGNED urls.** `receipts` + `contract-pdfs` are PRIVATE (migration 047). Read sites resolve a stored url to a signed one with `resolveStorageUrl()` / `<SignedImage>` (`src/lib/signedStorage.js`) for authenticated dashboard surfaces; public token pages get a server-minted signed url (service role) — see the public contract route. Never reintroduce `getPublicUrl` for these buckets on a read site. `quote-media`/`quote-pdfs`/`job-media` are still public (their galleries need the same swap before they can be privatized — `PRIVATE_BUCKETS` already lists them so the resolver is ready). `materials` + `marketing-gallery` stay public on purpose.
- **Security headers** live in `next.config.mjs` `headers()` (HSTS, nosniff, `X-Frame-Options: SAMEORIGIN` — keep SAMEORIGIN, not DENY, so the demo crew-mobile iframe works — Referrer-Policy, Permissions-Policy, and a Report-Only CSP). Promote the CSP to enforcing once the console shows no violations. The marketing site's headers are in `marketing/public/_headers`.
- **Owner must set in Vercel env:** `TURNSTILE_SECRET` (enforces the lead-form bot gate — until set, `/api/leads/public` accepts leads but doesn't verify), `CRON_SECRET`, `NEXT_PUBLIC_APP_URL=https://app.luckylandscapes.com`. Run migration `047_private_storage_buckets.sql` (reversible — flip the buckets back to `public=true` if anything breaks).

# Tappable addresses — always use `<AddressLink>`

Any address shown to a user must be tap-to-navigate. **Never hand-roll a maps `<a>` again** — use the shared pieces so every surface behaves identically:

- **Component:** `src/components/AddressLink.js` — `<AddressLink address city state zip />` (or a single `address` string, or `query={fullString}` with custom `children`). `multiline` renders street on line 1, city/state/zip on line 2. Presentational (no hooks) so it works in client or server components. Renders nothing when there's no address; `stopPropagation` is on by default so it's safe inside clickable rows.
- **Helpers:** `src/lib/addressLink.js` — `formatAddress(parts|string)` builds the one-line string; `mapsHref(parts|string)` returns the URL for a standalone "Navigate" button.
- **URL shape:** the universal `https://www.google.com/maps/search/?api=1&query=…` form (opens the Google Maps app on iOS/Android, google.com/maps on desktop). Don't reintroduce the old `maps.google.com/?q=` form.
- **Styling:** `.address-link` in `globals.css` (inherits text color, subtle green underline, green on hover).
- **Current surfaces:** customers list + detail, job detail (+ "Open in Maps" button), crew cockpit (quick-nav + job cards), calendar event detail, routing stops (scheduled + optimized), mileage trip start/end. The public customer-facing `/quote` and `/pay` pages deliberately keep the recipient's own address as plain text (no navigation value). Add `<AddressLink>` to any new address you render.

# Catalog system — quick map

Rebuilt 2026-05 in migrations 030–032. If you're touching anything material-related:

- **Schema:** `suppliers` (master table) + `materials` (FK to suppliers, single `unit_cost`, `tax_rate` override, `is_customer_visible`, dropped `image`/`image_emoji`/`unit_alt`/`cost_low`/`cost_high`). `quotes.selected_materials` and `contracts.selected_materials` are JSONB arrays of price-free snapshots.
- **Pure helpers:** `src/lib/catalog.js` (`getMaterialActualCost`, `getEffectiveTaxRate`, `snapshotMaterialForQuote`, `MATERIAL_UNITS`, `MATERIAL_CATEGORIES`, `STOCK_STATUSES`).
- **CSV import:** `src/lib/csvCatalog.js` (`parseCsv`, `validateRows`, `dryRunSummary`). Importer UI: `src/components/ImportMaterialsModal.js`.
- **Customer view contract:** `src/components/CustomerCatalogCard.js` structurally cannot render prices. The materials gallery is rendered in `generateQuotePdf.js`, `app/quote/[token]/page.js`, `app/sign/[token]/page.js`, and `app/(dashboard)/contracts/[id]/page.js` — keep these in sync if you change the snapshot shape.
- **Manual refresh:** `app/api/catalog/refresh-batch/route.js` + `scripts/refresh-catalog-prices.js`. No cron — by design.
- **Sales tax assumption:** NE Option 1 (contractor pays tax to supplier; doesn't charge customer). If Riley confirms a different election, `getMaterialActualCost` and the customer-tax-on-quote handling need to change.

# Quote total — quick map (post-migration 036)

If you're touching anything that reads or writes `quotes.total`:

- **`quote.total` is the customer-facing grand total** — line items + delivery_fee. Migration 036 backfilled existing rows.
- **Write path:** `(dashboard)/quotes/new/page.js` and `(dashboard)/quotes/[id]/edit/page.js` both compute `grandTotal = subtotal + (parseFloat(deliveryFee) || 0)` and save `total: grandTotal`. Don't revert this — it breaks percentage-deposit math (`total × pct`) and the public quote total display.
- **Read sites** (PDF, public quote, dashboard detail page) all show a "Subtotal / Delivery / Total" breakdown. The line-item subtotal is computed back as `quote.total - quote.deliveryFee`.
- **Don't add `+ deliveryFee` at any read site** — the value is already baked into `quote.total`.
- **Materials cost auto-fill:** `computeSelectedMaterialsCost(selectedMaterials, materials, suppliers)` in `src/lib/catalog.js` rolls up `quantity × actual cost` from snapshots back to the live catalog. UI surfaces a "Use as materials cost" button under the selected-materials grid in both new and edit quote pages.

# Minor compliance — quick map (migration 037)

- **Schema:** `team_members.date_of_birth DATE`, nullable.
- **Helpers:** `src/lib/minorCompliance.js` — `computeAge`, `isMinor`, `isUnder16`, `ageTier`, `getComplianceWarnings`, plus the `HAZARDOUS_TASKS_UNDER_18` / `HOUR_CAPS_UNDER_16` reference data.
- **NOT a tax field.** Non-family W-2s owe full FICA/FUTA regardless of age. This drives FLSA child-labor flags only — hazardous tasks (chainsaws, chippers, riding mowers >20HP per 29 CFR 570.50–570.68) and under-16 hour caps (29 CFR 570.35).
- **UI surface:** team page (`(dashboard)/team/page.js`) — age pill on member rows; "No chainsaw / chipper / riding mower" warning for minors; DOB input in edit row + Add Team Member modal.
- **API:** `/api/invite-member` accepts and persists `dateOfBirth`.

# Subcontract / authorization gate — quick map

Added 2026-05 in migration 033. If you're touching the start-job gate, customer types, or the job edit modal:

- **Schema:** `customers.customer_type` (`'homeowner'` | `'business'` | `'general_contractor'`, default `'homeowner'`); `jobs.work_authorization` (`'contract'` | `'subcontract'` | `'verbal'`, default `'contract'`); `jobs.work_order_url` + `work_order_path` + `work_order_notes`; `jobs.site_contact_name` + `site_contact_phone`.
- **Customer types:** `CUSTOMER_TYPES` and `customerTypeMeta()` are exported from `src/app/(dashboard)/customers/page.js` and re-imported by `src/app/(dashboard)/customers/[id]/page.js`. The pill in customer rows is hidden when type is `'homeowner'`.
- **Authorization gate logic:** Lives in `src/app/(dashboard)/jobs/[id]/page.js`. Compute `workAuth` from `job.workAuthorization || 'contract'`, then derive `blockStart` and `gateMessage`. The "Start Job" button + the banner above the financials both react to `blockStart`. Each mode has its own proof requirement — don't drop the gate, replace it.
- **Work order uploads:** Reuse the existing `ReceiptUpload` component with `scope="work-order"`. Files land in the `receipts` storage bucket under `<orgId>/work-order/`. Component returns `{ url, path }` — both are stored on the job so storage cleanup works on delete.
- **Site contact UX:** Surfaced as a separate row inside the Customer card on the job detail page, with a `tel:` link. Crew sees the homeowner's phone without touching the GC's billing info.
- **Why this exists (mental model):** the GC is the customer for billing; the homeowner is just a site contact. Don't try to model the homeowner as a separate `customers` row — that creates two parallel CRM histories for one job and breaks invoice flow.
- **Direct job creation (no quote, no signature):** `addDirectJob(input)` in `src/lib/data.js` + `<NewJobModal>` (`src/components/NewJobModal.js`, opened from the `/jobs` "New Job" button) create a `'scheduled'` job with `quoteId: null` and `workAuthorization` defaulting to `'subcontract'`. It resolves/creates the customer (GC by default for sub work) like `addHistoricalJob`. It does NOT bypass the gate — a subcontract job still needs a work order on file (notes/upload) before it can start; it only skips the sales-quote + signing flow. Invoice via the normal "from a completed job" path (or a blank invoice), then edit the invoice's line items as scope/gas/day-count shifts (see "Editing invoice line items after creation" in the root CLAUDE.md).

# Insurance class-code split — quick map (migration 045)

Added 2026-05. Splits payroll + revenue by insurance class code so Lucky can prove the split at a WC/GL audit and pay the correct (lower) blended premium instead of everything-at-masonry. If you're touching jobs, the payroll model, or the `/insurance` page:

- **Schema:** `jobs.wc_class TEXT` nullable — a stable KEY (`masonry` | `landscape_gardening` | `lawn_care`), NOT a code number. Code numbers + rates live on `organizations.settings.payroll.wcClasses` (existing JSONB, no migration).
- **Helpers (all in `src/lib/finance.js`):** `DEFAULT_WC_CLASSES`, `CATEGORY_TO_WC_CLASS`, `wcClassForCategory(category)`, `getWcClasses(org)` (merges org overrides onto defaults by key), `buildInsuranceClassReport({ jobs, timeEntries, timeSegments, teamMembers, wcClasses, start, end, experienceMod })`.
- **Auto-classify:** `convertQuoteToJob` in `src/lib/data.js` sets `wcClass: wcClassForCategory(quote.category)`. `addJob`/`updateJob` already pass `wcClass` through `camelToSnake`, so no other data-layer change is needed.
- **Payroll basis is GROSS, not burdened** — premium is rated on gross wages. Don't pass `payrollSettings` burden into this report. Revenue per code = completed jobs in range; payroll per code = `time_segments` (kind `job` → the job's class) + legacy entries dated in range.
- **Per-member burden on the team page is intentionally untouched** — it still uses the single `wcClassCode`/rate from `getPayrollSettings`. This report is a standalone aggregate; don't rewire the burden math to "blend" without a plan.
- **The codes Riley gave are 5-digit (GL/ISO style).** They're seeded but the disclaimer banner tells him to verify against the policy dec page (landscaping WC is NCCI 0042/9102/5022). Keep that disclaimer.
- **Report completeness depends on time-tracking data** — unclocked jobs contribute revenue but $0 payroll. The page says this; don't silently "fix" it by faking payroll.

# Local rank grid — quick map (no migration)

Added 2026-06. A free Local-Falcon clone: scans where Lucky's GBP ranks across a geo-grid of Lincoln, plus location-spoofed organic-SERP links. Page at `src/app/(dashboard)/local-rank/page.js` + server route `src/app/api/local-rank/scan/route.js` ("Local Rank" in the Sidebar, owner/admin). **No schema/migration.**

- **CRITICAL — ranking does NOT use the Google Places API.** The first build did, and it was fundamentally wrong: the Places API orders by **text/name relevance**, not the consumer map pack, so it ranked a literally-named "Lincoln Landscaping Company" #1 and Lucky (4th in the real pack) vanished. Confirmed by a research workflow (2026-06): no Places mode (`rankPreference` RELEVANCE/DISTANCE, `searchNearby`, `includedType`) can reproduce the map pack; Google ships no local-pack API. **Never reintroduce Places Text/Nearby Search for rank.** The only accurate source is the real Google Maps SERP read at a precise lat/lng.
- **Server route is the data source.** `searchText(query, lat, lng)` in the page now just `POST`s to `/api/local-rank/scan` `{ keyword, lat, lng, maxN }` and gets back `{ provider, results: [{id,name,address}] }` in true rank order (index 0 = rank #1). The route is **provider-agnostic** via env (key never client-side, mirrors the `/api/buildings/lookup` proxy pattern): **Bright Data SERP** primary (`BRIGHTDATA_API_TOKEN` + `BRIGHTDATA_SERP_ZONE`; recurring 5,000 free req/mo; calls `POST https://api.brightdata.com/request` with a `https://www.google.com/maps/search/<q>/@lat,lng,14z?brd_json=1` url + `format:'raw'`; rank = result order). **DataForSEO** fallback (`DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`; `POST /v3/serp/google/maps/live/advanced`, `location_coordinate:"lat,lng,14z"`, returns `rank_absolute` natively — ~$0.30–1.30/mo upgrade). Neither set → 503 `not_configured` with a setup hint the UI shows. `normalizeOrdered`/`firstBusinessArray` parse defensively (SERP JSON shapes vary) — if a future Bright Data response returns no recognized business array, widen the `KEYS` list there.
- **Match the tracked business by NAME or Place ID.** `matchesUs(p)` = `p.id === seoPlaceId` OR `p.name` includes `seoBusinessName` (case-insensitive). `canScan` = a Place ID OR a business name is set. The finder searches the live Maps results (via the route) and offers **Track by name** (`applyTrackByName` → saves `seo_business_name` only) — name-matching is the robust path because Place IDs go stale (Lucky's old `ChIJg8…` is `NOT_FOUND` after the storefront→SAB reclass). A paste-Place-ID box (`applyManualId`/`lookupPlaceById`, Places SDK — a ToS-clean *lookup*, fine) stays as a backup. Tracked listing persists to `organizations.settings.seo_place_id`/`seo_business_name` via `updateOrgSettings` (in **demo mode `org` is null so this can't persist** — a demo limitation, not a prod bug).
- **The Google Maps JS SDK is still loaded** (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`) but ONLY to render the grid map + drag the center pin — it does zero ranking now.
- **ToS reality:** every accurate tracker (incl. Local Falcon) reads the Maps SERP, which breaches Google's Maps ToS. Low risk for internal single-org use (Google litigates data *resellers*) — but don't expose raw SERP rows to the client or market the feature publicly. The only ToS-clean Google API (Places) is exactly the one that gives wrong ranks.
- **uule organic-SERP spoof (separate, unaffected feature):** the zip-button links build `google.com/search?...&uule=…&pws=0`. `uuleFor(canonical)` = `'w+CAIQICI'` + `ALPHA[canonical.length % 64]` + `encodeURIComponent(btoa(canonical))`, `ALPHA='A-Za-z0-9-_'`, key char indexed by **raw canonical-name length** (verified: `West New York,New Jersey,United States` → `m`). Canonicals must match Google Ads geo-targets (`'<zip>,Nebraska,United States'`).
- **Scan history is device-local** (`localStorage` `lucky_local_rank_scans`, cap 40) with a "vs last scan" avg-rank delta; **competitor tally** counts top-3 holders across the grid ("who's beating you"). Both unchanged by the rebuild — they operate on the `{rank, top}` shape `runScan` produces regardless of data source.
- **Honest framing:** the footnote now says ranks come from the **real Maps SERP** (not the old Places approximation) but still aren't one phone's exact result — trust trends/weak zones, spot-check surprising dots, and the levers that actually move rank are reviews/photos/weekly posts/category match. Keep that.

# Clock-in integrity — quick map (migration 046)

Fixed 2026-06 after crew reported the clock "lagged and counted double time" and "counted break as hours worked". If you touch time tracking, keep these invariants:

- **Never allow two open rows.** One open `time_segments` per shift, one open `time_entries` per member. Enforced by: synchronous `busyRef` lock (`runGuarded`) in `src/app/(dashboard)/crew-dashboard/page.js` (a `useState` boolean can't block a same-tick double-tap); `switchSegment`/`endShift` closing **ALL** open segments (not `.find()` first) and `startShift` reusing/auto-closing an existing open shift, both in `src/lib/data.js`; and partial unique indexes in `supabase/migrations/046_one_open_shift_segment.sql`. `insertSegment` catches `23505` and self-heals. Don't revert to single-`.find()` closes or a plain boolean guard.
- **One paid/break helper:** `computeShiftPaidBreak(entry, segments, { now })` + `coveredMinutesGrouped(...)` in `src/lib/finance.js`. ALL surfaces route through it (crew cockpit, team payroll/TimeLog, `laborCostForEntries`/`laborCostForJob`/`laborCostForJobBurdened`, `pnlForRange`, `buildInsuranceClassReport`). It overlap-collapses segments (dedup defense) but sums stored `durationMinutes` exactly for non-overlapping shifts — so healthy historical numbers are unchanged. Don't re-implement paid/break math inline anywhere; add a call site instead.
- **`weekHours` must be segment-aware.** The old entry-level `clockOut−clockIn−break_minutes` counted an OPEN shift's break as worked (break_minutes is 0 until `endShift`). The helper's segment path excludes break live.
- **Realtime is debounced (400ms)** for `time_entries`/`time_segments` so a burst of writes from one clock tap doesn't full-refetch-and-replace mid-interaction (the "lag"). Optimistic local updates already show correct state.
- **Demo/localStorage mode** has no DB constraint — the `busyRef` lock + close-all-open + overlap-collapse are its only defenses (verified working).
