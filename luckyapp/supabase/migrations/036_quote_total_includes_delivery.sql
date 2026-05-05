-- 036_quote_total_includes_delivery.sql
--
-- Backfill: prior to this migration, quotes.total was the line-item subtotal
-- only. The delivery_fee was stored separately and silently rolled into the
-- materials_delivery deposit, but it never appeared in the customer-facing
-- "Estimated Total" or in the percentage-deposit math (total * pct ran
-- against subtotal-without-delivery, so delivery was never billed).
--
-- Going forward the write path stores total = line_items + delivery_fee.
-- This migration brings existing rows in line.
--
-- One-shot: run once. There is no idempotence flag because we cannot tell
-- after the fact whether a given row's total already includes delivery.

UPDATE quotes
   SET total = COALESCE(total, 0) + COALESCE(delivery_fee, 0)
 WHERE COALESCE(delivery_fee, 0) > 0;
