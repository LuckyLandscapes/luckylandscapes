-- ============================================================
-- 030 — Suppliers master table
-- ============================================================
-- Replaces the free-text `materials.supplier` column with a real table.
-- Each supplier carries a `default_tax_rate` (Lincoln/Lancaster combined is
-- 7.25% as of 2026). Materials can override per-item.
--
-- Run BEFORE 031_materials_rebuild.sql — 031 adds a NOT NULL FK from
-- materials.supplier_id to this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  website          TEXT,
  default_tax_rate NUMERIC(5,4) DEFAULT 0.0725,
  contact_phone    TEXT,
  address          TEXT,
  notes            TEXT,
  sort_order       INT DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(org_id, is_active);

-- RLS — uses the existing get_user_org_id() helper from 010_fix_rls_policies.sql
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
  DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
  DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
  DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
