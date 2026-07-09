-- 048_meta_leads.sql
--
-- Backs the Meta Instant Form lead-ads bridge (docs/meta-ads-campaign-001.md
-- §2.3): Meta sends no native per-lead email, so a leadgen webhook (+ a
-- polling cron fallback while Meta app review is pending) creates the lead
-- in `customers` the same way /api/leads/public does, and this table is the
-- idempotency + audit record keyed on Meta's own `leadgen_id` (globally
-- unique) so webhook redeliveries and the polling fallback can both fire on
-- the same lead without creating duplicate customers.
--
-- See src/lib/metaLeads.js for the shared ingest logic used by both
-- src/app/api/meta/leadgen/route.js (webhook) and
-- src/app/api/cron/meta-leads-poll/route.js (polling fallback).

CREATE TABLE IF NOT EXISTS meta_leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  leadgen_id         TEXT NOT NULL UNIQUE,
  form_id            TEXT,
  page_id            TEXT,
  ad_id              TEXT,
  customer_id        UUID REFERENCES customers(id) ON DELETE SET NULL,
  field_data         JSONB,
  lead_created_time  TIMESTAMPTZ,
  ingested_via       TEXT NOT NULL DEFAULT 'webhook', -- 'webhook' | 'poll'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_leads_org ON meta_leads(org_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_customer ON meta_leads(customer_id);

-- RLS — only the service role writes (both entry points use the service-role
-- client, same as every other webhook/cron in this app — see auto-dunning,
-- the Stripe webhook). Dashboard members can read their own org's rows if a
-- UI ever surfaces them; no insert/update/delete policy for `authenticated`
-- is defined on purpose.
ALTER TABLE meta_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_leads_org_select" ON meta_leads;
CREATE POLICY "meta_leads_org_select" ON meta_leads FOR SELECT
  USING (org_id = get_user_org_id());
