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
