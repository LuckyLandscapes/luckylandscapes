// CSV import for backfilling completed jobs and expenses tracked outside
// the app (typically a Google Sheet). Pure functions — no React, no
// Supabase. Imported by ImportHistoricalJobsModal and
// ImportHistoricalExpensesModal.
//
// Two separate flows share the same parseCsv + dry-run pattern:
//   - Historical jobs: 1 row per completed job. Optional cost columns
//     spawn matching job_expenses rows. Customer matched by name; created
//     if missing.
//   - Historical expenses: 1 row per overhead expense. Lands in
//     company_expenses (overhead). Per-job expense backfill is intentionally
//     NOT supported here — match by customer+date is too brittle on legacy
//     data; if you want job-tagged costs, use the per-job expense UI.

// ─── Shared CSV parsing (lifted from csvCatalog so this file stands alone)

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let i = 0;
  let inQ = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQ = false; i += 1; continue;
      }
      cur += ch; i += 1; continue;
    }
    if (ch === ',') { out.push(cur); cur = ''; i += 1; continue; }
    if (ch === '"' && cur.length === 0) { inQ = true; i += 1; continue; }
    cur += ch; i += 1;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function splitCsvText(text) {
  const lines = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQ = !inQ; cur += ch; continue; }
    if ((ch === '\n' || ch === '\r') && !inQ) {
      if (cur.length > 0) { lines.push(cur); cur = ''; }
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

export function parseCsv(text) {
  const lines = splitCsvText((text || '').trim());
  if (lines.length === 0) return { rows: [], headers: [], errors: [{ row: 0, message: 'Empty file' }] };
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length === 1 && cells[0] === '') continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }
  return { rows, headers, errors: [] };
}

function csvField(s) {
  const v = String(s ?? '');
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function csvLine(cols, row) {
  return cols.map(c => csvField(row[c] ?? '')).join(',');
}

// ─── Shared coercion helpers

// Accept "$1,234.56", "1234.56", "1234", or blank. Returns null on blank,
// NaN on garbage so callers can detect.
function parseMoney(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const cleaned = s.replace(/[$,]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// Accept YYYY-MM-DD, M/D/YYYY, M/D/YY, MM/DD/YYYY. Returns ISO date
// (YYYY-MM-DD) string, or null on blank, or 'INVALID' on garbage.
function parseFlexibleDate(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // M/D/YYYY or MM/DD/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // M/D/YY → assume 20YY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `20${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return 'INVALID';
}

// Split "Riley Lucky" → { firstName: 'Riley', lastName: 'Lucky' }.
// Single-token names go to firstName.
function splitFullName(s) {
  const trimmed = String(s || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// ─── Historical Jobs

export const HISTORICAL_JOB_COLUMNS = [
  'date_completed',    // required
  'customer_name',     // required (full name; matched case-insensitively, created if missing)
  'title',             // required
  'revenue',           // required (number, dollars)
  'address',
  'description',
  'materials_cost',    // optional → job_expenses (category=materials)
  'equipment_cost',    // optional → job_expenses (category=equipment)
  'labor_cost',        // optional → job_expenses (category=other, "Labor (imported)")
  'other_cost',        // optional → job_expenses (category=other, "Other (imported)")
  'notes',             // → crew_notes
];

export function historicalJobsTemplate() {
  const example = {
    date_completed: '2025-08-14',
    customer_name: 'Jane Doe',
    title: 'Mulch refresh — front beds',
    revenue: '850.00',
    address: '1234 Sheridan Blvd, Lincoln NE 68502',
    description: 'Black mulch, 4 cu yd, edged 60 ft.',
    materials_cost: '140.00',
    equipment_cost: '',
    labor_cost: '180.00',
    other_cost: '',
    notes: 'Imported from 2025 Google Sheet',
  };
  return [
    HISTORICAL_JOB_COLUMNS.join(','),
    csvLine(HISTORICAL_JOB_COLUMNS, example),
  ].join('\n');
}

// Returns { ok: [{ rowIndex, payload, expenseSeeds, customerMatch }], errors }
// payload is the shape addJob expects (camelCase).
// expenseSeeds is an array of { category, description, amount } the caller
// will fan out to addJobExpense once the job has an id.
// customerMatch is { kind: 'existing', id } | { kind: 'new', firstName, lastName }
export function validateHistoricalJobRows(rawRows, customers) {
  const customersByName = new Map();
  (customers || []).forEach(c => {
    const key = `${(c.firstName || '').toLowerCase().trim()} ${(c.lastName || '').toLowerCase().trim()}`.trim();
    if (key && !customersByName.has(key)) customersByName.set(key, c);
  });

  const ok = [];
  const errors = [];

  rawRows.forEach((r, i) => {
    const rowIndex = i + 1;
    const customerName = (r.customer_name || '').trim();
    const title = (r.title || '').trim();

    if (!customerName) { errors.push({ rowIndex, name: '(blank)', message: 'customer_name is required' }); return; }
    if (!title) { errors.push({ rowIndex, name: customerName, message: 'title is required' }); return; }

    const dateCompleted = parseFlexibleDate(r.date_completed);
    if (!dateCompleted) { errors.push({ rowIndex, name: customerName, message: 'date_completed is required' }); return; }
    if (dateCompleted === 'INVALID') {
      errors.push({ rowIndex, name: customerName, message: `date_completed "${r.date_completed}" not recognized — use YYYY-MM-DD or M/D/YYYY` });
      return;
    }

    const revenue = parseMoney(r.revenue);
    if (revenue == null) { errors.push({ rowIndex, name: customerName, message: 'revenue is required' }); return; }
    if (Number.isNaN(revenue) || revenue < 0) {
      errors.push({ rowIndex, name: customerName, message: `revenue "${r.revenue}" is not a valid number` });
      return;
    }

    // Optional numeric costs
    const costFields = [
      ['materials_cost', 'materials', 'Materials (imported)'],
      ['equipment_cost', 'equipment', 'Equipment (imported)'],
      ['labor_cost', 'other', 'Labor (imported)'],
      ['other_cost', 'other', 'Other (imported)'],
    ];
    const expenseSeeds = [];
    let costError = null;
    for (const [col, category, label] of costFields) {
      const v = parseMoney(r[col]);
      if (v == null) continue;
      if (Number.isNaN(v) || v < 0) {
        costError = `${col} "${r[col]}" is not a valid number`;
        break;
      }
      if (v > 0) expenseSeeds.push({ category, description: label, amount: v });
    }
    if (costError) { errors.push({ rowIndex, name: customerName, message: costError }); return; }

    // Customer match
    const matchKey = customerName.toLowerCase();
    const existingCustomer = customersByName.get(matchKey);
    const customerMatch = existingCustomer
      ? { kind: 'existing', id: existingCustomer.id, label: customerName }
      : { kind: 'new', ...splitFullName(customerName), label: customerName };

    const payload = {
      title,
      status: 'completed',
      description: r.description || '',
      address: r.address || '',
      scheduledDate: dateCompleted,
      completedAt: `${dateCompleted}T12:00:00.000Z`,
      crewNotes: r.notes || '',
      total: revenue,
      revenue,
      assignedTo: [],
    };

    ok.push({ rowIndex, payload, expenseSeeds, customerMatch });
  });

  return { ok, errors };
}

export function summarizeHistoricalJobs(validRows) {
  const newCustomers = new Map();
  let totalExpenses = 0;
  validRows.forEach(r => {
    if (r.customerMatch.kind === 'new') {
      const key = `${r.customerMatch.firstName} ${r.customerMatch.lastName}`.trim().toLowerCase();
      if (!newCustomers.has(key)) newCustomers.set(key, r.customerMatch);
    }
    totalExpenses += r.expenseSeeds.length;
  });
  return {
    jobs: validRows.length,
    newCustomers: newCustomers.size,
    expenses: totalExpenses,
  };
}

// ─── Historical Expenses (overhead → company_expenses)

const COMPANY_EXPENSE_CATEGORIES = [
  'vehicle', 'insurance', 'rent', 'utilities', 'software', 'marketing',
  'office_supplies', 'fuel', 'payroll_tax', 'other',
];

const RECURRING_INTERVALS = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

export const HISTORICAL_EXPENSE_COLUMNS = [
  'date',                // required
  'category',            // required (must match company_expenses.category check)
  'amount',              // required
  'vendor',
  'description',
  'recurring',           // optional true/false
  'recurring_interval',  // optional weekly|biweekly|monthly|quarterly|yearly
];

export function historicalExpensesTemplate() {
  const example = {
    date: '2025-09-01',
    category: 'insurance',
    amount: '187.50',
    vendor: 'State Farm',
    description: 'Liability insurance — September',
    recurring: 'true',
    recurring_interval: 'monthly',
  };
  return [
    HISTORICAL_EXPENSE_COLUMNS.join(','),
    csvLine(HISTORICAL_EXPENSE_COLUMNS, example),
  ].join('\n');
}

function toBool(v, fallback) {
  if (v == null || v === '') return fallback;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return fallback;
}

export function validateHistoricalExpenseRows(rawRows) {
  const ok = [];
  const errors = [];

  rawRows.forEach((r, i) => {
    const rowIndex = i + 1;
    const date = parseFlexibleDate(r.date);
    const category = (r.category || '').trim().toLowerCase();
    const label = `${date || '?'} ${category || '?'}`;

    if (!date) { errors.push({ rowIndex, name: '(blank)', message: 'date is required' }); return; }
    if (date === 'INVALID') {
      errors.push({ rowIndex, name: label, message: `date "${r.date}" not recognized — use YYYY-MM-DD or M/D/YYYY` });
      return;
    }
    if (!category) { errors.push({ rowIndex, name: label, message: 'category is required' }); return; }
    if (!COMPANY_EXPENSE_CATEGORIES.includes(category)) {
      errors.push({ rowIndex, name: label, message: `category "${category}" not recognized; must be one of ${COMPANY_EXPENSE_CATEGORIES.join(', ')}` });
      return;
    }
    const amount = parseMoney(r.amount);
    if (amount == null) { errors.push({ rowIndex, name: label, message: 'amount is required' }); return; }
    if (Number.isNaN(amount) || amount < 0) {
      errors.push({ rowIndex, name: label, message: `amount "${r.amount}" is not a valid number` });
      return;
    }

    const recurring = toBool(r.recurring, false);
    let recurringInterval = (r.recurring_interval || '').trim().toLowerCase() || null;
    if (recurringInterval && !RECURRING_INTERVALS.includes(recurringInterval)) {
      errors.push({ rowIndex, name: label, message: `recurring_interval "${r.recurring_interval}" must be one of ${RECURRING_INTERVALS.join(', ')}` });
      return;
    }
    if (recurring && !recurringInterval) recurringInterval = 'monthly';
    if (!recurring) recurringInterval = null;

    ok.push({
      rowIndex,
      payload: {
        category,
        description: r.description || '',
        amount,
        date,
        vendor: r.vendor || null,
        recurring,
        recurringInterval,
      },
    });
  });

  return { ok, errors };
}
