-- ============================================================================
-- 023: Service Contracts (auto-generated, customer-signed)
-- ============================================================================
-- Stores legal service agreements that customers sign before work begins.
-- A contract is normally generated from an accepted quote, but can also be
-- created standalone (e.g. recurring maintenance agreements).
--
-- The contract body is rendered from a template at generation time and then
-- frozen as plain text in `body` so future template changes don't alter what
-- the customer actually agreed to.
--
-- The signature is captured on the public /sign/[token] page as a base64-encoded
-- PNG (data URL) plus typed-name / IP / user-agent metadata for evidentiary
-- weight. Once signed, contracts are immutable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id          UUID REFERENCES customers(id) ON DELETE SET NULL,
  quote_id             UUID REFERENCES quotes(id) ON DELETE SET NULL,
  job_id               UUID REFERENCES jobs(id) ON DELETE SET NULL,
  contract_number      INTEGER NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','sent','viewed','signed','declined','void')),

  -- Snapshot of what the customer is agreeing to (frozen at generate time)
  title                TEXT NOT NULL DEFAULT 'Service Agreement',
  category             TEXT,                          -- mirrors quote.category for filtering
  scope_of_work        TEXT,                          -- bulleted summary of items
  total_amount         NUMERIC(12,2) DEFAULT 0,
  deposit_amount       NUMERIC(12,2) DEFAULT 0,
  start_date           DATE,                          -- estimated start
  completion_window    TEXT,                          -- e.g. "within 14 business days of start"
  body                 TEXT NOT NULL,                 -- full rendered contract text
  customer_snapshot    JSONB DEFAULT '{}'::jsonb,     -- {name,email,phone,address,city,state,zip}

  -- Public link + lifecycle timestamps
  public_token         TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  sent_at              TIMESTAMPTZ,
  last_viewed_at       TIMESTAMPTZ,
  signed_at            TIMESTAMPTZ,
  declined_at          TIMESTAMPTZ,
  decline_reason       TEXT,

  -- Signature evidence
  signature_data_url   TEXT,                          -- base64 PNG of drawn signature
  signature_typed_name TEXT,                          -- typed full legal name (corroborates drawn sig)
  signature_ip         TEXT,
  signature_user_agent TEXT,

  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),

  UNIQUE (org_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_contracts_org_id        ON contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id   ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_quote_id      ON contracts(quote_id);
CREATE INDEX IF NOT EXISTS idx_contracts_job_id        ON contracts(job_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status        ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_public_token  ON contracts(public_token);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org contracts"
  ON contracts
  FOR ALL
  USING (org_id IN (
    SELECT org_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (org_id IN (
    SELECT org_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Realtime so the dashboard updates the moment a customer signs
ALTER PUBLICATION supabase_realtime ADD TABLE contracts;
