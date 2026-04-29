-- ============================================================================
-- 🍀 LUCKY LANDSCAPES — CATALOG STOCK + SKU
-- ============================================================================
-- Run after add_catalog_enhancements.sql.
-- Adds fields used by the catalog Stock chip, Refresh-price/stock action, and
-- supplier-search deep-links (which need the SKU/model number to land on a
-- specific product page rather than a search result list).
-- ============================================================================

-- Backfill columns added in earlier baselines if the DB started on 002_full_schema
-- (which is missing image_url / image_emoji / is_favorite that 001 + FULL_REBUILD had).
ALTER TABLE materials ADD COLUMN IF NOT EXISTS image_url   TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS image_emoji TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- Supplier SKU / model number — what you'd type into Home Depot or Menards search
-- to land directly on the product page. Used by the "Verify price/stock" lookup.
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sku TEXT;

-- Stock state. Free-text rather than enum so we can refine later without a migration.
-- Expected values: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown'.
ALTER TABLE materials ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT 'unknown';

-- Optional numeric quantity — when the supplier page reports an exact count.
ALTER TABLE materials ADD COLUMN IF NOT EXISTS stock_qty INT;

-- When the stock figure was last verified (manually or by the lookup endpoint).
ALTER TABLE materials ADD COLUMN IF NOT EXISTS stock_last_checked TIMESTAMPTZ;

-- Helps "low stock" filters & sorting.
CREATE INDEX IF NOT EXISTS idx_materials_stock_status ON materials(stock_status);
