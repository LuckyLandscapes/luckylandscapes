-- ============================================================
-- Lucky Landscapes — One open shift / one open segment (clock-in integrity)
-- Run this in your Supabase SQL Editor
-- ============================================================
-- Root cause of the "clock counted double time" reports: nothing stopped a
-- shift from having TWO simultaneously-open time_segments, or a member from
-- having TWO open time_entries (shifts). The live cockpit clock sums every
-- open segment as (now - started_at), so a duplicate open row read ~2x; once
-- closed, the overlapping durations also double-counted in payroll/job-cost.
--
-- The app now (a) guards against creating duplicates (synchronous tap lock +
-- close-ALL-open-before-insert + startShift reuse), and (b) de-dupes overlaps
-- in the paid/break math. This migration is the STRUCTURAL backstop: partial
-- unique indexes that make a second open row impossible at the database.
--
-- Run during off-hours: a worker who is legitimately clocked in mid-run has
-- one open shift + one open segment, which is fine — only DUPLICATES are
-- cleaned. The numbered-prefix caveat in CLAUDE.md applies: 046 is the next
-- free prefix.
-- ============================================================

-- 1. Close abandoned open segments belonging to DUPLICATE (non-newest) open
--    shifts. We don't know when work actually stopped, so close them at their
--    own start (zero duration) rather than billing to now.
WITH dup_shifts AS (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY clock_in DESC) AS rn
    FROM time_entries WHERE clock_out IS NULL
  ) x WHERE x.rn > 1
)
UPDATE time_segments ts
SET ended_at = ts.started_at,
    duration_minutes = 0
FROM dup_shifts d
WHERE ts.time_entry_id = d.id AND ts.ended_at IS NULL;

-- 2. Close the DUPLICATE open shifts themselves at their last real activity
--    (max segment ended_at), or their clock_in if they had no segments. Roll
--    up break minutes from any closed break segments.
WITH dup_shifts AS (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY clock_in DESC) AS rn
    FROM time_entries WHERE clock_out IS NULL
  ) x WHERE x.rn > 1
),
ends AS (
  SELECT te.id,
         COALESCE(MAX(s.ended_at), te.clock_in) AS close_at,
         COALESCE(SUM(CASE WHEN s.kind = 'break' AND s.ended_at IS NOT NULL
                           THEN s.duration_minutes ELSE 0 END), 0) AS break_mins
  FROM time_entries te
  JOIN dup_shifts d ON d.id = te.id
  LEFT JOIN time_segments s ON s.time_entry_id = te.id
  GROUP BY te.id, te.clock_in
)
UPDATE time_entries te
SET clock_out = ends.close_at,
    break_minutes = ends.break_mins
FROM ends
WHERE te.id = ends.id;

-- 3. For the remaining (kept) open shifts, close all-but-newest open segment
--    per shift so each shift has at most one open segment. Zero duration —
--    these are the phantom duplicates, not real worked time.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY time_entry_id ORDER BY started_at DESC, created_at DESC) AS rn
  FROM time_segments
  WHERE ended_at IS NULL
)
UPDATE time_segments ts
SET ended_at = ts.started_at,
    duration_minutes = 0
FROM ranked r
WHERE ts.id = r.id AND r.rn > 1;

-- 4. Structural backstop: at most ONE open segment per shift, ONE open shift
--    per member. A second concurrent insert now fails with 23505 (which the
--    app catches and heals) instead of silently creating a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_segment_per_entry
  ON time_segments(time_entry_id) WHERE ended_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_shift_per_member
  ON time_entries(member_id) WHERE clock_out IS NULL;

-- 5. Sanity check — both should return 0 rows. If not, a duplicate slipped in
--    after steps 1-3 (someone clocked in mid-migration); re-run this file.
-- SELECT time_entry_id, COUNT(*) FROM time_segments WHERE ended_at IS NULL
--   GROUP BY time_entry_id HAVING COUNT(*) > 1;
-- SELECT member_id, COUNT(*) FROM time_entries WHERE clock_out IS NULL
--   GROUP BY member_id HAVING COUNT(*) > 1;

SELECT 'Migration 046 complete! One-open-shift / one-open-segment enforced.' AS status;
