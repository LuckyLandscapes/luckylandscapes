-- ============================================================
-- Lucky Landscapes — Time Tracking & Team Enhancement Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add hourly_rate column to team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 15.00;

-- 2. Create time_entries table for clock in/out tracking
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_org_id ON time_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_member_id ON time_entries(member_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);

-- 4. Enable RLS on time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for time_entries
-- Policy: Members can view their own time entries
CREATE POLICY "Members can view own time entries"
  ON time_entries FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Owners/admins can view all time entries in their org
CREATE POLICY "Owners and admins can view all org time entries"
  ON time_entries FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM team_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Policy: Members can insert their own time entries
CREATE POLICY "Members can clock in"
  ON time_entries FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Policy: Members can update their own time entries (for clock out)
CREATE POLICY "Members can update own time entries"
  ON time_entries FOR UPDATE
  USING (
    member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Owners/admins can update any time entry in their org (corrections)
CREATE POLICY "Owners and admins can update org time entries"
  ON time_entries FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM team_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Policy: Owners can delete time entries in their org
CREATE POLICY "Owners can delete time entries"
  ON time_entries FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM team_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND is_active = true
    )
  );

-- 6. Enable Realtime for time_entries
ALTER PUBLICATION supabase_realtime ADD TABLE time_entries;

-- 7. Update existing team members (set default hourly rate for existing workers)
-- You can adjust these rates per-person in the Team management page after running this.
-- UPDATE team_members SET hourly_rate = 20.00 WHERE email = 'worker@example.com';

SELECT 'Migration complete! time_entries table created, hourly_rate added to team_members.' AS status;
