-- ============================================================================
-- 014: Online Payments + Invoice Sending
-- ============================================================================
-- Adds:
--   1. `payments` table — discrete payment events (one row per charge)
--   2. New columns on `invoices` for public payment links + send tracking
-- ============================================================================

-- 1. Payments table — every charge/transfer/cash entry gets a row
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id               UUID REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id              UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount                   NUMERIC(12,2) NOT NULL,
  method                   TEXT NOT NULL CHECK (method IN (
    'card','ach','cash','check','venmo','zelle','other'
  )),
  status                   TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN (
    'pending','succeeded','failed','refunded'
  )),
  stripe_payment_intent_id TEXT,
  stripe_charge_id         TEXT,
  processor_fee            NUMERIC(12,2) DEFAULT 0,
  net_amount               NUMERIC(12,2),
  notes                    TEXT,
  paid_at                  TIMESTAMPTZ DEFAULT now(),
  created_by               UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_org           ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice       ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer      ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at       ON payments(paid_at);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON payments FOR SELECT
  TO authenticated USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "payments_update" ON payments FOR UPDATE
  TO authenticated USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "payments_delete" ON payments FOR DELETE
  TO authenticated USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE payments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Invoice columns for public sharing + send tracking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS public_token       TEXT UNIQUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at            TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_viewed_at     TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_via           TEXT CHECK (sent_via IN ('email','sms','both',NULL));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_to_email      TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_to_phone      TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms              TEXT;

-- Backfill: every existing invoice gets a public token so it can receive payments
UPDATE invoices SET public_token = encode(gen_random_bytes(18), 'base64')
  WHERE public_token IS NULL;

-- Make public_token mandatory going forward
ALTER TABLE invoices ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(18), 'base64');
ALTER TABLE invoices ALTER COLUMN public_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices(public_token);

-- 3. Public read-only policy on invoices for the payment page (lookup by token)
-- The /pay/[token] route uses the service role to read, so RLS doesn't need anon access.
-- (We intentionally do NOT add an anon SELECT policy — would expose org-wide data to anyone with ANY token.)
