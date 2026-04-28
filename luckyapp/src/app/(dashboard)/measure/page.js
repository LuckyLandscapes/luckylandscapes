'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '@/lib/data';
import {
  Ruler, Search, Trash2, Copy, MapPin, CheckCircle, Layers, X, SquareIcon,
  Loader2, Pencil, Hexagon, Circle as CircleIcon, Building2, Minus, ChevronDown, ChevronUp, Eye, EyeOff,
} from 'lucide-react';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const SQM_TO_SQFT = 10.7639;
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const AREA_FILL = '#2d7a3a';
const AREA_STROKE = '#7dd87d';
const EXCLUSION_FILL = '#dc2626';
const EXCLUSION_STROKE = '#fca5a5';
const CANDIDATE_FILL = '#f59e0b';
const CANDIDATE_STROKE = '#fbbf24';

// Tools the user can pick from the toolbar.
const TOOLS = [
  { id: 'polygon-area',     kind: 'area',      shape: 'polygon',   label: 'Polygon',   Icon: Hexagon },
  { id: 'rectangle-area',   kind: 'area',      shape: 'rectangle', label: 'Rectangle', Icon: SquareIcon },
  { id: 'circle-area',      kind: 'area',      shape: 'circle',    label: 'Circle',    Icon: CircleIcon },
  { id: 'polygon-exclude',  kind: 'exclusion', shape: 'polygon',   label: 'Subtract',  Icon: Minus },
];

export default function MeasurePage() {
  const { customers } = useData();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const shapesRef = useRef(new Map()); // id -> google maps overlay
  const candidateOverlaysRef = useRef(new Map()); // candidate id -> overlay

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [shapes, setShapes] = useState([]); // [{id, kind, shape, sqft, label, hidden}]
  const [activeTool, setActiveTool] = useState(null); // tool id or null
  const [hasSearchText, setHasSearchText] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showCustomerAddresses, setShowCustomerAddresses] = useState(false);
  const [candidates, setCandidates] = useState([]); // detected building candidates
  const [detecting, setDetecting] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [toast, setToast] = useState(null);

  // Show transient toast
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  }, []);

  // ---- Load Google Maps script ----
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    if (window.google?.maps?.Map) {
      setMapsLoaded(true);
      return;
    }
    const existing = document.getElementById('google-maps-script');
    if (existing) {
      existing.addEventListener('load', () => setMapsLoaded(true));
      return;
    }
    const s = document.createElement('script');
    s.id = 'google-maps-script';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=drawing,geometry,places`;
    s.async = true;
    s.defer = true;
    s.onload = () => setMapsLoaded(true);
    s.onerror = () => console.error('Failed to load Google Maps');
    document.head.appendChild(s);
  }, []);

  // Helper: compute sqft for a google maps overlay (polygon/rectangle/circle).
  const computeSqft = useCallback((overlay) => {
    const g = window.google.maps;
    if (!overlay) return 0;
    if (typeof overlay.getRadius === 'function') {
      const r = overlay.getRadius();
      return Math.round(Math.PI * r * r * SQM_TO_SQFT);
    }
    if (typeof overlay.getBounds === 'function' && typeof overlay.getPath !== 'function') {
      const b = overlay.getBounds();
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      const path = [
        new g.LatLng(ne.lat(), sw.lng()),
        new g.LatLng(ne.lat(), ne.lng()),
        new g.LatLng(sw.lat(), ne.lng()),
        new g.LatLng(sw.lat(), sw.lng()),
      ];
      return Math.round(g.geometry.spherical.computeArea(path) * SQM_TO_SQFT);
    }
    if (typeof overlay.getPath === 'function') {
      return Math.round(g.geometry.spherical.computeArea(overlay.getPath()) * SQM_TO_SQFT);
    }
    return 0;
  }, []);

  // Helper: attach edit listeners that recalc sqft on change.
  const attachEditListeners = useCallback((id, overlay) => {
    const g = window.google.maps;
    const recalc = () => {
      const sqft = computeSqft(overlay);
      setShapes(prev => prev.map(s => s.id === id ? { ...s, sqft } : s));
    };
    if (typeof overlay.getPath === 'function') {
      const path = overlay.getPath();
      ['set_at', 'insert_at', 'remove_at'].forEach(ev => g.event.addListener(path, ev, recalc));
    }
    if (typeof overlay.getRadius === 'function') {
      g.event.addListener(overlay, 'radius_changed', recalc);
      g.event.addListener(overlay, 'center_changed', recalc);
    }
    if (typeof overlay.getBounds === 'function' && typeof overlay.getPath !== 'function') {
      g.event.addListener(overlay, 'bounds_changed', recalc);
    }
  }, [computeSqft]);

  // Add a completed shape to state.
  const addShape = useCallback((overlay, kind) => {
    const id = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isExclusion = kind === 'exclusion';
    overlay.setOptions({
      fillColor: isExclusion ? EXCLUSION_FILL : AREA_FILL,
      strokeColor: isExclusion ? EXCLUSION_STROKE : AREA_STROKE,
      fillOpacity: isExclusion ? 0.45 : 0.3,
      strokeWeight: 2,
      editable: true,
      draggable: false,
      zIndex: isExclusion ? 2 : 1,
    });
    const sqft = computeSqft(overlay);
    shapesRef.current.set(id, overlay);
    attachEditListeners(id, overlay);

    setShapes(prev => {
      const sameKind = prev.filter(s => s.kind === kind).length + 1;
      const label = (kind === 'area' ? 'Area ' : 'Exclude ') + sameKind;
      return [...prev, { id, kind, sqft, label, hidden: false }];
    });
  }, [attachEditListeners, computeSqft]);

  // ---- Initialize map ----
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;
    const g = window.google.maps;

    const map = new g.Map(mapRef.current, {
      center: { lat: 40.8136, lng: -96.7026 },
      zoom: 18,
      mapTypeId: 'satellite',
      tilt: 0,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: g.MapTypeControlStyle.HORIZONTAL_BAR,
        position: g.ControlPosition.TOP_RIGHT,
      },
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      zoomControlOptions: { position: g.ControlPosition.RIGHT_CENTER },
      gestureHandling: 'greedy',
    });
    mapInstanceRef.current = map;

    const drawingManager = new g.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: { fillColor: AREA_FILL, strokeColor: AREA_STROKE, fillOpacity: 0.3, strokeWeight: 2, editable: true },
      rectangleOptions: { fillColor: AREA_FILL, strokeColor: AREA_STROKE, fillOpacity: 0.3, strokeWeight: 2, editable: true },
      circleOptions:    { fillColor: AREA_FILL, strokeColor: AREA_STROKE, fillOpacity: 0.3, strokeWeight: 2, editable: true },
    });
    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    const onComplete = (overlay) => {
      // Read kind from the dataset of drawingManager (set when tool changes)
      const kind = drawingManager.__kind || 'area';
      addShape(overlay, kind);
      drawingManager.setDrawingMode(null);
      setActiveTool(null);
    };
    g.event.addListener(drawingManager, 'polygoncomplete',   onComplete);
    g.event.addListener(drawingManager, 'rectanglecomplete', onComplete);
    g.event.addListener(drawingManager, 'circlecomplete',    onComplete);

    // Places autocomplete
    if (searchInputRef.current) {
      const autocomplete = new g.places.Autocomplete(searchInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['geometry', 'formatted_address', 'address_components'],
      });
      autocomplete.bindTo('bounds', map);
      autocompleteRef.current = autocomplete;
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          map.setCenter(place.geometry.location);
          map.setZoom(20);
          setHasSearchText(true);
        }
      });
    }
  }, [mapsLoaded, addShape]);

  // ---- Tool selection drives the drawing mode ----
  const selectTool = useCallback((toolId) => {
    const dm = drawingManagerRef.current;
    if (!dm) return;
    if (toolId === activeTool || toolId == null) {
      dm.setDrawingMode(null);
      dm.__kind = null;
      setActiveTool(null);
      return;
    }
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) return;
    const g = window.google.maps;
    const isExclusion = tool.kind === 'exclusion';
    const opts = {
      fillColor: isExclusion ? EXCLUSION_FILL : AREA_FILL,
      strokeColor: isExclusion ? EXCLUSION_STROKE : AREA_STROKE,
      fillOpacity: isExclusion ? 0.4 : 0.3,
      strokeWeight: 2,
      editable: true,
    };
    dm.setOptions({ polygonOptions: opts, rectangleOptions: opts, circleOptions: opts });
    dm.__kind = tool.kind;
    const modeMap = {
      polygon: g.drawing.OverlayType.POLYGON,
      rectangle: g.drawing.OverlayType.RECTANGLE,
      circle: g.drawing.OverlayType.CIRCLE,
    };
    dm.setDrawingMode(modeMap[tool.shape]);
    setActiveTool(toolId);
  }, [activeTool]);

  // Cancel drawing
  const cancelDrawing = useCallback(() => {
    const dm = drawingManagerRef.current;
    if (dm) {
      dm.setDrawingMode(null);
      dm.__kind = null;
    }
    setActiveTool(null);
  }, []);

  // Remove a shape
  const removeShape = useCallback((id) => {
    const overlay = shapesRef.current.get(id);
    if (overlay) overlay.setMap(null);
    shapesRef.current.delete(id);
    setShapes(prev => prev.filter(s => s.id !== id));
  }, []);

  // Toggle visibility
  const toggleHidden = useCallback((id) => {
    const overlay = shapesRef.current.get(id);
    setShapes(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = !s.hidden;
      if (overlay) overlay.setMap(next ? null : mapInstanceRef.current);
      return { ...s, hidden: next };
    }));
  }, []);

  // Clear everything
  const clearAll = useCallback(() => {
    shapesRef.current.forEach(o => o.setMap(null));
    shapesRef.current.clear();
    setShapes([]);
    candidateOverlaysRef.current.forEach(o => o.setMap(null));
    candidateOverlaysRef.current.clear();
    setCandidates([]);
  }, []);

  // ---- Auto-detect buildings via OpenStreetMap Overpass ----
  const detectBuildings = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    setDetecting(true);

    // Clear prior candidates
    candidateOverlaysRef.current.forEach(o => o.setMap(null));
    candidateOverlaysRef.current.clear();
    setCandidates([]);

    try {
      const q = `[out:json][timeout:25];(way["building"](${sw.lat()},${sw.lng()},${ne.lat()},${ne.lng()}););out geom;`;
      const res = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = await res.json();
      const elements = (data.elements || []).filter(e => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length >= 3);

      const g = window.google.maps;
      const found = [];
      elements.forEach((el) => {
        const path = el.geometry.map(pt => ({ lat: pt.lat, lng: pt.lon }));
        const overlay = new g.Polygon({
          paths: path,
          fillColor: CANDIDATE_FILL,
          fillOpacity: 0.45,
          strokeColor: CANDIDATE_STROKE,
          strokeWeight: 2,
          strokeOpacity: 0.95,
          clickable: true,
          zIndex: 5,
          map,
        });
        const sqft = Math.round(g.geometry.spherical.computeArea(overlay.getPath()) * SQM_TO_SQFT);
        if (sqft < 30) {
          overlay.setMap(null);
          return; // ignore tiny artifacts
        }
        const cid = `cand-${el.id}`;
        candidateOverlaysRef.current.set(cid, overlay);
        found.push({ id: cid, sqft, tag: el.tags?.building || 'building' });

        // Click-to-add-as-exclusion
        overlay.addListener('click', () => acceptCandidate(cid));
      });

      setCandidates(found);
      if (found.length === 0) {
        showToast('No buildings found in this area. Try zooming or panning.', 'info');
      } else {
        showToast(`Found ${found.length} building${found.length === 1 ? '' : 's'}. Tap to subtract.`, 'success');
      }
    } catch (err) {
      console.error('Building detection failed', err);
      showToast('Could not load building data. Try again.', 'error');
    } finally {
      setDetecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  // Accept a single candidate -> turn into exclusion
  const acceptCandidate = useCallback((cid) => {
    const overlay = candidateOverlaysRef.current.get(cid);
    if (!overlay) return;
    candidateOverlaysRef.current.delete(cid);
    addShape(overlay, 'exclusion');
    setCandidates(prev => prev.filter(c => c.id !== cid));
  }, [addShape]);

  const acceptAllCandidates = useCallback(() => {
    const ids = Array.from(candidateOverlaysRef.current.keys());
    ids.forEach(acceptCandidate);
  }, [acceptCandidate]);

  const dismissCandidates = useCallback(() => {
    candidateOverlaysRef.current.forEach(o => o.setMap(null));
    candidateOverlaysRef.current.clear();
    setCandidates([]);
  }, []);

  // Copy helper
  const copyToClipboard = useCallback((value, label) => {
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);

  // Search by address (manual Enter)
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const query = searchInputRef.current?.value?.trim();
    if (!query || !mapInstanceRef.current) return;
    document.querySelectorAll('.pac-container').forEach(c => { c.style.display = 'none'; });
    setIsSearching(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      setIsSearching(false);
      if (status === 'OK' && results[0]) {
        mapInstanceRef.current.setCenter(results[0].geometry.location);
        mapInstanceRef.current.setZoom(20);
        searchInputRef.current.value = results[0].formatted_address || query;
        setHasSearchText(true);
      }
    });
  }, []);

  const goToAddress = useCallback((address) => {
    if (!mapInstanceRef.current) return;
    setIsSearching(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      setIsSearching(false);
      if (status === 'OK' && results[0]) {
        mapInstanceRef.current.setCenter(results[0].geometry.location);
        mapInstanceRef.current.setZoom(20);
        if (searchInputRef.current) searchInputRef.current.value = address;
        setHasSearchText(true);
        setShowCustomerAddresses(false);
      }
    });
  }, []);

  const clearSearch = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.focus();
    }
    setHasSearchText(false);
  }, []);

  const totals = useMemo(() => {
    const visible = shapes.filter(s => !s.hidden);
    const areaTotal = visible.filter(s => s.kind === 'area').reduce((s, x) => s + x.sqft, 0);
    const exclusionTotal = visible.filter(s => s.kind === 'exclusion').reduce((s, x) => s + x.sqft, 0);
    return { areaTotal, exclusionTotal, net: Math.max(0, areaTotal - exclusionTotal) };
  }, [shapes]);

  // Cleanup on unmount: remove all overlays
  useEffect(() => () => {
    shapesRef.current.forEach(o => o?.setMap?.(null));
    shapesRef.current.clear();
    candidateOverlaysRef.current.forEach(o => o?.setMap?.(null));
    candidateOverlaysRef.current.clear();
  }, []);

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="page animate-fade-in">
        <div className="page-header">
          <div className="page-header-left">
            <h1><Ruler size={28} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Measure</h1>
            <p>Calculate square footage with satellite maps.</p>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>🗺️</div>
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>Google Maps API Key Required</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            Add your Google Maps API key to <code>.env.local</code> as <code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code>
          </p>
        </div>
      </div>
    );
  }

  const areasCount = shapes.filter(s => s.kind === 'area').length;
  const exclusionsCount = shapes.filter(s => s.kind === 'exclusion').length;

  return (
    <div className="measure-page page animate-fade-in">
      {/* Map fills the viewport. Header floats on top. */}
      <div className="measure-stage">
        <div ref={mapRef} className="measure-map-canvas" />

        {/* Top-left: search */}
        <div className="measure-search-bar">
          {isSearching ? (
            <Loader2 size={16} className="spin" style={{ color: 'var(--lucky-green-light)', flexShrink: 0 }} />
          ) : (
            <Search size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          )}
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search address..."
            onChange={(e) => setHasSearchText(!!e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="measure-search-input"
            autoComplete="off"
          />
          {hasSearchText && (
            <button className="measure-search-clear" onClick={clearSearch} title="Clear search">
              <X size={14} />
            </button>
          )}
          {customers.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowCustomerAddresses(s => !s)}
              title="Customer addresses"
              style={{ padding: '4px 8px' }}
            >
              <MapPin size={16} />
            </button>
          )}
        </div>

        {showCustomerAddresses && (
          <div className="measure-customer-dropdown">
            <div className="measure-customer-header">Customer Addresses</div>
            {customers.filter(c => c.address).map(c => (
              <button
                key={c.id}
                className="measure-customer-item"
                onClick={() => goToAddress(`${c.address}, ${c.city}, ${c.state} ${c.zip}`)}
              >
                <MapPin size={14} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.firstName} {c.lastName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.address}, {c.city}</div>
                </div>
              </button>
            ))}
            {customers.filter(c => c.address).length === 0 && (
              <div style={{ padding: '12px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                No customers with addresses yet.
              </div>
            )}
          </div>
        )}

        {/* Top-center: net total chip */}
        <div className="measure-net-chip" aria-live="polite">
          <div>
            <div className="measure-net-label">Net Area</div>
            <div className="measure-net-value">
              {totals.net.toLocaleString()}<span> sqft</span>
            </div>
          </div>
          {(totals.exclusionTotal > 0) && (
            <div className="measure-net-breakdown">
              <span style={{ color: 'var(--lucky-green-light)' }}>+{totals.areaTotal.toLocaleString()}</span>
              <span style={{ color: '#fca5a5' }}>−{totals.exclusionTotal.toLocaleString()}</span>
            </div>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => copyToClipboard(totals.net, 'net')}
            title="Copy net sqft"
            style={{ marginLeft: 8 }}
          >
            {copied === 'net' ? <CheckCircle size={14} /> : <Copy size={14} />}
          </button>
        </div>

        {/* Toolbar (floating, dock bottom on mobile) */}
        <div className={`measure-toolbar ${activeTool ? 'is-drawing' : ''}`}>
          {TOOLS.map(({ id, label, Icon, kind }) => (
            <button
              key={id}
              className={`measure-tool-btn ${activeTool === id ? 'active' : ''} ${kind === 'exclusion' ? 'tool-exclude' : ''}`}
              onClick={() => selectTool(id)}
              title={label}
            >
              <Icon size={16} />
              <span className="measure-tool-label">{label}</span>
            </button>
          ))}

          <div className="measure-tool-sep" />

          <button
            className="measure-tool-btn"
            onClick={detectBuildings}
            disabled={detecting}
            title="Auto-detect buildings in view"
          >
            {detecting ? <Loader2 size={16} className="spin" /> : <Building2 size={16} />}
            <span className="measure-tool-label">{detecting ? 'Detecting…' : 'Detect Buildings'}</span>
          </button>

          {(shapes.length > 0 || candidates.length > 0) && (
            <button className="measure-tool-btn measure-tool-danger" onClick={clearAll} title="Clear all">
              <Trash2 size={16} />
              <span className="measure-tool-label">Clear</span>
            </button>
          )}
        </div>

        {/* Drawing hint banner */}
        {activeTool && (
          <div className="measure-drawing-hint">
            <Pencil size={14} />
            <span>
              {activeTool.includes('exclude')
                ? 'Outline a building or feature to subtract.'
                : activeTool.includes('rectangle')
                  ? 'Click and drag to draw a rectangle.'
                  : activeTool.includes('circle')
                    ? 'Click and drag to draw a circle.'
                    : 'Tap points to draw. Tap the first point to close.'}
            </span>
            <button className="measure-hint-cancel" onClick={cancelDrawing}><X size={14} /></button>
          </div>
        )}

        {/* Candidate buildings panel */}
        {candidates.length > 0 && (
          <div className="measure-candidates">
            <div className="measure-candidates-head">
              <Building2 size={14} />
              <strong>{candidates.length}</strong> building{candidates.length === 1 ? '' : 's'} found
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.74rem' }}>
                tap on map or use buttons
              </span>
              <button className="measure-candidates-close" onClick={dismissCandidates} title="Dismiss">
                <X size={14} />
              </button>
            </div>
            <div className="measure-candidates-actions">
              <button className="btn btn-primary btn-sm" onClick={acceptAllCandidates}>
                <Minus size={14} /> Subtract all
              </button>
              <button className="btn btn-ghost btn-sm" onClick={dismissCandidates}>
                Skip all
              </button>
            </div>
          </div>
        )}

        {/* Bottom sheet listing shapes */}
        <div className={`measure-sheet ${sheetExpanded ? 'expanded' : ''}`}>
          <button className="measure-sheet-handle" onClick={() => setSheetExpanded(s => !s)}>
            <div className="measure-sheet-handle-bar" />
            <div className="measure-sheet-summary">
              <Layers size={14} />
              <span><strong>{areasCount}</strong> area{areasCount === 1 ? '' : 's'}</span>
              {exclusionsCount > 0 && (
                <span style={{ color: '#fca5a5' }}>
                  · <strong>{exclusionsCount}</strong> exclusion{exclusionsCount === 1 ? '' : 's'}
                </span>
              )}
              <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>
                {sheetExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </span>
            </div>
          </button>

          <div className="measure-sheet-body">
            {shapes.length === 0 ? (
              <div className="measure-empty">
                <SquareIcon size={28} style={{ opacity: 0.4 }} />
                <p>No shapes drawn yet.</p>
                <p className="measure-empty-hint">
                  Pick a tool above. Use <strong>Subtract</strong> or <strong>Detect Buildings</strong> to remove
                  driveways, houses, sheds from your area.
                </p>
              </div>
            ) : (
              <div className="measure-shape-list">
                {shapes.map(s => {
                  const isEx = s.kind === 'exclusion';
                  return (
                    <div key={s.id} className={`measure-shape-row ${isEx ? 'is-exclusion' : ''} ${s.hidden ? 'is-hidden' : ''}`}>
                      <div className="measure-shape-swatch" style={{ background: isEx ? EXCLUSION_FILL : AREA_FILL }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="measure-shape-label">{s.label}</div>
                        <div className="measure-shape-sqft">
                          {isEx ? '−' : ''}{s.sqft.toLocaleString()}
                          <span> sqft</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => copyToClipboard(s.sqft, s.id)}
                        title="Copy"
                      >
                        {copied === s.id ? <CheckCircle size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleHidden(s.id)}
                        title={s.hidden ? 'Show' : 'Hide'}
                      >
                        {s.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeShape(s.id)}
                        title="Delete"
                        style={{ color: 'var(--status-danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <CheckCircle size={18} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
