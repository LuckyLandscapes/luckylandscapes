-- ============================================================
-- 031 — Materials table rebuild
-- ============================================================
-- The previous materials table accumulated dead/redundant columns
-- (image + image_url + image_emoji, cost_low + cost_high, unit_alt,
-- supplier as TEXT). Items had been seeded with bad supplier
-- assignments and the user requested a clean rewipe.
--
-- This migration DROPS the old materials table and recreates it with:
--   - supplier_id FK to suppliers (NOT NULL)
--   - single unit_cost + nullable tax_rate (falls back to supplier.default_tax_rate)
--   - is_customer_visible flag
--   - stock_status as CHECK-constrained enum
--   - canonical image_url only
--
-- WARNING: this DROPS all rows in materials. Run 030_suppliers_table.sql
-- first. Take a Supabase point-in-time backup before running this.
-- ============================================================

DROP TABLE IF EXISTS materials CASCADE;

CREATE TABLE materials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id         UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  -- Identity (customer-visible)
  name                TEXT NOT NULL,
  category            TEXT NOT NULL,
  subcategory         TEXT,
  description         TEXT,
  color               TEXT,
  texture             TEXT,
  coverage_per_unit   TEXT,
  image_url           TEXT,

  -- Internal-only pricing
  unit                TEXT NOT NULL,
  unit_cost           NUMERIC(10,4) NOT NULL DEFAULT 0,
  tax_rate            NUMERIC(5,4),  -- override; null means "use supplier default"

  -- Internal metadata
  sku                 TEXT,
  notes               TEXT,
  supplier_url        TEXT,
  supplier_url_alt    TEXT,
  last_price_check    TIMESTAMPTZ,
  stock_status        TEXT DEFAULT 'unknown' CHECK (stock_status IN ('in_stock','low_stock','out_of_stock','unknown')),
  stock_qty           INT,
  stock_last_checked  TIMESTAMPTZ,

  -- Display flags
  is_favorite         BOOLEAN DEFAULT false,
  is_active           BOOLEAN DEFAULT true,
  is_customer_visible BOOLEAN DEFAULT true,
  sort_order          INT DEFAULT 0,
  tags                TEXT[] DEFAULT '{}',

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_materials_supplier ON materials(supplier_id);
CREATE INDEX idx_materials_category ON materials(org_id, category);
CREATE INDEX idx_materials_favorite ON materials(org_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_materials_customer_visible ON materials(org_id, is_customer_visible) WHERE is_customer_visible = true;
CREATE INDEX idx_materials_active ON materials(org_id, is_active);

-- RLS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "materials_select" ON materials;
  DROP POLICY IF EXISTS "materials_insert" ON materials;
  DROP POLICY IF EXISTS "materials_update" ON materials;
  DROP POLICY IF EXISTS "materials_delete" ON materials;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "materials_select" ON materials FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "materials_insert" ON materials FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "materials_update" ON materials FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "materials_delete" ON materials FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE materials;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
