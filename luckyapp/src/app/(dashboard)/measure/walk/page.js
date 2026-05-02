'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Footprints,
  Plus,
  Undo2,
  Check,
  X,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

const SQM_TO_SQFT = 10.7639;
const RESULT_KEY = 'lucky_measure_walk_result';

// Shoelace formula on the XZ plane (Y is up in WebXR local-floor space).
// Returns absolute area in square meters.
function polygonAreaSqm(points) {
  const n = points.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

export default function MeasureWalkPage() {
  const router = useRouter();

  // ---- DOM/Three refs ----
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const threeRef = useRef(null);          // imported THREE module
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const reticleRef = useRef(null);
  const pointsGroupRef = useRef(null);
  const lineRef = useRef(null);
  const xrSessionRef = useRef(null);
  const hitTestSourceRef = useRef(null);
  const localRefSpaceRef = useRef(null);
  const reticleVisibleRef = useRef(false);
  const reticlePoseRef = useRef(null);    // last reticle position {x,y,z} in local-floor

  // points stored as plain objects in local-floor metres
  const pointsRef = useRef([]);

  // ---- React state (drives the AR overlay UI) ----
  const [supportState, setSupportState] = useState('checking'); // 'checking' | 'supported' | 'unsupported' | 'error'
  const [supportError, setSupportError] = useState('');
  const [arActive, setArActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [areaSqft, setAreaSqft] = useState(0);
  const [reticleReady, setReticleReady] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  }, []);

  // ---- Feature detection ----
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        if (typeof navigator === 'undefined' || !navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') {
          if (!cancelled) setSupportState('unsupported');
          return;
        }
        const ok = await navigator.xr.isSessionSupported('immersive-ar');
        if (cancelled) return;
        setSupportState(ok ? 'supported' : 'unsupported');
      } catch (err) {
        if (cancelled) return;
        setSupportError(err?.message || String(err));
        setSupportState('error');
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  // ---- Recompute live area when points change ----
  const refreshAreaState = useCallback(() => {
    const pts = pointsRef.current;
    setPointCount(pts.length);
    if (pts.length >= 3) {
      const sqm = polygonAreaSqm(pts);
      setAreaSqft(Math.round(sqm * SQM_TO_SQFT));
    } else {
      setAreaSqft(0);
    }
  }, []);

  // ---- Rebuild scene helpers (anchors + polyline) ----
  const rebuildPolyline = useCallback(() => {
    const THREE = threeRef.current;
    const scene = sceneRef.current;
    if (!THREE || !scene) return;

    if (lineRef.current) {
      scene.remove(lineRef.current);
      lineRef.current.geometry.dispose();
      lineRef.current.material.dispose();
      lineRef.current = null;
    }

    const pts = pointsRef.current;
    if (pts.length < 2) return;

    const verts = [];
    for (const p of pts) verts.push(p.x, p.y, p.z);
    // Close the loop preview when ≥3 points
    if (pts.length >= 3) {
      const first = pts[0];
      verts.push(first.x, first.y, first.z);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x7dd87d, linewidth: 2 });
    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    scene.add(line);
    lineRef.current = line;
  }, []);

  const addAnchorMarker = useCallback((point) => {
    const THREE = threeRef.current;
    const group = pointsGroupRef.current;
    if (!THREE || !group) return;

    // Vertical pole + small base disc so the marker is visible from any angle.
    const markerGroup = new THREE.Group();
    markerGroup.position.set(point.x, point.y, point.z);

    const discGeo = new THREE.RingGeometry(0.05, 0.09, 24);
    const discMat = new THREE.MeshBasicMaterial({ color: 0x7dd87d, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    markerGroup.add(disc);

    const poleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8);
    const poleMat = new THREE.MeshBasicMaterial({ color: 0x2d7a3a });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.175;
    markerGroup.add(pole);

    group.add(markerGroup);
  }, []);

  const removeLastAnchorMarker = useCallback(() => {
    const group = pointsGroupRef.current;
    if (!group || group.children.length === 0) return;
    const last = group.children[group.children.length - 1];
    group.remove(last);
    last.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }, []);

  // ---- Drop / Undo / Finish handlers (declared before we wire them up) ----
  const handleDropPoint = useCallback(() => {
    if (!reticleVisibleRef.current || !reticlePoseRef.current) {
      showToast('Aim at the ground until the ring locks on, then tap.', 'error');
      return;
    }
    const p = { ...reticlePoseRef.current };
    pointsRef.current.push(p);
    addAnchorMarker(p);
    rebuildPolyline();
    refreshAreaState();
  }, [addAnchorMarker, rebuildPolyline, refreshAreaState, showToast]);

  const handleUndo = useCallback(() => {
    if (pointsRef.current.length === 0) return;
    pointsRef.current.pop();
    removeLastAnchorMarker();
    rebuildPolyline();
    refreshAreaState();
  }, [removeLastAnchorMarker, rebuildPolyline, refreshAreaState]);

  // ---- Cleanup XR + three resources, restore page state ----
  const teardownXR = useCallback(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      try { renderer.setAnimationLoop(null); } catch {}
      try { renderer.dispose(); } catch {}
      // Detach canvas from DOM
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    rendererRef.current = null;

    if (sceneRef.current) {
      sceneRef.current.traverse((obj) => {
        if (obj.geometry) {
          try { obj.geometry.dispose(); } catch {}
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => { try { m.dispose(); } catch {} });
          else { try { obj.material.dispose(); } catch {} }
        }
      });
    }
    sceneRef.current = null;
    cameraRef.current = null;
    reticleRef.current = null;
    pointsGroupRef.current = null;
    lineRef.current = null;
    hitTestSourceRef.current = null;
    localRefSpaceRef.current = null;
    xrSessionRef.current = null;
    reticleVisibleRef.current = false;
    reticlePoseRef.current = null;

    setArActive(false);
    setReticleReady(false);
  }, []);

  // ---- Start AR session ----
  const handleStartAR = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const THREE = await import('three');
      threeRef.current = THREE;

      // Reset any prior state
      pointsRef.current = [];
      setPointCount(0);
      setAreaSqft(0);

      if (!navigator.xr || typeof navigator.xr.requestSession !== 'function') {
        showToast('WebXR not available on this browser.', 'error');
        setStarting(false);
        return;
      }

      let session;
      try {
        session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['hit-test', 'local-floor'],
        });
      } catch (err) {
        const msg = err?.message || String(err);
        if (/denied|permission|NotAllowed/i.test(msg)) {
          showToast('Camera permission denied. Enable it in browser settings and retry.', 'error');
        } else if (/secure|https/i.test(msg)) {
          showToast('AR requires HTTPS. Open this page over a secure connection.', 'error');
        } else {
          showToast(`Could not start AR: ${msg}`, 'error');
        }
        setStarting(false);
        return;
      }

      xrSessionRef.current = session;

      // Build scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
      cameraRef.current = camera;

      // Renderer with XR enabled
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { xrCompatible: true, antialias: true, alpha: true })
              || canvas.getContext('webgl', { xrCompatible: true, antialias: true, alpha: true });
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local-floor');
      rendererRef.current = renderer;

      // Hide canvas behind UI but mounted in DOM
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.zIndex = '0';
      document.body.appendChild(canvas);

      // Reticle: a flat ring on the ground
      const reticleGeo = new THREE.RingGeometry(0.10, 0.13, 32).rotateX(-Math.PI / 2);
      const reticleMat = new THREE.MeshBasicMaterial({ color: 0x7dd87d });
      const reticle = new THREE.Mesh(reticleGeo, reticleMat);
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);
      reticleRef.current = reticle;

      // Group to hold dropped-point markers
      const pointsGroup = new THREE.Group();
      scene.add(pointsGroup);
      pointsGroupRef.current = pointsGroup;

      // Light (BasicMaterial doesn't need it but keep one for future)
      const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
      scene.add(ambient);

      await renderer.xr.setSession(session);

      // Reference spaces + hit-test source
      const localFloor = await session.requestReferenceSpace('local-floor');
      localRefSpaceRef.current = localFloor;
      const viewerSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      hitTestSourceRef.current = hitTestSource;

      const onSessionEnd = () => {
        teardownXR();
      };
      session.addEventListener('end', onSessionEnd);

      // Render loop
      renderer.setAnimationLoop((time, frame) => {
        if (!frame) return;
        const refSpace = localRefSpaceRef.current;
        const hts = hitTestSourceRef.current;
        if (refSpace && hts) {
          const results = frame.getHitTestResults(hts);
          if (results.length > 0) {
            const pose = results[0].getPose(refSpace);
            if (pose) {
              const m = pose.transform.matrix;
              reticle.matrix.fromArray(m);
              reticle.visible = true;
              const p = pose.transform.position;
              reticlePoseRef.current = { x: p.x, y: p.y, z: p.z };
              if (!reticleVisibleRef.current) {
                reticleVisibleRef.current = true;
                setReticleReady(true);
              }
            }
          } else {
            if (reticleVisibleRef.current) {
              reticleVisibleRef.current = false;
              setReticleReady(false);
            }
            reticle.visible = false;
          }
        }
        renderer.render(scene, camera);
      });

      setArActive(true);
      setStarting(false);
    } catch (err) {
      const msg = err?.message || String(err);
      showToast(`Failed to start AR: ${msg}`, 'error');
      teardownXR();
      setStarting(false);
    }
  }, [showToast, starting, teardownXR]);

  const handleCancel = useCallback(async () => {
    const session = xrSessionRef.current;
    if (session) {
      try { await session.end(); } catch {}
    } else {
      teardownXR();
    }
  }, [teardownXR]);

  const handleFinish = useCallback(async () => {
    const pts = pointsRef.current;
    if (pts.length < 3) {
      showToast('Drop at least 3 points before finishing.', 'error');
      return;
    }
    const sqm = polygonAreaSqm(pts);
    const sqft = Math.round(sqm * SQM_TO_SQFT);
    const payload = {
      sqft,
      points: pts.map((p) => ({ x: p.x, z: p.z })),
      capturedAt: new Date().toISOString(),
      source: 'webxr-walk',
    };
    try {
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(payload));
    } catch (err) {
      showToast('Could not save result to session storage.', 'error');
      return;
    }
    const session = xrSessionRef.current;
    if (session) {
      try { await session.end(); } catch {}
    } else {
      teardownXR();
    }
    router.push('/measure');
  }, [router, showToast, teardownXR]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      const session = xrSessionRef.current;
      if (session) {
        try { session.end(); } catch {}
      }
      teardownXR();
    };
  }, [teardownXR]);

  // ---- Resize handling for renderer outside the XR loop (XR sets its own viewport,
  // but if the user backs out without ending the session cleanly the canvas size matters) ----
  useEffect(() => {
    function onResize() {
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!renderer || !camera) return;
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  // --- AR overlay UI (rendered on top of the canvas while AR is active) ---
  if (arActive) {
    const canFinish = pointCount >= 3;
    return (
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px',
          color: 'white',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          fontFamily: 'inherit',
        }}
      >
        {/* Top bar — status + cancel */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              background: 'rgba(15, 17, 21, 0.78)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '10px 14px',
              minWidth: '160px',
            }}
          >
            <div style={{ fontSize: '0.72rem', opacity: 0.7, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Points placed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.1 }}>
              {pointCount}
            </div>
            {pointCount >= 3 && (
              <>
                <div style={{ fontSize: '0.72rem', opacity: 0.7, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: '6px' }}>
                  Area
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7dd87d' }}>
                  {areaSqft.toLocaleString()} sqft
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.65, marginTop: '4px', maxWidth: '210px', lineHeight: 1.3 }}>
                  Estimate — drift ±1% over distance. Verify against satellite measure for jobs ≥¼ acre.
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleCancel}
            aria-label="Cancel"
            style={{
              minWidth: '48px',
              minHeight: '48px',
              borderRadius: '50%',
              background: 'rgba(15, 17, 21, 0.78)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'white',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Center reticle hint */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: reticleReady ? 0 : 0.85,
            transition: 'opacity 0.25s',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(15, 17, 21, 0.7)',
              borderRadius: '999px',
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            Aim phone at the ground to lock on…
          </div>
        </div>

        {/* Bottom action bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
            <button
              onClick={handleUndo}
              disabled={pointCount === 0}
              style={{
                flex: 1,
                minHeight: '52px',
                borderRadius: '12px',
                background: 'rgba(15, 17, 21, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: pointCount === 0 ? 0.4 : 1,
              }}
            >
              <Undo2 size={20} />
              Undo
            </button>

            <button
              onClick={handleFinish}
              disabled={!canFinish}
              style={{
                flex: 1,
                minHeight: '52px',
                borderRadius: '12px',
                background: canFinish ? '#2d7a3a' : 'rgba(15, 17, 21, 0.85)',
                backdropFilter: 'blur(8px)',
                border: canFinish ? '1px solid #2d7a3a' : '1px solid rgba(255,255,255,0.18)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: canFinish ? 1 : 0.5,
              }}
            >
              <Check size={20} />
              Finish
            </button>
          </div>

          <button
            onClick={handleDropPoint}
            disabled={!reticleReady}
            aria-label="Drop point"
            style={{
              minHeight: '72px',
              borderRadius: '16px',
              background: reticleReady ? '#7dd87d' : 'rgba(125, 216, 125, 0.45)',
              border: 'none',
              color: '#0F1115',
              fontWeight: 800,
              fontSize: '1.15rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
              transform: reticleReady ? 'scale(1)' : 'scale(0.98)',
              transition: 'transform 0.15s, background 0.15s',
            }}
          >
            <Plus size={28} strokeWidth={3} />
            Drop Point
          </button>
        </div>

        {toast && (
          <div
            className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}
            style={{ pointerEvents: 'auto' }}
          >
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  // --- Pre-AR landing page (start screen / fallback) ---
  return (
    <div style={{ padding: 'var(--space-lg, 24px)', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-lg, 24px)' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push('/measure')}
          aria-label="Back to measure"
        >
          <ArrowLeft size={16} />
          Back to Measure
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
          <Footprints size={24} style={{ color: 'var(--lucky-green-light)' }} />
          <h2 style={{ margin: 0 }}>On-site AR Walk</h2>
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
          Walk the perimeter of the area you want to measure and tap{' '}
          <strong>Drop Point</strong> at each corner. Lucky will compute the
          square footage live. Use this when you&rsquo;re standing on the property —
          for measuring from afar, use the satellite tool back on{' '}
          <strong>Measure</strong>.
        </p>
      </div>

      {supportState === 'checking' && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          <span style={{ color: 'var(--text-tertiary)' }}>Checking AR support…</span>
        </div>
      )}

      {supportState === 'supported' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Before you start</h3>
            <ul style={{ color: 'var(--text-tertiary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0, paddingLeft: '1.2rem' }}>
              <li>Stand at one corner of the area you want to measure.</li>
              <li>Hold the phone roughly waist-high and aim slightly down so you can see the ground.</li>
              <li>Wait for the green ring to lock onto the ground, then walk the perimeter dropping a point at each corner.</li>
              <li>Tap <strong>Finish</strong> when you&rsquo;re back at the start.</li>
            </ul>
          </div>

          <div
            className="card"
            style={{
              marginBottom: '1rem',
              borderLeft: '3px solid var(--status-warning, #f59e0b)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--status-warning, #f59e0b)', marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary, white)' }}>Estimate only.</strong>{' '}
              AR tracking drifts roughly ±1% over distance. Verify against the satellite
              measure tool for jobs &ge;&frac14; acre. Camera permission is required.
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={handleStartAR}
            disabled={starting}
            style={{ width: '100%', minHeight: '56px', fontSize: '1rem' }}
          >
            {starting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Footprints size={20} />
                Start AR Walk
              </>
            )}
          </button>
        </>
      )}

      {supportState === 'unsupported' && (
        <div className="card" style={{ borderLeft: '3px solid var(--status-warning, #f59e0b)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            <AlertTriangle size={20} style={{ color: 'var(--status-warning, #f59e0b)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>AR not supported on this device</h3>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            On-site AR walk requires <strong>Android Chrome with ARCore</strong>.
            iOS Safari is not supported. Use the satellite measure tool instead.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/measure')}
            style={{ width: '100%' }}
          >
            <ArrowLeft size={16} />
            Back to Satellite Measure
          </button>
        </div>
      )}

      {supportState === 'error' && (
        <div className="card" style={{ borderLeft: '3px solid var(--status-danger, #dc2626)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            <AlertTriangle size={20} style={{ color: 'var(--status-danger, #dc2626)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Could not check AR support</h3>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {supportError || 'WebXR feature detection failed.'} Try reloading, or use the satellite measure tool.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/measure')}
            style={{ width: '100%' }}
          >
            <ArrowLeft size={16} />
            Back to Satellite Measure
          </button>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type === 'error' ? 'error' : 'success'}`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
