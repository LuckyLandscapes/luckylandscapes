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
export function jobFinancials(job, jobExpenses, timeEntries, teamMembers, timeSegments = []) {
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
  const laborCosts = laborCostForJob(job.id, timeEntries, teamMembers, timeSegments);

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
function pnlForRange({ jobs, jobExpenses, timeEntries, timeSegments = [], teamMembers, invoices, companyExpenses, start, end, basis }) {
  // Revenue
  let revenue = 0;
  let revenueJobs = [];
  if (basis === 'paid') {
    for (const inv of invoices) {
      if (inv.status !== 'paid') continue;
      if (!inRange(inv.paidDate || inv.createdAt, start, end)) continue;
      revenue += Number(inv.total || 0);
    }
  }
  // For COGS pairing we always use completed jobs in range (matching costs to the completion event).
  const periodJobs = jobs.filter(j => j.status === 'completed' && inRange(j.completedAt, start, end));
  if (basis !== 'paid') {
    for (const j of periodJobs) revenue += Number(j.revenue || j.total || 0);
    revenueJobs = periodJobs;
  }

  // COGS — direct expenses + direct labor on completed jobs in period
  const cogsByCat = {};
  for (const cat of COGS_CATEGORIES) cogsByCat[cat] = 0;
  let directLabor = 0;

  for (const job of periodJobs) {
    const expenses = jobExpenses.filter(e => e.jobId === job.id);
    for (const e of expenses) {
      const cat = COGS_CATEGORIES.includes(e.category) ? e.category : 'other';
      cogsByCat[cat] += Number(e.amount || 0);
    }
    directLabor += laborCostForJob(job.id, timeEntries, teamMembers, timeSegments);
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
  // Travel segments in the date range
  for (const seg of timeSegments) {
    if (seg.kind !== 'travel' || !seg.endedAt) continue;
    if (!inRange(seg.startedAt, start, end)) continue;
    const entry = timeEntries.find(t => t.id === seg.timeEntryId);
    const member = teamMembers.find(m => m.id === (entry?.teamMemberId || entry?.memberId));
    const rate = Number(member?.hourlyRate || 0);
    indirectLabor += rate * (Number(seg.durationMinutes || 0) / 60);
  }
  // Legacy entries with no jobId AND no segments
  const legacyIndirect = timeEntries.filter(t =>
    !t.jobId && t.clockIn && t.clockOut && inRange(t.clockIn, start, end) &&
    !timeSegments.some(s => s.timeEntryId === t.id)
  );
  indirectLabor += laborCostForEntries(legacyIndirect, teamMembers, []);
  const opex = Object.values(opexByCat).reduce((a, b) => a + b, 0) + indirectLabor;

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    revenue,
    cogs, cogsByCat, directLabor,
    grossProfit, grossMargin,
    opex, opexByCat, indirectLabor,
    netProfit, netMargin,
    periodJobs,
    revenueJobs: revenueJobs.length ? revenueJobs : periodJobs,
  };
}

// Build full P&L plus prior-period comparison.
export function buildPnL({ jobs, jobExpenses, timeEntries, timeSegments = [], teamMembers, invoices, companyExpenses, period = 'month', basis = 'completed' }) {
  const { start, end, prevStart, prevEnd } = getPeriodRange(period);
  const args = { jobs, jobExpenses, timeEntries, timeSegments, teamMembers, invoices, companyExpenses, basis };
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
