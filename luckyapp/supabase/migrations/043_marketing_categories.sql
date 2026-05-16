-- ============================================================================
-- 043: Marketing categories — per-org category list with metadata
-- ============================================================================
-- The public gallery landing page (luckylandscapes.com/gallery) used to derive
-- category tiles from the unique values in marketing_gallery.tags[]. That gave
-- Riley no control: every tag became a tile, single-project categories cluttered
-- the page, and adjacent categories that shared a top project also shared the
-- cover photo. Riley needed explicit control over which categories appear, in
-- what order, and with which cover image.
--
-- This table holds that metadata. Tags themselves still live in
-- marketing_gallery.tags[] (free-form, no foreign key) so adding a tag to a
-- photo doesn't require a category row — the app creates the row lazily on
-- first use. Categories survive after their last photo is deleted; Riley
-- manages explicitly via the Manage Categories modal.
--
-- Public site behavior:
--   - If ANY marketing_categories row has is_visible=true → show ONLY those,
--     using their explicit cover_image_url / display_name / icon / sort_order.
--   - If NO rows are visible (the all-hidden default state) → fall back to
--     auto-derive from tags (existing behavior, all categories shown).
-- This lets Riley curate at his pace without breaking the public site between
-- the migration running and his first explicit enable.
--
-- Backfill: one row per unique tag found in existing published photos, ALL
-- HIDDEN BY DEFAULT (is_visible=false). Sorted by descending project count
-- so the manage UI shows Riley's most-common tags at the top of the list.
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- The tag string. Must match the value used in marketing_gallery.tags[]
  -- exactly (case-sensitive) — that's how we look up which photos belong.
  name              TEXT NOT NULL,
  -- Human-friendly override. NULL = render `name` as-is on the public site.
  display_name      TEXT,
  -- Explicit cover photo. NULL = fall back to the first photo tagged with
  -- this category (existing auto-derive behavior).
  cover_image_url   TEXT,
  cover_image_path  TEXT,
  -- Emoji shown on the category tile. NULL = no icon overlay.
  icon              TEXT,
  -- If false, the public site hides this category from the landing grid.
  -- Photos with this tag are still filterable via /gallery#tag=Name.
  is_visible        BOOLEAN NOT NULL DEFAULT false,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_marketing_categories_org_visible
  ON marketing_categories(org_id, is_visible, sort_order);

ALTER TABLE marketing_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_categories_select" ON marketing_categories FOR SELECT
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_categories_insert" ON marketing_categories FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_categories_update" ON marketing_categories FOR UPDATE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_categories_delete" ON marketing_categories FOR DELETE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE marketing_categories; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill — one row per unique tag across all published photos in each org.
-- ALL HIDDEN (is_visible=false). Sort_order is by descending project count
-- then alphabetical so Riley sees his most-common categories first in the
-- manage modal.
WITH unnested AS (
  SELECT org_id, UNNEST(tags) AS tag_name, id
  FROM marketing_gallery
  WHERE is_published = true
),
tag_counts AS (
  SELECT org_id, tag_name, COUNT(DISTINCT id) AS cnt
  FROM unnested
  GROUP BY org_id, tag_name
),
ordered AS (
  SELECT
    org_id,
    tag_name,
    cnt,
    ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY cnt DESC, tag_name ASC) AS sort_idx
  FROM tag_counts
)
INSERT INTO marketing_categories (org_id, name, is_visible, sort_order)
SELECT org_id, tag_name, false, (sort_idx - 1) * 10
FROM ordered
ON CONFLICT (org_id, name) DO NOTHING;
