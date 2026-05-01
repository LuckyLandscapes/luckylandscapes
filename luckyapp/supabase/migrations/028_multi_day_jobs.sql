-- ============================================================
-- 028 — Multi-day jobs
-- ============================================================
-- A job can now span multiple calendar days (e.g. a 20h retaining wall
-- across Mon–Wed). When `scheduled_end_date` is NULL the job is single-day
-- (anchored at scheduled_date) — preserves all existing rows.
--
-- Hours are still stored as a single total in `estimated_duration`. The
-- calendar UI auto-distributes that total across workdays in the range
-- (skipping Sundays). If you ever need per-day overrides ("8h Mon / 4h
-- Tue"), add a `job_workdays(job_id, date, hours)` table — out of scope
-- here.
-- ============================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;

-- Index helps the calendar's range-overlap queries when we eventually
-- filter by visible window instead of loading the whole org.
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_range
  ON jobs(scheduled_date, scheduled_end_date);

-- Sanity: end >= start when both are set.
ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_scheduled_end_after_start;
ALTER TABLE jobs
  ADD CONSTRAINT jobs_scheduled_end_after_start
  CHECK (scheduled_end_date IS NULL OR scheduled_date IS NULL OR scheduled_end_date >= scheduled_date);
