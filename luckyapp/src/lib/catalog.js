// Catalog helpers — pure functions, no React, no Supabase.
// Imported by both the catalog UI and the CSV importer.

// Lincoln/Lancaster County combined sales tax (state 5.5% + city 1.75%).
// This is the default we fall back to when neither the material nor its
// supplier specifies a tax rate. Confirmed 2026-05; refresh occasionally
// against revenue.nebraska.gov.
export const DEFAULT_TAX_RATE = 0.0725;

// Allowed material units. Drives the unit dropdown in MaterialFormModal and
// the CSV importer's validator. Add new units here only — don't ad-hoc them
// in the UI.
export const MATERIAL_UNITS = [
  'cu yd', 'ton', 'sqft', 'each', 'bag', 'pallet', 'ft', 'face ft', 'load',
];

// Material categories. Same rationale as units — single source of truth.
export const MATERIAL_CATEGORIES = [
  'Mulch', 'Rock', 'Pavers', 'Retaining Wall', 'Soil & Amendments',
  'Edging', 'Flagstone', 'Boulders', 'Sand & Gravel', 'Sod & Seed',
  'Pottery', 'Plants', 'Other',
];

export const STOCK_STATUSES = ['in_stock', 'low_stock', 'out_of_stock', 'unknown'];

// Resolve the effective tax rate for a material. Material override wins;
// otherwise falls back to the supplier's default; otherwise the org-wide
// default. Always returns a number, never null.
export function getEffectiveTaxRate(material, supplier) {
  if (material?.taxRate != null && Number.isFinite(Number(material.taxRate))) {
    return Number(material.taxRate);
  }
  if (supplier?.defaultTaxRate != null && Number.isFinite(Number(supplier.defaultTaxRate))) {
    return Number(supplier.defaultTaxRate);
  }
  return DEFAULT_TAX_RATE;
}

// Compute the actual cost basis of a material — what you'll pay including
// sales tax. Used by job costing and the catalog "Actual cost" line.
export function getMaterialActualCost(material, supplier) {
  const unitCost = Number(material?.unitCost ?? 0);
  if (!Number.isFinite(unitCost)) return 0;
  const rate = getEffectiveTaxRate(material, supplier);
  return unitCost * (1 + rate);
}

// Find the supplier object for a material from a suppliers array. Returns
// null if not found or if the material has no supplierId.
export function findMaterialSupplier(material, suppliers) {
  if (!material?.supplierId || !Array.isArray(suppliers)) return null;
  return suppliers.find(s => s.id === material.supplierId) || null;
}

// Normalise a material name for matching/de-duplication during bulk import.
// Lowercase, collapse whitespace, strip punctuation that customers don't
// type consistently.
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build the match key the bulk importer uses. Combines supplier and
// normalized name so "Premium Mulch" from OS doesn't collide with the same
// name from Menards.
export function buildMatchKey(material) {
  return `${material.supplierId || ''}|${normalizeName(material.name)}`;
}

// Format a USD amount for display. Cents-precise, with thousands separators.
export function formatCurrency(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// Convert a tax rate (0.0725) to a display percent ("7.25%").
export function formatTaxRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

// Snapshot a material into the shape stored in quote.selected_materials and
// contract.selected_materials. Strips internal-only fields and adds the
// quantity + timestamp the salesperson chose at selection time.
export function snapshotMaterialForQuote(material, quantity = 1, customerNotes = '') {
  return {
    materialId: material.id,
    name: material.name,
    category: material.category,
    subcategory: material.subcategory || null,
    imageUrl: material.imageUrl || null,
    color: material.color || null,
    texture: material.texture || null,
    coveragePerUnit: material.coveragePerUnit || null,
    description: material.description || null,
    unit: material.unit,
    quantity: Number(quantity) || 1,
    notes: customerNotes || null,
    snapshottedAt: new Date().toISOString(),
  };
}
