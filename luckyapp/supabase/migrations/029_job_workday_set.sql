-- ============================================================
-- 029 — Multi-day jobs as a workday SET (supersedes 028)
-- ============================================================
-- The contiguous-range model from 028 can't express "Friday + Monday but
-- skip the weekend." Replace it with `scheduled_dates JSONB`, an explicit
-- array of YYYY-MM-DD strings the job is scheduled for.
--
--   Single-day:        ["2026-05-04"]
--   Mon-Wed run:       ["2026-05-04","2026-05-05","2026-05-06"]
--   Fri + Mon split:   ["2026-05-01","2026-05-04"]
--
-- Empty array / NULL means "fall back to scheduled_date as a single day"
-- so untouched legacy rows keep working.
-- ============================================================

-- 1. New canonical column.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_dates JSONB DEFAULT '[]'::JSONB;

-- 2. Backfill from 028's contiguous range — only if 028 actually ran and
--    `scheduled_end_date` exists. The DO block keeps the SQL valid even
--    when the column is missing (skip-028 path). Sundays are dropped
--    from the expansion since 028's range model implicitly skipped them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'scheduled_end_date'
  ) THEN
    EXECUTE $sql$
      UPDATE jobs
      SET scheduled_dates = sub.dates
      FROM (
        SELECT j.id, to_jsonb(array_agg(d::date::text ORDER BY d)) AS dates
        FROM jobs j
        CROSS JOIN LATERAL generate_series(j.scheduled_date, j.scheduled_end_date, '1 day'::interval) d
        WHERE j.scheduled_date IS NOT NULL
          AND j.scheduled_end_date IS NOT NULL
          AND EXTRACT(DOW FROM d) <> 0
        GROUP BY j.id
      ) sub
      WHERE jobs.id = sub.id
        AND (jobs.scheduled_dates IS NULL OR jobs.scheduled_dates = '[]'::JSONB);
    $sql$;
  END IF;
END $$;

-- 3. Backfill single-day legacy rows: if a job has scheduled_date but
--    scheduled_dates is still empty, populate it with the single date.
--    Covers both fresh installs (no 028) and rows that 028 didn't touch.
UPDATE jobs
SET scheduled_dates = to_jsonb(ARRAY[scheduled_date::text])
WHERE scheduled_date IS NOT NULL
  AND (scheduled_dates IS NULL OR scheduled_dates = '[]'::JSONB);

-- 4. Drop the now-obsolete range columns/constraints/indexes from 028.
--    All guarded with IF EXISTS so this is a no-op when 028 wasn't run.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_scheduled_end_after_start;
DROP INDEX IF EXISTS idx_jobs_scheduled_range;
ALTER TABLE jobs DROP COLUMN IF EXISTS scheduled_end_date;

-- 5. GIN index for "which jobs touch date X" lookups.
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_dates
  ON jobs USING GIN (scheduled_dates);
