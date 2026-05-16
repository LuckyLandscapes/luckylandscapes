-- ============================================================================
-- 040: Marketing gallery — "featured" star flag for homepage curation
-- ============================================================================
-- The marketing site's homepage shows a curated "Featured Work" section (6
-- cards). Before this migration the public API returned every published
-- photo in sort_order, and the homepage took the first 6 — which meant
-- whatever Riley uploaded most recently dominated the homepage even if a
-- pricier portfolio photo was better marketing.
--
-- This flag lets Riley star his best 6-10 photos and lock them to the
-- homepage. Falls back to newest if fewer than 6 are starred (so the
-- section never goes empty).
-- ============================================================================

ALTER TABLE marketing_gallery
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_marketing_gallery_org_featured
  ON marketing_gallery(org_id, is_published, is_featured, created_at DESC);
