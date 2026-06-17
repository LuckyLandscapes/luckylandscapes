// Shared address → maps helpers.
//
// One place that decides (1) how we format a postal address into a single
// human/queryable line, and (2) what URL opens that address in a maps app.
// Used by <AddressLink> and anywhere we need the raw URL (e.g. a "Navigate"
// button). Keeping the URL shape here means every "tap an address" surface in
// the app behaves identically.

/**
 * Format address parts (or pass a pre-built string through) into one line like
 * "123 Maple St, Lincoln NE 68502". Accepts either a string or an object with
 * any of { address, city, state, zip }. Missing pieces are skipped cleanly.
 */
export function formatAddress(input) {
  if (!input) return '';
  if (typeof input === 'string') return input.trim();
  const { address = '', city = '', state = '', zip = '' } = input;
  let s = (address || '').trim();
  if (city) s += (s ? ', ' : '') + city;
  if (state) s += (s ? ' ' : '') + state;
  if (zip) s += (s ? ' ' : '') + zip;
  return s.trim();
}

/**
 * Universal Google Maps deep link. Using the `?api=1&query=` form is the
 * cross-platform recommended shape: it opens the Google Maps app on iOS/Android
 * when installed (falling back to the browser / Apple Maps), and google.com/maps
 * on desktop — all with the address pre-filled and ready to navigate.
 * Returns '' when there's nothing to search so callers can guard on it.
 */
export function mapsHref(input) {
  const q = formatAddress(input);
  if (!q) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
