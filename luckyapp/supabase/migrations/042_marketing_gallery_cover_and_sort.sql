-- ============================================================================
-- 042: Marketing gallery — explicit cover photo + sort_order respacing
-- ============================================================================
-- Two fixes that go together:
--
-- 1) Multi-photo projects (rows sharing `project_name`) need a way to pick
--    which photo represents the project on the public website. Before this
--    migration the public site used the first-by-sort-order photo. Now we
--    have an explicit `is_cover` flag — Riley clicks a star on any photo in
--    a project and that one becomes the card thumbnail, decoupled from the
--    in-project display order. Public API will expose it as `isCover`.
--
--    Constraint: at most one cover per (org_id, project_name) for grouped
--    projects. Standalone photos (project_name IS NULL) ignore the flag —
--    each is its own card so "cover" is moot.
--
-- 2) The Move Up / Move Down buttons in /marketing-gallery have been broken
--    since launch. Every upload landed with `sort_order = 0` (default), and
--    the swap-with-neighbor logic in the UI assumed distinct values. Result:
--    every reorder attempt shot both items to the bottom of the list while
--    the rest of the rows stayed at zero. This migration respaces every
--    existing row to `(visual_row_index - 1) * 10` per org so:
--      • the current on-screen order is preserved verbatim,
--      • there's room between every pair for drag-and-drop drops, and
--      • new uploads (which the app will start assigning `max + 10`) land at
--        the bottom in upload order, where Riley can drag them into place.
-- ============================================================================

-- 1a. Add the cover flag.
ALTER TABLE marketing_gallery
  ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT false;

-- 1b. Partial unique index: at most one cover per project, only enforced
--     when the row is BOTH flagged AND has a project_name. Standalone
--     photos are unaffected.
DROP INDEX IF EXISTS idx_marketing_gallery_one_cover_per_project;
CREATE UNIQUE INDEX idx_marketing_gallery_one_cover_per_project
  ON marketing_gallery (org_id, project_name)
  WHERE is_cover = true AND project_name IS NOT NULL;

-- 1c. Backfill — for every project_name group, the first photo (by current
--     visible order: sort_order ASC, then created_at ASC as tiebreaker)
--     becomes the cover. Matches what the public site was already showing,
--     so no visual change on existing gallery cards.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY org_id, project_name
           ORDER BY sort_order ASC, created_at ASC
         ) AS rn
  FROM marketing_gallery
  WHERE project_name IS NOT NULL
)
UPDATE marketing_gallery mg
SET    is_cover = true
FROM   ranked r
WHERE  mg.id = r.id
  AND  r.rn = 1
  AND  mg.is_cover = false;

-- 2. Respacing — give every existing row a unique sort_order with gaps.
--    Per-org `ROW_NUMBER() * 10` over the current visible order preserves
--    what users see today while making future drag-and-drop reorders cheap
--    (drop between A and B = set sort_order to midpoint; collisions only
--    happen after ~10 consecutive drops between the same pair).
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY org_id
           ORDER BY sort_order ASC, created_at DESC
         ) AS rn
  FROM marketing_gallery
)
UPDATE marketing_gallery mg
SET    sort_order = (n.rn - 1) * 10
FROM   numbered n
WHERE  mg.id = n.id;

-- 3. Index helper for the cover lookup in the public API + manage page
--    (find all covers for an org in one indexed scan).
CREATE INDEX IF NOT EXISTS idx_marketing_gallery_org_cover
  ON marketing_gallery (org_id, project_name, is_cover)
  WHERE is_cover = true;
