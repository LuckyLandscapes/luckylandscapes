'use client';

import { useState, useEffect, useCallback } from 'react';
import { useData } from '@/lib/data';
import {
  Search, Maximize2, X, ChevronLeft, ChevronRight, Star, Plus,
  Grid3x3, List, ExternalLink, Edit3, Trash2, AlertTriangle, Clock,
  RefreshCw, Loader2, Download,
} from 'lucide-react';
import MaterialFormModal from '@/components/MaterialFormModal';
import { getQuickSearchLinks } from '@/lib/supplierSearch';
import { OUTDOOR_SOLUTIONS_CATALOG, normalizeName } from '@/lib/seedOutdoorSolutionsLincoln';

function getSupplierClass(s) {
  if (!s) return 'supplier-other';
  const l = s.toLowerCase();
  if (l.includes('outdoor')) return 'supplier-outdoor-solutions';
  if (l.includes('menard')) return 'supplier-menards';
  if (l.includes('home') || l.includes('depot')) return 'supplier-home-depot';
  return 'supplier-other';
}

function formatPrice(m) {
  if (m.soldOut) return <span style={{ color: '#ef4444', fontWeight: 700 }}>Sold Out</span>;
  if (m.unitAlt) return <>${m.costLow}/{m.unitAlt} — ${m.costHigh}/{m.unit}</>;
  if (Number(m.costLow) === Number(m.costHigh)) return <>${m.costLow} / {m.unit}</>;
  return <>${m.costLow}–${m.costHigh} / {m.unit}</>;
}

function getImageSrc(m) {
  if (m.imageUrl && m.imageUrl.startsWith('http')) return m.imageUrl;
  if (m.image && m.image.startsWith('http')) return m.image;
  return null;
}

const STOCK_LABEL = {
  in_stock: 'In stock',
  low_stock: 'Low',
  out_of_stock: 'Out',
  unknown: '',
};
function StockBadge({ m }) {
  const s = m.soldOut ? 'out_of_stock' : (m.stockStatus || 'unknown');
  if (s === 'unknown') return null;
  return <span className={`stock-badge stock-${s.replace('_', '-')}`}>{STOCK_LABEL[s]}{m.stockQty ? ` · ${m.stockQty}` : ''}</span>;
}

export default function CatalogPage() {
  const { materials, addMaterial, updateMaterial, deleteMaterial, bulkUpsertMaterials } = useData();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSupplier, setActiveSupplier] = useState('all');
  const [view, setView] = useState('grid');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [presMode, setPresMode] = useState(false);
  const [presIndex, setPresIndex] = useState(0);
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);

  // Filters
  const categories = ['all', ...new Set(materials.map(m => m.category).filter(Boolean))];
  const suppliers = ['all', ...new Set(materials.map(m => m.supplier).filter(Boolean))];

  const filtered = materials.filter(m => {
    const s = `${m.name} ${m.description || ''} ${m.supplier || ''} ${m.color || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
    const matchSearch = s.includes(search.toLowerCase());
    const matchCat = activeCategory === 'all' || m.category === activeCategory;
    const matchSup = activeSupplier === 'all' || m.supplier === activeSupplier;
    return matchSearch && matchCat && matchSup;
  }).sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });

  // Keyboard nav for presentation
  useEffect(() => {
    if (!presMode) return;
    const handler = (e) => {
      if (e.key === 'Escape') setPresMode(false);
      if (e.key === 'ArrowRight') setPresIndex(i => (i + 1) % filtered.length);
      if (e.key === 'ArrowLeft') setPresIndex(i => (i - 1 + filtered.length) % filtered.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presMode, filtered.length]);

  const handleSave = async (data) => {
    if (editingMaterial) {
      await updateMaterial(editingMaterial.id, data);
    } else {
      await addMaterial(data);
    }
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    await deleteMaterial(showDelete.id);
    setShowDelete(null);
    setSelectedMaterial(null);
  };

  const toggleFav = async (e, m) => {
    e.stopPropagation();
    await updateMaterial(m.id, { isFavorite: !m.isFavorite });
  };

  const startPresentation = (idx) => { setPresIndex(idx); setPresMode(true); };

  const importOutdoorSolutions = async () => {
    setConfirmImport(false);
    setImporting(true);
    setImportResult(null);
    try {
      const result = await bulkUpsertMaterials(
        OUTDOOR_SOLUTIONS_CATALOG,
        (m) => normalizeName(m.name)
      );
      setImportResult(result);
    } catch (err) {
      setImportResult({ inserted: 0, updated: 0, errors: [{ item: 'import', error: err.message || String(err) }] });
    } finally {
      setImporting(false);
    }
  };

  const refreshFromSupplier = async (m) => {
    if (!m.supplierUrl) { setRefreshMsg('Add a supplier URL first.'); return; }
    setRefreshingId(m.id); setRefreshMsg('');
    try {
      const res = await fetch('/api/catalog/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: m.supplierUrl }),
      });
      const data = await res.json();
      if (!data.ok) { setRefreshMsg(data.error || 'Lookup failed.'); return; }
      const patch = {
        stockStatus: data.stockStatus,
        stockLastChecked: data.checkedAt,
        lastPriceCheck: data.checkedAt,
        soldOut: data.stockStatus === 'out_of_stock',
      };
      if (data.price != null) { patch.costLow = data.price; patch.costHigh = data.price; }
      await updateMaterial(m.id, patch);
      setSelectedMaterial(prev => prev && prev.id === m.id ? { ...prev, ...patch } : prev);
      setRefreshMsg(`Updated ${m.name}: ${data.stockStatus.replace('_', ' ')}${data.price != null ? ` at $${data.price}` : ''}.`);
    } catch (err) {
      setRefreshMsg('Lookup failed: ' + (err.message || err));
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Material Catalog</h1>
          <p>Browse & present materials to customers. {materials.length} items.</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setConfirmImport(true)}
            disabled={importing}
            title="Insert or refresh prices for the full Outdoor Solutions Lincoln catalog"
          >
            {importing ? <><Loader2 size={16} className="spin" /> Importing…</> : <><Download size={16} /> Import OS catalog</>}
          </button>
          <button className="btn btn-secondary" onClick={() => startPresentation(0)} disabled={filtered.length === 0}>
            <Maximize2 size={16} /> Present
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingMaterial(null); setShowForm(true); }}>
            <Plus size={16} /> Add Material
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="catalog-toolbar">
        <div className="search-input-wrap">
          <Search size={16} />
          <input className="search-input" placeholder="Search materials..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="catalog-view-toggle">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}><Grid3x3 size={16} /></button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16} /></button>
        </div>
      </div>

      {/* Category Chips */}
      <div className="catalog-filters">
        {categories.map(cat => {
          const count = cat === 'all' ? materials.length : materials.filter(m => m.category === cat).length;
          return (
            <button key={cat} className={`catalog-filter-chip ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
              {cat === 'all' ? 'All' : cat}
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Supplier Chips */}
      {suppliers.length > 1 && (
        <div className="catalog-filters" style={{ marginTop: '-var(--space-sm)' }}>
          {suppliers.map(sup => {
            const count = sup === 'all' ? materials.length : materials.filter(m => m.supplier === sup).length;
            return (
              <button key={sup} className={`catalog-filter-chip ${activeSupplier === sup ? 'active' : ''}`} onClick={() => setActiveSupplier(sup)}>
                {sup === 'all' ? 'All Suppliers' : sup}
                <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grid View */}
      {view === 'grid' && (
        <div className="material-grid">
          {filtered.map((m, i) => {
            const imgSrc = getImageSrc(m);
            return (
              <div key={m.id} className="material-card" onClick={() => setSelectedMaterial(m)}>
                <div className="material-card-img">
                  {imgSrc ? <img src={imgSrc} alt={m.name} /> : <div className="material-emoji">{m.imageEmoji || '🪨'}</div>}
                  <div className="material-card-badges">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      {m.soldOut && <span className="material-sold-out-badge">Sold Out</span>}
                      {!m.soldOut && <StockBadge m={m} />}
                    </div>
                    <button className={`material-fav-btn ${m.isFavorite ? 'active' : ''}`} onClick={e => toggleFav(e, m)}>
                      <Star size={14} fill={m.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
                <div className="material-card-body">
                  <div className="material-card-name">{m.name}</div>
                  <div className="material-card-sub">{m.category}{m.subcategory ? ` · ${m.subcategory}` : ''}</div>
                  <div className="material-card-footer">
                    <div className="material-card-price">{formatPrice(m)}</div>
                    {m.supplier && <span className={`material-card-supplier ${getSupplierClass(m.supplier)}`}>{m.supplier}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}></th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Supplier</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const imgSrc = getImageSrc(m);
                return (
                  <tr key={m.id} onClick={() => setSelectedMaterial(m)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                        {imgSrc ? <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '1.2rem' }}>{m.imageEmoji || '🪨'}</div>}
                      </div>
                    </td>
                    <td><div style={{ fontWeight: 600 }}>{m.name}</div></td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{m.category}</td>
                    <td><span style={{ fontWeight: 600, color: 'var(--lucky-green-light)' }}>{formatPrice(m)}</span></td>
                    <td>{m.supplier && <span className={`material-card-supplier ${getSupplierClass(m.supplier)}`}>{m.supplier}</span>}</td>
                    <td>
                      {m.soldOut
                        ? <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.78rem' }}>Sold Out</span>
                        : <StockBadge m={m} />}
                      {!m.soldOut && (m.stockStatus === 'unknown' || !m.stockStatus) && m.isFavorite && (
                        <Star size={14} style={{ color: 'var(--lucky-gold)', fill: 'var(--lucky-gold)' }} />
                      )}
                    </td>
                    <td>
                      <button className="btn btn-icon btn-ghost" onClick={e => { e.stopPropagation(); setEditingMaterial(m); setShowForm(true); }}><Edit3 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="empty-state">
          <h3>No materials found</h3>
          <p>Try a different search or add your first material.</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => { setEditingMaterial(null); setShowForm(true); }}>
            <Plus size={16} /> Add Material
          </button>
        </div>
      )}

      {/* Detail Slideout */}
      {selectedMaterial && (
        <>
          <div className="material-detail-overlay" onClick={() => setSelectedMaterial(null)} />
          <div className="material-detail-panel">
            <div className="material-detail-hero">
              {getImageSrc(selectedMaterial)
                ? <img src={getImageSrc(selectedMaterial)} alt={selectedMaterial.name} />
                : <div className="material-emoji">{selectedMaterial.imageEmoji || '🪨'}</div>
              }
              <button className="material-detail-close" onClick={() => setSelectedMaterial(null)}><X size={20} /></button>
            </div>
            <div className="material-detail-content">
              <div className="material-detail-header">
                <div>
                  <div className="material-detail-name">{selectedMaterial.name}</div>
                  <div className="material-detail-category">{selectedMaterial.category}{selectedMaterial.subcategory ? ` · ${selectedMaterial.subcategory}` : ''}</div>
                </div>
                {selectedMaterial.isFavorite && <Star size={20} style={{ color: 'var(--lucky-gold)', fill: 'var(--lucky-gold)', flexShrink: 0 }} />}
              </div>

              {selectedMaterial.description && (
                <div className="material-detail-section">
                  <div className="material-detail-section-title">Description</div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedMaterial.description}</p>
                </div>
              )}

              {/* Price + Stock */}
              <div className="material-detail-section">
                <div className="material-detail-section-title">Pricing & Stock</div>
                <div className="material-detail-price-row">
                  <div className="material-detail-price-value">{formatPrice(selectedMaterial)}</div>
                  <StockBadge m={selectedMaterial} />
                  {selectedMaterial.lastPriceCheck && (
                    <div className="material-detail-price-verified">
                      <Clock size={12} /> Verified {new Date(selectedMaterial.lastPriceCheck).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {selectedMaterial.supplierUrl && (
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: 'var(--space-sm)' }}
                    onClick={() => refreshFromSupplier(selectedMaterial)}
                    disabled={refreshingId === selectedMaterial.id}
                  >
                    {refreshingId === selectedMaterial.id
                      ? <><Loader2 size={14} className="spin" /> Checking…</>
                      : <><RefreshCw size={14} /> Refresh price & stock</>}
                  </button>
                )}
                {refreshMsg && refreshingId === null && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 6 }}>{refreshMsg}</div>
                )}
              </div>

              {/* Details Grid */}
              <div className="material-detail-section">
                <div className="material-detail-section-title">Details</div>
                <div className="material-detail-info-grid">
                  {selectedMaterial.color && <div className="material-detail-info-item"><div className="material-detail-info-label">Color</div><div className="material-detail-info-value">{selectedMaterial.color}</div></div>}
                  {selectedMaterial.texture && <div className="material-detail-info-item"><div className="material-detail-info-label">Texture</div><div className="material-detail-info-value">{selectedMaterial.texture}</div></div>}
                  {selectedMaterial.supplier && <div className="material-detail-info-item"><div className="material-detail-info-label">Supplier</div><div className="material-detail-info-value">{selectedMaterial.supplier}</div></div>}
                  {selectedMaterial.coveragePerUnit && <div className="material-detail-info-item"><div className="material-detail-info-label">Coverage</div><div className="material-detail-info-value">{selectedMaterial.coveragePerUnit}</div></div>}
                </div>
              </div>

              {/* Supplier Links */}
              {(selectedMaterial.supplierUrl || selectedMaterial.supplierUrlAlt) && (
                <div className="material-detail-section">
                  <div className="material-detail-section-title">Check Live Price & Stock</div>
                  <div className="material-detail-supplier-links">
                    {selectedMaterial.supplierUrl && (
                      <a href={selectedMaterial.supplierUrl} target="_blank" rel="noopener noreferrer" className="supplier-link-btn">
                        <div className="supplier-link-icon" style={{ background: 'rgba(58, 156, 74, 0.1)' }}>🔗</div>
                        <div className="supplier-link-text">
                          <div>{selectedMaterial.supplier || 'Supplier'} Product Page</div>
                          <div className="supplier-link-sub">Check current price & availability</div>
                        </div>
                        <ExternalLink size={16} style={{ color: 'var(--text-tertiary)' }} />
                      </a>
                    )}
                    {selectedMaterial.supplierUrlAlt && (
                      <a href={selectedMaterial.supplierUrlAlt} target="_blank" rel="noopener noreferrer" className="supplier-link-btn">
                        <div className="supplier-link-icon" style={{ background: 'rgba(251, 146, 60, 0.1)' }}>🔗</div>
                        <div className="supplier-link-text">
                          <div>Alternative Supplier</div>
                          <div className="supplier-link-sub">Compare prices</div>
                        </div>
                        <ExternalLink size={16} style={{ color: 'var(--text-tertiary)' }} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Quick search at our three suppliers (Lincoln NE stores) */}
              <div className="material-detail-section">
                <div className="material-detail-section-title">Find at Lincoln Suppliers</div>
                <div className="supplier-quicksearch-row">
                  {getQuickSearchLinks(selectedMaterial.sku || selectedMaterial.name).map(link => (
                    <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" className={`supplier-quicksearch-chip supplier-${link.key}`}>
                      {link.label}
                      <ExternalLink size={12} />
                    </a>
                  ))}
                </div>
              </div>

              {selectedMaterial.notes && (
                <div className="material-detail-section">
                  <div className="material-detail-section-title">Internal Notes</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{selectedMaterial.notes}</p>
                </div>
              )}

              <div className="material-detail-actions">
                <button className="btn btn-primary" onClick={() => { const idx = filtered.findIndex(m => m.id === selectedMaterial.id); if (idx >= 0) { setSelectedMaterial(null); startPresentation(idx); }}}>
                  <Maximize2 size={16} /> Present
                </button>
                <button className="btn btn-secondary" onClick={() => { setEditingMaterial(selectedMaterial); setShowForm(true); setSelectedMaterial(null); }}>
                  <Edit3 size={16} /> Edit
                </button>
                <button className="btn btn-danger" onClick={() => { setShowDelete(selectedMaterial); setSelectedMaterial(null); }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Presentation Mode */}
      {presMode && filtered.length > 0 && (() => {
        const m = filtered[presIndex];
        const imgSrc = getImageSrc(m);
        return (
          <div className="catalog-presentation">
            <button className="catalog-presentation-close" onClick={() => setPresMode(false)}><X size={24} /></button>
            <div className="catalog-presentation-counter">{presIndex + 1} / {filtered.length}</div>
            <div className="catalog-presentation-content">
              <div className="catalog-presentation-image">
                {imgSrc ? <img src={imgSrc} alt={m.name} /> : <div className="material-emoji">{m.imageEmoji || '🪨'}</div>}
              </div>
              <div className="catalog-presentation-info">
                <div className="catalog-presentation-name">{m.name}</div>
                <div className="catalog-presentation-category">{m.category}{m.subcategory ? ` · ${m.subcategory}` : ''}</div>
                {m.description && <div className="catalog-presentation-description">{m.description}</div>}
                <div className="catalog-presentation-stats">
                  <div className="catalog-presentation-stat">
                    <div className="catalog-presentation-stat-label">Price</div>
                    <div className="catalog-presentation-stat-value price">{formatPrice(m)}</div>
                  </div>
                  <div className="catalog-presentation-stat">
                    <div className="catalog-presentation-stat-label">Unit</div>
                    <div className="catalog-presentation-stat-value">per {m.unit}</div>
                  </div>
                  {m.supplier && (
                    <div className="catalog-presentation-stat">
                      <div className="catalog-presentation-stat-label">Supplier</div>
                      <div className="catalog-presentation-stat-value">{m.supplier}</div>
                    </div>
                  )}
                  {m.coveragePerUnit && (
                    <div className="catalog-presentation-stat">
                      <div className="catalog-presentation-stat-label">Coverage</div>
                      <div className="catalog-presentation-stat-value" style={{ fontSize: '0.9rem' }}>{m.coveragePerUnit}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="catalog-presentation-nav">
              <button onClick={() => setPresIndex(i => (i - 1 + filtered.length) % filtered.length)}><ChevronLeft size={24} /></button>
              <button onClick={() => setPresIndex(i => (i + 1) % filtered.length)}><ChevronRight size={24} /></button>
            </div>
          </div>
        );
      })()}

      {/* Form Modal */}
      {showForm && (
        <MaterialFormModal
          material={editingMaterial}
          onClose={() => { setShowForm(false); setEditingMaterial(null); }}
          onSave={handleSave}
        />
      )}

      {/* Import Outdoor Solutions — confirm */}
      {confirmImport && (
        <div className="modal-overlay" onClick={() => setConfirmImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>Import Outdoor Solutions Catalog</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setConfirmImport(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                Will insert or update <strong>{OUTDOOR_SOLUTIONS_CATALOG.length}</strong> items from the Outdoor Solutions Lincoln price list.
              </p>
              <ul style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', paddingLeft: 'var(--space-md)', lineHeight: 1.7 }}>
                <li>Existing items with a matching name (and same or no supplier) will have their price, unit, and category refreshed.</li>
                <li>New items will be inserted with supplier set to “Outdoor Solutions”.</li>
                <li>Items not on the Outdoor Solutions list are left untouched.</li>
                <li>Pricing source: outdoorsolutions-lincoln.com/price-list.</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmImport(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={importOutdoorSolutions}>
                <Download size={16} /> Import {OUTDOOR_SOLUTIONS_CATALOG.length} items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="modal-overlay" onClick={() => setImportResult(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>Import complete</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setImportResult(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(34,197,94,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#4ade80' }}>{importResult.inserted}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inserted</div>
                </div>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(59,130,246,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#60a5fa' }}>{importResult.updated}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price-refreshed</div>
                </div>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: importResult.errors.length ? 'rgba(239,68,68,0.10)' : 'rgba(148,163,184,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: importResult.errors.length ? '#f87171' : 'var(--text-tertiary)' }}>{importResult.errors.length}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Errors</div>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Show errors</summary>
                  <ul style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)', maxHeight: 240, overflowY: 'auto' }}>
                    {importResult.errors.map((e, i) => <li key={i}><strong>{e.item}:</strong> {e.error}</li>)}
                  </ul>
                </details>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setImportResult(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>Delete Material</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowDelete(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>This cannot be undone</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>"{showDelete.name}" will be permanently removed from your catalog.</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={16} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
