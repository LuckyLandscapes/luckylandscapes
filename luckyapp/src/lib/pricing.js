// Customer-facing campaign DISCOUNT pricing — display-only savings.
//
// The setup (Riley's campaign): Lucky's regular rate on a line is the higher
// number (e.g. labor at $75/hr) and the discounted campaign price is what the
// customer actually pays (e.g. $60/hr). The salesperson stores the regular,
// pre-discount price in `item.listUnitPrice`; `item.unitPrice` stays the real
// charged (discounted) price. This is a genuine sale — $75 is a real rate
// Lucky charges off-campaign — so a struck "~~$75~~ $60" is truthful.
//
// CRITICAL: the discount is DISPLAY-ONLY. It NEVER changes the money.
//   - `item.total`   stays `unitPrice × quantity` (the real, discounted charge)
//   - `quote.total` / `invoice.total` and every deposit/payment/P&L number
//     are untouched — they only ever see `unitPrice`.
// The regular price only drives the strike-through + "you save" display.
//
// Because the field lives inside the existing `items` JSONB on both quotes
// and invoices, it needs no migration and rides through the public
// /api/{quotes,invoices}/public/[token] routes automatically.

/**
 * The market/list unit price for a line — but only when it's SET and strictly
 * higher than the actual price (otherwise there's no saving to show).
 * @returns {number|null}
 */
export function lineMarketUnitPrice(item) {
  const market = Number(item?.listUnitPrice);
  const actual = Number(item?.unitPrice) || 0;
  if (!Number.isFinite(market) || market <= actual) return null;
  return market;
}

/** True when this line has a real customer-visible saving. */
export function lineHasSavings(item) {
  return lineMarketUnitPrice(item) !== null && (Number(item?.quantity) || 0) > 0;
}

/** Dollar saving on a single line = (market − actual) × qty, floored at 0. */
export function lineSavings(item) {
  const market = lineMarketUnitPrice(item);
  if (market === null) return 0;
  const actual = Number(item?.unitPrice) || 0;
  const qty = Number(item?.quantity) || 0;
  return Math.max(0, (market - actual) * qty);
}

/** What the line "would" cost at the market rate (falls back to actual). */
export function lineMarketTotal(item) {
  const qty = Number(item?.quantity) || 0;
  const market = lineMarketUnitPrice(item);
  const actual = Number(item?.unitPrice) || 0;
  return (market !== null ? market : actual) * qty;
}

/**
 * Roll a line-item array up into everything a totals block needs.
 * `actualSubtotal` mirrors the existing Σ item.total math so it always agrees
 * with what the rest of the app computes.
 * @returns {{savings:number, actualSubtotal:number, marketSubtotal:number, hasSavings:boolean, pct:number}}
 */
export function computeSavings(items) {
  const list = Array.isArray(items) ? items : [];
  const savings = list.reduce((s, it) => s + lineSavings(it), 0);
  const actualSubtotal = list.reduce((s, it) => s + (Number(it?.total) || 0), 0);
  const marketSubtotal = actualSubtotal + savings;
  return {
    savings,
    actualSubtotal,
    marketSubtotal,
    hasSavings: savings > 0.005,
    pct: marketSubtotal > 0 ? Math.round((savings / marketSubtotal) * 100) : 0,
  };
}
