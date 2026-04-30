-- ============================================================
-- 021: Quote Media — customer-anchored + 30-day auto-cleanup
-- Run this in Supabase SQL Editor → New Query (depends on 020)
-- ============================================================
-- Changes:
--   1. Adds `customer_id` so photos persist across quote revisions
--      for the same customer (a declined-and-rebuilt quote keeps
--      its photos automatically).
--   2. Adds `pinned` flag so important "before" photos can survive
--      the 30-day cleanup if needed.
--   3. Adds `cleanup_old_quote_media()` — deletes DB rows for
--      photos whose customer has no active quote/job and whose
--      last quote-or-job activity is 30+ days old. Returns the
--      `file_path`s so the caller can remove the storage objects.
--   4. Backfills `customer_id` on existing rows from the quote.
-- ============================================================

ALTER TABLE quote_media ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE quote_media ADD COLUMN IF NOT EXISTS pinned      BOOLEAN DEFAULT false;

-- Backfill: derive customer_id from the originating quote
UPDATE quote_media qm
SET    customer_id = q.customer_id
FROM   quotes q
WHERE  qm.quote_id = q.id
  AND  qm.customer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_quote_media_customer ON quote_media(customer_id);

-- ============================================================
-- Cleanup function — call from Vercel cron (or pg_cron).
-- A photo is eligible for deletion when ALL of:
--   • not pinned
--   • the customer has NO quote in (draft, sent, viewed)
--   • the customer has NO accepted quote whose linked job is
--     still scheduled or in_progress
--   • the customer's most recent settle event (declined_at,
--     completed_at, or quote.created_at) is 30+ days old
--
-- Returns the deleted rows' file_paths so the caller can remove
-- the storage objects. (pg can't reach the Storage API directly.)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_quote_media()
RETURNS TABLE (id UUID, file_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH active_customers AS (
    SELECT DISTINCT q.customer_id
    FROM   quotes q
    LEFT   JOIN jobs j ON j.quote_id = q.id
    WHERE  q.customer_id IS NOT NULL
      AND  (
        q.status IN ('draft','sent','viewed')
        OR (q.status = 'accepted' AND (j.id IS NULL OR j.status IN ('scheduled','in_progress')))
      )
  ),
  customer_last_active AS (
    SELECT q.customer_id,
           GREATEST(
             MAX(COALESCE(q.declined_at,     'epoch'::timestamptz)),
             MAX(COALESCE(j.completed_at,    'epoch'::timestamptz)),
             MAX(COALESCE(q.deposit_paid_at, 'epoch'::timestamptz)),
             MAX(q.created_at)
           ) AS last_activity
    FROM   quotes q
    LEFT   JOIN jobs j ON j.quote_id = q.id
    WHERE  q.customer_id IS NOT NULL
    GROUP  BY q.customer_id
  ),
  eligible AS (
    SELECT qm.id, qm.file_path
    FROM   quote_media qm
    LEFT   JOIN customer_last_active cla ON cla.customer_id = qm.customer_id
    WHERE  qm.pinned = false
      AND  qm.customer_id IS NOT NULL
      AND  qm.customer_id NOT IN (SELECT customer_id FROM active_customers)
      AND  COALESCE(cla.last_activity, qm.created_at) < (now() - interval '30 days')
  ),
  deleted AS (
    DELETE FROM quote_media qm
    USING  eligible e
    WHERE  qm.id = e.id
    RETURNING qm.id, qm.file_path
  )
  SELECT d.id, d.file_path FROM deleted d;
END;
$$;

-- Allow the service role (used by the Next.js cron route) to call it
GRANT EXECUTE ON FUNCTION cleanup_old_quote_media() TO service_role;
