-- ============================================================
-- 022: Quote Media — videos, voice memos, captions, transcripts
-- Run this in Supabase SQL Editor → New Query (depends on 020, 021)
-- ============================================================
-- Adds:
--   • media_type        — 'image' | 'video' | 'audio' (was implicit)
--   • duration_seconds  — for video and voice memos
--   • transcript        — Web Speech API transcript captured during
--                         voice-memo recording (or empty)
--   • bumps the storage bucket cap from 5MB → 50MB so a ~30s
--     phone video fits without rejection
-- ============================================================

ALTER TABLE quote_media ADD COLUMN IF NOT EXISTS media_type        TEXT DEFAULT 'image' CHECK (media_type IN ('image','video','audio'));
ALTER TABLE quote_media ADD COLUMN IF NOT EXISTS duration_seconds  INTEGER;
ALTER TABLE quote_media ADD COLUMN IF NOT EXISTS transcript        TEXT;

-- Backfill: every existing row from migration 020 was an image
UPDATE quote_media SET media_type = 'image' WHERE media_type IS NULL;

-- Bump the bucket size limit. Videos are ~5–30MB after browser
-- compression; voice memos ~1MB/min; images stay tiny via our
-- client-side compress-to-1600px pipeline.
UPDATE storage.buckets
SET    file_size_limit = 52428800   -- 50 MB
WHERE  id = 'quote-media';
