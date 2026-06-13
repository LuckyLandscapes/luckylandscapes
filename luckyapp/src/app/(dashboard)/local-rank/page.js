'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '@/lib/data';
import {
  Crosshair, Search, Play, ExternalLink, AlertTriangle, Trash2,
  History, CheckCircle2, Globe, X, Loader2,
} from 'lucide-react';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const SCANS_KEY = 'lucky_local_rank_scans';
const MAX_SCANS = 40;
const LINCOLN_CENTER = { lat: 40.7980, lng: -96.6850 };

// Map-pack style queries — what people type when they want the map results.
// No city name needed: the per-point location bias does the localizing.
const GBP_KEYWORDS = [
  'landscaping company',
  'landscaper',
  'lawn care service',
  'paver patio installer',
  'retaining wall contractor',
  'landscape design',
];

// Organic SERP queries — these DO carry the city, like a real typed search.
const ORGANIC_PRESETS = [
  'landscaping lincoln ne',
  'landscapers lincoln ne',
  'lawn care lincoln ne',
  'paver patio lincoln ne',
  'retaining wall lincoln ne',
];

// Lincoln zips with rough area labels. Canonical names must match Google Ads
// geo-targets ("<zip>,Nebraska,United States") for the uule spoof to bite.
const ZIP_TARGETS = [
  { zip: 'Lincoln (city-wide)', canonical: 'Lincoln,Nebraska,United States', area: '' },
  { zip: '68516', area: 'SE — Pine Lake' },
  { zip: '68526', area: 'far SE — Cheney' },
  { zip: '68512', area: 'S — Old Cheney' },
  { zip: '68506', area: 'SE — College View' },
  { zip: '68510', area: 'E central' },
  { zip: '68520', area: 'far E — Walton' },
  { zip: '68505', area: 'E — Meadowlane' },
  { zip: '68502', area: 'near south' },
  { zip: '68508', area: 'downtown' },
  { zip: '68504', area: 'NE — Uni Place' },
  { zip: '68507', area: 'NE — Havelock' },
  { zip: '68521', area: 'NW — Belmont' },
  { zip: '68528', area: 'W — Air Park' },
  { zip: '68522', area: 'SW — West A' },
  { zip: '68523', area: 'far SW' },
];

// uule v1: "w+CAIQICI" + alphabet[len(canonical)] + base64(canonical).
// Verified against the canonical "West New York,New Jersey,United States" → 'm' example.
const UULE_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function uuleFor(canonical) {
  return 'w+CAIQICI' + UULE_ALPHA[canonical.length % 64] + encodeURIComponent(btoa(canonical));
}
function organicUrl(query, canonical) {
  // pws=0 kills personalization; num=30 shows 3 pages worth in one load
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&uule=${uuleFor(canonical)}&hl=en&gl=us&pws=0&num=30`;
}
function mapsSpotUrl(query, lat, lng) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat.toFixed(6)},${lng.toFixed(6)},14z`;
}

function buildGrid(center, size, spacingMiles) {
  const half = (size - 1) / 2;
  const latStep = spacingMiles / 69.0;
  const lngStep = spacingMiles / (69.0 * Math.cos((center.lat * Math.PI) / 180));
  const pts = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      pts.push({
        lat: center.lat + (half - r) * latStep,
        lng: center.lng + (c - half) * lngStep,
      });
    }
  }
  return pts;
}

function rankColor(rank) {
  if (!rank) return '#dc2626';        // not in top 20
  if (rank <= 3) return '#16a34a';    // map pack territory
  if (rank <= 10) return '#d97706';
  if (rank <= 20) return '#ea580c';
  return '#dc2626';
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function summarize(points) {
  const ranked = points.filter((p) => p.rank);
  return {
    total: points.length,
    found: ranked.length,
    top3: ranked.filter((p) => p.rank <= 3).length,
    avg: ranked.length ? ranked.reduce((s, p) => s + p.rank, 0) / ranked.length : null,
  };
}

export default function LocalRankPage() {
  const { org, updateOrgSettings } = useData();

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapInited, setMapInited] = useState(false);
  const [keyword, setKeyword] = useState(GBP_KEYWORDS[0]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [gridSize, setGridSize] = useState(5);
  const [spacing, setSpacing] = useState(1.5);
  const [center, setCenter] = useState(LINCOLN_CENTER);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanError, setScanError] = useState(null);
  const [viewScan, setViewScan] = useState(null);
  const [scans, setScans] = useState([]);
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderQuery, setFinderQuery] = useState('Lucky Landscapes Lincoln NE');
  const [finderBusy, setFinderBusy] = useState(false);
  const [finderResults, setFinderResults] = useState(null);
  const [manualId, setManualId] = useState('');
  const [apiBlocked, setApiBlocked] = useState(false);
  const [organicQuery, setOrganicQuery] = useState(ORGANIC_PRESETS[0]);

  const mapDivRef = useRef(null);
  const gmapRef = useRef(null);
  const infoRef = useRef(null);
  const markersRef = useRef([]);
  const apiModeRef = useRef(null); // 'new' | 'legacy'
  const cancelRef = useRef(false);

  const seoPlaceId = org?.settings?.seo_place_id || null;
  const seoBusinessName = org?.settings?.seo_business_name || null;
  const activeKeyword = (customKeyword.trim() || keyword).trim();
  const totalPoints = gridSize * gridSize;

  // ---- History (this device only) ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCANS_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          setScans(list);
          if (list[0]) setViewScan(list[0]);
        }
      }
    } catch { /* corrupt history is disposable */ }
  }, []);

  const persistScans = useCallback((list) => {
    const capped = list.slice(0, MAX_SCANS);
    setScans(capped);
    try { localStorage.setItem(SCANS_KEY, JSON.stringify(capped)); } catch { /* full/blocked */ }
  }, []);

  // ---- Load Google Maps (same loader contract as /measure) ----
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    if (window.google?.maps?.Map) { setMapsLoaded(true); return; }
    const existing = document.getElementById('google-maps-script');
    if (existing) {
      existing.addEventListener('load', () => setMapsLoaded(true));
      return;
    }
    const s = document.createElement('script');
    s.id = 'google-maps-script';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry,places`;
    s.async = true;
    s.defer = true;
    s.onload = () => setMapsLoaded(true);
    s.onerror = () => console.error('Failed to load Google Maps');
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!mapsLoaded || gmapRef.current || !mapDivRef.current) return;
    const g = window.google;
    gmapRef.current = new g.maps.Map(mapDivRef.current, {
      center: LINCOLN_CENTER,
      zoom: 11,
      mapTypeId: 'roadmap',
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      clickableIcons: false,
    });
    infoRef.current = new g.maps.InfoWindow();
    setMapInited(true);
  }, [mapsLoaded]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    infoRef.current?.close();
  }, []);

  const addRankMarker = useCallback((pt, kw) => {
    const g = window.google;
    const m = new g.maps.Marker({
      map: gmapRef.current,
      position: { lat: pt.lat, lng: pt.lng },
      label: { text: pt.rank ? String(pt.rank) : '–', color: '#fff', fontWeight: '700', fontSize: '12px' },
      icon: {
        path: g.maps.SymbolPath.CIRCLE,
        scale: 15,
        fillColor: rankColor(pt.rank),
        fillOpacity: 0.92,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
    m.addListener('click', () => {
      const html = `
        <div style="font:13px system-ui;max-width:250px;color:#111">
          <div style="font-weight:700;margin-bottom:4px">${pt.rank ? `Rank #${pt.rank} here` : 'Not in the top 20 here'}</div>
          <ol style="margin:0 0 8px 16px;padding:0">
            ${(pt.top || []).map((t) => `<li style="${t.us ? 'font-weight:700;color:#16a34a' : ''}">${esc(t.name)}</li>`).join('')}
          </ol>
          <a href="${mapsSpotUrl(kw, pt.lat, pt.lng)}" target="_blank" rel="noopener" style="color:#2563eb">Open live Google Maps from this spot ↗</a>
        </div>`;
      infoRef.current.setContent(html);
      infoRef.current.open({ map: gmapRef.current, anchor: m });
    });
    markersRef.current.push(m);
  }, []);

  // ---- Map content: preview grid while configuring, ranks after a scan ----
  useEffect(() => {
    if (!mapInited || scanning) return;
    const g = window.google;
    clearMarkers();
    const bounds = new g.maps.LatLngBounds();

    if (viewScan) {
      viewScan.points.forEach((pt) => {
        addRankMarker(pt, viewScan.keyword);
        bounds.extend({ lat: pt.lat, lng: pt.lng });
      });
    } else {
      buildGrid(center, gridSize, spacing).forEach((pt) => {
        const m = new g.maps.Marker({
          map: gmapRef.current,
          position: pt,
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#64748b', fillOpacity: 0.6, strokeColor: '#fff', strokeWeight: 1 },
          clickable: false,
        });
        markersRef.current.push(m);
        bounds.extend(pt);
      });
      const pin = new g.maps.Marker({
        map: gmapRef.current,
        position: center,
        draggable: true,
        title: 'Drag to move the grid center',
        zIndex: 99,
      });
      pin.addListener('dragend', () => {
        const p = pin.getPosition();
        setCenter({ lat: p.lat(), lng: p.lng() });
      });
      markersRef.current.push(pin);
    }
    gmapRef.current.fitBounds(bounds, 40);
  }, [mapInited, viewScan, center, gridSize, spacing, scanning, clearMarkers, addRankMarker]);

  // ---- Places text search: tries the new Place API, falls back to legacy ----
  const searchText = useCallback(async (query, lat, lng, radius, maxN = 20) => {
    const g = window.google;
    if (apiModeRef.current !== 'legacy') {
      try {
        const { Place } = await g.maps.importLibrary('places');
        if (Place?.searchByText) {
          const { places } = await Place.searchByText({
            textQuery: query,
            fields: ['id', 'displayName', 'formattedAddress'],
            locationBias: { center: { lat, lng }, radius: Math.min(radius, 50000) },
            maxResultCount: maxN,
          });
          apiModeRef.current = 'new';
          return (places || []).map((p) => ({
            id: p.id,
            name: typeof p.displayName === 'string' ? p.displayName : (p.displayName?.text || ''),
            address: p.formattedAddress || '',
          }));
        }
      } catch (e) {
        // If the new API worked before, this is a real failure — surface it.
        if (apiModeRef.current === 'new') throw e;
        // "PERMISSION_DENIED / blocked" = Places API (New) isn't enabled on the
        // Cloud project. Flag it so the UI can tell the user exactly that,
        // instead of silently degrading to the deprecated legacy index (which
        // can't find newer service-area listings by name).
        if (/PERMISSION_DENIED|blocked|not.*enabled|API_NOT_ACTIVATED/i.test(String(e?.message))) {
          setApiBlocked(true);
        }
        apiModeRef.current = 'legacy';
      }
    }
    return new Promise((resolve, reject) => {
      const svc = new g.maps.places.PlacesService(document.createElement('div'));
      svc.textSearch({ query, location: new g.maps.LatLng(lat, lng), radius }, (res, status) => {
        const S = g.maps.places.PlacesServiceStatus;
        if (status === S.OK || status === S.ZERO_RESULTS) {
          resolve((res || []).slice(0, maxN).map((p) => ({ id: p.place_id, name: p.name, address: p.formatted_address || '' })));
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }, []);

  // ---- Find-my-listing ----
  const runFinder = async () => {
    if (!finderQuery.trim() || finderBusy) return;
    setFinderBusy(true);
    setFinderResults(null);
    try {
      const res = await searchText(finderQuery.trim(), LINCOLN_CENTER.lat, LINCOLN_CENTER.lng, 30000, 8);
      setFinderResults(res);
    } catch (e) {
      setFinderResults({ error: e.message });
    }
    setFinderBusy(false);
  };

  const pickBusiness = async (r) => {
    await updateOrgSettings({ seo_place_id: r.id, seo_business_name: r.name });
    setFinderOpen(false);
    setFinderResults(null);
  };

  // Validate a pasted Place ID to a name (nice-to-have); works on either API.
  const lookupPlaceById = useCallback(async (placeId) => {
    const g = window.google;
    try {
      const { Place } = await g.maps.importLibrary('places');
      if (Place) {
        const place = new Place({ id: placeId });
        await place.fetchFields({ fields: ['displayName', 'formattedAddress'] });
        return {
          id: placeId,
          name: typeof place.displayName === 'string' ? place.displayName : (place.displayName?.text || ''),
          address: place.formattedAddress || '',
        };
      }
    } catch (e) {
      if (/PERMISSION_DENIED|blocked|not.*enabled|API_NOT_ACTIVATED/i.test(String(e?.message))) setApiBlocked(true);
    }
    return new Promise((resolve, reject) => {
      const svc = new g.maps.places.PlacesService(document.createElement('div'));
      svc.getDetails({ placeId, fields: ['name', 'formatted_address'] }, (res, status) => {
        if (status === g.maps.places.PlacesServiceStatus.OK && res) {
          resolve({ id: placeId, name: res.name, address: res.formatted_address || '' });
        } else {
          reject(new Error(`Place lookup failed: ${status}`));
        }
      });
    });
  }, []);

  // Save a manually-pasted Place ID. We try to confirm the name, but save the
  // raw ID regardless — the grid match only needs the ID string, so this is the
  // guaranteed path when name search can't find the listing.
  const useManualId = async () => {
    const id = manualId.trim();
    if (!id || finderBusy) return;
    setFinderBusy(true);
    setFinderResults(null);
    let name = null;
    try { const r = await lookupPlaceById(id); name = r.name; } catch { /* save raw anyway */ }
    await updateOrgSettings({ seo_place_id: id, seo_business_name: name || 'My listing (manual ID)' });
    setManualId('');
    setFinderOpen(false);
    setFinderBusy(false);
  };

  // ---- The scan ----
  const runScan = async () => {
    if (scanning || !seoPlaceId || !activeKeyword || !mapInited) return;
    setScanning(true);
    setScanError(null);
    setViewScan(null);
    setProgress(0);
    cancelRef.current = false;
    clearMarkers();

    const pts = buildGrid(center, gridSize, spacing);
    const biasRadius = Math.max(400, spacing * 1609 * 0.6);
    const results = [];
    let errors = 0;
    let lastError = null;

    for (let i = 0; i < pts.length; i++) {
      if (cancelRef.current) break;
      let point = { ...pts[i], rank: null, top: [] };
      try {
        const places = await searchText(activeKeyword, pts[i].lat, pts[i].lng, biasRadius, 20);
        const idx = places.findIndex((p) => p.id === seoPlaceId);
        point = {
          ...pts[i],
          rank: idx >= 0 ? idx + 1 : null,
          top: places.slice(0, 5).map((p) => ({ name: p.name, us: p.id === seoPlaceId })),
        };
      } catch (e) {
        errors++;
        lastError = e.message;
      }
      results.push(point);
      addRankMarker(point, activeKeyword);
      setProgress(i + 1);
      await new Promise((r) => setTimeout(r, 120));
    }

    setScanning(false);

    if (errors === results.length) {
      setScanError(lastError || 'Every point failed.');
      return;
    }

    // Competitor tally — who owns the top 3 across the grid
    const comp = new Map();
    results.forEach((pt) => {
      (pt.top || []).slice(0, 3).forEach((t, idx) => {
        if (t.us) return;
        const cur = comp.get(t.name) || { name: t.name, top3Count: 0, best: 99 };
        cur.top3Count++;
        cur.best = Math.min(cur.best, idx + 1);
        comp.set(t.name, cur);
      });
    });
    const competitors = [...comp.values()].sort((a, b) => b.top3Count - a.top3Count).slice(0, 8);

    const scan = {
      id: Date.now().toString(36),
      at: new Date().toISOString(),
      keyword: activeKeyword,
      gridSize,
      spacing,
      center,
      points: results,
      competitors,
      summary: summarize(results),
      errors,
    };
    setViewScan(scan);
    persistScans([scan, ...scans]);
  };

  const deleteScan = (id) => {
    const next = scans.filter((s) => s.id !== id);
    persistScans(next);
    if (viewScan?.id === id) setViewScan(next[0] || null);
  };

  // Previous scan with the same config — powers the "vs last scan" delta
  const prevScan = viewScan
    ? scans.find((s) => s.id !== viewScan.id
        && s.keyword === viewScan.keyword
        && s.gridSize === viewScan.gridSize
        && s.spacing === viewScan.spacing
        && new Date(s.at) < new Date(viewScan.at))
    : null;

  const fmtAvg = (v) => (v == null ? '—' : v.toFixed(1));
  const sum = viewScan?.summary;

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Local Rank Grid</h1>
          <p>Where Lucky actually shows up in Google&apos;s map results, block by block — a free Local Falcon</p>
        </div>
      </div>

      {!GOOGLE_MAPS_KEY && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <AlertTriangle size={16} style={{ color: '#f59e0b', verticalAlign: 'text-bottom', marginRight: 6 }} />
          Add <code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> to <code>.env.local</code> — same key the Measure tool uses.
        </div>
      )}

      {/* Step 1 — pick the GBP listing */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        {seoPlaceId && !finderOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} style={{ color: 'var(--lucky-green)' }} />
              <span style={{ fontSize: '0.88rem' }}>
                Tracking <strong>{seoBusinessName || 'your listing'}</strong>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: '0.72rem', marginLeft: 8 }}>{seoPlaceId}</span>
              </span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setFinderOpen(true)}>Change</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
              <h3 style={{ margin: 0 }}>Step 1 — find your Google Business Profile</h3>
              {seoPlaceId && <button className="btn btn-secondary btn-sm" onClick={() => { setFinderOpen(false); setFinderResults(null); }}><X size={14} /></button>}
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
              One-time setup: search for the listing, pick it, and every scan after this tracks it by its Google place ID.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                style={{ flex: '1 1 240px' }}
                value={finderQuery}
                onChange={(e) => setFinderQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runFinder()}
                placeholder="Lucky Landscapes Lincoln NE"
              />
              <button className="btn btn-primary" onClick={runFinder} disabled={finderBusy || !mapsLoaded}>
                {finderBusy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
              </button>
            </div>
            {finderResults?.error && (
              <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.82rem', color: '#dc2626' }}>{finderResults.error}</div>
            )}
            {Array.isArray(finderResults) && (
              <div style={{ marginTop: 'var(--space-sm)', display: 'grid', gap: 6 }}>
                {finderResults.length === 0 && (
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong>No match for that name.</strong> Two common reasons: (1) Places API (New) isn&apos;t enabled
                    {apiBlocked ? ' — and we detected it IS blocked, so enable it (see below) and search again' : ''}; or
                    (2) the exact name on your Google listing is different (e.g. &ldquo;Lucky Landscapes LLC&rdquo;). Try the exact
                    name, or just paste your Place ID below — that always works.
                  </div>
                )}
                {finderResults.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{r.name}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.address}</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => pickBusiness(r)}>This is us</button>
                  </div>
                ))}
              </div>
            )}

            {apiBlocked && (
              <div style={{ marginTop: 'var(--space-sm)', padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                <strong>Places API (New) is blocked on your Google Cloud project.</strong> Enable it: Google Cloud Console →
                APIs &amp; Services → Library → search <strong>&ldquo;Places API (New)&rdquo;</strong> → Enable (same project as
                your Maps key). It has a free tier and gives a far better index for newer service-area listings than the old API.
              </div>
            )}

            {/* Guaranteed path: paste the Place ID directly */}
            <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Can&apos;t find it by name? Paste your Google <strong>Place ID</strong> — get it from{' '}
                <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lucky-green)' }}>Google&apos;s Place ID Finder ↗</a>
                {' '}(search your business on that map, copy the ID it shows).
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ flex: '1 1 240px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && useManualId()}
                  placeholder="ChIJ…"
                />
                <button className="btn btn-secondary" onClick={useManualId} disabled={finderBusy || !manualId.trim()}>
                  {finderBusy ? <Loader2 size={16} className="animate-spin" /> : null} Use this ID
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — configure + run */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <h3 style={{ marginBottom: 'var(--space-sm)' }}>Step 2 — scan the grid</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label className="form-label">Search term (what a customer types)</label>
            <select className="form-select" value={keyword} onChange={(e) => { setKeyword(e.target.value); setCustomKeyword(''); }}>
              {GBP_KEYWORDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label className="form-label">…or a custom term</label>
            <input className="form-input" value={customKeyword} onChange={(e) => setCustomKeyword(e.target.value)} placeholder="e.g. mulch installation" />
          </div>
          <div>
            <label className="form-label">Grid</label>
            <select className="form-select" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))}>
              <option value={3}>3 × 3</option>
              <option value={5}>5 × 5</option>
              <option value={7}>7 × 7</option>
            </select>
          </div>
          <div>
            <label className="form-label">Spacing</label>
            <select className="form-select" value={spacing} onChange={(e) => setSpacing(Number(e.target.value))}>
              <option value={0.75}>0.75 mi</option>
              <option value={1}>1 mi</option>
              <option value={1.5}>1.5 mi</option>
              <option value={2}>2 mi</option>
              <option value={3}>3 mi</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={runScan} disabled={scanning || !seoPlaceId || !activeKeyword || !mapInited}>
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {scanning ? ` Scanning ${progress}/${totalPoints}…` : ' Run scan'}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
          {totalPoints} searches per scan · Google&apos;s free tier covers ~5,000/month, so weekly scans cost $0 · drag the center pin on the map to move the grid
          {!seoPlaceId && <strong style={{ color: '#f59e0b' }}> · pick your listing above first</strong>}
        </div>
        {scanError && (
          <div style={{ marginTop: 'var(--space-sm)', padding: '10px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', fontSize: '0.82rem' }}>
            <strong>Scan failed:</strong> {scanError}
            <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
              Usually this means the Maps key doesn&apos;t have a Places API enabled. In Google Cloud Console → APIs &amp; Services, enable
              <strong> Places API (New)</strong> (or the legacy <strong>Places API</strong>) for the same project as the Maps key.
            </div>
          </div>
        )}
      </div>

      {/* Results summary */}
      {sum && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg rank (when found)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{fmtAvg(sum.avg)}</div>
            {prevScan?.summary?.avg != null && sum.avg != null && (
              <div style={{ fontSize: '0.76rem', color: sum.avg <= prevScan.summary.avg ? 'var(--lucky-green)' : '#dc2626' }}>
                {sum.avg <= prevScan.summary.avg ? '▲ ' : '▼ '}{Math.abs(sum.avg - prevScan.summary.avg).toFixed(1)} vs {new Date(prevScan.at).toLocaleDateString()}
              </div>
            )}
          </div>
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>In the top 3</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{Math.round((sum.top3 / sum.total) * 100)}%</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>{sum.top3} of {sum.total} points — that&apos;s map-pack territory</div>
          </div>
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Visible at all (top 20)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{Math.round((sum.found / sum.total) * 100)}%</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>{sum.found} of {sum.total} points</div>
          </div>
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scan</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>&ldquo;{viewScan.keyword}&rdquo;</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>{new Date(viewScan.at).toLocaleString()} · {viewScan.gridSize}×{viewScan.gridSize} @ {viewScan.spacing} mi{viewScan.errors ? ` · ${viewScan.errors} points errored` : ''}</div>
          </div>
        </div>
      )}

      {/* The map */}
      <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm)' }}>
        <div ref={mapDivRef} style={{ width: '100%', height: 'min(62vh, 560px)', borderRadius: 8, background: 'var(--bg-tertiary)' }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '8px 4px 2px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
          {[['#16a34a', '1–3 (map pack)'], ['#d97706', '4–10'], ['#ea580c', '11–20'], ['#dc2626', 'not in top 20']].map(([c, l]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
            </span>
          ))}
          <span style={{ color: 'var(--text-tertiary)' }}>· click a dot to see who ranks there + open live Maps from that spot</span>
        </div>
      </div>

      {/* Competitors */}
      {viewScan?.competitors?.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>Who&apos;s beating you in the top 3</h3>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr><th>Business</th><th style={{ textAlign: 'right' }}>Top-3 at # of points</th><th style={{ textAlign: 'right' }}>% of grid</th><th style={{ textAlign: 'right' }}>Best spot</th></tr>
              </thead>
              <tbody>
                {viewScan.competitors.map((c) => (
                  <tr key={c.name}>
                    <td><strong>{c.name}</strong></td>
                    <td style={{ textAlign: 'right' }}>{c.top3Count} / {viewScan.summary.total}</td>
                    <td style={{ textAlign: 'right' }}>{Math.round((c.top3Count / viewScan.summary.total) * 100)}%</td>
                    <td style={{ textAlign: 'right' }}>#{c.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scan history */}
      {scans.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <h3 style={{ marginBottom: 'var(--space-sm)' }}><History size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Scan history <span style={{ fontSize: '0.74rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>(stored on this device)</span></h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {scans.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, border: `1px solid ${viewScan?.id === s.id ? 'var(--lucky-green)' : 'var(--border-color)'}`, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.83rem' }}>
                  <strong>&ldquo;{s.keyword}&rdquo;</strong>
                  <span style={{ color: 'var(--text-tertiary)' }}> · {new Date(s.at).toLocaleString()} · {s.gridSize}×{s.gridSize} @ {s.spacing} mi · avg {fmtAvg(s.summary?.avg)} · top-3 {Math.round(((s.summary?.top3 || 0) / (s.summary?.total || 1)) * 100)}%</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {viewScan?.id !== s.id && <button className="btn btn-secondary btn-sm" onClick={() => setViewScan(s)}>View</button>}
                  <button className="btn btn-secondary btn-sm" onClick={() => deleteScan(s.id)} aria-label="Delete scan"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organic SERP spoofing */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <h3 style={{ marginBottom: 'var(--space-sm)' }}><Globe size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Organic search — view Google from any Lincoln zip</h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
          These links carry a <code>uule</code> location parameter, so Google renders the results page as if you were standing in that zip —
          no VPN needed. Open them in an <strong>Incognito window</strong> (personalization is already disabled via <code>pws=0</code>).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
          <input className="form-input" style={{ flex: '1 1 260px' }} value={organicQuery} onChange={(e) => setOrganicQuery(e.target.value)} />
          <select className="form-select" style={{ maxWidth: 220 }} value="" onChange={(e) => e.target.value && setOrganicQuery(e.target.value)}>
            <option value="">Presets…</option>
            {ORGANIC_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ZIP_TARGETS.map((z) => (
            <a
              key={z.zip}
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
              href={organicUrl(organicQuery, z.canonical || `${z.zip},Nebraska,United States`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {z.zip}{z.area ? ` · ${z.area}` : ''} <ExternalLink size={12} />
            </a>
          ))}
        </div>
      </div>

      {/* Honest footnote */}
      <div className="card" style={{ borderLeft: '3px solid #f59e0b', background: 'rgba(245,158,11,0.06)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Crosshair size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.84rem', lineHeight: 1.55 }}>
            <strong>How to read this.</strong> Grid ranks come from the Places API, which orders by the same core signals as the
            map pack (proximity, relevance, prominence) but isn&apos;t pixel-identical to a live phone search — trust the <em>trends
            and weak zones</em>, and spot-check any surprising dot with its live-Maps link. The grid measures; it doesn&apos;t move
            rankings. What moves them: <strong>review velocity</strong> (keep the one-tap asks going after every job),
            <strong> photo uploads + weekly GBP posts</strong>, and matching <strong>categories/services</strong> on the profile.
            Proximity you can&apos;t change — as a service-area business you&apos;ll always rank strongest near the home base.
          </div>
        </div>
      </div>
    </div>
  );
}
