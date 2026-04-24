-- Run this in the Supabase SQL Editor to create the storage bucket for quote PDFs
-- Dashboard → SQL Editor → New Query → Paste & Run

-- 1. Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('quote-pdfs', 'quote-pdfs', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quote-pdfs');

-- 3. Allow public read access (so customers can view the PDF link)
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'quote-pdfs');

-- 4. Allow service role to manage files (for the API route)
CREATE POLICY "Allow service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'quote-pdfs')
WITH CHECK (bucket_id = 'quote-pdfs');
