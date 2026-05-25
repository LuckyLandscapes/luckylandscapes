'use client';

import { useEffect } from 'react';
import { enterDemoMode } from '@/lib/demoMode';

// Shareable entry point — app.luckylandscapes.com/demo drops the visitor
// straight into the seeded sandbox + guided tour. Handy for marketing links.
export default function DemoEntryPage() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await enterDemoMode();
      if (!cancelled) window.location.href = '/dashboard';
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: '1rem', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
    }}>
      <div className="loading-spinner" />
      <p style={{ fontSize: '0.9rem' }}>Loading your live demo…</p>
    </div>
  );
}
