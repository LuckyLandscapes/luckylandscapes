'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
// PlantSwipe — hidden landscape-plant tinder. Reachable at /swipe via the "lucky" easter egg.
import { Heart, X, RotateCcw, Sun, Cloud, Droplets, Sprout, Sparkles } from 'lucide-react';

const PLANTS = [
  {
    id: 'black-eyed-susan',
    name: 'Black-Eyed Susan',
    sci: 'Rudbeckia hirta',
    emoji: '🌻',
    grad: ['#f6c344', '#d4881a'],
    sun: 'Full sun',
    water: 'Low',
    zone: '3–9',
    height: '2–3 ft',
    bio: 'Wisconsin native. Blooms June–October. Pollinator magnet that basically refuses to die.',
    pitch: "If you want flowers without the fuss, this is the one. We plant them everywhere.",
  },
  {
    id: 'hosta',
    name: 'Hosta',
    sci: 'Hosta spp.',
    emoji: '🌿',
    grad: ['#7DA45D', '#3E6033'],
    sun: 'Shade / part shade',
    water: 'Medium',
    zone: '3–8',
    height: '1–3 ft',
    bio: 'The shade-garden workhorse. Comes in blue, gold, variegated — fills in north-facing beds in two seasons.',
    pitch: 'Deer love them, which is the only complaint anyone has.',
  },
  {
    id: 'endless-summer-hydrangea',
    name: 'Endless Summer Hydrangea',
    sci: 'Hydrangea macrophylla',
    emoji: '💠',
    grad: ['#8FB6E0', '#4A6FA5'],
    sun: 'Morning sun, afternoon shade',
    water: 'High',
    zone: '4–9',
    height: '3–5 ft',
    bio: 'Reblooms on new wood — survives Wisconsin winters and still flowers. Pink in alkaline soil, blue in acidic.',
    pitch: 'Color-shifting flower bombs the size of softballs. Front-of-house showstopper.',
  },
  {
    id: 'daylily-stella',
    name: 'Stella d’Oro Daylily',
    sci: 'Hemerocallis',
    emoji: '🌼',
    grad: ['#f4b733', '#c97c20'],
    sun: 'Full sun',
    water: 'Low',
    zone: '3–9',
    height: '12–18 in',
    bio: 'Blooms continuously June–September. Indestructible. Multiplies on its own.',
    pitch: 'Cheap, reliable, and you can divide them after 3 years to fill more beds for free.',
  },
  {
    id: 'coneflower',
    name: 'Purple Coneflower',
    sci: 'Echinacea purpurea',
    emoji: '🪻',
    grad: ['#b574b3', '#6f3a72'],
    sun: 'Full sun',
    water: 'Low',
    zone: '3–9',
    height: '2–4 ft',
    bio: 'Native prairie plant. Drought-tolerant, deer-resistant, and goldfinches eat the seed heads in fall.',
    pitch: 'Leave the seed heads up over winter — birds throw a party.',
  },
  {
    id: 'karl-foerster',
    name: 'Karl Foerster Grass',
    sci: 'Calamagrostis acutiflora',
    emoji: '🌾',
    grad: ['#d4c181', '#8a6f3b'],
    sun: 'Full sun',
    water: 'Low',
    zone: '4–9',
    height: '4–5 ft',
    bio: 'Vertical, architectural, four-season interest. Wheat-colored plumes from July through snow.',
    pitch: 'The grass that makes a yard look designed instead of grown.',
  },
  {
    id: 'boxwood',
    name: 'Green Velvet Boxwood',
    sci: 'Buxus',
    emoji: '🟩',
    grad: ['#3f6b3a', '#1f3d1d'],
    sun: 'Sun / part shade',
    water: 'Medium',
    zone: '4–9',
    height: '3–4 ft',
    bio: 'Cold-hardy boxwood — keeps green color through Wisconsin winters. Takes shape beautifully.',
    pitch: 'Hedge fundamentals. If you want formal, start here.',
  },
  {
    id: 'russian-sage',
    name: 'Russian Sage',
    sci: 'Perovskia atriplicifolia',
    emoji: '🪴',
    grad: ['#a4afe0', '#5b6aa8'],
    sun: 'Full sun',
    water: 'Low',
    zone: '4–9',
    height: '3–4 ft',
    bio: 'Silvery foliage, lavender haze of flowers, smells incredible when you brush against it.',
    pitch: 'Loves bad soil and hates being watered. Perfect for hellstrips and rocky beds.',
  },
  {
    id: 'sedum-autumn-joy',
    name: "Sedum 'Autumn Joy'",
    sci: 'Hylotelephium spectabile',
    emoji: '🌷',
    grad: ['#cc6677', '#7a3a48'],
    sun: 'Full sun',
    water: 'Very low',
    zone: '3–10',
    height: '18–24 in',
    bio: 'Succulent foliage all summer, then huge pink-to-rust flower heads in September when nothing else is blooming.',
    pitch: 'Late-season color is rare. This plant is a closer.',
  },
  {
    id: 'japanese-maple',
    name: 'Japanese Maple',
    sci: 'Acer palmatum',
    emoji: '🍁',
    grad: ['#c0392b', '#5e1a14'],
    sun: 'Part shade',
    water: 'Medium',
    zone: '5–8',
    height: '6–15 ft',
    bio: 'Fiery red fall color, sculptural form. Zone 5 — protect from afternoon sun and harsh winter wind.',
    pitch: 'A focal-point tree. Plant one and the whole yard reorganizes around it.',
  },
  {
    id: 'river-birch',
    name: 'River Birch',
    sci: 'Betula nigra',
    emoji: '🌳',
    grad: ['#a08763', '#4d3d28'],
    sun: 'Full sun',
    water: 'High',
    zone: '4–9',
    height: '40–70 ft',
    bio: 'Native. Peeling cinnamon-colored bark gives winter interest. Loves wet feet.',
    pitch: 'Best privacy/shade tree for low-spots and rain gardens.',
  },
  {
    id: 'ninebark-diabolo',
    name: "Ninebark 'Diabolo'",
    sci: 'Physocarpus opulifolius',
    emoji: '🍂',
    grad: ['#5a2a3a', '#2a1018'],
    sun: 'Full sun',
    water: 'Medium',
    zone: '3–7',
    height: '6–10 ft',
    bio: 'Native shrub with deep purple foliage and pink-white flowers. Looks expensive, costs $35.',
    pitch: 'Drop one against a green hedge for instant contrast.',
  },
  {
    id: 'switchgrass',
    name: "Switchgrass 'Shenandoah'",
    sci: 'Panicum virgatum',
    emoji: '🌾',
    grad: ['#a86b5a', '#582d24'],
    sun: 'Full sun',
    water: 'Low',
    zone: '4–9',
    height: '3–4 ft',
    bio: 'Native prairie grass, tips turn burgundy in summer. Stays upright through snow.',
    pitch: 'Real Midwest energy. Plant in drifts, not singletons.',
  },
  {
    id: 'bee-balm',
    name: 'Bee Balm',
    sci: 'Monarda didyma',
    emoji: '🌸',
    grad: ['#e0445e', '#7a1f30'],
    sun: 'Full sun',
    water: 'Medium',
    zone: '4–9',
    height: '2–4 ft',
    bio: 'Native. Hummingbirds and bumblebees lose their minds over it. Mildew-resistant cultivars exist now.',
    pitch: 'For the client who asks about pollinator gardens.',
  },
  {
    id: 'creeping-thyme',
    name: 'Creeping Thyme',
    sci: 'Thymus serpyllum',
    emoji: '🌱',
    grad: ['#9bbf6e', '#3f5d2c'],
    sun: 'Full sun',
    water: 'Low',
    zone: '4–9',
    height: '2–4 in',
    bio: 'Walkable, fragrant, blooms purple. Lawn alternative that smells incredible underfoot.',
    pitch: 'Steppable groundcover between flagstone. Sells the patio job.',
  },
  {
    id: 'catmint',
    name: "Catmint 'Walker's Low'",
    sci: 'Nepeta racemosa',
    emoji: '🌷',
    grad: ['#8e7eb5', '#473d63'],
    sun: 'Full sun',
    water: 'Low',
    zone: '3–8',
    height: '2–3 ft',
    bio: 'Lavender-blue spires May through frost. Deer ignore it. Bees love it.',
    pitch: 'Lavender that actually survives Wisconsin. Same vibe, harder to kill.',
  },
];

const SWIPE_THRESHOLD = 110;
const ROTATE_FACTOR = 0.08;

export default function SwipePage() {
  const [index, setIndex] = useState(0);
  const [loved, setLoved] = useState([]);
  const [passed, setPassed] = useState([]);
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false });
  const [exiting, setExiting] = useState(null); // 'left' | 'right' | null
  const startRef = useRef({ x: 0, y: 0 });

  const total = PLANTS.length;
  const current = index < total ? PLANTS[index] : null;
  const next = index + 1 < total ? PLANTS[index + 1] : null;

  const verdict = useMemo(() => {
    const dx = drag.x;
    if (dx > 40) return 'love';
    if (dx < -40) return 'pass';
    return null;
  }, [drag.x]);

  const advance = useCallback((dir) => {
    setExiting(dir);
    const plant = PLANTS[index];
    setTimeout(() => {
      if (dir === 'right') setLoved(l => [...l, plant]);
      else setPassed(p => [...p, plant]);
      setIndex(i => i + 1);
      setDrag({ x: 0, y: 0, dragging: false });
      setExiting(null);
    }, 260);
  }, [index]);

  // Pointer handlers — work for mouse and touch
  const onPointerDown = (e) => {
    if (exiting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag(d => ({ ...d, dragging: true }));
  };
  const onPointerMove = (e) => {
    if (!drag.dragging || exiting) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
      dragging: true,
    });
  };
  const onPointerUp = (e) => {
    if (!drag.dragging) return;
    const dx = e.clientX - startRef.current.x;
    if (dx > SWIPE_THRESHOLD) advance('right');
    else if (dx < -SWIPE_THRESHOLD) advance('left');
    else setDrag({ x: 0, y: 0, dragging: false });
  };

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (!current || exiting) return;
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') advance('right');
      else if (e.key === 'ArrowLeft') advance('left');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, exiting, advance]);

  const reset = () => {
    setIndex(0); setLoved([]); setPassed([]);
    setDrag({ x: 0, y: 0, dragging: false }); setExiting(null);
  };

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const tx = exiting === 'right' ? screenW + 200
    : exiting === 'left' ? -screenW - 200
    : drag.x;
  const ty = exiting ? drag.y * 1.5 : drag.y;
  const rot = (drag.dragging || exiting) ? tx * ROTATE_FACTOR : 0;

  return (
    <div className="swipe-page">
      <div className="swipe-header">
        <div>
          <div className="swipe-eyebrow">🍀 Hidden — found via the Lucky code</div>
          <h1 className="swipe-title">PlantSwipe</h1>
          <p className="swipe-subtitle">
            Swipe right on plants you{'’'}d plant. Build a moodboard of midwest-friendly favorites.
          </p>
        </div>
        <div className="swipe-progress">
          <span>{Math.min(index + 1, total)} / {total}</span>
          <div className="swipe-progress-bar">
            <div className="swipe-progress-fill" style={{ width: `${(index / total) * 100}%` }} />
          </div>
        </div>
      </div>

      {current ? (
        <div className="swipe-deck">
          {next && (
            <PlantCard plant={next} style={{ transform: 'scale(0.95) translateY(14px)', opacity: 0.55 }} />
          )}
          <PlantCard
            plant={current}
            verdict={verdict}
            isTop
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
              transition: drag.dragging ? 'none' : exiting ? 'transform 260ms ease-out' : 'transform 280ms cubic-bezier(.2,.9,.3,1.4)',
            }}
          />

          <div className="swipe-controls">
            <button
              type="button"
              className="swipe-btn swipe-btn-pass"
              onClick={() => advance('left')}
              aria-label="Pass"
              disabled={!!exiting}
            >
              <X size={26} />
            </button>
            <div className="swipe-hint">← pass · love →</div>
            <button
              type="button"
              className="swipe-btn swipe-btn-love"
              onClick={() => advance('right')}
              aria-label="Love it"
              disabled={!!exiting}
            >
              <Heart size={26} fill="currentColor" />
            </button>
          </div>
        </div>
      ) : (
        <Moodboard loved={loved} passed={passed} onReset={reset} />
      )}
    </div>
  );
}

function PlantCard({ plant, verdict, isTop, style, ...handlers }) {
  return (
    <div
      className={`plant-card ${isTop ? 'plant-card-top' : ''}`}
      style={{
        background: `linear-gradient(155deg, ${plant.grad[0]} 0%, ${plant.grad[1]} 100%)`,
        ...style,
      }}
      {...handlers}
    >
      {verdict === 'love' && (
        <div className="plant-stamp plant-stamp-love">PLANT IT</div>
      )}
      {verdict === 'pass' && (
        <div className="plant-stamp plant-stamp-pass">NOPE</div>
      )}

      <div className="plant-emoji">{plant.emoji}</div>

      <div className="plant-card-body">
        <div className="plant-name-row">
          <h2 className="plant-name">{plant.name}</h2>
          <span className="plant-zone">Zone {plant.zone}</span>
        </div>
        <div className="plant-sci">{plant.sci}</div>
        <p className="plant-bio">{plant.bio}</p>
        <div className="plant-pitch">
          <Sparkles size={14} />
          <span>{plant.pitch}</span>
        </div>
        <div className="plant-stats">
          <Stat icon={<Sun size={14} />} label={plant.sun} />
          <Stat icon={<Droplets size={14} />} label={`${plant.water} water`} />
          <Stat icon={<Sprout size={14} />} label={plant.height} />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label }) {
  return (
    <div className="plant-stat">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function Moodboard({ loved, passed, onReset }) {
  const total = loved.length + passed.length;
  const ratio = total ? Math.round((loved.length / total) * 100) : 0;
  return (
    <div className="swipe-moodboard">
      <div className="swipe-moodboard-header">
        <h2>Your moodboard</h2>
        <p>
          You loved <strong>{loved.length}</strong> of <strong>{total}</strong> ({ratio}%).
          {ratio >= 70 && ' You’re a plant-collector at heart.'}
          {ratio >= 40 && ratio < 70 && ' Solid, balanced taste.'}
          {ratio < 40 && ' Picky, picky. We respect it.'}
        </p>
        <button type="button" className="swipe-btn-reset" onClick={onReset}>
          <RotateCcw size={16} /> Swipe again
        </button>
      </div>

      {loved.length > 0 ? (
        <div className="swipe-moodboard-grid">
          {loved.map(p => (
            <div
              key={p.id}
              className="moodboard-tile"
              style={{ background: `linear-gradient(155deg, ${p.grad[0]}, ${p.grad[1]})` }}
            >
              <div className="moodboard-tile-emoji">{p.emoji}</div>
              <div className="moodboard-tile-info">
                <div className="moodboard-tile-name">{p.name}</div>
                <div className="moodboard-tile-meta">{p.sun} · {p.water} water · Zone {p.zone}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="swipe-moodboard-empty">
          <Cloud size={32} />
          <p>You didn’t love any of them. Tough crowd.</p>
        </div>
      )}
    </div>
  );
}
