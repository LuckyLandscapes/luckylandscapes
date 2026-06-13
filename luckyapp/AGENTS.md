<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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

Added 2026-06. A free Local-Falcon clone: scans where Lucky's GBP ranks across a geo-grid of Lincoln, plus location-spoofed organic-SERP links. Page at `src/app/(dashboard)/local-rank/page.js` ("Local Rank" in the Sidebar, owner/admin). **No schema, no API route, no server** — it's a self-contained client page.

- **Two independent tools on one page.** (1) **GBP geo-grid** — drops an N×N grid of lat/lng points over Lincoln and runs a Google Places **Text Search** at each point biased to that point's location, then finds the tracked listing's place ID in the results to get a per-point rank. Colors dots green/amber/red by rank (1–3 / 4–10 / 11–20 / not-in-top-20). (2) **Organic SERP spoof** — builds `google.com/search?...&uule=…&pws=0` links per Lincoln zip; the `uule` param makes Google render the page as if standing in that zip (no VPN). Open in Incognito.
- **Places API call path:** `searchText()` tries the **new** Places API (`google.maps.importLibrary('places')` → `Place.searchByText` with `locationBias`), falls back to the **legacy** `PlacesService.textSearch` if the new one isn't enabled. Caps `maxResultCount`/results at 20 (top-20 = the practical map-pack window). Same Maps loader contract as `/measure` (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `libraries=geometry,places`). **The Maps key's Cloud project must have a Places API enabled** (New or legacy) — Maps JS alone isn't enough; the page shows an inline hint if every point errors.
- **uule encoding (load-bearing — get it wrong and Google silently ignores it):** `uuleFor(canonical)` = `'w+CAIQICI'` + `ALPHA[canonical.length % 64]` + `encodeURIComponent(btoa(canonical))`, where `ALPHA = 'A-Za-z0-9-_'`. The key char is indexed by the **raw canonical-name length**, NOT the base64 length. Verified against the documented example `West New York,New Jersey,United States` → key `m`. Canonical names must match Google Ads geo-targets: `'<zip>,Nebraska,United States'` or `'Lincoln,Nebraska,United States'`.
- **The tracked listing** is stored as `organizations.settings.seo_place_id` + `seo_business_name` (existing JSONB via `updateOrgSettings`, no migration). One-time "find my GBP" search sets it. In demo mode this lands in localStorage; in prod it persists to Supabase across devices.
- **Name search often fails for new SABs — manual Place ID entry is the guaranteed path.** Real finding 2026-06: Lucky's own GBP returned `ZERO_RESULTS` on a name search via the (deprecated) legacy Places API, while generic "landscaping lincoln ne" returned 18 competitors — the legacy index doesn't carry some newer service-area listings by name, and Places API (New) was blocked on the key. So the finder ALSO offers: (a) an `apiBlocked` banner with exact Cloud-Console enable steps, triggered when `searchText`/`lookupPlaceById` see `PERMISSION_DENIED|blocked|API_NOT_ACTIVATED`; (b) a paste-your-Place-ID box (`useManualId` → `lookupPlaceById` to confirm the name, but saves the raw ID regardless since the grid match only needs the ID string), linking Google's official Place ID Finder. Don't remove the manual path — it's the only thing that works when both name-search routes come up empty.
- **Scan history is device-local** (`localStorage` key `lucky_local_rank_scans`, capped 40). Each scan stores points+ranks+competitor tally+summary, and the UI shows a "vs last scan" avg-rank delta when a prior scan with the same keyword/grid/spacing exists. Not in Postgres on purpose — it's a personal diagnostic, not org data, and avoids a migration.
- **Competitor tally:** after a scan, counts which businesses hold a top-3 slot across the grid → "who's beating you" table. This is the actually-actionable output (proximity you can't change; who's winning + why you can).
- **Honest framing is intentional** — the page says grid ranks approximate the map pack (Places API orders by the same proximity/relevance/prominence signals but isn't pixel-identical to a live phone search) and points Riley at the real levers (review velocity, photos, weekly posts, category/service match). Keep that disclaimer; don't oversell it as exact.
