'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '@/lib/data';
import {
  Ruler, Search, Trash2, Copy, MapPin, CheckCircle, Layers, X, SquareIcon,
  Loader2, Pencil, Hexagon, Circle as CircleIcon, Building2, Minus, ChevronDown, ChevronUp,
  Eye, EyeOff, Save, FolderOpen, User, Spline, PersonStanding,
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

const TOOLS = [
  { id: 'polygon-area',     kind: 'area',      shape: 'polygon',   label: 'Polygon',   Icon: Hexagon },
  { id: 'rectangle-area',   kind: 'area',      shape: 'rectangle', label: 'Rectangle', Icon: SquareIcon },
  { id: 'circle-area',      kind: 'area',      shape: 'circle',    label: 'Circle',    Icon: CircleIcon },
  { id: 'freehand-area',    kind: 'area',      shape: 'freehand',  label: 'Freehand',  Icon: Spline },
  { id: 'polygon-exclude',  kind: 'exclusion', shape: 'polygon',   label: 'Subtract',  Icon: Minus },
  { id: 'freehand-exclude', kind: 'exclusion', shape: 'freehand',  label: 'Free Sub.', Icon: Pencil },
];

// Cache key for ElevationService lookups. Rounds to ~11cm so nearby vertices
// share the same cached elevation value.
function elevationKey(latlng) {
  const lat = typeof latlng.lat === 'function' ? latlng.lat() : latlng.lat;
  const lng = typeof latlng.lng === 'function' ? latlng.lng() : latlng.lng;
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

// Convert any google.maps overlay to a portable JSON form for storage.
function overlayToData(overlay, kind, label) {
  if (typeof overlay.getRadius === 'function') {
    const c = overlay.getCenter();
    return { kind, label, type: 'circle', center: { lat: c.lat(), lng: c.lng() }, radius: overlay.getRadius() };
  }
  if (typeof overlay.getBounds === 'function' && typeof overlay.getPath !== 'function') {
    const b = overlay.getBounds();
    const ne = b.getNorthEast(), sw = b.getSouthWest();
    return { kind, label, type: 'rectangle', ne: { lat: ne.lat(), lng: ne.lng() }, sw: { lat: sw.lat(), lng: sw.lng() } };
  }
  if (typeof overlay.getPath === 'function') {
    const path = overlay.getPath();
    const pts = [];
    for (let i = 0; i < path.getLength(); i++) {
      const p = path.getAt(i);
      pts.push({ lat: p.lat(), lng: p.lng() });
    }
    return { kind, label, type: 'polygon', path: pts };
  }
  return null;
}

// Rebuild a google.maps overlay from a stored shape definition.
function dataToOverlay(g, map, def, kind) {
  const opts = {
    fillColor: kind === 'exclusion' ? EXCLUSION_FILL : AREA_FILL,
    strokeColor: kind === 'exclusion' ? EXCLUSION_STROKE : AREA_STROKE,
    fillOpacity: kind === 'exclusion' ? 0.45 : 0.3,
    strokeWeight: 2,
    editable: true,
    map,
    zIndex: kind === 'exclusion' ? 2 : 1,
  };
  if (def.type === 'circle') {
    return new g.Circle({ ...opts, center: def.center, radius: def.radius });
  }
  if (def.type === 'rectangle') {
    return new g.Rectangle({ ...opts, bounds: { north: def.ne.lat, east: def.ne.lng, south: def.sw.lat, west: def.sw.lng } });
  }
  return new g.Polygon({ ...opts, paths: def.path });
}

export default function MeasurePage() {
  const { customers, updateCustomer } = useData();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const shapesRef = useRef(new Map());
  const candidateOverlaysRef = useRef(new Map());
  const projectionOverlayRef = useRef(null); // for screen→latlng during freehand
  const freehandStateRef = useRef(null);
  const mapTypeRef = useRef('satellite');
  const panoRef = useRef(null);
  const panoInstanceRef = useRef(null);
  const arOverlayRef = useRef(null);
  const edgeLabelClassRef = useRef(null);
  const edgeLabelOverlaysRef = useRef(new Map());
  const elevationServiceRef = useRef(null);
  const elevationCacheRef = useRef(new Map()); // "lat,lng" → metres
  const elevFetchTimerRef = useRef(null);
  const elevDisabledRef = useRef(false); // flips true if Elevation API rejects

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [shapes, setShapes] = useState([]); // [{id, kind, sqft, label, hidden}]
  const [activeTool, setActiveTool] = useState(null);
  const [hasSearchText, setHasSearchText] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showCustomerAddresses, setShowCustomerAddresses] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [mapTypeId, setMapTypeId] = useState('satellite');
  const [streetViewActive, setStreetViewActive] = useState(false);
  const [arEnabled, setArEnabled] = useState(false);
  const [arGroundOffset, setArGroundOffset] = useState(0); // metres ± nudge on top of auto / default
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [elevDataVersion, setElevDataVersion] = useState(0); // bumps when new elevations arrive
  const [elevAuto, setElevAuto] = useState(false);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const activeCustomer = useMemo(
    () => customers.find(c => c.id === activeCustomerId) || null,
    [customers, activeCustomerId]
  );

  // ---- Load Google Maps ----
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

  // sqft for a google maps overlay
  const computeSqft = useCallback((overlay) => {
    const g = window.google.maps;
    if (!overlay) return 0;
    if (typeof overlay.getRadius === 'function') {
      const r = overlay.getRadius();
      return Math.round(Math.PI * r * r * SQM_TO_SQFT);
    }
    if (typeof overlay.getBounds === 'function' && typeof overlay.getPath !== 'function') {
      const b = overlay.getBounds();
      const ne = b.getNorthEast(), sw = b.getSouthWest();
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

  const attachEditListeners = useCallback((id, overlay) => {
    const g = window.google.maps;
    const recalc = () => {
      const sqft = computeSqft(overlay);
      setShapes(prev => prev.map(s => s.id === id ? { ...s, sqft } : s));
      setIsDirty(true);
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

  const addShape = useCallback((overlay, kind, presetLabel) => {
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
      const label = presetLabel || ((kind === 'area' ? 'Area ' : 'Exclude ') + sameKind);
      return [...prev, { id, kind, sqft, label, hidden: false }];
    });
    setIsDirty(true);
  }, [attachEditListeners, computeSqft]);

  // ---- Initialize map + drawing manager + projection overlay ----
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;
    const g = window.google.maps;

    const map = new g.Map(mapRef.current, {
      center: { lat: 40.8136, lng: -96.7026 },
      zoom: 18,
      mapTypeId: mapTypeRef.current,
      tilt: 0,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      rotateControl: false,
      zoomControl: true,
      zoomControlOptions: { position: g.ControlPosition.RIGHT_TOP },
      gestureHandling: 'greedy',
    });
    mapInstanceRef.current = map;

    // Hidden overlay used purely to access the projection (screen px → LatLng) for freehand.
    const Overlay = function () {};
    Overlay.prototype = new g.OverlayView();
    Overlay.prototype.onAdd = function () {};
    Overlay.prototype.draw = function () {};
    Overlay.prototype.onRemove = function () {};
    const overlay = new Overlay();
    overlay.setMap(map);
    projectionOverlayRef.current = overlay;

    const drawingManager = new g.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions:   { fillColor: AREA_FILL, strokeColor: AREA_STROKE, fillOpacity: 0.3, strokeWeight: 2, editable: true },
      rectangleOptions: { fillColor: AREA_FILL, strokeColor: AREA_STROKE, fillOpacity: 0.3, strokeWeight: 2, editable: true },
      circleOptions:    { fillColor: AREA_FILL, strokeColor: AREA_STROKE, fillOpacity: 0.3, strokeWeight: 2, editable: true },
    });
    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    const onComplete = (shape) => {
      const kind = drawingManager.__kind || 'area';
      addShape(shape, kind);
      drawingManager.setDrawingMode(null);
      setActiveTool(null);
    };
    g.event.addListener(drawingManager, 'polygoncomplete',   onComplete);
    g.event.addListener(drawingManager, 'rectanglecomplete', onComplete);
    g.event.addListener(drawingManager, 'circlecomplete',    onComplete);

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
          if (panoInstanceRef.current && panoInstanceRef.current.getVisible()) {
            panoInstanceRef.current.setPosition(place.geometry.location);
          }
        }
      });
    }
  }, [mapsLoaded, addShape]);

  // ---- Tool selection ----
  const cancelDrawing = useCallback(() => {
    const dm = drawingManagerRef.current;
    if (dm) { dm.setDrawingMode(null); dm.__kind = null; }
    // Clean up freehand if active
    if (freehandStateRef.current) {
      freehandStateRef.current.cleanup?.();
      freehandStateRef.current = null;
    }
    setActiveTool(null);
  }, []);

  // Freehand drawing implementation. Uses pointer events on the map's div
  // and the projection overlay to convert screen points to LatLngs.
  const startFreehand = useCallback((kind) => {
    const map = mapInstanceRef.current;
    const overlay = projectionOverlayRef.current;
    const g = window.google.maps;
    if (!map || !overlay) return;

    // Save & disable map gestures so dragging draws instead of panning.
    const prevDraggable = map.get('draggable');
    const prevGesture = map.get('gestureHandling');
    map.setOptions({ draggable: false, gestureHandling: 'none' });

    const div = map.getDiv();
    const previewColor = kind === 'exclusion' ? EXCLUSION_STROKE : AREA_STROKE;

    const polyline = new g.Polyline({
      map,
      strokeColor: previewColor,
      strokeOpacity: 0.95,
      strokeWeight: 3,
      clickable: false,
      path: [],
    });

    const points = [];
    let drawing = false;

    const screenToLatLng = (x, y) => {
      const rect = div.getBoundingClientRect();
      const projection = overlay.getProjection();
      if (!projection) return null;
      return projection.fromContainerPixelToLatLng(
        new g.Point(x - rect.left, y - rect.top)
      );
    };

    const onDown = (e) => {
      const t = e.touches?.[0] || e;
      const ll = screenToLatLng(t.clientX, t.clientY);
      if (!ll) return;
      drawing = true;
      points.length = 0;
      points.push(ll);
      polyline.setPath([ll]);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!drawing) return;
      const t = e.touches?.[0] || e;
      const ll = screenToLatLng(t.clientX, t.clientY);
      if (!ll) return;
      // Sample-down: only push if moved more than ~2 px
      const last = points[points.length - 1];
      if (last && g.geometry.spherical.computeDistanceBetween(last, ll) < 0.3) return;
      points.push(ll);
      polyline.getPath().push(ll);
      e.preventDefault();
    };
    const onUp = () => {
      if (!drawing) return;
      drawing = false;
      polyline.setMap(null);

      if (points.length >= 3) {
        // Simplify slightly: drop near-duplicate points
        const simplified = [points[0]];
        for (let i = 1; i < points.length; i++) {
          const last = simplified[simplified.length - 1];
          if (g.geometry.spherical.computeDistanceBetween(last, points[i]) > 0.4) {
            simplified.push(points[i]);
          }
        }
        const polygon = new g.Polygon({
          paths: simplified,
          fillColor: kind === 'exclusion' ? EXCLUSION_FILL : AREA_FILL,
          strokeColor: kind === 'exclusion' ? EXCLUSION_STROKE : AREA_STROKE,
          fillOpacity: kind === 'exclusion' ? 0.45 : 0.3,
          strokeWeight: 2,
          editable: true,
          map,
        });
        addShape(polygon, kind);
      }
      cleanup();
    };

    const cleanup = () => {
      div.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      div.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove, { passive: false });
      window.removeEventListener('touchend', onUp);
      map.setOptions({ draggable: prevDraggable !== false, gestureHandling: prevGesture || 'greedy' });
      div.classList.remove('measure-cursor-cross');
      freehandStateRef.current = null;
      setActiveTool(null);
    };

    div.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    div.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    div.classList.add('measure-cursor-cross');
    freehandStateRef.current = { cleanup };
  }, [addShape]);

  const selectTool = useCallback((toolId) => {
    const dm = drawingManagerRef.current;
    if (!dm) return;
    if (toolId === activeTool || toolId == null) {
      cancelDrawing();
      return;
    }
    // Always clear any prior freehand state first
    if (freehandStateRef.current) {
      freehandStateRef.current.cleanup?.();
      freehandStateRef.current = null;
    }
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) return;
    const g = window.google.maps;

    if (tool.shape === 'freehand') {
      dm.setDrawingMode(null);
      setActiveTool(toolId);
      startFreehand(tool.kind);
      return;
    }

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
  }, [activeTool, cancelDrawing, startFreehand]);

  const removeShape = useCallback((id) => {
    const overlay = shapesRef.current.get(id);
    if (overlay) overlay.setMap(null);
    shapesRef.current.delete(id);
    setShapes(prev => prev.filter(s => s.id !== id));
    setIsDirty(true);
  }, []);

  const toggleHidden = useCallback((id) => {
    const overlay = shapesRef.current.get(id);
    setShapes(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = !s.hidden;
      if (overlay) overlay.setMap(next ? null : mapInstanceRef.current);
      return { ...s, hidden: next };
    }));
  }, []);

  const clearAllShapesOnly = useCallback(() => {
    shapesRef.current.forEach(o => o.setMap(null));
    shapesRef.current.clear();
    setShapes([]);
    candidateOverlaysRef.current.forEach(o => o.setMap(null));
    candidateOverlaysRef.current.clear();
    setCandidates([]);
  }, []);

  const clearAll = useCallback(() => {
    clearAllShapesOnly();
    setIsDirty(true);
  }, [clearAllShapesOnly]);

  // ---- Street View toggle (split pane: map on top, panorama on bottom) ----
  const toggleStreetView = useCallback(() => {
    setStreetViewActive(s => !s);
  }, []);

  // Move the panorama to a new location (used by search / customer select).
  const movePanoTo = useCallback((latlng) => {
    const pano = panoInstanceRef.current;
    if (pano && pano.getVisible()) pano.setPosition(latlng);
  }, []);

  // Initialize / show / hide the panorama in response to streetViewActive flips.
  // Done in an effect (not in the click handler) so the layout flip has settled
  // and the pano div has real dimensions before StreetViewPanorama is created.
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current || !panoRef.current) return;
    const map = mapInstanceRef.current;
    const g = window.google.maps;

    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const center = map.getCenter();

      if (streetViewActive) {
        if (!panoInstanceRef.current) {
          const pano = new g.StreetViewPanorama(panoRef.current, {
            position: center,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: true,
            fullscreenControl: false,
            motionTracking: false,
            motionTrackingControl: false,
            enableCloseButton: false,
            visible: true,
          });
          panoInstanceRef.current = pano;
          // Linking the pano so the pegman drag updates this panorama.
          map.setStreetView(pano);
        } else {
          panoInstanceRef.current.setPosition(center);
          panoInstanceRef.current.setVisible(true);
        }
      } else if (panoInstanceRef.current) {
        panoInstanceRef.current.setVisible(false);
      }

      // Tell both the map and pano to re-measure their containers.
      g.event.trigger(map, 'resize');
      if (panoInstanceRef.current && streetViewActive) {
        g.event.trigger(panoInstanceRef.current, 'resize');
      }
      if (center) map.setCenter(center);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [streetViewActive, mapsLoaded]);

  // ---- AR auto-calibration via Google's Elevation API ----
  // Looks up bare-earth elevation at the panorama camera and at every shape
  // vertex, so the projection can use the real ground-plane delta instead of a
  // hardcoded camera height. Falls back gracefully if the Elevation API is not
  // enabled on the Maps key.
  useEffect(() => {
    if (!arEnabled || !streetViewActive || !mapsLoaded) return;
    if (elevDisabledRef.current) return;
    const pano = panoInstanceRef.current;
    if (!pano) return;
    const g = window.google.maps;
    if (!g.ElevationService) return;
    if (!elevationServiceRef.current) elevationServiceRef.current = new g.ElevationService();

    const collectAndFetch = () => {
      if (elevFetchTimerRef.current) clearTimeout(elevFetchTimerRef.current);
      elevFetchTimerRef.current = setTimeout(async () => {
        const camPos = pano.getPosition();
        if (!camPos) return;
        const all = [camPos];
        shapes.forEach(s => {
          if (s.hidden) return;
          const overlay = shapesRef.current.get(s.id);
          if (!overlay) return;
          if (typeof overlay.getRadius === 'function') {
            all.push(overlay.getCenter());
          } else if (typeof overlay.getPath === 'function') {
            const path = overlay.getPath();
            for (let i = 0; i < path.getLength(); i++) all.push(path.getAt(i));
          } else if (typeof overlay.getBounds === 'function') {
            const b = overlay.getBounds();
            const ne = b.getNorthEast(), sw = b.getSouthWest();
            all.push(new g.LatLng(ne.lat(), sw.lng()));
            all.push(new g.LatLng(ne.lat(), ne.lng()));
            all.push(new g.LatLng(sw.lat(), ne.lng()));
            all.push(new g.LatLng(sw.lat(), sw.lng()));
          }
        });

        const cache = elevationCacheRef.current;
        const needs = [], needsKeys = [];
        for (const ll of all) {
          if (!ll) continue;
          const k = elevationKey(ll);
          if (!cache.has(k)) { needs.push(ll); needsKeys.push(k); }
        }
        if (needs.length === 0) {
          // Already have everything cached for this camera position.
          if (cache.has(elevationKey(camPos))) setElevAuto(true);
          return;
        }
        try {
          const result = await elevationServiceRef.current.getElevationForLocations({ locations: needs });
          if (result?.results) {
            result.results.forEach((r, i) => {
              if (r?.elevation != null) cache.set(needsKeys[i], r.elevation);
            });
            setElevAuto(true);
            setElevDataVersion(v => v + 1);
          }
        } catch (err) {
          // Elevation API may not be enabled on the key; degrade silently to
          // fallback and disable further lookups so we don't spam the console.
          console.warn('Elevation lookup failed; AR will use heuristic fallback:', err?.message || err);
          elevDisabledRef.current = true;
          setElevAuto(false);
        }
      }, 350);
    };

    collectAndFetch();
    const lPos = g.event.addListener(pano, 'position_changed', collectAndFetch);
    return () => {
      g.event.removeListener(lPos);
      if (elevFetchTimerRef.current) clearTimeout(elevFetchTimerRef.current);
    };
  }, [arEnabled, streetViewActive, shapes, mapsLoaded]);

  // ---- AR overlay: project measurement shapes into the Street View panorama ----
  // Assumes a flat ground plane CAMERA_HEIGHT below the panorama camera.
  // Caveats: no terrain elevation, no occlusion (draws through buildings).
  const drawAR = useCallback(() => {
    const pano = panoInstanceRef.current;
    const svg = arOverlayRef.current;
    const panoDiv = panoRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!pano || !panoDiv || !arEnabled || !streetViewActive || !pano.getVisible()) return;

    const w = panoDiv.clientWidth;
    const h = panoDiv.clientHeight;
    if (!w || !h) return;
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const g = window.google.maps;
    const camPos = pano.getPosition();
    if (!camPos) return;
    const pov = pano.getPov();
    const D2R = Math.PI / 180;
    // Typical Street View car camera height above the road surface.
    const ROAD_CAR_HEIGHT = 2.5;
    // Fallback when no elevation data is available (assume lawn ~0.5m above road).
    const FALLBACK_LAWN_DROP = 2.0;

    // Per-vertex elevation lookup: returns the effective camera-to-ground vertical
    // distance for a given target. When ElevationService data is cached for both
    // camera and target, uses the real ground-plane delta. Otherwise falls back
    // to the FALLBACK_LAWN_DROP heuristic. arGroundOffset is a manual nudge.
    const elevCache = elevationCacheRef.current;
    const camKey = elevationKey(camPos);
    const camElev = elevCache.get(camKey);
    const heightFor = (latlng) => {
      const tgtElev = elevCache.get(elevationKey(latlng));
      let h0;
      if (camElev != null && tgtElev != null) {
        h0 = ROAD_CAR_HEIGHT - (tgtElev - camElev);
      } else {
        h0 = FALLBACK_LAWN_DROP;
      }
      return Math.max(0.4, h0 + arGroundOffset);
    };

    // Horizontal FOV from zoom: zoom 1 ≈ 90°, doubles each step.
    const hFovRad = (180 / Math.pow(2, pov.zoom || 1)) * D2R;
    const focal = (w / 2) / Math.tan(hFovRad / 2);
    const NEAR = 0.5; // metres in front of camera

    const headingRad = (pov.heading || 0) * D2R;
    const pitchRad = (pov.pitch || 0) * D2R;
    const ch = Math.cos(headingRad), sh = Math.sin(headingRad);
    const cp = Math.cos(pitchRad), sp = Math.sin(pitchRad);

    // World vector from camera to a target latlng on the ground -> camera space
    const toCam = (latlng) => {
      const bearing = g.geometry.spherical.computeHeading(camPos, latlng) * D2R;
      const dist = Math.max(g.geometry.spherical.computeDistanceBetween(camPos, latlng), 0.5);
      const wx = Math.sin(bearing) * dist;
      const wy = -heightFor(latlng);
      const wz = Math.cos(bearing) * dist;
      // Inverse yaw (rotate world by -heading around Y so cam forward = +Z)
      const x1 = ch * wx - sh * wz;
      const z1 = sh * wx + ch * wz;
      // Inverse pitch (rotate by -pitch around X)
      const yCam = cp * wy - sp * z1;
      const zCam = sp * wy + cp * z1;
      return { x: x1, y: yCam, z: zCam };
    };

    const project = (cs) => ({
      x: w / 2 + focal * (cs.x / cs.z),
      y: h / 2 - focal * (cs.y / cs.z),
    });

    shapes.forEach(s => {
      if (s.hidden) return;
      const overlay = shapesRef.current.get(s.id);
      if (!overlay) return;

      // Collect vertices as LatLng[]
      let vertices = [];
      if (typeof overlay.getRadius === 'function') {
        const center = overlay.getCenter();
        const radius = overlay.getRadius();
        const N = 48;
        for (let i = 0; i < N; i++) {
          vertices.push(g.geometry.spherical.computeOffset(center, radius, (i / N) * 360));
        }
      } else if (typeof overlay.getBounds === 'function' && typeof overlay.getPath !== 'function') {
        const b = overlay.getBounds();
        const ne = b.getNorthEast(), sw = b.getSouthWest();
        vertices = [
          new g.LatLng(ne.lat(), sw.lng()),
          new g.LatLng(ne.lat(), ne.lng()),
          new g.LatLng(sw.lat(), ne.lng()),
          new g.LatLng(sw.lat(), sw.lng()),
        ];
      } else if (typeof overlay.getPath === 'function') {
        const path = overlay.getPath();
        for (let i = 0; i < path.getLength(); i++) vertices.push(path.getAt(i));
      }
      if (vertices.length < 3) return;

      const camPts = vertices.map(toCam);

      // Sutherland-Hodgman clip against z = NEAR so polygons crossing the camera
      // plane don't project to nonsense (huge / inverted coordinates).
      const clipped = [];
      for (let i = 0; i < camPts.length; i++) {
        const cur = camPts[i];
        const next = camPts[(i + 1) % camPts.length];
        const curIn = cur.z >= NEAR;
        const nextIn = next.z >= NEAR;
        if (curIn) {
          clipped.push(cur);
          if (!nextIn) {
            const t = (NEAR - cur.z) / (next.z - cur.z);
            clipped.push({
              x: cur.x + t * (next.x - cur.x),
              y: cur.y + t * (next.y - cur.y),
              z: NEAR,
            });
          }
        } else if (nextIn) {
          const t = (NEAR - cur.z) / (next.z - cur.z);
          clipped.push({
            x: cur.x + t * (next.x - cur.x),
            y: cur.y + t * (next.y - cur.y),
            z: NEAR,
          });
        }
      }
      if (clipped.length < 3) return;

      const screenPts = clipped.map(project);
      const inBounds = screenPts.some(p => p.x >= -w && p.x <= 2 * w && p.y >= -h && p.y <= 2 * h);
      if (!inBounds) return;

      const isEx = s.kind === 'exclusion';
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', screenPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
      polygon.setAttribute('fill', isEx ? EXCLUSION_FILL : AREA_FILL);
      polygon.setAttribute('fill-opacity', isEx ? '0.55' : '0.4');
      polygon.setAttribute('stroke', isEx ? EXCLUSION_STROKE : AREA_STROKE);
      polygon.setAttribute('stroke-width', '2');
      polygon.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(polygon);

      // Edge length labels in AR. Skip circles (no straight edges).
      if (showEdgeLabels && typeof overlay.getRadius !== 'function') {
        for (let i = 0; i < vertices.length; i++) {
          const a = vertices[i];
          const b = vertices[(i + 1) % vertices.length];
          const distM = g.geometry.spherical.computeDistanceBetween(a, b);
          const distFt = distM * 3.28084;
          const mid = g.geometry.spherical.interpolate(a, b, 0.5);
          const midCam = toCam(mid);
          if (midCam.z < NEAR) continue;
          const lsx = w / 2 + focal * (midCam.x / midCam.z);
          const lsy = h / 2 - focal * (midCam.y / midCam.z);
          if (lsx < -50 || lsx > w + 50 || lsy < -50 || lsy > h + 50) continue;

          const text = `${distFt < 100 ? distFt.toFixed(1) : distFt.toFixed(0)} ft`;
          const tnode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          tnode.setAttribute('x', lsx.toFixed(1));
          tnode.setAttribute('y', lsy.toFixed(1));
          tnode.setAttribute('text-anchor', 'middle');
          tnode.setAttribute('dominant-baseline', 'middle');
          tnode.setAttribute('font-size', '13');
          tnode.setAttribute('font-weight', '700');
          tnode.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
          tnode.setAttribute('fill', '#fff');
          tnode.setAttribute('stroke', 'rgba(0,0,0,0.85)');
          tnode.setAttribute('stroke-width', '4');
          tnode.setAttribute('paint-order', 'stroke fill');
          tnode.textContent = text;
          svg.appendChild(tnode);
        }
      }
    });
  }, [arEnabled, streetViewActive, shapes, arGroundOffset, showEdgeLabels]);

  // Re-draw the AR overlay when elevation data lands. drawAR reads the cache
  // via ref so its identity doesn't change with elevDataVersion, but we still
  // need a kick to re-render with the new values.
  useEffect(() => {
    if (elevDataVersion === 0) return;
    drawAR();
  }, [elevDataVersion, drawAR]);

  // Wire pano events (pov / position / resize) to redraw the AR overlay.
  useEffect(() => {
    const svg = arOverlayRef.current;
    if (!arEnabled || !streetViewActive || !panoInstanceRef.current) {
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      return;
    }
    const pano = panoInstanceRef.current;
    const g = window.google.maps;

    let raf = null;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; drawAR(); });
    };
    const lPov = g.event.addListener(pano, 'pov_changed', schedule);
    const lPos = g.event.addListener(pano, 'position_changed', schedule);
    const onResize = () => schedule();
    window.addEventListener('resize', onResize);

    schedule();

    return () => {
      g.event.removeListener(lPov);
      g.event.removeListener(lPos);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [arEnabled, streetViewActive, drawAR]);

  // ---- Edge length labels: HTML overlays at the midpoint of each polygon edge ----
  // Renders only when showEdgeLabels is on. Uses google.maps.OverlayView so the
  // labels reposition automatically when the user pans / zooms the map.
  useEffect(() => {
    // Always clear existing labels first.
    edgeLabelOverlaysRef.current.forEach(arr => arr.forEach(o => o.setMap(null)));
    edgeLabelOverlaysRef.current.clear();

    if (!showEdgeLabels || !mapsLoaded || !mapInstanceRef.current) return;
    const g = window.google.maps;
    if (!g?.OverlayView) return;
    const map = mapInstanceRef.current;

    // Lazy-define the OverlayView subclass once google.maps is available.
    // Uses prototype assignment instead of `class` because react-hooks/eslint
    // rejects inline class declarations inside a hook.
    if (!edgeLabelClassRef.current) {
      function EdgeLabel(position, text) {
        this.position_ = position;
        this.text_ = text;
        this.div_ = null;
      }
      EdgeLabel.prototype = new g.OverlayView();
      EdgeLabel.prototype.onAdd = function () {
        const div = document.createElement('div');
        div.className = 'measure-edge-label';
        div.textContent = this.text_;
        this.div_ = div;
        this.getPanes().floatPane.appendChild(div);
      };
      EdgeLabel.prototype.draw = function () {
        const proj = this.getProjection();
        if (!proj || !this.div_) return;
        const px = proj.fromLatLngToDivPixel(this.position_);
        if (px) {
          this.div_.style.left = `${px.x}px`;
          this.div_.style.top = `${px.y}px`;
        }
      };
      EdgeLabel.prototype.onRemove = function () {
        if (this.div_ && this.div_.parentNode) {
          this.div_.parentNode.removeChild(this.div_);
        }
        this.div_ = null;
      };
      edgeLabelClassRef.current = EdgeLabel;
    }
    const EdgeLabelCtor = edgeLabelClassRef.current;

    shapes.forEach(s => {
      if (s.hidden) return;
      const overlay = shapesRef.current.get(s.id);
      if (!overlay) return;
      // Skip circles (no straight edges to label).
      if (typeof overlay.getRadius === 'function') return;

      let vertices = [];
      if (typeof overlay.getBounds === 'function' && typeof overlay.getPath !== 'function') {
        const b = overlay.getBounds();
        const ne = b.getNorthEast(), sw = b.getSouthWest();
        vertices = [
          new g.LatLng(ne.lat(), sw.lng()),
          new g.LatLng(ne.lat(), ne.lng()),
          new g.LatLng(sw.lat(), ne.lng()),
          new g.LatLng(sw.lat(), sw.lng()),
        ];
      } else if (typeof overlay.getPath === 'function') {
        const path = overlay.getPath();
        for (let i = 0; i < path.getLength(); i++) vertices.push(path.getAt(i));
      }
      if (vertices.length < 2) return;

      const labels = [];
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        const distM = g.geometry.spherical.computeDistanceBetween(a, b);
        const distFt = distM * 3.28084;
        const mid = g.geometry.spherical.interpolate(a, b, 0.5);
        const label = new EdgeLabelCtor(mid, `${distFt < 100 ? distFt.toFixed(1) : distFt.toFixed(0)} ft`);
        label.setMap(map);
        labels.push(label);
      }
      edgeLabelOverlaysRef.current.set(s.id, labels);
    });
  }, [showEdgeLabels, shapes, mapsLoaded]);

  // ---- Map type toggle (replaces Google's mapTypeControl that we hid) ----
  const cycleMapType = useCallback(() => {
    const types = ['satellite', 'hybrid', 'roadmap'];
    const idx = types.indexOf(mapTypeRef.current);
    const next = types[(idx + 1) % types.length];
    mapTypeRef.current = next;
    setMapTypeId(next);
    if (mapInstanceRef.current) mapInstanceRef.current.setMapTypeId(next);
  }, []);

  // ---- Auto-detect buildings via Overpass ----
  const acceptCandidate = useCallback((cid) => {
    const overlay = candidateOverlaysRef.current.get(cid);
    if (!overlay) return;
    candidateOverlaysRef.current.delete(cid);
    addShape(overlay, 'exclusion');
    setCandidates(prev => prev.filter(c => c.id !== cid));
  }, [addShape]);

  const acceptAllCandidates = useCallback(() => {
    Array.from(candidateOverlaysRef.current.keys()).forEach(acceptCandidate);
  }, [acceptCandidate]);

  const dismissCandidates = useCallback(() => {
    candidateOverlaysRef.current.forEach(o => o.setMap(null));
    candidateOverlaysRef.current.clear();
    setCandidates([]);
  }, []);

  const detectBuildings = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    setDetecting(true);

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
        if (sqft < 30) { overlay.setMap(null); return; }
        const cid = `cand-${el.id}`;
        candidateOverlaysRef.current.set(cid, overlay);
        found.push({ id: cid, sqft, tag: el.tags?.building || 'building' });
        overlay.addListener('click', () => acceptCandidate(cid));
      });
      setCandidates(found);
      if (found.length === 0) {
        showToast('No buildings found in this view. Try zooming or panning.', 'info');
      } else {
        showToast(`Found ${found.length} building${found.length === 1 ? '' : 's'}. Tap to subtract.`, 'success');
      }
    } catch (err) {
      console.error('Building detection failed', err);
      showToast('Could not load building data. Try again.', 'error');
    } finally {
      setDetecting(false);
    }
  }, [acceptCandidate, showToast]);

  // ---- Per-customer save / load ----
  const loadFromCustomer = useCallback((customer) => {
    if (!customer) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const g = window.google.maps;

    clearAllShapesOnly();

    const stored = customer.measurements;
    if (!stored?.shapes?.length) {
      setIsDirty(false);
      return;
    }
    stored.shapes.forEach((def) => {
      const overlay = dataToOverlay(g, map, def, def.kind);
      const id = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      shapesRef.current.set(id, overlay);
      attachEditListeners(id, overlay);
      const sqft = computeSqft(overlay);
      setShapes(prev => [...prev, { id, kind: def.kind, sqft, label: def.label || (def.kind === 'area' ? 'Area' : 'Exclude'), hidden: false }]);
    });

    if (stored.center) {
      map.setCenter(stored.center);
      if (stored.zoom) map.setZoom(stored.zoom);
    }
    setIsDirty(false);
  }, [attachEditListeners, computeSqft, clearAllShapesOnly]);

  const handleSelectCustomer = useCallback((customer) => {
    setActiveCustomerId(customer.id);
    setShowCustomerAddresses(false);
    if (searchInputRef.current && customer.address) {
      searchInputRef.current.value = `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.zip || ''}`.trim();
      setHasSearchText(true);
    }
    // If the customer has measurements, restore them. Otherwise just go to address.
    if (customer.measurements?.shapes?.length) {
      loadFromCustomer(customer);
      // Center to stored center if present, else geocode address
      const stored = customer.measurements;
      if (stored.center) {
        movePanoTo(stored.center);
      } else if (customer.address && mapInstanceRef.current) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}` }, (results, status) => {
          if (status === 'OK' && results[0]) {
            mapInstanceRef.current.setCenter(results[0].geometry.location);
            mapInstanceRef.current.setZoom(20);
            movePanoTo(results[0].geometry.location);
          }
        });
      }
      showToast(`Loaded ${stored.shapes.length} saved shape${stored.shapes.length === 1 ? '' : 's'}.`, 'success');
    } else if (customer.address && mapInstanceRef.current) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}` }, (results, status) => {
        if (status === 'OK' && results[0]) {
          mapInstanceRef.current.setCenter(results[0].geometry.location);
          mapInstanceRef.current.setZoom(20);
          movePanoTo(results[0].geometry.location);
        }
      });
    }
  }, [loadFromCustomer, showToast, movePanoTo]);

  const saveToCustomer = useCallback(async () => {
    if (!activeCustomer) {
      showToast('Pick a customer first.', 'info');
      return;
    }
    const defs = [];
    shapes.forEach(s => {
      const overlay = shapesRef.current.get(s.id);
      const def = overlayToData(overlay, s.kind, s.label);
      if (def) defs.push(def);
    });
    const map = mapInstanceRef.current;
    const center = map ? { lat: map.getCenter().lat(), lng: map.getCenter().lng() } : null;
    const zoom = map ? map.getZoom() : null;
    const totalSqft = shapes.filter(s => !s.hidden && s.kind === 'area').reduce((a, b) => a + b.sqft, 0)
      - shapes.filter(s => !s.hidden && s.kind === 'exclusion').reduce((a, b) => a + b.sqft, 0);

    const measurements = {
      shapes: defs,
      center,
      zoom,
      totalSqft: Math.max(0, totalSqft),
      updatedAt: new Date().toISOString(),
    };
    try {
      await updateCustomer(activeCustomer.id, { measurements });
      setIsDirty(false);
      showToast(`Saved ${defs.length} shape${defs.length === 1 ? '' : 's'} to ${activeCustomer.firstName || 'customer'}.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Save failed. See console.', 'error');
    }
  }, [activeCustomer, shapes, updateCustomer, showToast]);

  const detachCustomer = useCallback(() => {
    setActiveCustomerId(null);
  }, []);

  // ---- Search ----
  const copyToClipboard = useCallback((value, label) => {
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);

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
        movePanoTo(results[0].geometry.location);
      }
    });
  }, [movePanoTo]);

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

  useEffect(() => () => {
    shapesRef.current.forEach(o => o?.setMap?.(null));
    shapesRef.current.clear();
    candidateOverlaysRef.current.forEach(o => o?.setMap?.(null));
    candidateOverlaysRef.current.clear();
    edgeLabelOverlaysRef.current.forEach(arr => arr.forEach(o => o?.setMap?.(null)));
    edgeLabelOverlaysRef.current.clear();
    if (elevFetchTimerRef.current) clearTimeout(elevFetchTimerRef.current);
    if (freehandStateRef.current) freehandStateRef.current.cleanup?.();
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
  const customersWithMeasurements = customers.filter(c => c.measurements?.shapes?.length).length;

  return (
    <div className="measure-page page animate-fade-in">
      <div className={`measure-stage ${streetViewActive ? 'split-streetview' : ''}`}>
        <div ref={mapRef} className="measure-map-canvas" />
        <div className="measure-pano-wrap">
          <div ref={panoRef} className="measure-pano-canvas" />
          <svg ref={arOverlayRef} className="measure-ar-overlay" />
          {streetViewActive && (
            <div className="measure-ar-controls">
              <button
                className={`measure-ar-btn ${arEnabled ? 'active' : ''}`}
                onClick={() => setArEnabled(s => !s)}
                title={arEnabled ? 'Hide measurements in street view' : 'Project measurements onto street view (beta)'}
              >
                <Eye size={14} />
                <span>{arEnabled ? 'AR On' : 'AR Off'}</span>
              </button>
              {arEnabled && (
                <div className="measure-ar-adjust">
                  {elevAuto && (
                    <span className="measure-ar-auto-pill" title="Using Google Elevation API per vertex">
                      Auto
                    </span>
                  )}
                  <button
                    className="measure-ar-step"
                    onClick={() => setArGroundOffset(o => Math.max(-1.5, +(o - 0.2).toFixed(1)))}
                    title="Raise overlay (lawn appears more elevated)"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <span className="measure-ar-step-val" title="Manual offset on top of auto-elevation">
                    {arGroundOffset > 0 ? '+' : ''}{arGroundOffset.toFixed(1)}m
                  </span>
                  <button
                    className="measure-ar-step"
                    onClick={() => setArGroundOffset(o => Math.min(2.0, +(o + 0.2).toFixed(1)))}
                    title="Lower overlay (lawn appears further below)"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
              title="Customer list"
              style={{ padding: '4px 8px' }}
            >
              <FolderOpen size={16} />
              {customersWithMeasurements > 0 && (
                <span className="measure-saved-badge">{customersWithMeasurements}</span>
              )}
            </button>
          )}
        </div>

        {showCustomerAddresses && (
          <div className="measure-customer-dropdown">
            <div className="measure-customer-header">Customers · click to load saved yard</div>
            {customers.filter(c => c.address).map(c => {
              const hasMeasurements = !!c.measurements?.shapes?.length;
              return (
                <button
                  key={c.id}
                  className="measure-customer-item"
                  onClick={() => handleSelectCustomer(c)}
                >
                  <MapPin size={14} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {c.firstName} {c.lastName}
                      {hasMeasurements && (
                        <span className="measure-saved-pill">
                          {c.measurements.shapes.length} saved
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.address}, {c.city}</div>
                  </div>
                </button>
              );
            })}
            {customers.filter(c => c.address).length === 0 && (
              <div style={{ padding: '12px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                No customers with addresses yet.
              </div>
            )}
          </div>
        )}

        {/* Active customer indicator */}
        {activeCustomer && (
          <div className="measure-active-customer">
            <User size={14} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Working on</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeCustomer.firstName} {activeCustomer.lastName}
              </div>
            </div>
            {isDirty && <span className="measure-dirty-dot" title="Unsaved changes" />}
            <button
              className="btn btn-primary btn-sm"
              onClick={saveToCustomer}
              disabled={!isDirty}
              title="Save to this customer"
              style={{ padding: '4px 8px' }}
            >
              <Save size={14} />
            </button>
            <button className="measure-search-clear" onClick={detachCustomer} title="Detach customer">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Net total chip */}
        <div className="measure-net-chip" aria-live="polite">
          <div>
            <div className="measure-net-label">Net Area</div>
            <div className="measure-net-value">
              {totals.net.toLocaleString()}<span> sqft</span>
            </div>
          </div>
          {totals.exclusionTotal > 0 && (
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

        {/* Map type toggle (replaces Google's hidden mapTypeControl) */}
        <button className="measure-maptype-btn" onClick={cycleMapType} title="Cycle map type">
          <Layers size={14} />
          <span>{mapTypeId === 'satellite' ? 'Satellite' : mapTypeId === 'hybrid' ? 'Hybrid' : 'Map'}</span>
        </button>

        {/* Street View toggle — opens a split panorama beneath the map */}
        <button
          className={`measure-streetview-btn ${streetViewActive ? 'active' : ''}`}
          onClick={toggleStreetView}
          title={streetViewActive ? 'Hide street view' : 'Show street view'}
        >
          <PersonStanding size={14} />
          <span>{streetViewActive ? 'Hide SV' : 'Street View'}</span>
        </button>

        {/* Floating toolbar */}
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

          <button
            className={`measure-tool-btn ${showEdgeLabels ? 'active' : ''}`}
            onClick={() => setShowEdgeLabels(s => !s)}
            title="Show length of each edge in feet"
          >
            <Ruler size={16} />
            <span className="measure-tool-label">Lengths</span>
          </button>

          {(shapes.length > 0 || candidates.length > 0) && (
            <button className="measure-tool-btn measure-tool-danger" onClick={clearAll} title="Clear all">
              <Trash2 size={16} />
              <span className="measure-tool-label">Clear</span>
            </button>
          )}
        </div>

        {activeTool && (
          <div className="measure-drawing-hint">
            <Pencil size={14} />
            <span>
              {activeTool.includes('freehand')
                ? 'Press and drag to draw a free shape. Release to finish.'
                : activeTool.includes('exclude')
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
                  Pick a tool. Use <strong>Subtract</strong> or <strong>Detect Buildings</strong> to remove
                  driveways, houses, sheds. Pick a customer from the folder icon to load or save a yard.
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
                      <button className="btn btn-ghost btn-sm" onClick={() => copyToClipboard(s.sqft, s.id)} title="Copy">
                        {copied === s.id ? <CheckCircle size={14} /> : <Copy size={14} />}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleHidden(s.id)} title={s.hidden ? 'Show' : 'Hide'}>
                        {s.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeShape(s.id)} title="Delete" style={{ color: 'var(--status-danger)' }}>
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
