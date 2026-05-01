**Last updated:** 2026-04-30
**Confidence:** Partially Known

# Finances

> **Update cadence:** refresh this when you pull a new P&L or before any strategic conversation that needs real numbers. Drop CSV/PDF exports into `docs/exports/` and reference them here rather than retyping line-by-line.

## Revenue model
- **Recurring vs project mix (rough %):** Recurring (5%) vs Project (95%)
- **Top revenue line by service:** TODO (per service category if it varies)
- **Average ticket size:** Mulch jobs are usually around $800, Garden beds are usually around $1000, Hardscaping is usually around $5000.
- **Customer concentration:** Vary mixed bag most are single time customers, we have a mowing route in beatrice nebraska that has 14 customers.

## Cost structure
| Bucket | Approx % of revenue | Notes |
|---|---|---|
| Labor (wages + payroll tax(.2) + workers comp) | TODO | TODO |
| Materials (mulch, plants, stone, etc.) | TODO | TODO |
| Equipment (fuel, maintenance, depreciation) fuel is $750 a month, maintenance is around $150 a month, depreciation is around $200 a month | TODO | TODO |
| Vehicles | $800/month | TODO |
| Insurance | TODO | TODO |
| Software / subscriptions | $288/month | TODO |
| Marketing | ($2500/month + $500/month ) | TODO |
| Owner draw / $48,000 | TODO | TODO |
| Other overhead | shop rent $3500/month,  | TODO |

## Margin targets
- **Gross margin target (per job):** 30%
- **Net margin target (annual):** 20%
- **Where we tend to leak margin:** Not paying ourselves, Insurance, Payroll tax, workers comp, shop rent, overspending on materials, not charging enough for labor.

## Current snapshot
- **As of:** 4/27/2026
- **YTD revenue:** $14,000
- **YTD net:** $-1000
- **AR balance / 30/60/90 aging:** $3320 30 days (luckyapp computes this — see [`src/lib/finance.js`](../luckyapp/src/lib/finance.js) `buildARAging`)
- **Cash on hand:** $2000
- **Outstanding debt / equipment loans:** $1,200

## Banking & financial accounts
- **Operating bank:** Pinaccle Bank (*Personal Account*)
- **Payment processor:** Stripe (luckyapp integration)
- **Books / accounting:** None Yet, but will hopefully integrate into the luckyapp in the near future.
- **Tax preparer / CPA:** Need to figure this out ASAP, we are not LEGALLY COVERED for anything, have LLC AND EIN and have no clue what to do, We have not been paying ourselves.

## Tax tooling in luckyapp
The app provides starting points for tax filings — **none of it is a substitute for a CPA.**

- **Mileage log** ([`/mileage`](../luckyapp/src/app/(dashboard)/mileage/page.js)) — IRS Pub 463 compliant per-trip records (date, miles, purpose, addresses, optional odometer photos). Year-end CSV export. 2026 standard rate is $0.70/mi.
- **Contractors directory** ([`/contractors`](../luckyapp/src/app/(dashboard)/contractors/page.js)) — captures W-9 info (full SSN/EIN, address, classification) plus a photo of the signed W-9. Tag expenses to a contractor in the receipt modal so payments roll up.
- **Tax Center** ([`/tax`](../luckyapp/src/app/(dashboard)/tax/page.js)) — year-end 1099-NEC totals (flags ≥$600 contractors) and a Schedule C line-by-line export. Honors a configurable LLC start date (default 2026-03-01) so pre-formation income gets excluded from the LLC's Schedule C.
- **Schedule C mapping** ([`src/lib/finance.js`](../luckyapp/src/lib/finance.js) `buildScheduleC`) — every internal expense category maps to a Schedule C line. The mapping is best-effort and overridable at year-end.

### What luckyapp does NOT do (and shouldn't)
- File 1099-NECs with the IRS — use Tax1099 or Track1099 ($5/form)
- Calculate self-employment tax (Schedule SE)
- Depreciate large equipment (Form 4562, §179, MACRS)
- Quarterly estimated tax (1040-ES) — the next due date is **2026-06-15**
- Sales tax (NE applies it to some landscaping services — confirm with NE DoR + CPA)
- Payroll / W-2 — outsource to Gusto when first employee is hired

## Last full-year results
(First year in buisness we dont have anything to really show yet)
| Year | Revenue | Net | Notes |
|---|---|---|---|
| TODO | | | |

## Known financial issues / questions
I have no clue what our margins are, we have never paid ourselves. we are not sure what to do, you will be our accountant/CPA.
