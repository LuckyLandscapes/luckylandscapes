'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, X, Check, Play, Compass,
  DollarSign, Ruler, BarChart3, Smartphone,
} from 'lucide-react';
import { TOUR_CHAPTERS, stepsForChapter } from '@/lib/demoTourSteps';
import {
  getTourState, setTourState, getTourStep, setTourStep,
  getTourChapter, setTourChapter, getDoneChapters, markChapterDone,
} from '@/lib/demoMode';

const TOOLTIP_W = 340;
const ICONS = { DollarSign, Ruler, BarChart3, Smartphone };

function computeTooltip(rect, placement) {
  if (!rect) {
    return { cls: 'centered', style: { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' } };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 14;
  const half = TOOLTIP_W / 2;
  if (placement === 'right' && rect.left + rect.width + TOOLTIP_W + margin < vw) {
    return { cls: 'right', style: { top: Math.min(vh - margin, Math.max(margin, rect.top + rect.height / 2)), left: rect.left + rect.width + 16, transform: 'translateY(-50%)' } };
  }
  const spaceBelow = vh - (rect.top + rect.height);
  const below = spaceBelow > 200 || spaceBelow > rect.top;
  let left = rect.left + rect.width / 2;
  left = Math.max(margin + half, Math.min(vw - margin - half, left));
  const top = below ? rect.top + rect.height + 12 : rect.top - 12;
  return { cls: below ? 'below' : 'above', style: { top, left, transform: below ? 'translateX(-50%)' : 'translate(-50%,-100%)' } };
}

export default function DemoTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [view, setViewState] = useState(null);        // 'menu' | 'running' | 'mobile' | null
  const [chapterId, setChapterIdState] = useState(null);
  const [stepIndex, setStepIndexState] = useState(0);
  const [rect, setRect] = useState(null);
  const [mobilePage, setMobilePage] = useState('crew-dashboard');
  const [doneChapters, setDoneChapters] = useState([]);
  const targetElRef = useRef(null);
  const navigatedForStep = useRef(-1);

  const steps = view === 'running' ? stepsForChapter(chapterId) : [];
  const step = steps[stepIndex];

  const setView = useCallback((v) => { setViewState(v); setTourState(v || 'done'); }, []);

  // Start / resume on mount; listen for the banner's "Tour menu" button.
  useEffect(() => {
    setDoneChapters(getDoneChapters());
    const state = getTourState();
    if (state === 'pending' || state === 'menu') {
      setViewState('menu'); setTourState('menu');
    } else if (state === 'running') {
      setChapterIdState(getTourChapter() || 'money');
      setStepIndexState(getTourStep());
      setViewState('running');
    } else if (state === 'mobile') {
      setChapterIdState(getTourChapter() || 'crew');
      setViewState('mobile');
    }
    const openMenu = () => { setViewState('menu'); setTourState('menu'); setDoneChapters(getDoneChapters()); };
    window.addEventListener('lucky:demo-open-menu', openMenu);
    return () => window.removeEventListener('lucky:demo-open-menu', openMenu);
  }, []);

  const goToStep = useCallback((i, list) => {
    const max = (list || steps).length - 1;
    const clamped = Math.max(0, Math.min(max, i));
    setStepIndexState(clamped);
    setTourStep(clamped);
  }, [steps]);

  const backToMenu = useCallback(() => {
    setRect(null); targetElRef.current = null;
    setViewState('menu'); setTourState('menu');
    setDoneChapters(getDoneChapters());
  }, []);

  const startChapter = useCallback((ch) => {
    if (ch.kind === 'mobile') {
      setChapterIdState(ch.id); setTourChapter(ch.id);
      setViewState('mobile'); setTourState('mobile');
      return;
    }
    navigatedForStep.current = -1;
    setChapterIdState(ch.id); setTourChapter(ch.id);
    setStepIndexState(0); setTourStep(0);
    setRect(null); targetElRef.current = null;
    setViewState('running'); setTourState('running');
  }, []);

  const startFull = useCallback(() => {
    navigatedForStep.current = -1;
    setChapterIdState('full'); setTourChapter('full');
    setStepIndexState(0); setTourStep(0);
    setRect(null); targetElRef.current = null;
    setViewState('running'); setTourState('running');
  }, []);

  const finishChapter = useCallback(() => {
    if (chapterId && chapterId !== 'full') { markChapterDone(chapterId); }
    backToMenu();
  }, [chapterId, backToMenu]);

  const closeAll = useCallback(() => {
    setRect(null); targetElRef.current = null;
    setViewState(null); setTourState('done');
  }, []);

  // Navigate (once per step) + locate the target — only while running.
  useEffect(() => {
    if (view !== 'running' || !step) return undefined;
    if (step.route && pathname !== step.route && navigatedForStep.current !== stepIndex) {
      navigatedForStep.current = stepIndex;
      router.push(step.route);
      return undefined;
    }
    let tries = 0;
    let timer;
    let raf;
    const locate = () => {
      if (!step.target) { targetElRef.current = null; setRect(null); return; }
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
        if (!onScreen) {
          if (tries++ < 8) { timer = setTimeout(locate, 150); return; }
          targetElRef.current = null; setRect(null); return;
        }
        targetElRef.current = el;
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        raf = requestAnimationFrame(() => {
          const rr = el.getBoundingClientRect();
          setRect({ top: rr.top, left: rr.left, width: rr.width, height: rr.height });
        });
      } else if (tries++ < 25) {
        timer = setTimeout(locate, 120);
      } else {
        targetElRef.current = null; setRect(null);
      }
    };
    locate();
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [view, stepIndex, pathname, step, router]);

  // Keep the spotlight glued to the target while scrolling/resizing.
  useEffect(() => {
    if (view !== 'running') return undefined;
    const reposition = () => {
      const el = targetElRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => { window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition); };
  }, [view]);

  // ── Menu ──────────────────────────────────────────────────
  if (view === 'menu') {
    return (
      <div className="demo-menu-overlay" role="dialog" aria-label="Demo sections">
        <div className="demo-menu-card">
          <button className="demo-tour-close" onClick={closeAll} aria-label="Close menu"><X size={18} /></button>
          <div className="demo-menu-head">
            <span className="demo-menu-kicker">🍀 Lucky App — Live Demo</span>
            <h2 className="demo-menu-title">What do you want to see?</h2>
            <p className="demo-menu-sub">Pick a section for a guided walkthrough, take the full tour, or just click around — it’s all sample data.</p>
          </div>
          <div className="demo-menu-grid">
            {TOUR_CHAPTERS.map((ch) => {
              const Icon = ICONS[ch.icon] || Play;
              const done = doneChapters.includes(ch.id);
              return (
                <button key={ch.id} className="demo-menu-item" onClick={() => startChapter(ch)} style={{ '--chip': ch.accent }}>
                  <span className="demo-menu-item-icon"><Icon size={20} /></span>
                  <span className="demo-menu-item-body">
                    <span className="demo-menu-item-label">
                      {ch.label}
                      {ch.kind === 'mobile' && <span className="demo-menu-tag">📱 Phone</span>}
                      {done && <Check size={14} className="demo-menu-done" />}
                    </span>
                    <span className="demo-menu-item-blurb">{ch.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="demo-menu-actions">
            <button className="demo-tour-btn demo-tour-btn-primary" onClick={startFull}><Play size={15} /> Take the full tour</button>
            <button className="demo-tour-btn demo-tour-btn-ghost" onClick={closeAll}><Compass size={15} /> Explore on my own</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Crew mobile showcase ──────────────────────────────────
  if (view === 'mobile') {
    return (
      <div className="demo-menu-overlay" role="dialog" aria-label="Crew mobile preview">
        <div className="demo-phone-card">
          <button className="demo-tour-close" onClick={backToMenu} aria-label="Back to menu"><X size={18} /></button>
          <div className="demo-phone-head">
            <Smartphone size={16} />
            <strong>Crew Mobile</strong>
            <span>— what your team uses in the field</span>
          </div>
          <div className="demo-phone-toggle">
            <button className={mobilePage === 'crew-dashboard' ? 'active' : ''} onClick={() => setMobilePage('crew-dashboard')}>Time Clock</button>
            <button className={mobilePage === 'crew-schedule' ? 'active' : ''} onClick={() => setMobilePage('crew-schedule')}>Schedule</button>
          </div>
          <div className="demo-phone-frame">
            <iframe
              key={mobilePage}
              src={`/${mobilePage}?embed=1`}
              className="demo-phone-screen"
              title="Crew mobile preview"
            />
          </div>
          <p className="demo-phone-caption">Crews clock in/out, see today’s jobs, and log receipts &amp; mileage from their phones — no laptop needed.</p>
          <button className="demo-tour-btn demo-tour-btn-ghost demo-phone-back" onClick={backToMenu}><ChevronLeft size={16} /> Back to sections</button>
        </div>
      </div>
    );
  }

  // ── Running tour ──────────────────────────────────────────
  if (view !== 'running' || !step) return null;

  const isLast = stepIndex === steps.length - 1;
  const pad = step.padding ?? 8;
  const spotlight = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const tip = computeTooltip(rect, step.placement);

  return (
    <div className="demo-tour-root" aria-live="polite">
      {spotlight ? <div className="demo-tour-spotlight" style={spotlight} /> : <div className="demo-tour-dim" />}
      <div className={`demo-tour-tip demo-tour-tip-${tip.cls}`} style={{ ...tip.style, width: TOOLTIP_W }} role="dialog" aria-label="Guided tour">
        <button className="demo-tour-close" onClick={backToMenu} aria-label="Back to menu"><X size={16} /></button>
        <div className="demo-tour-count">Step {stepIndex + 1} of {steps.length}</div>
        {step.title && <h3 className="demo-tour-title">{step.title}</h3>}
        <p className="demo-tour-text">{step.body}</p>
        <div className="demo-tour-progress">
          {steps.map((_, i) => (
            <span key={i} className={`demo-tour-dot ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`} />
          ))}
        </div>
        <div className="demo-tour-actions">
          <button className="demo-tour-skip" onClick={backToMenu}>Sections</button>
          <div className="demo-tour-navbtns">
            <button className="demo-tour-btn demo-tour-btn-ghost" onClick={() => (stepIndex === 0 ? backToMenu() : goToStep(stepIndex - 1))}>
              <ChevronLeft size={16} /> Back
            </button>
            <button className="demo-tour-btn demo-tour-btn-primary" onClick={() => (isLast ? finishChapter() : goToStep(stepIndex + 1))}>
              {isLast ? 'Done' : <>Next <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
