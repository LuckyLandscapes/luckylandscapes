-- ============================================================================
-- 024: Contracts — PDF storage + signed-URL bucket
-- ============================================================================
-- Adds two columns to `contracts` and creates the `contract-pdfs` storage
-- bucket where signed-contract PDFs live. Rendered server-side after the
-- customer signs (see /api/contracts/public/[token]) and immutable thereafter.
--
-- The bucket is PUBLIC because each PDF lives at an unguessable UUID path
-- (org_id/contract_id.pdf — both UUIDs, ~244 bits of entropy together) and
-- the dashboard simply links the public URL. If the security team later
-- requires private storage, flip `public` to false here and add a
-- /api/contracts/<id>/pdf-url endpoint that mints signed URLs on demand.
-- ============================================================================

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pdf_path TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pdf_url  TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('contract-pdfs', 'contract-pdfs', true, 5242880)   -- 5 MB cap
ON CONFLICT (id) DO NOTHING;

-- Allow service role to manage all PDFs (server route uploads them)
DROP POLICY IF EXISTS "contract pdfs service write" ON storage.objects;
CREATE POLICY "contract pdfs service write"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'contract-pdfs')
  WITH CHECK (bucket_id = 'contract-pdfs');

-- Allow public read (PDFs sit at unguessable UUID paths)
DROP POLICY IF EXISTS "contract pdfs public read" ON storage.objects;
CREATE POLICY "contract pdfs public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'contract-pdfs');
