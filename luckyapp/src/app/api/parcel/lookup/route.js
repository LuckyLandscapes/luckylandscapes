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

// Verified live 2026-05-01. Both endpoints are public ArcGIS REST FeatureServers
// operated by NE government — no API key required.
const SOURCES = [
  {
    id: 'lancaster-co',
    label: 'Lancaster County (Lincoln)',
    url: 'https://gis.lincoln.ne.gov/public/rest/services/Assessor/TaxParcels/FeatureServer/0/query',
  },
  {
    id: 'ne-state',
    label: 'Nebraska statewide',
    url: 'https://giscat.ne.gov/enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0/query',
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
  // Field names confirmed against:
  //   Lancaster TaxParcels: OWNERNME1, SITEADDRESS, PARCELID, GIS_AREA(sqft),
  //                         PRPRTYDSCRP, RESYRBLT, RESFLRAREA, CNTASSDVAL
  //   NE StatewideParcelsExternal: Parcel_ID, Situs_Address (often blank),
  //                         Ph_Full_Address, GIS_Acres, County_ID, Subdivision
  return {
    parcelId: pick('PARCELID', 'Parcel_ID', 'PARCEL_ID', 'PIN', 'PROP_ID', 'LOWPARCELID'),
    owner: pick('OWNERNME1', 'OWNER', 'OWNER_NAME', 'OWNER1', 'NAME'),
    address: pick('SITEADDRESS', 'Situs_Address', 'Ph_Full_Address', 'ADDRESS', 'SITUS_ADDR', 'PROP_ADDR'),
    acres: pick('GIS_Acres', 'ACRES', 'GIS_ACRES', 'ACREAGE', 'Acres_Deeded'),
    legalDesc: pick('PRPRTYDSCRP', 'Legal_Description', 'LEGAL_DESC', 'LEGAL'),
    yearBuilt: pick('RESYRBLT', 'BuildingYear', 'YEARBUILT'),
    floorArea: pick('RESFLRAREA', 'ImpSF'),
    assessedValue: pick('CNTASSDVAL', 'Total_Assessed_Value', 'ASSESSED_VAL'),
    classification: pick('CLASSDSCRP', 'Property_SubClass', 'PRIMEUSE'),
    subdivision: pick('CNVYNAME', 'Subdivision'),
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
