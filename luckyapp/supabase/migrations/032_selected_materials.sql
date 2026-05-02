-- ============================================================
-- 032 — Selected materials on quotes and contracts
-- ============================================================
-- Adds a JSONB array to quotes + contracts that holds a visual,
-- price-free snapshot of materials chosen for the job. Customer
-- never sees prices on materials; this column is purely for
-- approval ("yes, install this exact mulch / this exact paver").
--
-- Snapshot shape (each entry):
-- {
--   materialId: uuid,           // FK reference, may dangle if material later deleted
--   name: string,
--   category: string,
--   subcategory: string|null,
--   imageUrl: string|null,
--   color: string|null,
--   texture: string|null,
--   coveragePerUnit: string|null,
--   description: string|null,
--   unit: string,
--   quantity: number,
--   notes: string|null,         // salesperson context shown to customer
--   snapshottedAt: ISO8601
-- }
--
-- Stored as JSONB rather than a quote_materials table so:
--   1. Quote PDFs and signed contracts remain frozen even if a
--      material is renamed or deleted later.
--   2. No second JOIN on every quote read.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS selected_materials JSONB DEFAULT '[]'::JSONB;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS selected_materials JSONB DEFAULT '[]'::JSONB;

-- Backfill any nulls just in case (default applies only to new rows in pg < 11
-- in some configurations; run is a no-op if already set).
UPDATE quotes SET selected_materials = '[]'::JSONB WHERE selected_materials IS NULL;
UPDATE contracts SET selected_materials = '[]'::JSONB WHERE selected_materials IS NULL;

-- Cheap GIN index — supports `?` and `@>` ops if we ever query "which quotes
-- include material X?". Optional but small (selected_materials is short).
CREATE INDEX IF NOT EXISTS idx_quotes_selected_materials_gin ON quotes USING GIN (selected_materials);
CREATE INDEX IF NOT EXISTS idx_contracts_selected_materials_gin ON contracts USING GIN (selected_materials);
