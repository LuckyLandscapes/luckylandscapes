-- ============================================================================
-- 015: Fix public_token URL-safety
-- ============================================================================
-- The base64-encoded token from migration 014 can contain '/' and '+' which
-- break URLs of the form /pay/[token] and cause 404s. Switch to hex encoding
-- (URL-safe, slightly longer but bulletproof) and regenerate existing tokens.
-- ============================================================================

-- Regenerate ALL existing tokens with URL-safe hex
UPDATE invoices SET public_token = encode(gen_random_bytes(18), 'hex');

-- Change default for new invoices
ALTER TABLE invoices ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(18), 'hex');
