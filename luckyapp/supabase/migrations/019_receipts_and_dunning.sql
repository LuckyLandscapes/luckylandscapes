-- ============================================================
-- 019: Receipts (expense photos) + A/R Auto-Dunning
-- Run this in Supabase SQL Editor → New Query
-- ============================================================
-- Adds:
--   1. `date` and `vendor` columns to job_expenses (parity with company_expenses)
--   2. `receipt_path` columns on both expense tables (to enable storage cleanup
--      on delete; receipt_url already exists from 005/013)
--   3. `receipts` storage bucket (5MB cap; client compresses before upload)
--   4. `last_reminder_at` + `reminder_count` on invoices (for dunning UX)
--   5. `invoice_reminders` audit log so we can see who got nudged and when
-- ============================================================

-- 1. Job expenses — add date + vendor (already on company_expenses)
ALTER TABLE job_expenses ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE job_expenses ADD COLUMN IF NOT EXISTS vendor TEXT;

-- 2. Receipt path columns (storage object key, used for cleanup)
ALTER TABLE job_expenses     ADD COLUMN IF NOT EXISTS receipt_path TEXT;
ALTER TABLE company_expenses ADD COLUMN IF NOT EXISTS receipt_path TEXT;

CREATE INDEX IF NOT EXISTS idx_job_expenses_date ON job_expenses(date);

-- 3. Receipts storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('receipts', 'receipts', true, 5242880)  -- 5MB hard cap (client compresses to ~300KB)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "receipts_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_storage_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

CREATE POLICY "receipts_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "receipts_storage_all"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- 4. Invoice dunning columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_count   INTEGER DEFAULT 0;

-- 5. Invoice reminders audit log
CREATE TABLE IF NOT EXISTS invoice_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sent_at         TIMESTAMPTZ DEFAULT now(),
  sent_to_email   TEXT,
  tone            TEXT CHECK (tone IN ('friendly','firm','urgent')),
  days_overdue    INTEGER,
  balance         NUMERIC(12,2),
  sent_by         UUID REFERENCES team_members(id) ON DELETE SET NULL,
  email_id        TEXT,                  -- Resend message id for traceability
  error           TEXT                   -- populated if send failed
);

ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_reminders_select" ON invoice_reminders FOR SELECT
  USING (org_id = get_user_org_id());
CREATE POLICY "invoice_reminders_insert" ON invoice_reminders FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice ON invoice_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_org     ON invoice_reminders(org_id);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE invoice_reminders; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
