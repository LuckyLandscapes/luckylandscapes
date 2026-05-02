// CSV import/export for the materials catalog. Pure functions — no React,
// no Supabase. Imported by ImportMaterialsModal and the refresh CLI.

import { MATERIAL_UNITS, MATERIAL_CATEGORIES, STOCK_STATUSES, normalizeName } from './catalog';

// Columns the importer recognizes, in the order they appear in the template.
// Order matters for the export-to-CSV path; the import path uses headers, so
// users can omit columns they don't have data for.
export const CSV_COLUMNS = [
  'supplier_name',     // required — must match an existing supplier exactly
  'name',              // required
  'category',          // required — must match MATERIAL_CATEGORIES
  'subcategory',
  'sku',
  'unit',              // required — must match MATERIAL_UNITS
  'unit_cost',         // required (number, dollars; pre-tax)
  'tax_rate',          // optional (decimal e.g. 0.0725); blank = inherit from supplier
  'color',
  'texture',
  'coverage_per_unit',
  'description',       // customer-visible
  'image_url',
  'supplier_url',
  'supplier_url_alt',
  'notes',             // internal-only
  'stock_status',      // optional — must match STOCK_STATUSES
  'is_customer_visible', // optional — true/false (1/0/yes/no)
  'is_favorite',
];

// Header line the user pastes/uploads.
export function csvHeaderLine() {
  return CSV_COLUMNS.join(',');
}

// Generate a one-row example so the user can see what we expect.
export function csvTemplate() {
  const example = {
    supplier_name: 'Outdoor Solutions',
    name: 'Premium Black Mulch',
    category: 'Mulch',
    subcategory: 'Dyed',
    sku: 'BLK-001',
    unit: 'cu yd',
    unit_cost: '35.00',
    tax_rate: '',           // blank = inherit
    color: 'Black',
    texture: 'Coarse',
    coverage_per_unit: '1 cu yd ≈ 100 sqft at 3" depth',
    description: 'Long-lasting dyed black mulch — color holds through fall.',
    image_url: '',
    supplier_url: 'https://outdoorsolutions-lincoln.com/product/premium-black-mulch/',
    supplier_url_alt: '',
    notes: 'Always in stock May–October.',
    stock_status: 'in_stock',
    is_customer_visible: 'true',
    is_favorite: 'false',
  };
  return [
    csvHeaderLine(),
    CSV_COLUMNS.map(c => csvField(example[c] ?? '')).join(','),
  ].join('\n');
}

// Quote a CSV field if it contains commas, quotes, or newlines.
function csvField(s) {
  const v = String(s ?? '');
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// Stream-tolerant single-line CSV parser. Handles quoted fields with
// commas, doubled quotes, and trailing whitespace. We keep this in-house
// rather than pulling in a CSV library — the format is small.
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

// Split text into logical CSV lines, respecting quoted newlines.
function splitCsvText(text) {
  const lines = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQ = !inQ; cur += ch; continue; }
    if ((ch === '\n' || ch === '\r') && !inQ) {
      if (cur.length > 0) { lines.push(cur); cur = ''; }
      // skip a paired \r\n
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

// Parse CSV text → array of objects keyed by header. Returns
// { rows: [...], headers: [...], errors: [{ row, message }] }.
export function parseCsv(text) {
  const lines = splitCsvText((text || '').trim());
  if (lines.length === 0) return { rows: [], headers: [], errors: [{ row: 0, message: 'Empty file' }] };

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  const errors = [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length === 1 && cells[0] === '') continue; // skip blank lines
    const row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }
  return { rows, headers, errors };
}

// Coerce a CSV-string boolean.
function toBool(v, fallback) {
  if (v == null || v === '') return fallback;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return fallback;
}

// Validate raw CSV rows against the suppliers list and convert each into
// a payload the bulkUpsertMaterials API accepts. Returns:
//   {
//     ok: array of { rowIndex, payload, matchKey },
//     errors: array of { rowIndex, name, message }
//   }
//
// rowIndex is 1-based and aligns with the user's original spreadsheet row
// (the header is row 0, first data row is rowIndex 1).
export function validateRows(rawRows, suppliers) {
  const supplierByName = new Map();
  (suppliers || []).forEach(s => supplierByName.set(s.name.toLowerCase(), s));

  const ok = [];
  const errors = [];

  rawRows.forEach((r, i) => {
    const rowIndex = i + 1;
    const name = (r.name || '').trim();
    const supplierName = (r.supplier_name || '').trim();
    const category = (r.category || '').trim();
    const unit = (r.unit || '').trim();

    if (!name) { errors.push({ rowIndex, name: '(blank)', message: 'name is required' }); return; }
    if (!supplierName) { errors.push({ rowIndex, name, message: 'supplier_name is required' }); return; }

    const supplier = supplierByName.get(supplierName.toLowerCase());
    if (!supplier) {
      errors.push({ rowIndex, name, message: `supplier "${supplierName}" doesn't exist — create it first on the Suppliers screen` });
      return;
    }

    if (!category) { errors.push({ rowIndex, name, message: 'category is required' }); return; }
    if (!MATERIAL_CATEGORIES.includes(category)) {
      errors.push({ rowIndex, name, message: `category "${category}" not recognized; must be one of ${MATERIAL_CATEGORIES.join(', ')}` });
      return;
    }

    if (!unit) { errors.push({ rowIndex, name, message: 'unit is required' }); return; }
    if (!MATERIAL_UNITS.includes(unit)) {
      errors.push({ rowIndex, name, message: `unit "${unit}" not recognized; must be one of ${MATERIAL_UNITS.join(', ')}` });
      return;
    }

    const unitCost = parseFloat(r.unit_cost);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      errors.push({ rowIndex, name, message: `unit_cost "${r.unit_cost}" is not a valid number` });
      return;
    }

    let taxRate = null;
    if (r.tax_rate != null && String(r.tax_rate).trim() !== '') {
      taxRate = parseFloat(r.tax_rate);
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
        errors.push({ rowIndex, name, message: `tax_rate "${r.tax_rate}" must be a decimal between 0 and 1 (e.g. 0.0725)` });
        return;
      }
    }

    let stockStatus = (r.stock_status || '').trim().toLowerCase() || 'unknown';
    if (!STOCK_STATUSES.includes(stockStatus)) {
      errors.push({ rowIndex, name, message: `stock_status "${r.stock_status}" must be one of ${STOCK_STATUSES.join(', ')}` });
      return;
    }

    const payload = {
      supplierId: supplier.id,
      name,
      category,
      subcategory: r.subcategory || null,
      sku: r.sku || null,
      unit,
      unitCost,
      taxRate,
      color: r.color || null,
      texture: r.texture || null,
      coveragePerUnit: r.coverage_per_unit || null,
      description: r.description || null,
      imageUrl: r.image_url || null,
      supplierUrl: r.supplier_url || null,
      supplierUrlAlt: r.supplier_url_alt || null,
      notes: r.notes || null,
      stockStatus,
      isCustomerVisible: toBool(r.is_customer_visible, true),
      isFavorite: toBool(r.is_favorite, false),
      isActive: true,
    };

    const matchKey = `${supplier.id}|${normalizeName(name)}`;
    ok.push({ rowIndex, payload, matchKey });
  });

  return { ok, errors };
}

// Project the parsed + validated rows into a dry-run summary the modal
// shows before applying. existingMaterials is the current `materials`
// array from useData() — used to determine "this is an update" vs "this
// is a new row".
export function dryRunSummary(validRows, existingMaterials) {
  const existingByKey = new Map();
  (existingMaterials || []).forEach(m => {
    const key = `${m.supplierId}|${normalizeName(m.name)}`;
    if (!existingByKey.has(key)) existingByKey.set(key, m);
  });

  const inserts = [];
  const updates = [];
  for (const r of validRows) {
    const existing = existingByKey.get(r.matchKey);
    if (existing) updates.push({ ...r, existingId: existing.id, existingName: existing.name });
    else inserts.push(r);
  }
  return { inserts, updates };
}
