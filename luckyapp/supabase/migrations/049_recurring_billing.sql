-- ============================================
-- Lucky Landscapes — Recurring billing (migration 049)
-- Run this by hand in the Supabase SQL editor, in order, after 048.
-- Reversible: DROP TABLE recurring_plans; ALTER TABLE customers DROP COLUMN stripe_customer_id;
-- ============================================

-- 1. Saved-card link: a customer maps to one Stripe Customer so we can charge
--    a card on file off-session. Nullable — only set once they save a card.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Recurring plans — one row per customer per recurring service (weekly
--    mowing, monthly maintenance, etc). The daily cron (/api/cron/recurring-billing)
--    generates a real invoice each period and either auto-charges the saved card
--    (payment_mode='autopay') or emails the pay link (payment_mode='invoice').
CREATE TABLE IF NOT EXISTS recurring_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                       -- e.g. "Weekly mowing"
  interval TEXT NOT NULL DEFAULT 'weekly'
    CHECK (interval IN ('weekly', 'biweekly', 'monthly')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,   -- charged each period (tax-inclusive)
  line_items JSONB DEFAULT '[]'::jsonb,       -- optional detail for the generated invoice
  -- Fixed-term contracts (e.g. "$2,000 for the year, billed monthly"):
  --   contract_amount = 2000.00, total_periods = 12, amount = 166.67
  -- The cron bills `amount` for periods 1..n-1 and the exact remainder on the
  -- final period so the payments sum to contract_amount to the cent. When
  -- total_periods IS NULL the plan is open-ended (bills until cancelled).
  contract_amount NUMERIC(12,2),              -- total agreed price across the term
  total_periods INTEGER,                      -- number of payments (NULL = ongoing)
  periods_billed INTEGER NOT NULL DEFAULT 0,  -- how many have been billed so far
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  next_run_date DATE NOT NULL,               -- next date the cron bills this plan
  payment_mode TEXT NOT NULL DEFAULT 'invoice'
    CHECK (payment_mode IN ('autopay', 'invoice')),
  -- Autopay: the saved card + the customer's authorization (consent record).
  stripe_payment_method_id TEXT,
  authorized_at TIMESTAMPTZ,                  -- when the customer authorized autopay
  authorization_text TEXT,                    -- the exact language they agreed to
  public_token TEXT UNIQUE,                   -- for the /autopay/[token] card-save page
  last_run_at TIMESTAMPTZ,
  last_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_plans_org_id ON recurring_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_recurring_plans_customer_id ON recurring_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_plans_due ON recurring_plans(status, next_run_date);
CREATE INDEX IF NOT EXISTS idx_recurring_plans_public_token ON recurring_plans(public_token);

-- RLS — org-scoped, same shape as invoices (migration 007).
ALTER TABLE recurring_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org recurring plans"
  ON recurring_plans
  FOR ALL
  USING (org_id IN (
    SELECT org_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (org_id IN (
    SELECT org_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Realtime so the /recurring page updates live.
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_plans;
