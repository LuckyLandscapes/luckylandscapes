-- ============================================================
-- Lucky App — Job Media Migration (PART 1 of 2)
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates the table, storage bucket, and cleanup function.
-- ============================================================

-- 1. Job Media — tracks photos/videos uploaded to jobs
CREATE TABLE IF NOT EXISTS job_media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  uploaded_by     UUID,  -- team_member id who uploaded
  file_path       TEXT NOT NULL,  -- path in Supabase Storage
  file_url        TEXT NOT NULL,  -- full public URL
  file_type       TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  file_size       BIGINT DEFAULT 0,  -- bytes
  thumbnail_url   TEXT,
  caption         TEXT DEFAULT '',
  pinned          BOOLEAN DEFAULT false,  -- pinned items are exempt from auto-cleanup
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE job_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_media_select" ON job_media FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "job_media_insert" ON job_media FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "job_media_update" ON job_media FOR UPDATE
  USING (org_id = get_user_org_id());

CREATE POLICY "job_media_delete" ON job_media FOR DELETE
  USING (org_id = get_user_org_id());

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_job_media_org ON job_media(org_id);
CREATE INDEX IF NOT EXISTS idx_job_media_job ON job_media(job_id);
CREATE INDEX IF NOT EXISTS idx_job_media_created ON job_media(created_at);

-- ============================================================
-- Storage Bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('job-media', 'job-media', true, 52428800)  -- 50MB limit
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "job_media_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-media');

-- Allow public read access (so images/videos load in the app)
CREATE POLICY "job_media_storage_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "job_media_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job-media');

-- Allow service role full access
CREATE POLICY "job_media_storage_all"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'job-media')
WITH CHECK (bucket_id = 'job-media');

-- ============================================================
-- 30-Day Auto-Cleanup Function
-- Only deletes job_media rows that are:
--   - older than 30 days
--   - NOT pinned (pinned = false)
-- Other tables (jobs, customers, calendar_events, etc.) are NOT affected.
-- ============================================================

-- Cleanup function: deletes old unpinned job_media rows
-- NOTE: Storage object deletion must be handled by an Edge Function or
-- application-level cleanup since pg_cron cannot directly call the Storage API.
-- This function deletes the DATABASE records; the storage objects at the
-- file_path can be cleaned up by a scheduled Edge Function or manually.
CREATE OR REPLACE FUNCTION cleanup_old_job_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete job_media records older than 30 days that are NOT pinned
  DELETE FROM job_media
  WHERE created_at < now() - interval '30 days'
    AND pinned = false;
END;
$$;

-- ============================================================
-- Enable Realtime for job_media
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE job_media;


-- ============================================================
-- PART 2 — Scheduled Cleanup (RUN THIS SEPARATELY)
-- ============================================================
-- BEFORE running the lines below:
--   1. Go to Supabase Dashboard → Database → Extensions
--   2. Search for "pg_cron" and ENABLE it
--   3. Then come back here and run ONLY the uncommented SQL below
--
-- Once pg_cron is enabled, run this in a NEW query:
--
-- SELECT cron.schedule(
--   'cleanup-old-job-media',
--   '0 3 * * *',
--   'SELECT cleanup_old_job_media()'
-- );