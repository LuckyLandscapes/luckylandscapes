-- ============================================================================
-- 039: Marketing gallery (public website project portfolio)
-- ============================================================================
-- Drives the gallery shown at https://luckylandscapes.com/gallery and the
-- featured grid on the homepage. Riley adds photos from his phone in
-- luckyapp; the marketing site fetches `/api/marketing/gallery` and replaces
-- its static fallback list. No more "drop file in source-images/, run optimizer,
-- edit projectData, git commit, push" workflow — uploads go live in ~60s.
--
-- One row per photo (or before/after pair). Tags are a free-form text array
-- (curated to a known set in the UI for consistency, but not constrained in DB
-- so we can add new tags without a migration). `is_published` lets Riley stage
-- a photo before exposing it publicly. `sort_order` is honored by the public
-- API; ties broken by `created_at DESC` (newest first).
--
-- Storage: `marketing-gallery` bucket, files keyed `<orgId>/<photoId>.jpg`.
-- Bucket is PUBLIC because the marketing site is public — anyone hitting the
-- gallery URL needs unauthenticated read.
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_gallery (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What the public sees
  title                TEXT NOT NULL,
  description          TEXT,
  tags                 TEXT[] NOT NULL DEFAULT '{}',

  -- Main image (always present)
  image_url            TEXT NOT NULL,
  image_path           TEXT,                   -- storage key, kept so deletes can clean up the file
  image_width          INTEGER,
  image_height         INTEGER,
  image_bytes          INTEGER,

  -- Optional "before" image for before/after pairs
  before_image_url     TEXT,
  before_image_path    TEXT,

  -- Publishing controls
  is_published         BOOLEAN NOT NULL DEFAULT true,
  sort_order           INTEGER NOT NULL DEFAULT 0,

  -- Optional linkbacks for context (not exposed publicly)
  source_job_id        UUID REFERENCES jobs(id) ON DELETE SET NULL,
  source_quote_media_id UUID,

  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_gallery_org_published
  ON marketing_gallery(org_id, is_published, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_gallery_tags
  ON marketing_gallery USING GIN (tags);

ALTER TABLE marketing_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_gallery_select" ON marketing_gallery FOR SELECT
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_gallery_insert" ON marketing_gallery FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_gallery_update" ON marketing_gallery FOR UPDATE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "marketing_gallery_delete" ON marketing_gallery FOR DELETE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE marketing_gallery; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Storage bucket: marketing-gallery
-- ----------------------------------------------------------------------------
-- PUBLIC bucket — the marketing site is unauthenticated; image URLs must be
-- fetchable by anyone. Path convention `<orgId>/<photoId>.<ext>` keeps RLS
-- naturally scoped to the uploading org (the auth check matches the path
-- prefix to a team_members.org_id).

INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-gallery', 'marketing-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Public can READ any file in the bucket (it's public).
DROP POLICY IF EXISTS "marketing_gallery_public_read" ON storage.objects;
CREATE POLICY "marketing_gallery_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing-gallery');

-- Authenticated org members can write/delete files prefixed by their org_id.
DROP POLICY IF EXISTS "marketing_gallery_member_insert" ON storage.objects;
CREATE POLICY "marketing_gallery_member_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'marketing-gallery'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM team_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "marketing_gallery_member_update" ON storage.objects;
CREATE POLICY "marketing_gallery_member_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'marketing-gallery'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM team_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "marketing_gallery_member_delete" ON storage.objects;
CREATE POLICY "marketing_gallery_member_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'marketing-gallery'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM team_members WHERE user_id = auth.uid()
    )
  );
