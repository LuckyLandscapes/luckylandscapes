import { NextResponse } from 'next/server';

// GET /api/parcel/lookup?lat=&lng=
// Returns the parcel polygon containing (lat,lng) by querying public Nebraska
// GIS services. Tries Lancaster County (Lincoln) first because it has the
// freshest data for our primary service area, then falls back to the
// state-wide tax-parcels FeatureServer for outlying counties.
//
// Response shape on success:
//   { ok: true, parcel: { rings: [[{lat,lng}, ...], ...], attributes: {...}, source } }
// On miss (point lies outside any parcel polygon): { ok: false, miss: true }
// On error: { ok: false, error }
//
// All sources are public, free, and operated by Nebraska state / Lancaster
// County government. No API key required.

const SOURCES = [
  {
    id: 'lancaster-co',
    label: 'Lancaster County (Lincoln)',
    url: 'https://gisext.lincoln.ne.gov/arcgis/rest/services/Assessor/Pub_Parcels/MapServer/0/query',
  },
  {
    id: 'ne-state',
    label: 'Nebraska statewide 2023',
    url: 'https://giscat.ne.gov/enterprise/rest/services/TaxParcels2023/FeatureServer/0/query',
  },
];

const REQUEST_TIMEOUT_MS = 8000;

function buildQuery(lat, lng) {
  // ArcGIS REST point-in-polygon spatial query. inSR/outSR=4326 keeps lat/lng
  // throughout so we don't have to projection-transform on the client.
  const params = new URLSearchParams({
    f: 'json',
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    resultRecordCount: '1',
  });
  return params.toString();
}

async function tryFetch(source, lat, lng) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${source.url}?${buildQuery(lat, lng)}`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    if (data?.error) return { ok: false, esriError: data.error };
    const feature = data?.features?.[0];
    if (!feature?.geometry?.rings) return { ok: false, miss: true };
    return { ok: true, feature };
  } catch (err) {
    return { ok: false, error: err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err)) };
  } finally {
    clearTimeout(timer);
  }
}

// Esri rings are [[ [x,y], [x,y], ... ], ...] where x=lng, y=lat when outSR=4326.
function ringsToLatLng(rings) {
  return rings
    .map(ring => ring.map(([x, y]) => ({ lat: y, lng: x })))
    .filter(r => r.length >= 3);
}

// Pull a small subset of likely-useful attributes so the UI can show owner +
// parcel id without lugging the full Esri attribute bag back to the client.
// Field names vary by source so we look for common synonyms.
function summarizeAttributes(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = raw[k] ?? raw[k.toUpperCase()] ?? raw[k.toLowerCase()];
      if (v != null && v !== '') return v;
    }
    return null;
  };
  return {
    parcelId: pick('PARCEL_ID', 'PARCELID', 'PIN', 'PROP_ID', 'GIS_PIN'),
    owner: pick('OWNER', 'OWNER_NAME', 'OWNER1', 'NAME'),
    address: pick('ADDRESS', 'SITUS_ADDR', 'SITE_ADDR', 'PROP_ADDR', 'PROPERTYADDRESS'),
    acres: pick('ACRES', 'GIS_ACRES', 'ACREAGE', 'LANDAREA'),
    legalDesc: pick('LEGAL_DESC', 'LEGAL', 'LEGALDESC'),
    county: pick('COUNTY', 'COUNTY_NAME', 'CO_NAME'),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: 'lat and lng query params are required' }, { status: 400 });
  }
  // Sanity range — Nebraska bounding box is roughly 40.0–43.0 lat, -104.1–-95.3 lng.
  // We don't hard-block outside NE since the user might be quoting a project
  // across the Iowa border, but we do block the obviously invalid case.
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ ok: false, error: 'lat/lng out of range' }, { status: 400 });
  }

  const errors = [];
  for (const source of SOURCES) {
    const result = await tryFetch(source, lat, lng);
    if (result.ok && result.feature) {
      const rings = ringsToLatLng(result.feature.geometry.rings);
      if (!rings.length) {
        errors.push({ source: source.id, error: 'no usable rings' });
        continue;
      }
      return NextResponse.json({
        ok: true,
        parcel: {
          rings,
          attributes: summarizeAttributes(result.feature.attributes),
          source: source.id,
          sourceLabel: source.label,
        },
      });
    }
    if (result.miss) {
      // Point fell outside this dataset's coverage — try next source.
      errors.push({ source: source.id, miss: true });
      continue;
    }
    errors.push({ source: source.id, error: result.error || result.esriError?.message || `status ${result.status}` });
  }

  // None of the sources had a parcel covering the point.
  const allMiss = errors.every(e => e.miss);
  if (allMiss) {
    return NextResponse.json({
      ok: false,
      miss: true,
      error: 'No parcel found at this location. Try centering closer to the property.',
    });
  }
  return NextResponse.json({
    ok: false,
    error: 'Parcel lookup services were unreachable.',
    details: errors,
  }, { status: 502 });
}
