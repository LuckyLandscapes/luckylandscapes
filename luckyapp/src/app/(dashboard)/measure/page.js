'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '@/lib/data';
import {
  Ruler, Search, Trash2, Copy, MapPin, Plus, Minus, CheckCircle, Layers, X, SquareIcon, Loader2,
} from 'lucide-react';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

// Area polygon colors
const POLYGON_COLORS = [
  { fill: '#2d7a3a', stroke: '#1e5a28', label: 'Green' },
  { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Blue' },
  { fill: '#f59e0b', stroke: '#d97706', label: 'Amber' },
  { fill: '#ef4444', stroke: '#dc2626', label: 'Red' },
  { fill: '#8b5cf6', stroke: '#7c3aed', label: 'Purple' },
  { fill: '#ec4899', stroke: '#db2777', label: 'Pink' },
];

export default function MeasurePage() {
  const { customers } = useData();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [areas, setAreas] = useState([]);
  const [hasSearchText, setHasSearchText] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [copied, setCopied] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCustomerAddresses, setShowCustomerAddresses] = useState(false);

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    if (window.google?.maps?.Map) {
      setMapsLoaded(true);
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setMapsLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=drawing,geometry,places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => console.error('Failed to load Google Maps');
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 40.8136, lng: -96.7026 }, // Lincoln, NE
      zoom: 18,
      mapTypeId: 'satellite',
      tilt: 0,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: window.google.maps.ControlPosition.TOP_RIGHT,
      },
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_CENTER,
      },
    });
    mapInstanceRef.current = map;

    // Drawing manager
    const drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false, // We'll use our own controls
      polygonOptions: {
        fillColor: POLYGON_COLORS[0].fill,
        fillOpacity: 0.3,
        strokeColor: POLYGON_COLORS[0].stroke,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });
    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    // Listen for polygon completion
    window.google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon) => {
      const colorIndex = areas.length % POLYGON_COLORS.length;
      const area = window.google.maps.geometry.spherical.computeArea(polygon.getPath());
      const sqft = area * 10.7639; // Convert m² to sqft

      const newArea = {
        id: `area-${Date.now()}`,
        polygon,
        sqft: Math.round(sqft),
        label: `Area ${areas.length + 1}`,
        colorIndex,
      };

      setAreas(prev => [...prev, newArea]);
      drawingManager.setDrawingMode(null);
      setIsDrawing(false);

      // Listen for edits to recalculate
      ['set_at', 'insert_at', 'remove_at'].forEach(event => {
        window.google.maps.event.addListener(polygon.getPath(), event, () => {
          const updatedArea = window.google.maps.geometry.spherical.computeArea(polygon.getPath());
          const updatedSqft = Math.round(updatedArea * 10.7639);
          setAreas(prev => prev.map(a => a.id === newArea.id ? { ...a, sqft: updatedSqft } : a));
        });
      });
    });

    // Initialize Places autocomplete
    if (searchInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
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
  }, [mapsLoaded]);

  // Start drawing mode
  const startDrawing = useCallback(() => {
    if (!drawingManagerRef.current) return;

    const colorIndex = areas.length % POLYGON_COLORS.length;
    drawingManagerRef.current.setOptions({
      polygonOptions: {
        fillColor: POLYGON_COLORS[colorIndex].fill,
        fillOpacity: 0.3,
        strokeColor: POLYGON_COLORS[colorIndex].stroke,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });
    drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
    setIsDrawing(true);
  }, [areas.length]);

  // Cancel drawing
  const cancelDrawing = useCallback(() => {
    if (!drawingManagerRef.current) return;
    drawingManagerRef.current.setDrawingMode(null);
    setIsDrawing(false);
  }, []);

  // Remove area
  const removeArea = useCallback((areaId) => {
    setAreas(prev => {
      const area = prev.find(a => a.id === areaId);
      if (area?.polygon) {
        area.polygon.setMap(null);
      }
      return prev.filter(a => a.id !== areaId);
    });
  }, []);

  // Clear all areas
  const clearAll = useCallback(() => {
    areas.forEach(a => a.polygon?.setMap(null));
    setAreas([]);
  }, [areas]);

  // Copy to clipboard
  const copyToClipboard = useCallback((value, label) => {
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  // Navigate to customer address
  const goToAddress = useCallback((address) => {
    if (!mapInstanceRef.current) return;
    setIsSearching(true);

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      setIsSearching(false);
      if (status === 'OK' && results[0]) {
        mapInstanceRef.current.setCenter(results[0].geometry.location);
        mapInstanceRef.current.setZoom(20);
        if (searchInputRef.current) {
          searchInputRef.current.value = address;
        }
        setHasSearchText(true);
        setShowCustomerAddresses(false);
      }
    });
  }, []);

  // Handle Enter key for manual geocoding search
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchInputRef.current?.value?.trim();
      if (!query || !mapInstanceRef.current) return;

      // Dismiss any open autocomplete dropdown
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(c => c.style.display = 'none');

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
    }
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.focus();
    }
    setHasSearchText(false);
  }, []);

  // Total sqft
  const totalSqft = areas.reduce((sum, a) => sum + a.sqft, 0);

  // No API key message
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

  return (
    <div className="page animate-fade-in" style={{ height: 'calc(100vh - 0px)', display: 'flex', flexDirection: 'column', padding: 'var(--space-md) var(--space-xl)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexShrink: 0, flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ruler size={22} /> Measure
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Draw polygons on the satellite map to calculate square footage.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          {areas.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={clearAll}>
              <Trash2 size={14} /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Main content: Map + Panel */}
      <div style={{ display: 'flex', flex: 1, gap: 'var(--space-md)', minHeight: 0 }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
          {/* Search bar overlay */}
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
              <button
                className="measure-search-clear"
                onClick={clearSearch}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
            {customers.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowCustomerAddresses(!showCustomerAddresses)}
                title="Customer addresses"
                style={{ padding: '4px 8px' }}
              >
                <MapPin size={16} />
              </button>
            )}
          </div>

          {/* Customer addresses dropdown */}
          {showCustomerAddresses && (
            <div className="measure-customer-dropdown">
              <div style={{ padding: '8px 12px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-primary)' }}>
                Customer Addresses
              </div>
              {customers
                .filter(c => c.address)
                .map(c => (
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

          {/* Drawing controls overlay */}
          <div className="measure-draw-controls">
            {isDrawing ? (
              <button className="btn btn-danger btn-sm" onClick={cancelDrawing}>
                <X size={14} /> Cancel
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={startDrawing}>
                <Plus size={14} /> Draw Area
              </button>
            )}
          </div>

          {/* Map container */}
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '500px' }} />

          {/* Drawing hint overlay */}
          {isDrawing && (
            <div className="measure-drawing-hint">
              <SquareIcon size={16} />
              Click on the map to draw polygon points. Click the first point to close the shape.
            </div>
          )}
        </div>

        {/* Right panel — Area calculations */}
        <div className="measure-panel">
          <div className="measure-panel-header">
            <h3 style={{ fontSize: '0.95rem' }}>
              <Layers size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Measured Areas
            </h3>
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
              {areas.length} {areas.length === 1 ? 'area' : 'areas'}
            </span>
          </div>

          {/* Total */}
          {areas.length > 0 && (
            <div className="measure-total-card">
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Area</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--lucky-green-light)' }}>
                  {totalSqft.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>sqft</span>
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => copyToClipboard(totalSqft, 'total')}
                title="Copy total sqft"
              >
                {copied === 'total' ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied === 'total' ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          {/* Area cards */}
          <div className="measure-area-list">
            {areas.map((area, i) => (
              <div key={area.id} className="measure-area-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    className="measure-area-swatch"
                    style={{ background: POLYGON_COLORS[area.colorIndex]?.fill || '#666' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{area.label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {area.sqft.toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>sqft</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => copyToClipboard(area.sqft, area.id)}
                      title="Copy sqft"
                      style={{ padding: '4px 8px' }}
                    >
                      {copied === area.id ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeArea(area.id)}
                      title="Remove area"
                      style={{ padding: '4px 8px', color: 'var(--status-danger)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {areas.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl) var(--space-md)', color: 'var(--text-tertiary)' }}>
                <SquareIcon size={32} style={{ marginBottom: 'var(--space-sm)', opacity: 0.4 }} />
                <p style={{ fontSize: '0.82rem', marginBottom: 'var(--space-sm)' }}>No areas measured yet</p>
                <p style={{ fontSize: '0.75rem' }}>
                  Search an address, then click <strong>&quot;Draw Area&quot;</strong> to start measuring.
                </p>
              </div>
            )}
          </div>

          {/* Quick tips */}
          {areas.length === 0 && (
            <div className="measure-tips">
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Quick Tips
              </div>
              <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', listStyle: 'disc', paddingLeft: '16px' }}>
                <li>Search a customer address or enter any address</li>
                <li>Click &quot;Draw Area&quot; and outline the landscaping area</li>
                <li>Drag corners to adjust the polygon</li>
                <li>Copy sqft values to use in quotes</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <CheckCircle size={18} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
