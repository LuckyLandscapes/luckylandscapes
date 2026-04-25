-- ============================================================
-- Lucky Landscapes — Add priority column to jobs table
-- Run this in your Supabase SQL Editor
-- ============================================================

-- The edit job modal allows setting priority, but the column was missing
-- from the original schema. This caused ALL job edits (including crew
-- assignment changes) to silently fail because Supabase rejects updates
-- containing unknown columns.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

SELECT 'Migration complete! priority column added to jobs.' AS status;
