// Deep-link builders for the three suppliers we actually use, pre-filtered to
// Lincoln, NE stores. None of these vendors expose a free public stock API, so
// the catalog uses these URLs two ways:
//   1. Quick-look chips that open the supplier's own search page in a new tab.
//   2. As input to /api/catalog/lookup, which fetches the page server-side and
//      parses the JSON-LD block (price + availability) when present.

// Home Depot Lincoln stores. Numbers verified against homedepot.com/l/NE/Lincoln.
export const HOME_DEPOT_STORES = {
  southLincoln: { id: '3204', name: 'South Lincoln (6800 S 70th St)' },
  northLincoln: { id: '3209', name: 'North Lincoln (3300 N 27th St)' },
};

// Menards uses "yard" numbers in URLs. Lincoln South has historically been
// yard 3094; Lincoln North 3119. (Menards exposes these on storeAvailability.)
export const MENARDS_STORES = {
  southLincoln: { yard: '3094', name: 'Lincoln South' },
  northLincoln: { yard: '3119', name: 'Lincoln North' },
};

// Default we fall back to when no preference is set.
export const DEFAULT_HOME_DEPOT_STORE = HOME_DEPOT_STORES.southLincoln.id;
export const DEFAULT_MENARDS_YARD = MENARDS_STORES.southLincoln.yard;

function normalizeSupplier(s) {
  if (!s) return 'other';
  const l = s.toLowerCase();
  if (l.includes('home') || l.includes('depot')) return 'home-depot';
  if (l.includes('menard')) return 'menards';
  if (l.includes('outdoor')) return 'outdoor-solutions';
  return 'other';
}

// Build a search URL on the supplier's site for a free-text query.
// `storeId` is optional and only honored where the URL scheme supports it.
export function buildSupplierSearchUrl(supplier, query, storeId) {
  const q = encodeURIComponent((query || '').trim());
  if (!q) return null;
  switch (normalizeSupplier(supplier)) {
    case 'home-depot':
      // NCNI-5 = "no compare" view; storeId in path scopes results to that store.
      return `https://www.homedepot.com/s/${q}?NCNI-5${storeId ? `&storeId=${storeId}` : ''}`;
    case 'menards':
      return `https://www.menards.com/main/search.html?search=${q}${storeId ? `&store=${storeId}` : ''}`;
    case 'outdoor-solutions':
      // Outdoor Solutions has no e-comm site — fall back to a Google site search.
      return `https://www.google.com/search?q=site%3Aoutdoorsolutionsinc.com+${q}`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

// Build a direct product-page URL when we have a SKU/model number.
// Home Depot product URLs require the OMS ID (numeric); search by model is the
// closest reliable fallback. Menards exposes /p/.../{itemNumber}.htm.
export function buildSupplierProductUrl(supplier, sku, storeId) {
  if (!sku) return null;
  const s = encodeURIComponent(sku.trim());
  switch (normalizeSupplier(supplier)) {
    case 'home-depot':
      return `https://www.homedepot.com/s/${s}?NCNI-5${storeId ? `&storeId=${storeId}` : ''}`;
    case 'menards':
      return `https://www.menards.com/main/search.html?search=${s}${storeId ? `&store=${storeId}` : ''}`;
    default:
      return null;
  }
}

// Returns { name, url } objects for each supplier the catalog cares about,
// so the UI can render a row of "Find at..." chips next to a material.
export function getQuickSearchLinks(query) {
  if (!query || !query.trim()) return [];
  return [
    {
      key: 'home-depot',
      label: 'Home Depot',
      url: buildSupplierSearchUrl('Home Depot', query, DEFAULT_HOME_DEPOT_STORE),
    },
    {
      key: 'menards',
      label: 'Menards',
      url: buildSupplierSearchUrl('Menards', query, DEFAULT_MENARDS_YARD),
    },
    {
      key: 'outdoor-solutions',
      label: 'Outdoor Solutions',
      url: buildSupplierSearchUrl('Outdoor Solutions', query),
    },
  ];
}

export { normalizeSupplier };
