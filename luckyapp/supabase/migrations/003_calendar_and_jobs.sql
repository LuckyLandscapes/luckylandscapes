-- ============================================================
-- Lucky App — Calendar System Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Jobs — active work converted from accepted quotes
CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id          UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  status            TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  description       TEXT,
  address           TEXT,
  scheduled_date    DATE,
  scheduled_time    TIME,
  estimated_duration INTERVAL DEFAULT '4 hours',
  assigned_to       UUID[] DEFAULT ARRAY[]::UUID[],
  crew_notes        TEXT,
  total             NUMERIC(12,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 2. Calendar Events — general scheduling (quote appointments, meetings, etc.)
CREATE TABLE IF NOT EXISTS calendar_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id        UUID REFERENCES jobs(id) ON DELETE CASCADE,
  quote_id      UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  type          TEXT DEFAULT 'other' CHECK (type IN ('quote_appointment','job','meeting','other')),
  date          DATE NOT NULL,
  start_time    TIME,
  end_time      TIME,
  all_day       BOOLEAN DEFAULT false,
  color         TEXT DEFAULT '#3a9c4a',
  notes         TEXT,
  google_event_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Jobs: full CRUD for org members
CREATE POLICY "jobs_select" ON jobs FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "jobs_insert" ON jobs FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "jobs_update" ON jobs FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "jobs_delete" ON jobs FOR DELETE USING (org_id = get_user_org_id());

-- Calendar Events: full CRUD for org members
CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE USING (org_id = get_user_org_id());

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quote ON jobs(quote_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON calendar_events(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_job ON calendar_events(job_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type);
