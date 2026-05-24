// Single source of truth for all financial calculations.
// QuickBooks-style: Revenue → COGS → Gross Profit → OpEx → Net Profit.

// ─── Categories ─────────────────────────────────────────────
// COGS lives on job_expenses (direct, per-job costs)
export const COGS_CATEGORIES = ['materials', 'equipment', 'fuel', 'dump_fees', 'subcontractor', 'permits', 'other'];
export const COGS_LABELS = {
  materials: 'Materials',
  equipment: 'Equipment',
  fuel: 'Fuel',
  dump_fees: 'Dump Fees',
  subcontractor: 'Subcontractor',
  permits: 'Permits',
  other: 'Other',
};

// OpEx lives on company_expenses (overhead, not tied to a job)
export const OPEX_CATEGORIES = ['vehicle', 'insurance', 'rent', 'utilities', 'software', 'marketing', 'office_supplies', 'fuel', 'payroll_tax', 'other'];
export const OPEX_LABELS = {
  vehicle: 'Vehicle',
  insurance: 'Insurance',
  rent: 'Rent',
  utilities: 'Utilities',
  software: 'Software',
  marketing: 'Marketing',
  office_supplies: 'Office Supplies',
  fuel: 'Fuel',
  payroll_tax: 'Payroll Tax',
  other: 'Other',
};

export const RECURRING_INTERVALS = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

// ─── Schedule C line mapping ────────────────────────────────
// Best-effort default mapping from our internal category to the IRS
// Schedule C line a single-member LLC / sole prop would report it on.
// Year-end the user (or their CPA) can override per-line. Don't treat
// these as tax advice — they're starting points for a Schedule C export.
//
// See 2025 Schedule C (Form 1040). Part II = Expenses, Part III = COGS.
export const SCHEDULE_C_LINES = {
  // Part II (operating expenses)
  '8':   { label: 'Advertising', part: 'II' },
  '9':   { label: 'Car and truck expenses', part: 'II' },
  '11':  { label: 'Contract labor', part: 'II' },
  '13':  { label: 'Depreciation (Form 4562)', part: 'II' },
  '15':  { label: 'Insurance (other than health)', part: 'II' },
  '17':  { label: 'Legal and professional services', part: 'II' },
  '18':  { label: 'Office expense', part: 'II' },
  '20a': { label: 'Rent or lease — vehicles, machinery, equipment', part: 'II' },
  '20b': { label: 'Rent or lease — other (buildings)', part: 'II' },
  '21':  { label: 'Repairs and maintenance', part: 'II' },
  '22':  { label: 'Supplies', part: 'II' },
  '23':  { label: 'Taxes and licenses', part: 'II' },
  '24a': { label: 'Travel', part: 'II' },
  '25':  { label: 'Utilities', part: 'II' },
  '27a': { label: 'Other expenses', part: 'II' },
  // Part III (cost of goods sold)
  '36':  { label: 'Purchases (COGS)', part: 'III' },
  '38':  { label: 'Materials and supplies (COGS)', part: 'III' },
  '39':  { label: 'Other COGS', part: 'III' },
};

// COGS categories → Schedule C Part III lines.
// Materials and small tools roll through Part III for a service-with-supplies
// business like landscaping; large equipment ($2,500+ per IRS de minimis safe
// harbor) belongs on Form 4562 depreciation (Line 13) instead of Line 36.
export const COGS_TO_SCHEDULE_C = {
  materials:     '38',
  equipment:     '36',  // small tools; large ones → Form 4562 (Line 13)
  fuel:          '9',
  dump_fees:     '39',
  subcontractor: '11',
  permits:       '23',
  other:         '39',
};

// OpEx categories → Schedule C Part II lines
export const OPEX_TO_SCHEDULE_C = {
  vehicle:         '9',
  insurance:       '15',
  rent:            '20b',
  utilities:       '25',
  software:        '18',
  marketing:       '8',
  office_supplies: '18',
  fuel:            '9',
  payroll_tax:     '23',
  other:           '27a',
};

// Direct labor (paid to W-2 employees) goes on Schedule C Line 26 (Wages).
// Direct labor paid to 1099 contractors goes on Line 11 (Contract labor) —
// our contractor model handles this separately via 1099 totals.
export const SCHEDULE_C_LINE_WAGES = '26';

// ─── Payroll burden (employer side only) ────────────────────
// What the BUSINESS pays on top of gross wages for a W-2 employee.
// These are federal/state law, not user-configurable. Update if rates
// change at the federal/state level.
//
// Simplifications worth knowing:
//   - FUTA is technically 6.0% on first $7k/employee minus 5.4% state credit
//     = 0.6% effective. We treat it as flat 0.6% of gross. For a $40k worker
//     this overstates FUTA by ~$198/yr; for job-cost honesty that's noise.
//   - SUTA is on first $9,000/employee in NE. We treat it as flat 1.25%
//     (NE new-employer rate). Once Lucky has 2+ years of UI history the
//     rate gets re-rated by NE DoL — update SUTA_NE_PCT then.
//   - Additional Medicare (0.9% over $200k wages) ignored — none of these
//     workers are anywhere near that threshold.
export const PAYROLL_BURDEN_CONSTANTS = {
  FICA_EMPLOYER_PCT:  0.0765,  // 6.20% Social Security + 1.45% Medicare
  FUTA_EFFECTIVE_PCT: 0.006,   // 0.6% effective after state credit
  SUTA_NE_NEW_PCT:    0.0125,  // 1.25% Nebraska new-employer rate
};

// Payroll classification — must match team_members.payroll_classification CHECK
export const PAYROLL_CLASSIFICATIONS = {
  w2_employee:     { label: 'W-2 Employee',     description: 'On payroll. Employer pays FICA + FUTA + SUTA + WC on top of gross.', burden: true,  schedC: 'wages' },
  '1099_contractor': { label: '1099 Contractor', description: 'Invoiced as outside vendor. No employer tax. Issue 1099-NEC at year-end if paid ≥$600.', burden: false, schedC: 'contract' },
  owner_excluded:  { label: 'Owner (excluded)', description: 'LLC owner taking draws/distributions, not wages. Not on payroll.', burden: false, schedC: 'none' },
};

// Org-level payroll settings. These live on organizations.settings.payroll
// (the existing JSONB column — no migration needed for the org table).
export const DEFAULT_PAYROLL_SETTINGS = {
  wcClassCode:      '0042',     // NCCI Landscape Gardening & Drivers
  wcRatePer100:     null,       // $/100 of payroll. Null = use estimate.
  wcExperienceMod:  1.00,       // New-business default. Carrier mod ~0.85-1.30 once they have claim history.
  wcCarrier:        '',         // 'Farm Bureau' once policy is bound.
  wcEstimatePct:    0.05,       // Placeholder used when wcRatePer100 is null.
};

export function getPayrollSettings(org) {
  const fromOrg = org?.settings?.payroll || {};
  return { ...DEFAULT_PAYROLL_SETTINGS, ...fromOrg };
}

// Compute the WC piece as a fraction of gross.
// Returns { pct, isEstimate } — pct is unit fraction (0.045 = 4.5%).
export function computeWcPct(payrollSettings) {
  const s = { ...DEFAULT_PAYROLL_SETTINGS, ...payrollSettings };
  if (s.wcRatePer100 != null && Number(s.wcRatePer100) > 0) {
    // wcRatePer100 is "$X per $100 of payroll" → unit fraction = X/100
    return {
      pct: (Number(s.wcRatePer100) / 100) * Number(s.wcExperienceMod || 1),
      isEstimate: false,
    };
  }
  return { pct: Number(s.wcEstimatePct) || 0, isEstimate: true };
}

// Compute the burden breakdown for a W-2 employee.
// Returns null for non-W-2 (1099, owner_excluded) — caller should treat
// burden as 0 for those.
export function computePayrollBurden(payrollSettings, classification = 'w2_employee') {
  if (classification !== 'w2_employee') return null;
  const wc = computeWcPct(payrollSettings);
  const { FICA_EMPLOYER_PCT, FUTA_EFFECTIVE_PCT, SUTA_NE_NEW_PCT } = PAYROLL_BURDEN_CONSTANTS;
  const totalPct = FICA_EMPLOYER_PCT + FUTA_EFFECTIVE_PCT + SUTA_NE_NEW_PCT + wc.pct;
  return {
    ficaPct:  FICA_EMPLOYER_PCT,
    futaPct:  FUTA_EFFECTIVE_PCT,
    sutaPct:  SUTA_NE_NEW_PCT,
    wcPct:    wc.pct,
    wcIsEstimate: wc.isEstimate,
    totalPct,
  };
}

// True hourly cost for a member: gross + employer burden (W-2 only).
// Returns { gross, burdenAmount, total, burdenPct, burden } where `burden`
// is the breakdown object (or null for non-W-2).
export function computeBurdenedHourlyRate(member, payrollSettings) {
  const gross = Number(member?.hourlyRate || 0);
  const classification = member?.payrollClassification || 'w2_employee';
  const burden = computePayrollBurden(payrollSettings, classification);
  if (!burden) return { gross, burdenAmount: 0, total: gross, burdenPct: 0, burden: null, classification };
  const burdenAmount = gross * burden.totalPct;
  return {
    gross,
    burdenAmount,
    total: gross + burdenAmount,
    burdenPct: burden.totalPct,
    burden,
    classification,
  };
}

// Burdened version of laborCostForJob.
// Drop-in replacement that loads `useBurden: true` to opt in. We keep the
// non-burdened `laborCostForJob` for callers that want raw gross.
export function laborCostForJobBurdened(jobId, timeEntries, teamMembers, timeSegments = [], payrollSettings = DEFAULT_PAYROLL_SETTINGS) {
  let total = 0;
  const memberMultiplier = (memberId) => {
    const m = teamMembers.find(x => x.id === memberId);
    if (!m) return { rate: 0, mult: 1 };
    const rate = Number(m.hourlyRate || 0);
    const burden = computePayrollBurden(payrollSettings, m.payrollClassification || 'w2_employee');
    return { rate, mult: burden ? 1 + burden.totalPct : 1 };
  };

  for (const seg of timeSegments) {
    if (seg.kind !== 'job' || seg.jobId !== jobId) continue;
    if (!seg.endedAt) continue;
    const entry = timeEntries.find(t => t.id === seg.timeEntryId);
    if (!entry) continue;
    const { rate, mult } = memberMultiplier(entry.teamMemberId || entry.memberId);
    total += rate * mult * (Number(seg.durationMinutes || 0) / 60);
  }

  const legacyEntries = timeEntries.filter(t =>
    t.jobId === jobId && t.clockIn && t.clockOut &&
    !timeSegments.some(s => s.timeEntryId === t.id)
  );
  for (const t of legacyEntries) {
    const { rate, mult } = memberMultiplier(t.teamMemberId || t.memberId);
    const totalHours = (new Date(t.clockOut) - new Date(t.clockIn)) / (1000 * 60 * 60);
    const breakHrs = Number(t.breakMinutes || 0) / 60;
    const paidHours = Math.max(0, totalHours - breakHrs);
    total += rate * mult * paidHours;
  }
  return total;
}

// ─── Period helpers ─────────────────────────────────────────
export function getPeriodRange(period, ref = new Date()) {
  const end = new Date(ref);
  const start = new Date(ref);
  const prevStart = new Date(ref);

  if (period === 'week') {
    start.setDate(start.getDate() - 7);
    prevStart.setDate(prevStart.getDate() - 14);
  } else if (period === 'quarter') {
    start.setMonth(start.getMonth() - 3);
    prevStart.setMonth(prevStart.getMonth() - 6);
  } else if (period === 'year') {
    start.setFullYear(start.getFullYear() - 1);
    prevStart.setFullYear(prevStart.getFullYear() - 2);
  } else if (period === 'ytd') {
    // Year-to-date — Jan 1 of the reference year through now. Used by the
    // quarterly tax estimator (which needs YTD net, not "trailing 12 months").
    start.setFullYear(start.getFullYear(), 0, 1);
    prevStart.setFullYear(prevStart.getFullYear() - 1, 0, 1);
  } else if (period === 'all') {
    start.setFullYear(1970, 0, 1);
    prevStart.setFullYear(1970, 0, 1);
  } else { // month (default)
    start.setMonth(start.getMonth() - 1);
    prevStart.setMonth(prevStart.getMonth() - 2);
  }
  start.setHours(0, 0, 0, 0);
  prevStart.setHours(0, 0, 0, 0);
  return { start, end, prevStart, prevEnd: start };
}

const inRange = (dateStr, start, end) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
};

// ─── Labor cost ─────────────────────────────────────────────
// Sum (paid hours × rate) across entries. Breaks are subtracted (unpaid).
//
// Segment-aware: when timeSegments are passed AND a given entry has
// segments, paid hours = sum of (job + travel) segment durations. Falls
// back to (clock_out - clock_in - break_minutes) for legacy entries
// without segments.
export function laborCostForEntries(entries, teamMembers, timeSegments = []) {
  let total = 0;
  for (const t of entries) {
    if (!t.clockIn || !t.clockOut) continue;
    const member = teamMembers.find(m => m.id === t.teamMemberId);
    const rate = Number(member?.hourlyRate || 0);
    const segs = timeSegments.filter(s => s.timeEntryId === t.id);
    let paidHours;
    if (segs.length > 0) {
      const paidMins = segs
        .filter(s => s.kind !== 'break')
        .reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
      paidHours = paidMins / 60;
    } else {
      const totalHours = (new Date(t.clockOut) - new Date(t.clockIn)) / (1000 * 60 * 60);
      const breakHrs = Number(t.breakMinutes || 0) / 60;
      paidHours = Math.max(0, totalHours - breakHrs);
    }
    total += rate * paidHours;
  }
  return total;
}

// ─── Labor cost attributed to a specific job ────────────────
// Uses 'job'-kind segments when available (lets one shift split labor across
// multiple properties accurately). Falls back to the legacy time_entry.job_id
// model for entries without segments.
export function laborCostForJob(jobId, timeEntries, teamMembers, timeSegments = []) {
  let total = 0;

  // 1. Segment-attributed labor
  for (const seg of timeSegments) {
    if (seg.kind !== 'job' || seg.jobId !== jobId) continue;
    if (!seg.endedAt) continue; // skip in-progress segments
    const entry = timeEntries.find(t => t.id === seg.timeEntryId);
    if (!entry) continue;
    const member = teamMembers.find(m => m.id === (entry.teamMemberId || entry.memberId));
    const rate = Number(member?.hourlyRate || 0);
    total += rate * (Number(seg.durationMinutes || 0) / 60);
  }

  // 2. Legacy fallback: time_entries with this jobId AND no segments at all
  const legacyEntries = timeEntries.filter(t =>
    t.jobId === jobId && t.clockIn && t.clockOut &&
    !timeSegments.some(s => s.timeEntryId === t.id)
  );
  total += laborCostForEntries(legacyEntries, teamMembers, []);
  return total;
}

// ─── Per-job financials ─────────────────────────────────────
// payrollSettings (5th arg) is optional. When passed, labor cost includes
// employer burden (FICA + FUTA + SUTA + WC) for W-2 members so the margin
// reflects what the business actually pays. Pre-existing callers that
// don't pass it still get raw gross-wage labor.
export function jobFinancials(job, jobExpenses, timeEntries, teamMembers, timeSegments = [], payrollSettings = null) {
  if (!job) return null;

  const expenses = jobExpenses.filter(e => e.jobId === job.id);
  // Entries we surface to the UI = any entry that touched this job (legacy
  // jobId match) or any entry that has a 'job' segment for this job.
  const entryIdsFromSegments = new Set(
    timeSegments.filter(s => s.kind === 'job' && s.jobId === job.id).map(s => s.timeEntryId)
  );
  const entries = timeEntries.filter(t =>
    (t.jobId === job.id || entryIdsFromSegments.has(t.id)) && t.clockIn && t.clockOut
  );

  const byCategory = {};
  for (const cat of COGS_CATEGORIES) byCategory[cat] = 0;
  for (const e of expenses) {
    const cat = COGS_CATEGORIES.includes(e.category) ? e.category : 'other';
    byCategory[cat] += Number(e.amount || 0);
  }

  const materialCosts = byCategory.materials;
  const equipmentCosts = byCategory.equipment;
  const otherExpenses = byCategory.fuel + byCategory.dump_fees + byCategory.subcontractor + byCategory.permits + byCategory.other;
  const laborCostsGross = laborCostForJob(job.id, timeEntries, teamMembers, timeSegments);
  const laborCostsBurdened = payrollSettings
    ? laborCostForJobBurdened(job.id, timeEntries, teamMembers, timeSegments, payrollSettings)
    : laborCostsGross;
  const laborBurdenAmount = laborCostsBurdened - laborCostsGross;
  const laborCosts = laborCostsBurdened;

  const revenue = Number(job.revenue || job.total || 0);
  const totalExpenses = materialCosts + equipmentCosts + otherExpenses + laborCosts;
  const profit = revenue - totalExpenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const totalBreakMinutes = entries.reduce((s, e) => s + Number(e.breakMinutes || 0), 0);

  return {
    revenue,
    materialCosts,
    equipmentCosts,
    otherExpenses,
    laborCosts,
    laborCostsGross,
    laborBurdenAmount,
    totalExpenses,
    profit,
    margin,
    expenses,
    entries,
    totalBreakMinutes,
    byCategory,
  };
}

// ─── P&L for a date range ───────────────────────────────────
// Cash-basis-ish: costs are recognized when they're incurred (segment ended,
// expense dated), not when the parent job completes. Otherwise mid-period
// dashboards understate spend on jobs still in progress, which silently hides
// labor and materials until completion.
//
// Revenue depends on basis:
//   - 'completed' (accrual): sum of completed-job revenue dated in period.
//   - 'paid' (cash):         sum of payments.amount with paid_at in period.
//                            This picks up deposits, partial payments, and
//                            anything that hit the bank — the prior behavior
//                            (only fully-paid invoices) silently dropped
//                            partial payments and quote deposits.
//
// Processor fees (Stripe / Square / etc.) come back as their own number so
// the UI can show them as a separate expense line rather than burying them
// in 'other'.
function pnlForRange({ jobs, jobExpenses, timeEntries, timeSegments = [], teamMembers, invoices, companyExpenses, payments = [], start, end, basis, payrollSettings = null }) {
  // Multiplier on a member's gross rate to include employer burden when
  // payrollSettings is provided. Returns 1.0 (no burden) when settings are
  // missing so legacy callers preserve behavior.
  const burdenMult = (memberId) => {
    if (!payrollSettings) return 1;
    const m = teamMembers.find(x => x.id === memberId);
    const burden = computePayrollBurden(payrollSettings, m?.payrollClassification || 'w2_employee');
    return burden ? 1 + burden.totalPct : 1;
  };
  // Revenue
  let revenue = 0;
  // Payment-method breakdown (used by both /finance and the Stripe-fee line).
  // Always built — cheap to compute and the UI uses it regardless of basis.
  //
  // Duplicate-flagged payments (where the webhook detected the invoice was
  // already paid and tagged the row "DUPLICATE" / "OVERPAYMENT" in notes) are
  // EXCLUDED from revenue + processor fees + payment-method breakdown. They
  // represent a charge that Riley needs to refund — counting them as revenue
  // would lie about real income until the refund posts. The audit row still
  // lives in the payments table so the invoice detail page can flag the
  // overpayment and let Riley delete it.
  const isDuplicateFlag = /DUPLICATE|OVERPAYMENT/i;
  const paymentsInRange = payments.filter(p =>
    (p.status === 'succeeded' || !p.status) &&
    inRange(p.paidAt || p.paid_at || p.createdAt, start, end) &&
    !isDuplicateFlag.test(p.notes || '')
  );
  const paymentsByMethod = {};
  let processorFees = 0;
  for (const p of paymentsInRange) {
    const method = p.method || 'other';
    paymentsByMethod[method] = (paymentsByMethod[method] || 0) + Number(p.amount || 0);
    processorFees += Number(p.processorFee || p.processor_fee || 0);
  }
  const paymentsTotal = Object.values(paymentsByMethod).reduce((a, b) => a + b, 0);

  if (basis === 'paid') {
    // Cash basis: every dollar that hit the bank counts, regardless of whether
    // it was a deposit, partial payment, or fully closed invoice.
    revenue = paymentsTotal;
  }
  // periodJobs is the per-job drill-down list (used by /reports). Always
  // completed jobs in range, regardless of basis.
  const periodJobs = jobs.filter(j => j.status === 'completed' && inRange(j.completedAt, start, end));
  if (basis !== 'paid') {
    for (const j of periodJobs) revenue += Number(j.revenue || j.total || 0);
  }

  // COGS — job_expenses dated in period (any job, completed or not)
  const cogsByCat = {};
  for (const cat of COGS_CATEGORIES) cogsByCat[cat] = 0;
  for (const e of jobExpenses) {
    if (!inRange(e.date || e.createdAt, start, end)) continue;
    const cat = COGS_CATEGORIES.includes(e.category) ? e.category : 'other';
    cogsByCat[cat] += Number(e.amount || 0);
  }

  // Direct labor — closed job-kind segments dated in period (any job).
  // Plus legacy entries with a jobId, clocked out, no segments.
  let directLabor = 0;
  for (const seg of timeSegments) {
    if (seg.kind !== 'job' || !seg.endedAt) continue;
    if (!inRange(seg.startedAt, start, end)) continue;
    const entry = timeEntries.find(t => t.id === seg.timeEntryId);
    const memberId = entry?.teamMemberId || entry?.memberId;
    const member = teamMembers.find(m => m.id === memberId);
    const rate = Number(member?.hourlyRate || 0);
    directLabor += rate * burdenMult(memberId) * (Number(seg.durationMinutes || 0) / 60);
  }
  const legacyDirect = timeEntries.filter(t =>
    t.jobId && t.clockIn && t.clockOut && inRange(t.clockIn, start, end) &&
    !timeSegments.some(s => s.timeEntryId === t.id)
  );
  for (const t of legacyDirect) {
    const memberId = t.teamMemberId || t.memberId;
    const member = teamMembers.find(m => m.id === memberId);
    const rate = Number(member?.hourlyRate || 0);
    const totalHours = (new Date(t.clockOut) - new Date(t.clockIn)) / (1000 * 60 * 60);
    const breakHrs = Number(t.breakMinutes || 0) / 60;
    directLabor += rate * burdenMult(memberId) * Math.max(0, totalHours - breakHrs);
  }

  const cogs = Object.values(cogsByCat).reduce((a, b) => a + b, 0) + directLabor;

  // OpEx — company expenses dated in period + indirect labor.
  // With segments, "indirect labor" = travel-kind segments (driving/yard time).
  // For legacy entries without segments, indirect = entries with no jobId.
  const opexByCat = {};
  for (const cat of OPEX_CATEGORIES) opexByCat[cat] = 0;
  for (const e of companyExpenses) {
    if (!inRange(e.date || e.createdAt, start, end)) continue;
    const cat = OPEX_CATEGORIES.includes(e.category) ? e.category : 'other';
    opexByCat[cat] += Number(e.amount || 0);
  }

  let indirectLabor = 0;
  for (const seg of timeSegments) {
    if (seg.kind !== 'travel' || !seg.endedAt) continue;
    if (!inRange(seg.startedAt, start, end)) continue;
    const entry = timeEntries.find(t => t.id === seg.timeEntryId);
    const memberId = entry?.teamMemberId || entry?.memberId;
    const member = teamMembers.find(m => m.id === memberId);
    const rate = Number(member?.hourlyRate || 0);
    indirectLabor += rate * burdenMult(memberId) * (Number(seg.durationMinutes || 0) / 60);
  }
  const legacyIndirect = timeEntries.filter(t =>
    !t.jobId && t.clockIn && t.clockOut && inRange(t.clockIn, start, end) &&
    !timeSegments.some(s => s.timeEntryId === t.id)
  );
  for (const t of legacyIndirect) {
    const memberId = t.teamMemberId || t.memberId;
    const member = teamMembers.find(m => m.id === memberId);
    const rate = Number(member?.hourlyRate || 0);
    const totalHours = (new Date(t.clockOut) - new Date(t.clockIn)) / (1000 * 60 * 60);
    const breakHrs = Number(t.breakMinutes || 0) / 60;
    indirectLabor += rate * burdenMult(memberId) * Math.max(0, totalHours - breakHrs);
  }
  // Processor fees count as an operating expense — Stripe/Square skim off the
  // top of every card/ACH payment. Showing them as a P&L line keeps the
  // "money in" and "money kept" numbers honest. (They show up here regardless
  // of basis so accrual P&Ls also see the real net cost of accepting cards.)
  const opex = Object.values(opexByCat).reduce((a, b) => a + b, 0) + indirectLabor + processorFees;

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    revenue,
    cogs, cogsByCat, directLabor,
    grossProfit, grossMargin,
    opex, opexByCat, indirectLabor, processorFees,
    netProfit, netMargin,
    paymentsByMethod, paymentsTotal, paymentsInRange,
    periodJobs,
    revenueJobs: periodJobs,
  };
}

// Build full P&L plus prior-period comparison.
// payrollSettings (optional) — when passed, labor lines include employer
// burden (FICA + FUTA + SUTA + WC) so net margin reflects true labor cost.
// payments (optional) — required for cash-basis revenue + processor-fee
// expense line. When omitted, cash basis returns 0 and the processor-fee
// line is hidden (back-compat with callers that haven't been updated yet).
export function buildPnL({ jobs, jobExpenses, timeEntries, timeSegments = [], teamMembers, invoices, companyExpenses, payments = [], period = 'month', basis = 'completed', payrollSettings = null }) {
  const { start, end, prevStart, prevEnd } = getPeriodRange(period);
  const args = { jobs, jobExpenses, timeEntries, timeSegments, teamMembers, invoices, companyExpenses, payments, basis, payrollSettings };
  const current = pnlForRange({ ...args, start, end });
  const previous = pnlForRange({ ...args, start: prevStart, end: prevEnd });
  return { ...current, range: { start, end }, previous };
}

// ─── A/R aging ──────────────────────────────────────────────
export function buildARAging(invoices, today = new Date()) {
  const buckets = { current: [], days30: [], days60: [], days90: [], days90plus: [] };
  for (const inv of invoices) {
    if (inv.status === 'paid' || inv.status === 'cancelled') continue;
    const balance = Number(inv.total || 0) - Number(inv.amountPaid || 0);
    if (balance <= 0) continue;
    const due = inv.dueDate ? new Date(inv.dueDate + 'T12:00:00') : new Date(inv.createdAt || today);
    const daysOver = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    let key = 'current';
    if (daysOver > 90) key = 'days90plus';
    else if (daysOver > 60) key = 'days90';
    else if (daysOver > 30) key = 'days60';
    else if (daysOver > 0) key = 'days30';
    buckets[key].push({ ...inv, balance, daysOver });
  }
  const sum = (k) => buckets[k].reduce((s, i) => s + i.balance, 0);
  const totals = {
    current: sum('current'),
    days30: sum('days30'),
    days60: sum('days60'),
    days90: sum('days90'),
    days90plus: sum('days90plus'),
  };
  const totalAR = totals.current + totals.days30 + totals.days60 + totals.days90 + totals.days90plus;
  return { buckets, totals, totalAR };
}

export const AGING_LABELS = {
  current: 'Current',
  days30: '1–30 days',
  days60: '31–60 days',
  days90: '61–90 days',
  days90plus: '90+ days',
};

// ─── Misc helpers ───────────────────────────────────────────
export function fmtCurrency(n, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(Number(n) || 0);
}

export function pctChange(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function isInPeriod(dateStr, period, ref = new Date()) {
  const { start, end } = getPeriodRange(period, ref);
  return inRange(dateStr, start, end);
}

// ─── Schedule C aggregation ─────────────────────────────────
// Roll up COGS + OpEx + direct-contractor labor + mileage deduction into
// Schedule C lines for a tax year. `entityStartDate` lets us split the year
// for businesses that incorporated mid-year (e.g. LLC formed in March) —
// only entries on/after that date count for the LLC return; pre-formation
// activity belongs on a personal Schedule C as sole prop.
export function buildScheduleC({
  jobs = [],
  jobExpenses = [],
  companyExpenses = [],
  contractorPayments = [],
  mileageEntries = [],
  taxYear,
  entityStartDate = null,         // ISO date string or null
  mileageRate = 0.70,             // 2026 IRS standard mileage rate ($/mi)
} = {}) {
  const yearStart = new Date(`${taxYear}-01-01T00:00:00`);
  const yearEnd   = new Date(`${taxYear}-12-31T23:59:59`);
  const cutover   = entityStartDate ? new Date(`${entityStartDate}T00:00:00`) : yearStart;
  const start     = cutover > yearStart ? cutover : yearStart;
  const end       = yearEnd;

  const lines = {};
  const ensure = (line) => { if (!lines[line]) lines[line] = { line, label: SCHEDULE_C_LINES[line]?.label || line, part: SCHEDULE_C_LINES[line]?.part || 'II', amount: 0, sources: [] }; return lines[line]; };

  // 1. COGS — only against completed jobs in the period
  const periodJobs = jobs.filter(j => j.status === 'completed' && inRange(j.completedAt, start, end));
  const periodJobIds = new Set(periodJobs.map(j => j.id));
  for (const e of jobExpenses) {
    if (!periodJobIds.has(e.jobId)) continue;
    const cat = COGS_CATEGORIES.includes(e.category) ? e.category : 'other';
    const line = COGS_TO_SCHEDULE_C[cat] || '39';
    const row = ensure(line);
    row.amount += Number(e.amount || 0);
    row.sources.push({ type: 'job_expense', cat, amount: Number(e.amount || 0), id: e.id, date: e.date || e.createdAt });
  }

  // 2. OpEx — company_expenses dated in the period
  for (const e of companyExpenses) {
    if (!inRange(e.date || e.createdAt, start, end)) continue;
    const cat = OPEX_CATEGORIES.includes(e.category) ? e.category : 'other';
    const line = OPEX_TO_SCHEDULE_C[cat] || '27a';
    const row = ensure(line);
    row.amount += Number(e.amount || 0);
    row.sources.push({ type: 'company_expense', cat, amount: Number(e.amount || 0), id: e.id, date: e.date || e.createdAt });
  }

  // 3. Contract labor — Line 11 (1099 contractors paid in the period)
  for (const p of contractorPayments) {
    if (!inRange(p.paidDate || p.date || p.createdAt, start, end)) continue;
    const row = ensure('11');
    row.amount += Number(p.amount || 0);
    row.sources.push({ type: 'contractor_payment', amount: Number(p.amount || 0), id: p.id, contractorId: p.contractorId, date: p.paidDate || p.date });
  }

  // 4. Mileage — Line 9 (Car/truck), standard mileage method.
  // If the user is also tracking actual vehicle expenses (fuel/maint),
  // they must pick one method per vehicle. We surface both totals so they
  // can choose at year-end with their CPA.
  let mileageTotal = 0;
  let mileageMiles = 0;
  for (const m of mileageEntries) {
    if (!inRange(m.date, start, end)) continue;
    const miles = Number(m.miles || 0);
    mileageMiles += miles;
    mileageTotal += miles * mileageRate;
  }
  if (mileageMiles > 0) {
    // Don't auto-add to Line 9 (would double-count vehicle/fuel OpEx).
    // Surface separately so the export can show both methods.
  }

  const sorted = Object.values(lines).sort((a, b) => {
    if (a.part !== b.part) return a.part === 'III' ? 1 : -1;
    return a.line.localeCompare(b.line, undefined, { numeric: true });
  });

  const totalPartII  = sorted.filter(r => r.part === 'II').reduce((s, r) => s + r.amount, 0);
  const totalPartIII = sorted.filter(r => r.part === 'III').reduce((s, r) => s + r.amount, 0);

  return {
    taxYear,
    range: { start, end, entityStartDate: entityStartDate || null },
    lines: sorted,
    totalPartII,
    totalPartIII,
    mileage: { miles: mileageMiles, rate: mileageRate, deductionStandardMethod: mileageTotal },
  };
}

// ─── Insurance class-code split (workers' comp + general liability) ──
// WC premium  = payroll × (wcRatePer100 / 100) × experienceMod, per class code.
// GL premium  ≈ revenue × (glRatePer1000 / 1000), per class code.
// Masonry/hardscaping rates run far above lawn care, so without records that
// prove the split a carrier rates ALL payroll at the highest (masonry) code at
// audit. Classification is per JOB (jobs.wc_class); payroll is derived from
// clocked time (segments → job → the job's class) so the split traces back to
// original time records, which is what makes it audit-defensible.
//
// IMPORTANT: this is only as complete as the time-tracking data. A job with
// revenue but no clocked hours contributes revenue (GL basis) but $0 payroll
// (WC basis). The /insurance page says this out loud and lets Riley reconcile
// against actual payroll totals before sending anything to the carrier.

export const DEFAULT_WC_CLASSES = [
  { key: 'masonry',             label: 'Masonry / Hardscaping', code: '97447', desc: 'Pavers, retaining walls, patios, block, stone, outdoor living.', wcRatePer100: null, glRatePer1000: null },
  { key: 'landscape_gardening', label: 'Landscape Gardening',   code: '90747', desc: 'Planting, mulch, beds, grading, sod, design installs.',         wcRatePer100: null, glRatePer1000: null },
  { key: 'lawn_care',           label: 'Lawn Care',             code: '97050', desc: 'Mowing, edging, trimming, routine maintenance.',                wcRatePer100: null, glRatePer1000: null },
];

export const DEFAULT_WC_CLASS_KEY = 'landscape_gardening';

// Quote-builder category → default class key. Riley can override per job in
// the job edit modal. Unmatched categories fall back to landscape_gardening,
// mirroring how NCCI treats the general-landscaping catch-all.
export const CATEGORY_TO_WC_CLASS = {
  'Lawn Care':        'lawn_care',
  'Garden & Beds':    'landscape_gardening',
  'Hardscaping':      'masonry',
  'Landscape Design': 'landscape_gardening',
  'Cleanup':          'lawn_care',
  'Custom':           'landscape_gardening',
};

export function wcClassForCategory(category) {
  return CATEGORY_TO_WC_CLASS[category] || DEFAULT_WC_CLASS_KEY;
}

// Merge org overrides (organizations.settings.payroll.wcClasses) onto the
// defaults, matched by stable key. Lets Riley correct code numbers + plug in
// rates without losing structure. Extra keys (a 4th class he adds later) are
// appended after the defaults.
export function getWcClasses(org) {
  const overrides = org?.settings?.payroll?.wcClasses;
  if (!Array.isArray(overrides) || overrides.length === 0) return DEFAULT_WC_CLASSES.map(c => ({ ...c }));
  const byKey = new Map(DEFAULT_WC_CLASSES.map(c => [c.key, { ...c }]));
  for (const o of overrides) {
    if (!o?.key) continue;
    const base = byKey.get(o.key) || { key: o.key, label: o.key, code: '', desc: '', wcRatePer100: null, glRatePer1000: null };
    byKey.set(o.key, { ...base, ...o });
  }
  const ordered = [];
  for (const c of DEFAULT_WC_CLASSES) { if (byKey.has(c.key)) { ordered.push(byKey.get(c.key)); byKey.delete(c.key); } }
  for (const c of byKey.values()) ordered.push(c);
  return ordered;
}

const UNCLASSIFIED_KEY = '__unclassified__';

// Build the payroll + revenue split by insurance class code over [start, end].
// Payroll counts clocked job-time dated in range (segments preferred, legacy
// entries as fallback). Revenue counts completed jobs with completedAt in
// range. Travel/indirect labor and labor on jobs with no class land in
// "unallocated". Estimated premiums + WC savings only compute when rates are
// set on the classes (passed via wcClasses).
export function buildInsuranceClassReport({
  jobs = [], timeEntries = [], timeSegments = [], teamMembers = [],
  wcClasses = DEFAULT_WC_CLASSES, start, end, experienceMod = 1,
} = {}) {
  const classByKey = new Map(wcClasses.map(c => [c.key, c]));
  const jobById = new Map(jobs.map(j => [j.id, j]));
  const entryById = new Map(timeEntries.map(t => [t.id, t]));
  const rateById = new Map(teamMembers.map(m => [m.id, Number(m.hourlyRate || 0)]));
  const rateOf = (id) => rateById.get(id) || 0;
  const classOfJob = (job) => (job && job.wcClass) ? job.wcClass : UNCLASSIFIED_KEY;

  const buckets = {};
  const ensure = (key) => {
    if (!buckets[key]) buckets[key] = { key, payroll: 0, hours: 0, revenue: 0, jobIds: new Set(), memberIds: new Set() };
    return buckets[key];
  };
  for (const c of wcClasses) ensure(c.key);

  let unallocatedPayroll = 0, unallocatedHours = 0;

  // 1. Segment-attributed payroll (job-kind → class; travel → unallocated).
  for (const seg of timeSegments) {
    if (!seg.endedAt || !inRange(seg.startedAt, start, end)) continue;
    const entry = entryById.get(seg.timeEntryId);
    const memberId = entry?.teamMemberId || entry?.memberId;
    const hrs = Number(seg.durationMinutes || 0) / 60;
    const dollars = rateOf(memberId) * hrs;
    if (seg.kind === 'job' && seg.jobId) {
      const job = jobById.get(seg.jobId);
      const b = ensure(classOfJob(job));
      b.payroll += dollars; b.hours += hrs;
      if (job) b.jobIds.add(job.id);
      if (memberId) b.memberIds.add(memberId);
    } else if (seg.kind === 'travel') {
      unallocatedPayroll += dollars; unallocatedHours += hrs;
    }
    // break = unpaid, ignored
  }

  // 2. Legacy entries with no segments.
  const segEntryIds = new Set(timeSegments.map(s => s.timeEntryId));
  for (const t of timeEntries) {
    if (!t.clockIn || !t.clockOut || segEntryIds.has(t.id)) continue;
    if (!inRange(t.clockIn, start, end)) continue;
    const memberId = t.teamMemberId || t.memberId;
    const totalHours = (new Date(t.clockOut) - new Date(t.clockIn)) / (1000 * 60 * 60);
    const paidHours = Math.max(0, totalHours - Number(t.breakMinutes || 0) / 60);
    const dollars = rateOf(memberId) * paidHours;
    if (t.jobId) {
      const job = jobById.get(t.jobId);
      const b = ensure(classOfJob(job));
      b.payroll += dollars; b.hours += paidHours;
      if (job) b.jobIds.add(job.id);
      if (memberId) b.memberIds.add(memberId);
    } else {
      unallocatedPayroll += dollars; unallocatedHours += paidHours;
    }
  }

  // 3. Revenue — completed jobs dated in range, by class.
  for (const j of jobs) {
    if (j.status !== 'completed' || !inRange(j.completedAt, start, end)) continue;
    const b = ensure(classOfJob(j));
    b.revenue += Number(j.revenue || j.total || 0);
    b.jobIds.add(j.id);
  }

  // Rows: known classes first (in configured order), then any orphan keys
  // (a class removed after jobs were tagged), then unclassified last.
  const rows = [];
  const seen = new Set();
  const pushRow = (key) => {
    const b = buckets[key];
    if (!b) return;
    seen.add(key);
    const def = classByKey.get(key);
    const wcRate = def && Number(def.wcRatePer100) > 0 ? Number(def.wcRatePer100) : null;
    const glRate = def && Number(def.glRatePer1000) > 0 ? Number(def.glRatePer1000) : null;
    rows.push({
      key,
      label: def?.label || (key === UNCLASSIFIED_KEY ? 'Unclassified' : key),
      code: def?.code || '',
      desc: def?.desc || '',
      payroll: b.payroll,
      hours: b.hours,
      revenue: b.revenue,
      headcount: b.memberIds.size,
      jobCount: b.jobIds.size,
      wcRatePer100: wcRate,
      glRatePer1000: glRate,
      estWcPremium: wcRate != null ? (b.payroll / 100) * wcRate * experienceMod : null,
      estGlPremium: glRate != null ? (b.revenue / 1000) * glRate : null,
      isUnclassified: key === UNCLASSIFIED_KEY,
    });
  };
  for (const c of wcClasses) pushRow(c.key);
  for (const k of Object.keys(buckets)) { if (!seen.has(k) && k !== UNCLASSIFIED_KEY) pushRow(k); }
  if (buckets[UNCLASSIFIED_KEY]) pushRow(UNCLASSIFIED_KEY);

  const totals = {
    payroll: rows.reduce((s, r) => s + r.payroll, 0) + unallocatedPayroll,
    hours: rows.reduce((s, r) => s + r.hours, 0) + unallocatedHours,
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
  };

  // WC savings: split (each code at its own rate; unallocated + unclassified
  // payroll at the governing/highest rate — the auditor's default for un-split
  // time) vs. all-at-highest (no records). Only when every class has a rate.
  const wcRated = wcClasses.filter(c => Number(c.wcRatePer100) > 0);
  const maxWcRate = wcRated.length ? Math.max(...wcRated.map(c => Number(c.wcRatePer100))) : null;
  const wcRatesComplete = wcClasses.length > 0 && wcRated.length === wcClasses.length;
  let estWcPremiumSplit = null, estWcPremiumAllHighest = null, estWcSavings = null;
  if (wcRatesComplete) {
    const leftoverPayroll = unallocatedPayroll + (rows.find(r => r.isUnclassified)?.payroll || 0);
    estWcPremiumSplit = rows.reduce((s, r) => s + (r.estWcPremium || 0), 0)
      + (leftoverPayroll / 100) * maxWcRate * experienceMod;
    estWcPremiumAllHighest = (totals.payroll / 100) * maxWcRate * experienceMod;
    estWcSavings = estWcPremiumAllHighest - estWcPremiumSplit;
  }

  const glRated = wcClasses.filter(c => Number(c.glRatePer1000) > 0);
  const estGlPremiumTotal = rows.reduce((s, r) => s + (r.estGlPremium || 0), 0);

  return {
    rows,
    unallocated: { payroll: unallocatedPayroll, hours: unallocatedHours },
    totals,
    wc: {
      anyRate: wcRated.length > 0,
      ratesComplete: wcRatesComplete,
      maxRatePer100: maxWcRate,
      experienceMod,
      estPremiumSplit: estWcPremiumSplit,
      estPremiumAllHighest: estWcPremiumAllHighest,
      estSavings: estWcSavings,
    },
    gl: {
      anyRate: glRated.length > 0,
      ratesComplete: wcClasses.length > 0 && glRated.length === wcClasses.length,
      estPremiumTotal: glRated.length > 0 ? estGlPremiumTotal : null,
    },
    range: { start, end },
  };
}
