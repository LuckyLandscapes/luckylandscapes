// Payment fee + cash discount math.
//
// Centralized so the invoice detail page (internal view), public pay page
// (customer view), SMS body, and webhook all agree on the numbers. Stripe's
// posted pricing as of 2026-05 — if Lucky negotiates a custom rate, change
// these constants. The webhook still stores the EXACT fee from each
// balance_transaction, so historical accuracy isn't affected by tweaking
// these defaults.

// Stripe US standard pricing (online, card-not-present).
export const STRIPE_CARD_RATE       = 0.029;   // 2.9%
export const STRIPE_CARD_FLAT_CENTS = 30;      // + $0.30 per charge
export const STRIPE_ACH_RATE        = 0.008;   // 0.8%
export const STRIPE_ACH_CAP_CENTS   = 500;     // capped at $5

// Default cash discount — 3% encourages non-card payment while staying
// close to break-even on Stripe's card fee.
export const DEFAULT_CASH_DISCOUNT_PCT = 3;

// Estimate the Stripe card fee on an amount in dollars.
export function estimateCardFee(amount) {
  return Math.round((Number(amount || 0) * STRIPE_CARD_RATE + STRIPE_CARD_FLAT_CENTS / 100) * 100) / 100;
}

// Estimate the Stripe ACH fee on an amount in dollars.
export function estimateAchFee(amount) {
  const raw = Number(amount || 0) * STRIPE_ACH_RATE * 100; // in cents
  const capped = Math.min(raw, STRIPE_ACH_CAP_CENTS);
  return Math.round(capped) / 100;
}

// Effective fee % for a given amount + method (so the UI can show
// "≈ 2.93% on this invoice").
export function effectiveCardFeePct(amount) {
  if (!amount || amount <= 0) return 0;
  return (estimateCardFee(amount) / amount) * 100;
}

// Compute the cash-discount amount + post-discount total. Returns dollars.
export function computeCashDiscount(total, discountPct = DEFAULT_CASH_DISCOUNT_PCT) {
  const pct = Number(discountPct) || 0;
  const t = Number(total || 0);
  return {
    discount: Math.round(t * pct / 100 * 100) / 100,
    cashTotal: Math.round(t * (1 - pct / 100) * 100) / 100,
    pct,
  };
}

// Read the org's configured discount %, falling back to the default.
// Lives on organizations.settings.cash_discount_percent (existing JSONB
// column — no migration needed). Pass `null` for default behavior.
export function getCashDiscountPct(org) {
  const v = org?.settings?.cash_discount_percent;
  if (v === undefined || v === null || v === '') return DEFAULT_CASH_DISCOUNT_PCT;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_CASH_DISCOUNT_PCT;
  return n;
}

// Methods that qualify for the cash discount. Non-Stripe payment methods —
// the customer is paying us directly, so we save the Stripe fee entirely.
// Stripe card AND Stripe ACH are excluded because they still cost us fees
// (ACH is cheap at 0.8% capped at $5, but it's still > 0).
export const CASH_DISCOUNT_METHODS = ['cash', 'check', 'venmo', 'zelle', 'other'];

export function methodQualifiesForCashDiscount(method) {
  return CASH_DISCOUNT_METHODS.includes(method);
}
