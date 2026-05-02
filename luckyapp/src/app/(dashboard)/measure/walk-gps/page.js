'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Footprints, Plus, Undo2, Check, X, AlertTriangle, ArrowLeft, MapPin, Crosshair,
} from 'lucide-react';

const SQM_TO_SQFT = 10.7639;
const RESULT_KEY = 'lucky_measure_walk_result';

// Equirectangular projection of geo points to a local meters frame around a
// reference point, then shoelace for area. For residential lots (<¼ mile)
// the equirectangular error is negligible.
function geoPolygonSqm(geoPoints) {
  if (geoPoints.length < 3) return 0;
  const lat0 = geoPoints[0].lat * Math.PI / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat0);
  const xy = geoPoints.map(p => ({
    x: (p.lng - geoPoints[0].lng) * mPerDegLng,
    y: (p.lat - geoPoints[0].lat) * mPerDegLat,
  }));
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export default function MeasureWalkGpsPage() {
  const router = useRouter();
  const watchIdRef = useRef(null);

  const [supportState, setSupportState] = useState('checking'); // checking | supported | denied | unsupported
  const [supportError, setSupportError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState(null); // {lat, lng, accuracy}
  const [geoPoints, setGeoPoints] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setSupportState('unsupported');
      return;
    }
    setSupportState('supported');
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) return;
    setTracking(true);
    setGeoPoints([]);
    setPosition(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, // metres
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setSupportState('denied');
          setSupportError('Location permission was denied. Enable it in Settings → Safari/Chrome → Location.');
        } else {
          showToast(err.message || 'GPS error', 'error');
        }
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
  }, [showToast]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const dropPoint = useCallback(() => {
    if (!position) return;
    setGeoPoints(prev => [...prev, { lat: position.lat, lng: position.lng }]);
  }, [position]);

  const undoPoint = useCallback(() => {
    setGeoPoints(prev => prev.slice(0, -1));
  }, []);

  const cancel = useCallback(() => {
    stopTracking();
    router.push('/measure');
  }, [router, stopTracking]);

  const finish = useCallback(() => {
    if (geoPoints.length < 3) {
      showToast('Drop at least 3 points to close the perimeter.', 'info');
      return;
    }
    const sqm = geoPolygonSqm(geoPoints);
    const sqft = Math.round(sqm * SQM_TO_SQFT);
    try {
      sessionStorage.setItem(RESULT_KEY, JSON.stringify({
        sqft,
        geoPoints,
        capturedAt: new Date().toISOString(),
        source: 'gps-walk',
      }));
    } catch { /* private mode etc — no-op */ }
    stopTracking();
    router.push('/measure');
  }, [geoPoints, stopTracking, router, showToast]);

  const liveSqft = (() => {
    if (geoPoints.length < 3) return 0;
    return Math.round(geoPolygonSqm(geoPoints) * SQM_TO_SQFT);
  })();

  // ---- Render ----

  if (supportState === 'checking') {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Checking location support…</p>
      </div>
    );
  }

  if (supportState === 'unsupported' || supportState === 'denied') {
    return (
      <div className="page" style={{ padding: 'var(--space-lg)', maxWidth: 520, margin: '0 auto' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/measure')} style={{ marginBottom: 'var(--space-lg)' }}>
          <ArrowLeft size={14} /> Back to Measure
        </button>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--status-warning)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
          <AlertTriangle size={32} style={{ color: 'var(--status-warning)', marginBottom: 'var(--space-md)' }} />
          <h2 style={{ marginTop: 0 }}>Location {supportState === 'denied' ? 'denied' : 'unavailable'}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {supportError || 'This browser does not expose geolocation. Use a recent Safari, Chrome, or Firefox over HTTPS.'}
          </p>
        </div>
      </div>
    );
  }

  // supported — landing or tracking
  return (
    <div className="page" style={{ padding: 'var(--space-lg)', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <button className="btn btn-ghost btn-sm" onClick={cancel}>
          <ArrowLeft size={14} /> Back
        </button>
        <h1 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Footprints size={20} /> GPS Walk
        </h1>
      </div>

      {!tracking ? (
        <>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
            <h3 style={{ marginTop: 0 }}>How it works</h3>
            <ol style={{ paddingLeft: 'var(--space-lg)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <li>Stand at the first corner of the property.</li>
              <li>Tap <strong>Start</strong> and grant location permission.</li>
              <li>Wait for the accuracy reading to stabilize (under 10m is good).</li>
              <li>Tap <strong>Drop Point</strong>, walk to the next corner, drop again.</li>
              <li>After the last corner, tap <strong>Finish</strong>.</li>
            </ol>
            <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid var(--status-warning)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginTop: 'var(--space-md)' }}>
              <strong>Accuracy:</strong> Consumer GPS is ±3–10 m. For lots under ¼ acre this can produce 10–20% error. Best for ¼ acre+. The result drops at the correct map location, so you can edit corners on the satellite afterward.
            </div>
          </div>

          <button className="btn btn-primary" onClick={startTracking} style={{ minHeight: 56, fontSize: '1.05rem' }}>
            <Crosshair size={20} /> Start
          </button>
        </>
      ) : (
        <>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Accuracy</span>
              <span style={{ fontWeight: 600, color: position ? (position.accuracy < 10 ? 'var(--lucky-green-light)' : position.accuracy < 25 ? 'var(--status-warning)' : 'var(--status-danger)') : 'var(--text-tertiary)' }}>
                {position ? `±${Math.round(position.accuracy)} m` : 'acquiring…'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Points placed</span>
              <span style={{ fontWeight: 600 }}>{geoPoints.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Live area</span>
              <span style={{ fontWeight: 700, fontSize: '1.4rem', color: 'var(--lucky-green-light)' }}>
                {liveSqft.toLocaleString()} sqft
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
              Estimate — GPS drift ±{position ? Math.round(position.accuracy) : '?'} m. Round to whole sqft.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-md)' }}>
            <button
              className="btn btn-primary"
              onClick={dropPoint}
              disabled={!position}
              style={{ minHeight: 72, fontSize: '1.1rem' }}
            >
              <Plus size={24} /> Drop Point
            </button>
            <button
              className="btn btn-ghost"
              onClick={undoPoint}
              disabled={geoPoints.length === 0}
              style={{ minHeight: 72, minWidth: 72 }}
              aria-label="Undo last point"
            >
              <Undo2 size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <button className="btn btn-ghost" onClick={cancel} style={{ minHeight: 52 }}>
              <X size={16} /> Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={finish}
              disabled={geoPoints.length < 3}
              style={{ minHeight: 52, background: geoPoints.length >= 3 ? 'var(--lucky-green)' : undefined }}
            >
              <Check size={16} /> Finish
            </button>
          </div>

          {position && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} />
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </div>
          )}
        </>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <AlertTriangle size={16} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
