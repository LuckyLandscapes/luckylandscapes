-- ============================================================================
-- 🍀 LUCKY LANDSCAPES — CATALOG ENHANCEMENTS
-- ============================================================================
-- Run in Supabase SQL Editor after the FULL_REBUILD migration.
-- Enhances the materials table with new fields for the revamped catalog.
-- ============================================================================

-- =============================================
-- 1. ENHANCED MATERIALS COLUMNS
-- =============================================

-- Tags for flexible filtering (e.g., 'premium', 'budget', 'popular')
ALTER TABLE materials ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Appearance descriptors for customer presentations
ALTER TABLE materials ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS texture TEXT;

-- Coverage info (e.g., "1 cu yd ≈ 100 sqft at 3\" depth")
ALTER TABLE materials ADD COLUMN IF NOT EXISTS coverage_per_unit TEXT;

-- Direct links to product pages at suppliers
ALTER TABLE materials ADD COLUMN IF NOT EXISTS supplier_url TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS supplier_url_alt TEXT;

-- Track when pricing was last verified
ALTER TABLE materials ADD COLUMN IF NOT EXISTS last_price_check TIMESTAMPTZ;

-- Internal notes (not shown to customers)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS notes TEXT;

-- Sort ordering for custom display
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;


-- =============================================
-- 2. STORAGE BUCKET — materials
-- =============================================
-- Your images already live in this bucket. This ensures the bucket
-- exists and has proper policies for the app to upload/read images.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('materials', 'materials', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "materials_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "materials_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "materials_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "materials_storage_all" ON storage.objects;

-- Authenticated users can upload material images
CREATE POLICY "materials_storage_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'materials');

-- Public read (images shown in catalog / PDFs / presentations)
CREATE POLICY "materials_storage_select" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'materials');

-- Authenticated users can delete material images
CREATE POLICY "materials_storage_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'materials');

-- Service role has full access (for server-side operations)
CREATE POLICY "materials_storage_all" ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'materials') WITH CHECK (bucket_id = 'materials');


-- =============================================
-- 3. PERFORMANCE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_supplier ON materials(supplier);
CREATE INDEX IF NOT EXISTS idx_materials_favorite ON materials(is_favorite);
CREATE INDEX IF NOT EXISTS idx_materials_sort ON materials(sort_order);


-- =============================================
-- 4. REALTIME (if not already added)
-- =============================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE materials;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- ✅ DONE! Materials catalog is enhanced.
-- ============================================================================
