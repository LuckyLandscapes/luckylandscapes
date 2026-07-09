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

// The exact authorization sentence the customer agrees to when saving a card.
// Stored on the plan (authorization_text) as the consent record.
export function authorizationText({ amount, interval, title, business = 'Lucky Landscapes' }) {
  return `I authorize ${business} to automatically charge my saved payment method ${describeCadence(amount, interval)} for "${title}" until I cancel. I understand I can cancel anytime by contacting ${business} at (402) 405-5475.`;
}
