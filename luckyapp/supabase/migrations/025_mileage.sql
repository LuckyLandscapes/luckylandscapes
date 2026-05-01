-- ============================================================================
-- 025: Mileage tracking (IRS-compliant log)
-- ============================================================================
-- Stores per-trip mileage entries that map to the IRS contemporaneous-log
-- requirement (Pub 463, §274(d)). Each row captures: date, miles, business
-- purpose, start/end address — the four facts the IRS expects to see in an
-- audit. Odometer photos are stored in the existing `receipts` bucket under
-- a `mileage/` folder so we don't need a second bucket / second policy set.
--
-- We deliberately do NOT auto-derive miles from start/end address via maps
-- — drivers can backfill the photo'd odometer numbers and the difference is
-- the IRS-canonical truth. `miles` is required; odometer fields and photos
-- are encouraged but optional.
--
-- 2026 standard mileage rate is currently $0.70/mi (subject to IRS update).
-- We don't store the rate per row; year-end aggregation applies the rate
-- valid for that tax year.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mileage_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id    UUID REFERENCES team_members(id) ON DELETE SET NULL,
  job_id            UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- IRS-required facts
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  miles             NUMERIC(10,2) NOT NULL CHECK (miles >= 0),
  purpose           TEXT NOT NULL,                    -- "to job site at X", "supply run to OS", etc.

  -- IRS-recommended supporting evidence
  start_odometer    NUMERIC(10,1),
  end_odometer      NUMERIC(10,1),
  start_address     TEXT,
  end_address       TEXT,
  vehicle           TEXT,                              -- "F-150", "trailer truck", etc.

  -- Odometer photos (stored in `receipts` bucket under mileage/)
  start_photo_url   TEXT,
  start_photo_path  TEXT,
  end_photo_url     TEXT,
  end_photo_path    TEXT,

  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mileage_org_date    ON mileage_entries(org_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_mileage_job         ON mileage_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_mileage_member      ON mileage_entries(team_member_id);

ALTER TABLE mileage_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mileage_select" ON mileage_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "mileage_insert" ON mileage_entries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "mileage_update" ON mileage_entries FOR UPDATE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "mileage_delete" ON mileage_entries FOR DELETE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE mileage_entries; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
