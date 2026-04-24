-- ============================================================
-- Lucky App — Project Financials Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Job Expenses — track per-job costs (materials, equipment, etc.)
CREATE TABLE IF NOT EXISTS job_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN ('materials','equipment','fuel','dump_fees','subcontractor','permits','other')),
  description     TEXT NOT NULL DEFAULT '',
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  receipt_url     TEXT,
  created_by      UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Add hourly_rate to team_members (for labor cost calculation)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2) DEFAULT 0;

-- 3. Add revenue to jobs (copied from quote total when scheduled)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS revenue NUMERIC(12,2) DEFAULT 0;

-- 4. Add job_id to time_entries (link clock sessions to specific jobs)
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE job_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_expenses_select" ON job_expenses FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "job_expenses_insert" ON job_expenses FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "job_expenses_update" ON job_expenses FOR UPDATE
  USING (org_id = get_user_org_id());

CREATE POLICY "job_expenses_delete" ON job_expenses FOR DELETE
  USING (org_id = get_user_org_id());

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_job_expenses_org ON job_expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_job_expenses_job ON job_expenses(job_id);
CREATE INDEX IF NOT EXISTS idx_job_expenses_category ON job_expenses(category);
CREATE INDEX IF NOT EXISTS idx_time_entries_job ON time_entries(job_id);

-- ============================================================
-- Enable Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE job_expenses;
