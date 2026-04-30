-- ============================================================
-- Lucky Landscapes — Real-time shift segments
-- Run this in your Supabase SQL Editor
-- ============================================================
-- A "shift" is a single time_entries row (clock_in -> clock_out for the day).
-- Within a shift, the worker moves between SEGMENTS:
--   * 'job'     — working at a specific property (paid, attributed to that job)
--   * 'travel'  — driving / yard / loading (paid, indirect labor)
--   * 'break'   — meal or rest break (unpaid by default)
--
-- The worker dashboard records segment transitions in real time, so break
-- minutes are no longer self-reported guesses at clock-out time. Job costing
-- now uses the sum of 'job' segments tagged with the job_id, rather than
-- assuming one job per shift.

CREATE TABLE IF NOT EXISTS time_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('job', 'travel', 'break')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for the common access patterns: looking up segments for a shift,
-- finding a member's open segment, and rolling up by job for cost reports.
CREATE INDEX IF NOT EXISTS idx_time_segments_org_id        ON time_segments(org_id);
CREATE INDEX IF NOT EXISTS idx_time_segments_time_entry_id ON time_segments(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_segments_member_id     ON time_segments(member_id);
CREATE INDEX IF NOT EXISTS idx_time_segments_job_id        ON time_segments(job_id);
CREATE INDEX IF NOT EXISTS idx_time_segments_open
  ON time_segments(member_id) WHERE ended_at IS NULL;

ALTER TABLE time_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own segments"
  ON time_segments FOR SELECT
  USING (
    member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners and admins can view all org segments"
  ON time_segments FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin') AND is_active = true
    )
  );

CREATE POLICY "Members can insert own segments"
  ON time_segments FOR INSERT
  WITH CHECK (
    member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Members can update own segments"
  ON time_segments FOR UPDATE
  USING (
    member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners and admins can update org segments"
  ON time_segments FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin') AND is_active = true
    )
  );

CREATE POLICY "Owners can delete segments"
  ON time_segments FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE time_segments;

SELECT 'Migration complete! time_segments table created.' AS status;
