-- ============================================================
-- 023: Allow walkthrough media to exist before the quote does
-- Run this in Supabase SQL Editor → New Query
-- ============================================================
-- The new-quote wizard now lets the estimator capture photos /
-- video / voice memos BEFORE building line items, while doing
-- the in-person walk-around with the customer. At that point
-- the quote row hasn't been inserted yet, so quote_id has to be
-- nullable. Media is still customer-anchored (customer_id), so
-- the gallery and cleanup logic continue to work correctly.
-- ============================================================

ALTER TABLE quote_media ALTER COLUMN quote_id DROP NOT NULL;
