'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, RotateCcw, X, LayoutGrid } from 'lucide-react';
import { exitDemoMode, resetDemoData } from '@/lib/demoMode';

// Persistent top bar shown only in demo mode. Also hosts the global demo toast
// (fired via the `lucky:demo-toast` event from demoGuard()).
export default function DemoBanner() {
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    // Offset the fixed sidebar + main content so the banner never covers them.
    document.body.classList.add('lucky-demo-active');
    const onToast = (e) => {
      setToast(e.detail?.message || '');
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3500);
    };
    window.addEventListener('lucky:demo-toast', onToast);
    return () => {
      document.body.classList.remove('lucky-demo-active');
      window.removeEventListener('lucky:demo-toast', onToast);
      clearTimeout(toastTimer.current);
    };
  }, []);

  const openMenu = () => window.dispatchEvent(new CustomEvent('lucky:demo-open-menu'));

  const resetDemo = async () => {
    setBusy(true);
    await resetDemoData();
    window.location.href = '/dashboard';
  };

  const exitDemo = () => {
    exitDemoMode();
    window.location.href = '/login';
  };

  return (
    <>
      <div className="demo-banner" role="region" aria-label="Demo mode">
        <div className="demo-banner-label">
          <Sparkles size={15} />
          <strong>Demo Mode</strong>
          <span className="demo-banner-sub">— sample data · nothing is saved or sent</span>
        </div>
        <div className="demo-banner-actions">
          <button type="button" onClick={openMenu}><LayoutGrid size={14} /> Sections</button>
          <button type="button" onClick={resetDemo} disabled={busy}><RotateCcw size={14} /> Reset demo</button>
          <button type="button" className="demo-banner-exit" onClick={exitDemo}><X size={14} /> Exit</button>
        </div>
      </div>
      {toast && <div className="demo-toast">{toast}</div>}
    </>
  );
}
