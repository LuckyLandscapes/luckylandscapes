'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { Search, Maximize2, X, ChevronLeft, ChevronRight, Star } from 'lucide-react';

export default function CatalogPage() {
  const { materials } = useData();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);

  const categories = ['all', ...new Set(materials.map(m => m.category))];

  const filtered = materials.filter(m => {
    const matchSearch = `${m.name} ${m.description} ${m.supplier}`.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'all' || m.category === activeCategory;
    return matchSearch && matchCat;
  });

  // Presentation mode navigation
  const startPresentation = (index) => {
    setPresentationIndex(index);
    setPresentationMode(true);
  };

  const nextSlide = () => setPresentationIndex((i) => (i + 1) % filtered.length);
  const prevSlide = () => setPresentationIndex((i) => (i - 1 + filtered.length) % filtered.length);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Material Catalog</h1>
          <p>Browse materials to show clients and add to quotes. {materials.length} items available.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => startPresentation(0)}>
            <Maximize2 size={16} /> Presentation Mode
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input-wrap" style={{ flex: 1, maxWidth: '400px' }}>
          <Search size={16} />
          <input
            className="search-input"
            placeholder="Search materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Material Grid */}
      <div className="material-grid">
        {filtered.map((material, i) => (
          <div key={material.id} className="material-card" onClick={() => startPresentation(i)}>
            <div className="material-card-img" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-card) 100%)',
              overflow: 'hidden',
            }}>
              {material.imageUrl ? (
                <img src={material.imageUrl} alt={material.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                material.imageEmoji || '🌿'
              )}
            </div>
            <div className="material-card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div className="material-card-name">{material.name}</div>
                  <div className="material-card-sub">{material.category}</div>
                </div>
                {material.isFavorite && (
                  <Star size={14} style={{ color: 'var(--lucky-gold)', fill: 'var(--lucky-gold)' }} />
                )}
              </div>
              <div className="material-card-price">
                {material.costLow === material.costHigh ? (
                  <>${material.costLow} / {material.unit}</>
                ) : (
                  <>${material.costLow}–${material.costHigh} / {material.unit}</>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <h3>No materials found</h3>
          <p>Try a different search term or category.</p>
        </div>
      )}

      {/* Presentation Mode Overlay */}
      {presentationMode && filtered.length > 0 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl)',
          animation: 'fadeIn 200ms ease',
        }}>
          {/* Close */}
          <button
            onClick={() => setPresentationMode(false)}
            style={{
              position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)',
              width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
              cursor: 'pointer', border: 'none',
            }}
          >
            <X size={22} />
          </button>

          {/* Counter */}
          <div style={{
            position: 'absolute', top: 'var(--space-lg)', left: '50%', transform: 'translateX(-50%)',
            fontSize: '0.82rem', color: 'var(--text-tertiary)', fontWeight: 600,
          }}>
            {presentationIndex + 1} / {filtered.length}
          </div>

          {/* Material Display */}
          <div style={{ textAlign: 'center', maxWidth: '600px' }}>
            <div style={{ fontSize: '6rem', marginBottom: 'var(--space-xl)' }}>
              {filtered[presentationIndex].imageUrl ? (
                <img
                  src={filtered[presentationIndex].imageUrl}
                  alt={filtered[presentationIndex].name}
                  style={{ width: '300px', height: '300px', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }}
                />
              ) : (
                filtered[presentationIndex].imageEmoji || '🌿'
              )}
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>
              {filtered[presentationIndex].name}
            </h2>
            <div style={{ fontSize: '1rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
              {filtered[presentationIndex].category}
            </div>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
              {filtered[presentationIndex].description}
            </p>
            <div style={{
              display: 'inline-flex', gap: 'var(--space-xl)',
              background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-md) var(--space-xl)',
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Price</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--lucky-green-light)' }}>
                  {filtered[presentationIndex].costLow === filtered[presentationIndex].costHigh ? (
                    <>${filtered[presentationIndex].costLow}</>
                  ) : (
                    <>${filtered[presentationIndex].costLow}–${filtered[presentationIndex].costHigh}</>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Unit</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  per {filtered[presentationIndex].unit}
                </div>
              </div>
              {filtered[presentationIndex].supplier && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Supplier</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                    {filtered[presentationIndex].supplier}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div style={{
            position: 'absolute', bottom: 'var(--space-xl)',
            display: 'flex', gap: 'var(--space-md)',
          }}>
            <button
              onClick={prevSlide}
              style={{
                width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                cursor: 'pointer', border: 'none',
              }}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={nextSlide}
              style={{
                width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                cursor: 'pointer', border: 'none',
              }}
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
