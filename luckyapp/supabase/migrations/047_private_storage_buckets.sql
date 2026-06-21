-- 047_private_storage_buckets.sql
--
-- Privatize the Storage buckets that hold SENSITIVE data and were created
-- PUBLIC (anyone with the object URL could read them):
--   • receipts        — contractor W-9 images (FULL SSN/EIN), expense receipts,
--                       work-order scans, mileage odometer photos
--   • quote-media     — customer property photos (lead + quote walkthrough)
--   • contract-pdfs   — signed customer agreements (name, address, price, signature, IP)
--   • quote-pdfs      — generated quote PDFs (PII + pricing)
--   • job-media       — job-site photos/videos
--
-- This flips them private and replaces the `TO public` read + UNSCOPED write
-- policies with org-scoped ones (the correct pattern, already used by
-- marketing-gallery in 039). After running this the app serves these objects via
-- short-lived SIGNED urls: authenticated dashboard members mint them client-side
-- (the org-scoped SELECT below authorizes it — see src/lib/signedStorage.js), and
-- the public /sign + /pay pages get server-minted signed urls from their token
-- route (service-role). materials + marketing-gallery stay PUBLIC on purpose
-- (catalog photos + the marketing portfolio are shown to anonymous visitors).
--
-- SAFE TO REVERT — non-destructive. If any surface breaks, flip back:
--   UPDATE storage.buckets SET public = true
--    WHERE id IN ('receipts','quote-media','contract-pdfs','quote-pdfs','job-media');
-- (the signed-url code keeps working on a public bucket, so reverting just
-- restores the old behavior.)
--
-- Path convention: (storage.foldername(name))[1] is the first path segment and
-- holds the org id for every upload EXCEPT lead photos, which use
-- 'leads/<orgId>/<customerId>/...', so quote-media also checks segment [2].

-- ── 1. Flip the sensitive buckets to private ────────────────────────────────
-- Scoped to the buckets whose read sites are converted to signed urls in this
-- change set: receipts (W-9 SSNs — CRITICAL) and contract-pdfs (signed
-- agreements). quote-media (property photos), quote-pdfs, and job-media are a
-- follow-up — their display sites (QuoteMediaGallery, the quote-PDF download, the
-- job-detail media grid) still need the signed-url swap, so privatizing them now
-- would 404 those images. Do them in a later migration once converted.
UPDATE storage.buckets
   SET public = false
 WHERE id IN ('receipts', 'contract-pdfs');

-- ── 2. receipts ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "receipts_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "receipts_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_storage_delete" ON storage.objects;

CREATE POLICY "receipts_org_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "receipts_org_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "receipts_org_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ── 3. contract-pdfs (writes already service-role-only; just fix the read) ───
DROP POLICY IF EXISTS "contract pdfs public read" ON storage.objects;

CREATE POLICY "contract_pdfs_org_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contract-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- quote-pdfs + job-media are deliberately NOT privatized here — see the note on
-- the UPDATE above. They keep their existing public-read policies until their
-- display sites are converted to signed urls in a follow-up migration.

-- The service_role "*_storage_all" / "service role full access" policies created
-- in the original migrations are intentionally LEFT IN PLACE so server routes
-- (which use the service-role client) can keep reading/writing + minting signed
-- urls for the public token pages.
