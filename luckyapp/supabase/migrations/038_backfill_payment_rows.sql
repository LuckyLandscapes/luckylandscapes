-- ============================================================================
-- 038: Backfill payment rows for invoices marked paid before payments table existed
-- ============================================================================
-- Why: cash-basis revenue (dashboard, P&L, /finance) reads from the payments
-- table, not from invoices.amount_paid. The legacy "Mark Paid" button on
-- /invoices/[id] only updated the invoice; it never inserted a payments row.
-- That left invoices with amount_paid > 0 but no payment history, so:
--   - Dashboard revenue showed $0 even after Mark Paid
--   - P&L cash-basis showed $0
--   - Payment-method breakdown was empty
--
-- This migration retroactively creates one synthetic payment row for every
-- invoice with amount_paid > 0 and no existing payment row, dated to
-- invoice.paid_date (falls back to created_at). Method is 'other' since we
-- don't know how the legacy invoice was actually paid — the user can edit
-- the payment row to correct the method later.
--
-- Safe to re-run: the WHERE NOT EXISTS guard means each invoice gets at most
-- one synthetic backfill row even if the migration is run multiple times.
-- ============================================================================

INSERT INTO payments (org_id, invoice_id, customer_id, amount, method, status, notes, paid_at, created_at)
SELECT
  i.org_id,
  i.id,
  i.customer_id,
  i.amount_paid,
  CASE
    WHEN i.payment_method IN ('card','ach','cash','check','venmo','zelle','other') THEN i.payment_method
    ELSE 'other'
  END,
  'succeeded',
  'Backfilled from legacy invoice.amount_paid — edit to correct payment method',
  COALESCE(i.paid_date::timestamptz, i.created_at, now()),
  now()
FROM invoices i
WHERE i.amount_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.invoice_id = i.id
  );
