'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const SECRET = 'lucky';
const UNLOCK_KEY = 'lucky_easter_egg_unlocked';

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function EasterEgg() {
  const [confetti, setConfetti] = useState(null);
  const [toast, setToast] = useState(null);
  const bufferRef = useRef('');
  const router = useRouter();

  const trigger = useCallback(() => {
    const pieces = Array.from({ length: 36 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.4 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 120,
      size: 18 + Math.random() * 22,
      rotate: Math.random() * 360,
      char: Math.random() < 0.85 ? '🍀' : '🌿',
    }));
    setConfetti(pieces);
    setToast({
      isFirstTime: !localStorage.getItem(UNLOCK_KEY),
    });
    try { localStorage.setItem(UNLOCK_KEY, '1'); } catch {}
    setTimeout(() => setConfetti(null), 4500);
    setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (isTypingTarget(e.target)) {
        bufferRef.current = '';
        return;
      }
      if (e.key.length !== 1) return;
      bufferRef.current = (bufferRef.current + e.key.toLowerCase()).slice(-SECRET.length);
      if (bufferRef.current === SECRET) {
        bufferRef.current = '';
        trigger();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trigger]);

  return (
    <>
      {confetti && (
        <div className="lucky-clover-rain" aria-hidden="true">
          {confetti.map(p => (
            <span
              key={p.id}
              className="lucky-clover-piece"
              style={{
                left: `${p.left}%`,
                fontSize: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                '--drift': `${p.drift}px`,
                '--rotate': `${p.rotate}deg`,
              }}
            >
              {p.char}
            </span>
          ))}
        </div>
      )}
      {toast && (
        <div className="lucky-egg-toast" role="status">
          <div className="lucky-egg-toast-emoji">🍀</div>
          <div className="lucky-egg-toast-body">
            <div className="lucky-egg-toast-title">
              {toast.isFirstTime ? "You found it!" : "Lucky again!"}
            </div>
            <div className="lucky-egg-toast-sub">
              PlantSwipe is unlocked — swipe right on plants you{'’'}d plant.
            </div>
          </div>
          <button
            type="button"
            className="lucky-egg-toast-cta"
            onClick={() => { setToast(null); router.push('/swipe'); }}
          >
            Open PlantSwipe →
          </button>
        </div>
      )}
    </>
  );
}

export function isEasterEggUnlocked() {
  if (typeof window === 'undefined') return false;
  try { return !!localStorage.getItem(UNLOCK_KEY); } catch { return false; }
}
