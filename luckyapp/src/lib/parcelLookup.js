// Client wrapper for the /api/parcel/lookup route. Returns a Promise that
// resolves to { ok: true, parcel } on hit, { ok: false, miss: true } when the
// point lies outside any parcel polygon, or { ok: false, error } on transport
// failure. Caller is responsible for showing a toast / building Google Maps
// overlays from the rings.

export async function lookupParcel({ lat, lng, signal } = {}) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { ok: false, error: 'lat and lng are required numbers' };
  }
  try {
    const url = `/api/parcel/lookup?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
    const res = await fetch(url, { signal, cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, error: `Bad response (${res.status})` };
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'aborted' };
    return { ok: false, error: err?.message || String(err) };
  }
}
