'use client';

import { useState, useMemo } from 'react';
import { X, Search, Plus, Minus, Check } from 'lucide-react';
import { useData } from '@/lib/data';
import CustomerCatalogCard from '@/components/CustomerCatalogCard';
import { snapshotMaterialForQuote, MATERIAL_CATEGORIES } from '@/lib/catalog';

// Material picker for quotes/contracts. Salesperson selects materials
// + quantities; output is an array of snapshots (NO prices) suitable
// for storage in quote.selected_materials or contract.selected_materials.
//
// `initialSelection` is an array of existing snapshots — used when editing
// a quote that already has materials picked.
export default function SelectMaterialsModal({ initialSelection = [], onClose, onSave }) {
  const { materials } = useData();

  // Internal map: materialId -> { quantity, notes }. We rebuild snapshots
  // from the live material on save so customer-visible details (image,
  // description) reflect the current catalog at quote time.
  const [picked, setPicked] = useState(() => {
    const m = {};
    for (const s of initialSelection) {
      if (s?.materialId) m[s.materialId] = { quantity: s.quantity || 1, notes: s.notes || '' };
    }
    return m;
  });

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Customer-visible materials only. If the salesperson wants something the
  // customer shouldn't see, they shouldn't be picking it for a quote anyway.
  const visible = useMemo(() => {
    return materials.filter(m => m.isCustomerVisible !== false && m.isActive !== false);
  }, [materials]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visible
      .filter(m => {
        if (activeCategory !== 'all' && m.category !== activeCategory) return false;
        if (!term) return true;
        const hay = `${m.name} ${m.category} ${m.subcategory || ''} ${m.color || ''} ${m.texture || ''} ${m.description || ''}`.toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
  }, [visible, activeCategory, search]);

  const categories = useMemo(() => {
    const s = new Set(visible.map(m => m.category).filter(Boolean));
    return ['all', ...MATERIAL_CATEGORIES.filter(c => s.has(c))];
  }, [visible]);

  const pickedCount = Object.keys(picked).length;
  const pickedList = useMemo(() => {
    return Object.entries(picked)
      .map(([id, info]) => {
        const m = materials.find(x => x.id === id);
        if (!m) return null;
        return { material: m, ...info };
      })
      .filter(Boolean);
  }, [picked, materials]);

  const togglePick = (m) => {
    setPicked(prev => {
      const next = { ...prev };
      if (next[m.id]) delete next[m.id];
      else next[m.id] = { quantity: 1, notes: '' };
      return next;
    });
  };
  const adjustQuantity = (id, delta) => {
    setPicked(prev => {
      const cur = prev[id];
      if (!cur) return prev;
      const q = Math.max(1, (Number(cur.quantity) || 1) + delta);
      return { ...prev, [id]: { ...cur, quantity: q } };
    });
  };
  const setQuantity = (id, value) => {
    const n = parseFloat(value);
    setPicked(prev => ({ ...prev, [id]: { ...prev[id], quantity: Number.isFinite(n) && n > 0 ? n : 1 } }));
  };
  const setNotes = (id, value) => {
    setPicked(prev => ({ ...prev, [id]: { ...prev[id], notes: value } }));
  };

  const handleSave = () => {
    const snapshots = pickedList.map(({ material, quantity, notes }) =>
      snapshotMaterialForQuote(material, quantity, notes)
    );
    onSave(snapshots);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2>Select materials for this quote</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--space-md)', overflow: 'hidden', flex: 1 }}>
          {/* LEFT: catalog */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="catalog-toolbar" style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="search-input-wrap" style={{ flex: 1 }}>
                <Search size={16} />
                <input className="search-input" placeholder="Search materials..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="catalog-filters">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`catalog-filter-chip ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', paddingRight: 4, marginTop: 'var(--space-sm)' }}>
              <div className="customer-grid">
                {filtered.map(m => {
                  const isPicked = !!picked[m.id];
                  return (
                    <div
                      key={m.id}
                      className="customer-grid-item"
                      onClick={() => togglePick(m)}
                      style={{
                        position: 'relative',
                        outline: isPicked ? '2px solid var(--lucky-green)' : 'none',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <CustomerCatalogCard material={m} />
                      {isPicked && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--lucky-green)', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                  <p>No materials match. Try clearing filters or check the catalog page.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: selected list */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 'var(--space-md)' }}>
            <h3 style={{ margin: 0, marginBottom: 'var(--space-sm)' }}>
              Selected ({pickedCount})
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 0 }}>
              Customer sees photo, name, and quantity — never prices.
            </p>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {pickedList.length === 0 && (
                <div style={{ padding: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                  Click any material on the left to add it.
                </div>
              )}
              {pickedList.map(({ material, quantity, notes }) => (
                <div key={material.id} style={{ display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-sm)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', overflow: 'hidden', flexShrink: 0 }}>
                    {material.imageUrl ? <img src={material.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{material.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <button className="btn btn-icon btn-ghost" style={{ padding: 4 }} onClick={() => adjustQuantity(material.id, -1)} disabled={quantity <= 1}><Minus size={12} /></button>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={quantity}
                        onChange={e => setQuantity(material.id, e.target.value)}
                        style={{ width: 60, fontSize: '0.85rem', padding: '2px 6px', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}
                      />
                      <button className="btn btn-icon btn-ghost" style={{ padding: 4 }} onClick={() => adjustQuantity(material.id, 1)}><Plus size={12} /></button>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{material.unit}</span>
                      <button
                        className="btn btn-icon btn-ghost"
                        style={{ marginLeft: 'auto', padding: 4 }}
                        onClick={() => togglePick(material)}
                        title="Remove from selection"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Optional note for customer (e.g. 'around back patio')"
                      value={notes}
                      onChange={e => setNotes(material.id, e.target.value)}
                      style={{ width: '100%', marginTop: 4, fontSize: '0.78rem', padding: '4px 6px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Check size={16} /> Save {pickedCount} {pickedCount === 1 ? 'material' : 'materials'}
          </button>
        </div>
      </div>
    </div>
  );
}
