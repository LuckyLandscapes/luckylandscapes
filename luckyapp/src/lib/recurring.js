// Recurring-billing pure helpers — safe to import from both client (the
// /recurring admin UI + /autopay consent page) and server (the cron + routes).
// NO Stripe / DB imports here so it never drags server-only deps into a client
// bundle. Money movement + card logic live in the cron and the API routes.

export const RECURRING_INTERVALS = [
  { key: 'weekly', label: 'Weekly', noun: 'week', days: 7 },
  { key: 'biweekly', label: 'Every 2 weeks', noun: '2 weeks', days: 14 },
  { key: 'monthly', label: 'Monthly', noun: 'month', days: null }, // calendar month, not fixed days
];

export function intervalMeta(key) {
  return RECURRING_INTERVALS.find(i => i.key === key) || RECURRING_INTERVALS[0];
}

export function intervalLabel(key) {
  return intervalMeta(key).label;
}

// The noun used in "$55 every <week>" phrasing.
export function intervalNoun(key) {
  return intervalMeta(key).noun;
}

// The adverb used in "charge $166.67 <monthly>" phrasing.
export function intervalAdverb(key) {
  if (key === 'monthly') return 'monthly';
  if (key === 'biweekly') return 'every 2 weeks';
  return 'weekly';
}

function round2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

function fmtUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

// "$55.00 every week" — used in plan cards + the consent language.
export function describeCadence(amount, interval) {
  return `${fmtUSD(amount)} every ${intervalNoun(interval)}`;
}

// Parse a 'YYYY-MM-DD' as local noon (avoids the UTC-midnight off-by-one that
// bites date-only strings) and return a Date.
function parseDateOnly(dateStr) {
  if (dateStr instanceof Date) return new Date(dateStr);
  const s = String(dateStr || '');
  return new Date(s.includes('T') ? s : `${s}T12:00:00`);
}

function toDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Advance a date-only string by one interval. Weekly/biweekly add fixed days;
// monthly adds a calendar month and clamps (Jan 31 -> Feb 28/29).
export function addInterval(dateStr, interval) {
  const d = parseDateOnly(dateStr);
  const meta = intervalMeta(interval);
  if (meta.days) {
    d.setDate(d.getDate() + meta.days);
    return toDateOnly(d);
  }
  // monthly
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInMonth));
  return toDateOnly(d);
}

// ─── Fixed-term contracts ────────────────────────────────────────────────
// "$2,000 for the year, billed monthly" → contractAmount 2000, totalPeriods 12.
// 2000/12 = 166.6666…, so we bill $166.67 for the first 11 and $166.63 on the
// final one. Never charge more than the agreed total — it's a signed contract.

/** The per-period amount for periods 1..n-1 (rounded to cents). */
export function perPeriodAmount(contractAmount, totalPeriods) {
  const total = Number(contractAmount) || 0;
  const n = Number(totalPeriods) || 0;
  if (n <= 0) return 0;
  return round2(total / n);
}

/** The final period absorbs the rounding remainder so the sum is exact. */
export function finalPeriodAmount(contractAmount, totalPeriods) {
  const total = Number(contractAmount) || 0;
  const n = Number(totalPeriods) || 0;
  if (n <= 0) return 0;
  if (n === 1) return round2(total);
  return round2(total - perPeriodAmount(total, n) * (n - 1));
}

/** True when the plan has a fixed term (vs. billing until cancelled). */
export function isFixedTerm(plan) {
  const n = Number(plan?.total_periods ?? plan?.totalPeriods) || 0;
  const amt = Number(plan?.contract_amount ?? plan?.contractAmount) || 0;
  return n > 0 && amt > 0;
}

/**
 * What to charge on the plan's NEXT run. Accepts snake_case (cron/DB) or
 * camelCase (UI) plans. On the last period of a fixed term this returns the
 * exact remainder so total charges == contract_amount.
 */
export function amountForNextCharge(plan) {
  const base = Number(plan?.amount) || 0;
  if (!isFixedTerm(plan)) return base;
  const n = Number(plan.total_periods ?? plan.totalPeriods) || 0;
  const billed = Number(plan.periods_billed ?? plan.periodsBilled) || 0;
  const total = Number(plan.contract_amount ?? plan.contractAmount) || 0;
  return billed >= n - 1 ? finalPeriodAmount(total, n) : base;
}

/** Progress for the UI: { billed, total, billedAmount, contractAmount, done }. */
export function planProgress(plan) {
  const billed = Number(plan?.periods_billed ?? plan?.periodsBilled) || 0;
  if (!isFixedTerm(plan)) return { billed, total: null, done: false };
  const total = Number(plan.total_periods ?? plan.totalPeriods) || 0;
  const contractAmount = Number(plan.contract_amount ?? plan.contractAmount) || 0;
  const per = Number(plan.amount) || 0;
  const billedAmount = billed >= total ? contractAmount : round2(per * billed);
  return { billed, total, billedAmount, contractAmount, done: billed >= total };
}

/** "12 monthly payments of $166.67 · $2,000.00 total" */
export function describePlanTerm(plan) {
  if (!isFixedTerm(plan)) return describeCadence(plan?.amount, plan?.interval);
  const n = Number(plan.total_periods ?? plan.totalPeriods) || 0;
  const total = Number(plan.contract_amount ?? plan.contractAmount) || 0;
  return `${n} ${intervalAdverb(plan.interval)} payments of ${fmtUSD(plan.amount)} · ${fmtUSD(total)} total`;
}

// The exact authorization sentence the customer agrees to when saving a card.
// Stored on the plan (authorization_text) as the consent record.
export function authorizationText({ amount, interval, title, totalPeriods, contractAmount, business = 'Lucky Landscapes' }) {
  const n = Number(totalPeriods) || 0;
  const total = Number(contractAmount) || 0;
  if (n > 0 && total > 0) {
    return `I authorize ${business} to automatically charge my saved payment method ${fmtUSD(amount)} ${intervalAdverb(interval)} for ${n} payments for "${title}", totaling ${fmtUSD(total)}. Charges stop automatically after the final payment. I can cancel anytime by contacting ${business} at (402) 405-5475.`;
  }
  return `I authorize ${business} to automatically charge my saved payment method ${describeCadence(amount, interval)} for "${title}" until I cancel. I understand I can cancel anytime by contacting ${business} at (402) 405-5475.`;
}
