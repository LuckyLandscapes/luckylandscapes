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

# Subcontract / authorization gate — quick map

Added 2026-05 in migration 033. If you're touching the start-job gate, customer types, or the job edit modal:

- **Schema:** `customers.customer_type` (`'homeowner'` | `'business'` | `'general_contractor'`, default `'homeowner'`); `jobs.work_authorization` (`'contract'` | `'subcontract'` | `'verbal'`, default `'contract'`); `jobs.work_order_url` + `work_order_path` + `work_order_notes`; `jobs.site_contact_name` + `site_contact_phone`.
- **Customer types:** `CUSTOMER_TYPES` and `customerTypeMeta()` are exported from `src/app/(dashboard)/customers/page.js` and re-imported by `src/app/(dashboard)/customers/[id]/page.js`. The pill in customer rows is hidden when type is `'homeowner'`.
- **Authorization gate logic:** Lives in `src/app/(dashboard)/jobs/[id]/page.js`. Compute `workAuth` from `job.workAuthorization || 'contract'`, then derive `blockStart` and `gateMessage`. The "Start Job" button + the banner above the financials both react to `blockStart`. Each mode has its own proof requirement — don't drop the gate, replace it.
- **Work order uploads:** Reuse the existing `ReceiptUpload` component with `scope="work-order"`. Files land in the `receipts` storage bucket under `<orgId>/work-order/`. Component returns `{ url, path }` — both are stored on the job so storage cleanup works on delete.
- **Site contact UX:** Surfaced as a separate row inside the Customer card on the job detail page, with a `tel:` link. Crew sees the homeowner's phone without touching the GC's billing info.
- **Why this exists (mental model):** the GC is the customer for billing; the homeowner is just a site contact. Don't try to model the homeowner as a separate `customers` row — that creates two parallel CRM histories for one job and breaks invoice flow.
