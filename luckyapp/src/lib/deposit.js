// ─── Deposit calculation helpers ───────────────────────────────────────────
// Two modes exist, gated by the `deposit_type` column added in migration 035:
//
//   1. 'materials_delivery' — legacy default. Deposit is the literal sum of
//      `materials_cost` + `delivery_fee` entered by the salesperson. Covers
//      hard costs Lucky has to front before a single shovel hits dirt.
//
//   2. 'percentage' — new in 2026-05. Deposit is `total × deposit_percentage`.
//      Right call for labor-heavy jobs where there's no big material buy
//      upfront, and the standard 25/33% schedule is what the customer expects.
//
// All of these helpers accept either a camelCase quote (from `useData()`) or a
// snake_case raw row (from a server-side Supabase select), so the same code
// works on both sides of the boundary.

export const DEPOSIT_TYPES = {
  MATERIALS_DELIVERY: 'materials_delivery',
  PERCENTAGE: 'percentage',
};

export const DEPOSIT_PERCENTAGE_PRESETS = [10, 25, 33, 50];

function readField(record, camel, snake) {
  if (!record) return undefined;
  return record[camel] !== undefined ? record[camel] : record[snake];
}

// Compute the deposit dollar amount for a quote. Always returns a finite,
// non-negative number rounded to cents (so it can be passed straight to
// Stripe as `Math.round(amount * 100)`).
export function computeQuoteDeposit(quote) {
  if (!quote) return 0;
  const type = readField(quote, 'depositType', 'deposit_type') || DEPOSIT_TYPES.MATERIALS_DELIVERY;

  if (type === DEPOSIT_TYPES.PERCENTAGE) {
    const pct = Number(readField(quote, 'depositPercentage', 'deposit_percentage') || 0);
    const total = Number(readField(quote, 'total', 'total') || 0);
    if (!Number.isFinite(pct) || !Number.isFinite(total) || pct <= 0 || total <= 0) return 0;
    return Math.max(0, Math.round(total * pct) / 100);
  }

  const materials = Number(readField(quote, 'materialsCost', 'materials_cost') || 0);
  const delivery = Number(readField(quote, 'deliveryFee', 'delivery_fee') || 0);
  return Math.max(0, materials + delivery);
}

// Short label suitable for inline UI / email copy:
//   "Materials + delivery"
//   "25% of total"
export function formatDepositLabel(record) {
  if (!record) return '';
  const type = readField(record, 'depositType', 'deposit_type') || DEPOSIT_TYPES.MATERIALS_DELIVERY;
  if (type === DEPOSIT_TYPES.PERCENTAGE) {
    const pct = Number(readField(record, 'depositPercentage', 'deposit_percentage') || 0);
    const pretty = Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2);
    return `${pretty}% of total`;
  }
  return 'Materials + delivery';
}

// Returns true when the deposit on this quote is a non-zero percentage.
export function isPercentageDeposit(record) {
  if (!record) return false;
  return (readField(record, 'depositType', 'deposit_type') || DEPOSIT_TYPES.MATERIALS_DELIVERY)
    === DEPOSIT_TYPES.PERCENTAGE;
}
