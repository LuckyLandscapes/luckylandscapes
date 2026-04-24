-- ============================================
-- Lucky Landscapes — Invoices Table Migration
-- Run this against your Supabase database
-- ============================================

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  due_date DATE,
  paid_date DATE,
  items JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see invoices from their own org
CREATE POLICY "Users can manage their org invoices"
  ON invoices
  FOR ALL
  USING (org_id IN (
    SELECT org_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (org_id IN (
    SELECT org_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
