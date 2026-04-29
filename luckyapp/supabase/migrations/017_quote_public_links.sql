-- ============================================================================
-- 017: Quote Public Links + Deposit Workflow
-- ============================================================================
-- Adds the columns that power the new customer-facing quote experience:
--   • public_token              — URL-safe hex; powers /quote/[token]
--   • materials_cost            — what we'll charge upfront for materials
--   • delivery_fee              — upfront delivery charge (0 if not needed)
--   • deposit_paid_at           — when the materials+delivery deposit cleared
--   • deposit_payment_intent_id — Stripe PI that recorded the deposit
--   • decline_reason            — what the customer wants changed/removed
--   • declined_at               — when the customer clicked "Request Changes"
--   • last_viewed_at            — last time the public link was opened
-- ============================================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS public_token              TEXT UNIQUE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS materials_cost            NUMERIC(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_fee              NUMERIC(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_paid_at           TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_payment_intent_id TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS decline_reason            TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_at               TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS last_viewed_at            TIMESTAMPTZ;

-- Backfill: every existing quote gets a URL-safe hex token so we can share it
UPDATE quotes
   SET public_token = encode(gen_random_bytes(18), 'hex')
 WHERE public_token IS NULL;

ALTER TABLE quotes ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(18), 'hex');
ALTER TABLE quotes ALTER COLUMN public_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_public_token ON quotes(public_token);
CREATE INDEX IF NOT EXISTS idx_quotes_deposit_pi   ON quotes(deposit_payment_intent_id);
