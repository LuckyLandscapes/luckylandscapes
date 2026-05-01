-- ============================================================================
-- 026: 1099 Contractors + W-9 capture + contractor agreements
-- ============================================================================
-- Adds the data we need to file 1099-NEC year-end and to issue independent
-- contractor agreements before work begins.
--
-- Design choices:
--
-- 1. `contractors` is its own table (not a reuse of customers/team_members).
--    Contractors are vendors we PAY, customers are people we BILL, team_members
--    are W-2 employees. Conflating them creates audit pain at 1099 time.
--
-- 2. Payments are NOT a separate `contractor_payments` table. Instead we
--    add a nullable `contractor_id` FK on `job_expenses` and `company_expenses`,
--    so a payment to a sub is recorded as a normal expense (which already
--    flows through P&L correctly) and tagged to a contractor for 1099 totals.
--    The `subcontractor` COGS category was already there.
--
-- 3. Contract agreements REUSE the `contracts` table by relaxing the
--    customer_id NOT-NULL implicit assumption (column is already nullable per 023).
--    We add `party_type` ('customer' | 'contractor') and a nullable
--    `contractor_id` FK so the same /sign/[token] signing flow works for
--    both customer service agreements AND contractor independent-contractor
--    agreements.
--
-- 4. Tax IDs (SSN/EIN) ARE stored full because the user needs them to e-file
--    the 1099. Supabase handles at-rest encryption. Do NOT expose this column
--    in any public route. The `pay/[token]` and `sign/[token]` routes use
--    contracts/invoices, neither of which join contractors.
-- ============================================================================

-- 1. Contractors directory
CREATE TABLE IF NOT EXISTS contractors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_name       TEXT,                                 -- DBA / company name (optional)
  contact_name        TEXT NOT NULL,                        -- "Pay to the order of" name on the 1099
  email               TEXT,
  phone               TEXT,

  -- 1099-NEC payee address (Box on the form)
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,

  -- Tax classification (W-9 Box 3)
  tax_classification  TEXT CHECK (tax_classification IN (
                        'individual','sole_prop','c_corp','s_corp','partnership','llc','other'
                      )),
  -- LLCs further specify tax treatment on W-9 ("C", "S", or "P")
  llc_tax_treatment   TEXT CHECK (llc_tax_treatment IN ('C','S','P') OR llc_tax_treatment IS NULL),

  -- Tax ID (SSN or EIN) — stored full because we need it to file
  tax_id_type         TEXT CHECK (tax_id_type IN ('ssn','ein')),
  tax_id              TEXT,                                  -- full SSN or EIN, no dashes
  -- Convenience for UI: don't display full ID, only last 4
  tax_id_last4        TEXT GENERATED ALWAYS AS (RIGHT(tax_id, 4)) STORED,

  -- W-9 evidence
  w9_received_at      DATE,
  w9_url              TEXT,
  w9_path             TEXT,

  -- Backup withholding flag (W-9 Part II item 2 NOT crossed out)
  backup_withholding  BOOLEAN DEFAULT false,
  -- C-corp / S-corp payees are generally exempt from 1099-NEC reporting
  exempt_from_1099    BOOLEAN DEFAULT false,

  notes               TEXT,
  archived            BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractors_org      ON contractors(org_id);
CREATE INDEX IF NOT EXISTS idx_contractors_archived ON contractors(org_id, archived);

ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractors_select" ON contractors FOR SELECT
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "contractors_insert" ON contractors FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "contractors_update" ON contractors FOR UPDATE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "contractors_delete" ON contractors FOR DELETE
  USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE contractors; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tag expense rows with the contractor they were paid to
ALTER TABLE job_expenses     ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL;
ALTER TABLE company_expenses ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_expenses_contractor     ON job_expenses(contractor_id);
CREATE INDEX IF NOT EXISTS idx_company_expenses_contractor ON company_expenses(contractor_id);

-- 3. Extend contracts to support contractor agreements alongside customer agreements
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS party_type    TEXT NOT NULL DEFAULT 'customer'
                                              CHECK (party_type IN ('customer','contractor'));
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_contractor_id ON contracts(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_party_type    ON contracts(party_type);

-- A contract is either tied to a customer (party_type='customer') or to a
-- contractor (party_type='contractor'), never both. We *don't* require
-- customer_id NOT NULL because customers.id ON DELETE SET NULL can leave
-- legitimate orphan customer-contracts; require it only on the contractor
-- side where the relationship is essential to the contract's identity.
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_party_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_party_check CHECK (
  (party_type = 'customer'   AND contractor_id IS NULL) OR
  (party_type = 'contractor' AND contractor_id IS NOT NULL AND customer_id IS NULL)
);
