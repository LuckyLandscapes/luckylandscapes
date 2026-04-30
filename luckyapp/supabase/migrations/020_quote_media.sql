-- ============================================================
-- 020: Quote Media — photos uploaded by the person taking the
-- quote so workers can reference them on the job.
-- Run this in Supabase SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  uploaded_by     UUID,                       -- team_member id who uploaded
  file_path       TEXT NOT NULL,              -- path in Supabase Storage
  file_url        TEXT NOT NULL,              -- full public URL
  file_size       BIGINT DEFAULT 0,           -- compressed bytes
  caption         TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quote_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_media_select" ON quote_media FOR SELECT
  USING (org_id = get_user_org_id());
CREATE POLICY "quote_media_insert" ON quote_media FOR INSERT
  WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "quote_media_update" ON quote_media FOR UPDATE
  USING (org_id = get_user_org_id());
CREATE POLICY "quote_media_delete" ON quote_media FOR DELETE
  USING (org_id = get_user_org_id());

CREATE INDEX IF NOT EXISTS idx_quote_media_org      ON quote_media(org_id);
CREATE INDEX IF NOT EXISTS idx_quote_media_quote    ON quote_media(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_media_created  ON quote_media(created_at);

-- ============================================================
-- Storage Bucket — quote-media
-- 5MB hard cap; client compresses to ~200–400KB before upload
-- so we stay inside the free-tier 1GB / 5GB-bandwidth budget.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('quote-media', 'quote-media', true, 5242880)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "quote_media_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quote-media');

CREATE POLICY "quote_media_storage_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'quote-media');

CREATE POLICY "quote_media_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'quote-media');

CREATE POLICY "quote_media_storage_all"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'quote-media')
WITH CHECK (bucket_id = 'quote-media');

-- Realtime so workers see new photos appear without a reload
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE quote_media;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
