-- ============================================================
-- 033: Subcontract support
-- Run in Supabase SQL Editor → New Query
-- ============================================================
-- Why this exists:
--   When Lucky is hired by a general contractor (GC) to work on someone
--   else's property, the homeowner signs the GC's agreement, not Lucky's.
--   Lucky's authorization comes from the GC (PO, email, verbal). The
--   existing "contract must be signed before job can start" gate blocks
--   this workflow.
--
-- Model:
--   - The GC IS the customer in Lucky's system (they're who Lucky bills).
--     A new `customers.customer_type` distinguishes a homeowner from a
--     business or general_contractor.
--   - The job gets a `work_authorization` enum: 'contract' (signed
--     agreement, current behavior), 'subcontract' (work-order/PO from
--     the GC), or 'verbal' (small repeat work). Only 'contract' triggers
--     the signature gate.
--   - For sub work, optional proof of authorization (PO, email screenshot)
--     is uploaded to the existing `receipts` storage bucket and tracked
--     via `work_order_url` + `work_order_path`.
--   - Site contact (homeowner name/phone) lives on the job, separate
--     from `customer_id` (which now points at the GC, not the homeowner).
-- ============================================================

-- 1. customers: customer_type
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'homeowner'
  CHECK (customer_type IN ('homeowner', 'business', 'general_contractor'));

CREATE INDEX IF NOT EXISTS idx_customers_type
  ON customers(org_id, customer_type);

-- 2. jobs: work_authorization
--    Default 'contract' so all existing jobs keep current behavior — they
--    still require a signed contract if they have a quote/contract link.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS work_authorization TEXT NOT NULL DEFAULT 'contract'
  CHECK (work_authorization IN ('contract', 'subcontract', 'verbal'));

-- 3. jobs: work order proof (sub work) + free-text reason
--    Reuses the 'receipts' storage bucket; upload key is
--    `<orgId>/work-order/<timestamp>-<rand>.<ext>`.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_order_url   TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_order_path  TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_order_notes TEXT;

-- 4. jobs: site contact (homeowner) when working through a GC
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_contact_name  TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_contact_phone TEXT;
