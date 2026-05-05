**Last updated:** 2026-05-04
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
| Labor (wages + payroll tax + workers comp) | TODO % | Gross wages × ~13.6% employer burden (FICA 7.65 + FUTA 0.6 + NE SUTA 1.25 + WC ~5% est.). See [Labor cost & employer burden](#labor-cost--employer-burden) below. |
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
- **Operating bank:** Pinnacle Bank (*Personal Account*)
- **Payment processor:** Stripe (luckyapp integration)
- **Books / accounting:** None Yet, but will hopefully integrate into the luckyapp in the near future.
- **Tax preparer / CPA:** Need to figure this out ASAP, we are not LEGALLY COVERED for anything, have LLC AND EIN and have no clue what to do, We have not been paying ourselves.

## Labor cost & employer burden
For every $1 of W-2 gross wages, the business pays additional tax + insurance on top. Lucky uses these numbers in /team and in per-job profitability so margins reflect what the business actually spends:

| Component | Rate | Notes |
|---|---|---|
| FICA (employer side) | **7.65%** | Social Security 6.20% + Medicare 1.45%. Match for what's withheld from the employee. |
| FUTA (effective) | **0.6%** | 6.0% on first $7k/employee minus 5.4% state credit. Treated as flat for simplicity. |
| Nebraska SUTA | **1.25%** | NE new-employer rate, first $9k/employee. Re-rated by NE DoL after ~2 years of UI history. |
| Workers comp (NCCI 0042 — Landscape Gardening) | **~5% (estimate)** | Real number replaces this once Farm Bureau binds the policy. NE landscaping is typically 4–6%. Calc: `wcRatePer100 / 100 × experienceMod`. |
| **Total burden on W-2 wages** | **~13.6%** | Multiplier applied: gross × 1.136 ≈ true labor cost. |

**Where this lives in the app:**
- /team page → "Payroll Settings" button. WC carrier + rate + experience mod are editable per-org. Federal/state rates are constants in [`src/lib/finance.js`](../luckyapp/src/lib/finance.js) (`PAYROLL_BURDEN_CONSTANTS`).
- Per-job profitability ([`src/lib/finance.js`](../luckyapp/src/lib/finance.js) `jobFinancials`) and the P&L (`buildPnL`) both apply burden when `payrollSettings` is passed — which the data context now does by default.
- Per-team-member `payroll_classification` (migration 034) decides whether burden applies:
  - `w2_employee` (default) — full burden.
  - `1099_contractor` — vendor invoice, no employer tax. Issue 1099-NEC at year-end if paid ≥$600. Macoy fits here (paid through WE Media, a pre-existing media agency).
  - `owner_excluded` — LLC owner taking draws not wages. Riley fits here.

**What this does NOT do:** real paycheck withholding (federal income tax W-4 tables, employee SS/Medicare deductions, NE income tax). That's Gusto's job — see "Payroll / W-2" below.

## Tax tooling in luckyapp
The app provides starting points for tax filings — **none of it is a substitute for a CPA.**

- **Mileage log** ([`/mileage`](../luckyapp/src/app/(dashboard)/mileage/page.js)) — IRS Pub 463 compliant per-trip records (date, miles, purpose, addresses, optional odometer photos). Year-end CSV export. 2026 standard rate is $0.70/mi.
- **Contractors directory** ([`/contractors`](../luckyapp/src/app/(dashboard)/contractors/page.js)) — captures W-9 info (full SSN/EIN, address, classification) plus a photo of the signed W-9. Tag expenses to a contractor in the receipt modal so payments roll up.
- **Tax Center** ([`/tax`](../luckyapp/src/app/(dashboard)/tax/page.js)) — year-end 1099-NEC totals (flags ≥$600 contractors), a Schedule C line-by-line export, and a **federal 1040-ES quarterly banner** showing the next due date plus a rough YTD-net × 25% placeholder. Honors a configurable LLC start date (default 2026-03-01) so pre-formation income gets excluded from the LLC's Schedule C.
- **Schedule C mapping** ([`src/lib/finance.js`](../luckyapp/src/lib/finance.js) `buildScheduleC`) — every internal expense category maps to a Schedule C line. The mapping is best-effort and overridable at year-end.

> **Quarterly tax placeholder caveat:** the 25% number on the Tax Center is a "set aside at least this" floor, not a calculation. The real number depends on filing status, total household income, deductions, and prior-year safe harbor. Use it to inform conversations with a CPA, not to actually pay.

### What luckyapp does NOT do (and shouldn't)
- File 1099-NECs with the IRS — use Tax1099 or Track1099 ($5/form)
- Calculate self-employment tax (Schedule SE)
- Depreciate large equipment (Form 4562, §179, MACRS)
- *Actually* compute quarterly estimated tax — the Tax Center shows a rough placeholder (25% × YTD net) and the next due date (Q2 2026 = **2026-06-15**), but the real number requires a CPA
- Sales tax (NE applies it to some landscaping services — confirm with NE DoR + CPA)
- Payroll / W-2 — outsource to Gusto when first employee is hired

## Last full-year results
(First year in buisness we dont have anything to really show yet)
| Year | Revenue | Net | Notes |
|---|---|---|---|
| TODO | | | |

## Known financial issues / questions
I have no clue what our margins are, we have never paid ourselves. we are not sure what to do, you will be our accountant/CPA.

### Open items (2026-05)
- **Workers comp not bound yet.** Farm Bureau quote in motion. Until bound, the /team page uses a 5% placeholder for WC. **Bind before next shift** — uncovered W-2 employees in NE = personal liability + Class III misdemeanor per day.
- **Owner pay structure undecided.** Riley is currently `owner_excluded` (no wages, takes draws). Once cash flow allows, decide between (a) staying with draws as a single-member LLC and paying SE tax on Schedule C, or (b) electing S-corp status to split owner pay between W-2 wages and distributions (saves SE tax above ~$60k profit but adds payroll filing overhead). CPA call.
- **Macoy 1099 through WE Media.** Macoy is *not* legally a member of Lucky LLC despite the 30%-ownership shorthand in [`docs/company.md`](company.md). WE Media is a pre-existing arms-length media agency he owned before Lucky was formed. As a 1099 vendor invoicing for marketing/dev/sales, this is fine — but document the relationship in writing (services agreement) so the IRS has nothing to reclassify. CPA should confirm.
