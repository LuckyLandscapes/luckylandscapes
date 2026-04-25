-- ============================================================================
-- 013: Financial System Revamp
-- ============================================================================
-- Adds:
--   1. `completed_at` column on jobs (Phase 1A)
--   2. `break_minutes` on time_entries (Phase 1E — was missing from FULL_REBUILD)
--   3. `company_expenses` table for overhead tracking (Phase 2A)
-- ============================================================================

-- 1. Add completed_at to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Add break_minutes to time_entries (idempotent)
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0;

-- 3. Company Expenses table (overhead / non-job costs)
CREATE TABLE IF NOT EXISTS company_expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category            TEXT NOT NULL CHECK (category IN (
    'vehicle','insurance','rent','utilities','software','marketing',
    'office_supplies','fuel','payroll_tax','other'
  )),
  description         TEXT NOT NULL DEFAULT '',
  amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring           BOOLEAN DEFAULT false,
  recurring_interval  TEXT CHECK (recurring_interval IN ('weekly','biweekly','monthly','quarterly','yearly')),
  receipt_url         TEXT,
  vendor              TEXT,
  created_by          UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- RLS for company_expenses
ALTER TABLE company_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_expenses_select" ON company_expenses FOR SELECT
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "company_expenses_insert" ON company_expenses FOR INSERT
  TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "company_expenses_update" ON company_expenses FOR UPDATE
  TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "company_expenses_delete" ON company_expenses FOR DELETE
  TO authenticated USING (org_id = get_user_org_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_expenses_org ON company_expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_company_expenses_date ON company_expenses(date);
CREATE INDEX IF NOT EXISTS idx_company_expenses_category ON company_expenses(category);
CREATE INDEX IF NOT EXISTS idx_jobs_completed_at ON jobs(completed_at);

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE company_expenses; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: set completed_at for any existing completed jobs that lack it
UPDATE jobs SET completed_at = created_at WHERE status = 'completed' AND completed_at IS NULL;
