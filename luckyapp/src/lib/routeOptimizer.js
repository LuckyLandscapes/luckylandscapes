// Multi-stop route optimization helpers.
//
// Given N stops with addresses, find a near-optimal driving order using
// nearest-neighbor TSP heuristic on Haversine (great-circle) distances.
// For Lucky's typical workload (5–15 stops in/around Lincoln NE),
// nearest-neighbor produces routes ~5–10% longer than the true optimum
// — well inside the noise of "did we hit traffic?" — and runs instantly
// in the browser with zero API cost.
//
// Geocoding uses OpenStreetMap Nominatim (free, no key required, ~1
// req/sec rate limit). For Lincoln-area addresses with full street + city
// + state, accuracy is excellent. The User-Agent header is required by
// OSM's usage policy; we set a Lucky Landscapes identifier on every call.
//
// Why not Google Maps optimization? Google's Routes API has paid
// optimization (~$5/1000 calls), and the public Maps URL `optimize:true`
// parameter is undocumented and unreliable. The pure-JS path is free,
// works offline once geocoded, and is plenty good for Lincoln-scale work.

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'LuckyLandscapes/1.0 (luckylandscapes.com)';

// Compose a customer's address into a single string for geocoding.
export function composeAddress(c) {
  if (!c) return '';
  const parts = [c.address, c.city, c.state, c.zip].filter(Boolean);
  return parts.join(', ');
}

// Haversine distance in miles between two lat/lng points.
export function haversineMiles(latA, lonA, latB, lonB) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.7613; // Earth radius in miles
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const lat1 = toRad(latA);
  const lat2 = toRad(latB);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Nearest-neighbor TSP. `stops` is an array of { lat, lng, ...meta }.
// `startIdx` is the index of the starting stop (e.g. the shop). The
// returned `order` is an array of indices into the original `stops`
// array, starting with `startIdx` and visiting every other stop in
// nearest-unvisited order. `totalMiles` is the rough straight-line
// distance — actual driving distance will be 1.2–1.5× this for grid
// cities like Lincoln.
export function nearestNeighborTsp(stops, startIdx = 0) {
  if (!Array.isArray(stops) || stops.length === 0) return { order: [], totalMiles: 0 };
  const n = stops.length;
  const visited = new Array(n).fill(false);
  const order = [];
  let current = Math.max(0, Math.min(startIdx, n - 1));
  visited[current] = true;
  order.push(current);
  let totalMiles = 0;

  for (let step = 1; step < n; step++) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = haversineMiles(
        stops[current].lat, stops[current].lng,
        stops[i].lat, stops[i].lng,
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }
    if (nearest === -1) break;
    visited[nearest] = true;
    order.push(nearest);
    totalMiles += nearestDist;
    current = nearest;
  }

  return { order, totalMiles };
}

// Geocode a single address via Nominatim. Returns { lat, lng, displayName }
// or null if no match. The caller should throttle to ~1 req/sec to respect
// OSM's rate limit (we add a small delay in batch helpers).
export async function geocodeOSM(address) {
  if (!address || typeof address !== 'string') return null;
  const url = `${NOMINATIM_BASE}?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const top = data[0];
    const lat = parseFloat(top.lat);
    const lng = parseFloat(top.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: top.display_name };
  } catch (err) {
    console.warn('Nominatim geocode failed for', address, err);
    return null;
  }
}

// Geocode many addresses sequentially with a delay so we stay polite to
// Nominatim. Returns an array of { address, lat, lng, displayName, error }
// in input order. `onProgress` (optional) is called with (i, total).
export async function geocodeBatch(addresses, { delayMs = 1100, onProgress } = {}) {
  const out = [];
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    if (!addr) {
      out.push({ address: addr, lat: null, lng: null, error: 'empty' });
      onProgress?.(i + 1, addresses.length);
      continue;
    }
    if (i > 0) await new Promise(r => setTimeout(r, delayMs));
    const result = await geocodeOSM(addr);
    out.push(result
      ? { address: addr, ...result, error: null }
      : { address: addr, lat: null, lng: null, error: 'no_match' });
    onProgress?.(i + 1, addresses.length);
  }
  return out;
}

// Build a Google Maps deep link for a route. First stop is origin, last
// is destination, middle stops are waypoints in order. Works on both
// google.com/maps web and the iOS/Android Google Maps app.
export function googleMapsRouteUrl(orderedAddresses) {
  if (!Array.isArray(orderedAddresses) || orderedAddresses.length < 2) return null;
  const cleaned = orderedAddresses.filter(Boolean);
  if (cleaned.length < 2) return null;
  const origin = encodeURIComponent(cleaned[0]);
  const destination = encodeURIComponent(cleaned[cleaned.length - 1]);
  const waypoints = cleaned.slice(1, -1).map(encodeURIComponent).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${destination}`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}
