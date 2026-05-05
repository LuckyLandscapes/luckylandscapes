-- ============================================================================
-- 035: Deposit options — percentage OR materials+delivery
-- ============================================================================
-- Until now every quote computed its deposit as materials_cost + delivery_fee.
-- Some jobs (mostly labor, no big material purchase upfront) want a flat
-- percentage of the total instead — industry-standard for residential
-- landscaping (10/25/33/50% are the common picks).
--
-- `deposit_type` switches between the legacy 'materials_delivery' mode and
-- the new 'percentage' mode. `deposit_percentage` is only meaningful when
-- type = 'percentage'; left nullable so existing rows can default cleanly.
--
-- The same pair is mirrored on `contracts` so the snapshot taken at signing
-- preserves which mode was in effect (a future quote edit doesn't rewrite
-- what the customer agreed to).
-- ============================================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS deposit_type TEXT NOT NULL DEFAULT 'materials_delivery'
    CHECK (deposit_type IN ('materials_delivery', 'percentage'));

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5,2);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS deposit_type TEXT NOT NULL DEFAULT 'materials_delivery'
    CHECK (deposit_type IN ('materials_delivery', 'percentage'));

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5,2);
