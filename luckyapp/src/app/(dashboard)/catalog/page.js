'use client';

import { useState, useEffect, useMemo } from 'react';
import { useData } from '@/lib/data';
import {
  Search, Maximize2, X, ChevronLeft, ChevronRight, Star, Plus,
  Grid3x3, List, ExternalLink, Edit3, Trash2, AlertTriangle, Clock,
  RefreshCw, Loader2, Eye, EyeOff, Truck, Sparkles, Upload, Download,
} from 'lucide-react';
import MaterialFormModal from '@/components/MaterialFormModal';
import CustomerCatalogCard from '@/components/CustomerCatalogCard';
import ImportMaterialsModal from '@/components/ImportMaterialsModal';
import { getQuickSearchLinks } from '@/lib/supplierSearch';
import {
  findMaterialSupplier, getMaterialActualCost, getEffectiveTaxRate,
  formatCurrency, formatTaxRate,
} from '@/lib/catalog';

const STOCK_LABEL = {
  in_stock: 'In stock',
  low_stock: 'Low',
  out_of_stock: 'Out',
  unknown: '',
};

function StockBadge({ m }) {
  const s = m.stockStatus || 'unknown';
  if (s === 'unknown') return null;
  return <span className={`stock-badge stock-${s.replace('_', '-')}`}>{STOCK_LABEL[s]}{m.stockQty ? ` · ${m.stockQty}` : ''}</span>;
}

function relativeDays(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CatalogPage() {
  const {
    materials, addMaterial, updateMaterial, deleteMaterial, clearAllMaterials,
    suppliers, addSupplier, updateSupplier, deleteSupplier, seedDefaultSuppliers,
  } = useData();

  // View mode: internal (full data) vs customer (photos + descriptors only).
  // Persisted because flipping back to internal accidentally during a customer
  // walkthrough would expose cost data.
  const [viewMode, setViewMode] = useState('internal');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lucky_catalog_view') : null;
    if (saved === 'internal' || saved === 'customer') setViewMode(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('lucky_catalog_view', viewMode);
  }, [viewMode]);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSupplierId, setActiveSupplierId] = useState('all');
  const [layout, setLayout] = useState('grid');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [presMode, setPresMode] = useState(false);
  const [presIndex, setPresIndex] = useState(0);
  const [presShowInternal, setPresShowInternal] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showSupplierMgmt, setShowSupplierMgmt] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showRefreshBatch, setShowRefreshBatch] = useState(false);
  const [refreshBatchRunning, setRefreshBatchRunning] = useState(false);
  const [refreshBatchResult, setRefreshBatchResult] = useState(null);

  // Lookup helpers
  const supplierById = useMemo(() => {
    const m = new Map();
    suppliers.forEach(s => m.set(s.id, s));
    return m;
  }, [suppliers]);

  const isCustomerView = viewMode === 'customer';

  // Filters: customer view only sees customer-visible + active items.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return materials
      .filter(m => {
        if (isCustomerView) {
          if (m.isCustomerVisible === false) return false;
          if (m.isActive === false) return false;
        }
        const sup = supplierById.get(m.supplierId);
        const haystack = `${m.name} ${m.description || ''} ${sup?.name || ''} ${m.color || ''} ${m.texture || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
        if (term && !haystack.includes(term)) return false;
        if (activeCategory !== 'all' && m.category !== activeCategory) return false;
        if (activeSupplierId !== 'all' && m.supplierId !== activeSupplierId) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
  }, [materials, search, activeCategory, activeSupplierId, isCustomerView, supplierById]);

  const categories = useMemo(() => ['all', ...new Set(materials.map(m => m.category).filter(Boolean))], [materials]);

  // Keyboard nav for presentation mode
  useEffect(() => {
    if (!presMode) return;
    const handler = (e) => {
      if (e.key === 'Escape') setPresMode(false);
      if (e.key === 'ArrowRight') setPresIndex(i => (i + 1) % filtered.length);
      if (e.key === 'ArrowLeft') setPresIndex(i => (i - 1 + filtered.length) % filtered.length);
      if (e.key === 'i' || e.key === 'I') setPresShowInternal(v => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presMode, filtered.length]);

  const handleSave = async (data) => {
    if (editingMaterial) await updateMaterial(editingMaterial.id, data);
    else await addMaterial(data);
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

  const clearCatalog = async () => {
    setConfirmClear(false);
    setClearing(true);
    try { await clearAllMaterials(); }
    catch (err) { alert('Failed to clear: ' + (err.message || err)); }
    finally { setClearing(false); }
  };

  const handleSeedSuppliers = async () => {
    setSeeding(true); setSeedMsg('');
    try {
      const res = await seedDefaultSuppliers();
      setSeedMsg(res.created > 0
        ? `Added ${res.created} suppliers (${res.skipped} already existed).`
        : 'All three default suppliers already exist.');
    } catch (err) {
      setSeedMsg('Failed: ' + (err.message || err));
    } finally {
      setSeeding(false);
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
      };
      if (data.price != null) patch.unitCost = data.price;
      if (data.image && !m.imageUrl) patch.imageUrl = data.image;
      await updateMaterial(m.id, patch);
      setSelectedMaterial(prev => prev && prev.id === m.id ? { ...prev, ...patch } : prev);
      setRefreshMsg(`Updated ${m.name}: ${(data.stockStatus || 'unknown').replace('_', ' ')}${data.price != null ? ` at ${formatCurrency(data.price)}` : ''}.`);
    } catch (err) {
      setRefreshMsg('Lookup failed: ' + (err.message || err));
    } finally {
      setRefreshingId(null);
    }
  };

  const noSuppliers = suppliers.length === 0;

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Material Catalog</h1>
          <p>{materials.length} items · {suppliers.length} suppliers · viewing as <strong>{isCustomerView ? 'Customer' : 'Internal team'}</strong>.</p>
        </div>
        <div className="page-header-actions">
          {/* The view toggle is the most important control on this page.
              Putting it left of the destructive buttons makes accidental
              taps less catastrophic. */}
          <div className="catalog-view-toggle" role="tablist" aria-label="Catalog view mode">
            <button
              role="tab"
              className={!isCustomerView ? 'active' : ''}
              onClick={() => setViewMode('internal')}
              title="Show cost, supplier, margin, SKU — for internal use only"
            >
              <EyeOff size={14} /> Internal
            </button>
            <button
              role="tab"
              className={isCustomerView ? 'active' : ''}
              onClick={() => setViewMode('customer')}
              title="Hide all internal data — safe to show customers"
            >
              <Eye size={14} /> Customer
            </button>
          </div>
          {!isCustomerView && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowSupplierMgmt(true)}
              title="Manage suppliers (Outdoor Solutions, Menards, Home Depot, etc.)"
            >
              <Truck size={16} /> Suppliers ({suppliers.length})
            </button>
          )}
          {!isCustomerView && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowImport(true)}
              disabled={noSuppliers}
              title="Bulk import from CSV"
            >
              <Upload size={16} /> Import CSV
            </button>
          )}
          {!isCustomerView && materials.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowRefreshBatch(true)}
              disabled={refreshBatchRunning}
              title="Refresh prices and stock for items with a supplier URL"
            >
              {refreshBatchRunning ? <><Loader2 size={16} className="spin" /> Refreshing…</> : <><RefreshCw size={16} /> Refresh prices</>}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => startPresentation(0)} disabled={filtered.length === 0}>
            <Maximize2 size={16} /> Present
          </button>
          {!isCustomerView && (
            <button
              className="btn btn-primary"
              onClick={() => { setEditingMaterial(null); setShowForm(true); }}
              disabled={noSuppliers}
              title={noSuppliers ? 'Add a supplier first' : 'Add a new material'}
            >
              <Plus size={16} /> Add Material
            </button>
          )}
        </div>
      </div>

      {/* Empty-state nudge: no suppliers yet */}
      {noSuppliers && !isCustomerView && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Get started in 10 seconds:</strong> click below to add Outdoor Solutions, Menards, and Home Depot as suppliers. You can edit or remove them after.
          <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSeedSuppliers} disabled={seeding}>
              {seeding ? <><Loader2 size={14} className="spin" /> Adding…</> : <><Sparkles size={14} /> Add 3 default suppliers</>}
            </button>
            {seedMsg && <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{seedMsg}</span>}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="catalog-toolbar">
        <div className="search-input-wrap">
          <Search size={16} />
          <input className="search-input" placeholder="Search materials..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {!isCustomerView && (
          <div className="catalog-view-toggle">
            <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}><Grid3x3 size={16} /></button>
            <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}><List size={16} /></button>
          </div>
        )}
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

      {/* Supplier Chips — internal view only */}
      {!isCustomerView && suppliers.length > 0 && (
        <div className="catalog-filters" style={{ marginTop: '-var(--space-sm)' }}>
          <button className={`catalog-filter-chip ${activeSupplierId === 'all' ? 'active' : ''}`} onClick={() => setActiveSupplierId('all')}>
            All Suppliers <span className="chip-count">{materials.length}</span>
          </button>
          {suppliers.map(s => {
            const count = materials.filter(m => m.supplierId === s.id).length;
            return (
              <button
                key={s.id}
                className={`catalog-filter-chip ${activeSupplierId === s.id ? 'active' : ''}`}
                onClick={() => setActiveSupplierId(s.id)}
              >
                {s.name} <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Customer Grid — only the customer card */}
      {isCustomerView && (
        <div className="customer-grid">
          {filtered.map(m => (
            <div key={m.id} className="customer-grid-item" onClick={() => startPresentation(filtered.findIndex(x => x.id === m.id))}>
              <CustomerCatalogCard material={m} />
            </div>
          ))}
        </div>
      )}

      {/* Internal Grid View */}
      {!isCustomerView && layout === 'grid' && (
        <div className="material-grid">
          {filtered.map(m => {
            const supplier = supplierById.get(m.supplierId);
            const actualCost = getMaterialActualCost(m, supplier);
            const taxRate = getEffectiveTaxRate(m, supplier);
            const stale = m.lastPriceCheck && (Date.now() - new Date(m.lastPriceCheck).getTime()) > 30 * 86400000;
            return (
              <div key={m.id} className="material-card" onClick={() => setSelectedMaterial(m)}>
                <div className="material-card-img">
                  {m.imageUrl ? <img src={m.imageUrl} alt={m.name} /> : <div className="material-emoji">📦</div>}
                  <div className="material-card-badges">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      {m.isActive === false && <span className="material-sold-out-badge">Inactive</span>}
                      {m.isCustomerVisible === false && <span className="stock-badge stock-low-stock" title="Hidden from customer view">Internal only</span>}
                      <StockBadge m={m} />
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
                    <div className="material-card-price">
                      {formatCurrency(m.unitCost)} <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>/ {m.unit}</span>
                    </div>
                    {supplier && <span className="material-card-supplier">{supplier.name}</span>}
                  </div>
                  <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Actual {formatCurrency(actualCost)} (tax {formatTaxRate(taxRate)})
                    {stale && <span style={{ color: 'var(--status-warn)', marginLeft: 6 }}>· stale</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Internal List View */}
      {!isCustomerView && layout === 'list' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}></th>
                <th>Name</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Cost</th>
                <th>Actual (tax)</th>
                <th>Stock</th>
                <th>Verified</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const supplier = supplierById.get(m.supplierId);
                const actualCost = getMaterialActualCost(m, supplier);
                const taxRate = getEffectiveTaxRate(m, supplier);
                const verified = relativeDays(m.lastPriceCheck);
                return (
                  <tr key={m.id} onClick={() => setSelectedMaterial(m)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                        {m.imageUrl ? <img src={m.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '1.2rem' }}>📦</div>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      {m.isCustomerVisible === false && <div style={{ fontSize: '0.7rem', color: 'var(--status-warn)' }}>Internal only</div>}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{m.category}</td>
                    <td>{supplier?.name || <span style={{ color: 'var(--status-danger)' }}>none</span>}</td>
                    <td><span style={{ fontWeight: 600 }}>{formatCurrency(m.unitCost)}</span> <span style={{ color: 'var(--text-tertiary)' }}>/ {m.unit}</span></td>
                    <td><span style={{ color: 'var(--lucky-green-light)', fontWeight: 600 }}>{formatCurrency(actualCost)}</span> <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{formatTaxRate(taxRate)}</span></td>
                    <td><StockBadge m={m} /></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{verified || '—'}</td>
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
          <p>{isCustomerView ? 'Switch to Internal view to add materials.' : noSuppliers ? 'Add a supplier first, then add materials.' : 'Try a different search or add your first material.'}</p>
          {!isCustomerView && !noSuppliers && (
            <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => { setEditingMaterial(null); setShowForm(true); }}>
              <Plus size={16} /> Add Material
            </button>
          )}
        </div>
      )}

      {/* Detail Slideout — internal view only */}
      {!isCustomerView && selectedMaterial && (() => {
        const supplier = supplierById.get(selectedMaterial.supplierId);
        const actualCost = getMaterialActualCost(selectedMaterial, supplier);
        const taxRate = getEffectiveTaxRate(selectedMaterial, supplier);
        return (
          <>
            <div className="material-detail-overlay" onClick={() => setSelectedMaterial(null)} />
            <div className="material-detail-panel">
              <div className="material-detail-hero">
                {selectedMaterial.imageUrl
                  ? <img src={selectedMaterial.imageUrl} alt={selectedMaterial.name} />
                  : <div className="material-emoji">📦</div>
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

                {/* Internal pricing */}
                <div className="material-detail-section">
                  <div className="material-detail-section-title">Internal Pricing</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)' }}>
                    <div className="material-detail-info-item">
                      <div className="material-detail-info-label">Unit cost (pre-tax)</div>
                      <div className="material-detail-info-value">{formatCurrency(selectedMaterial.unitCost)} / {selectedMaterial.unit}</div>
                    </div>
                    <div className="material-detail-info-item">
                      <div className="material-detail-info-label">Tax rate</div>
                      <div className="material-detail-info-value">{formatTaxRate(taxRate)} {selectedMaterial.taxRate == null && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(supplier default)</span>}</div>
                    </div>
                    <div className="material-detail-info-item">
                      <div className="material-detail-info-label">Actual cost (incl. tax)</div>
                      <div className="material-detail-info-value" style={{ color: 'var(--lucky-green-light)', fontWeight: 700 }}>{formatCurrency(actualCost)}</div>
                    </div>
                    <div className="material-detail-info-item">
                      <div className="material-detail-info-label">Stock</div>
                      <div className="material-detail-info-value"><StockBadge m={selectedMaterial} /> {selectedMaterial.lastPriceCheck && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: 6 }}><Clock size={11} style={{ verticalAlign: 'middle' }} /> {relativeDays(selectedMaterial.lastPriceCheck)}</span>}</div>
                    </div>
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

                {/* Customer-visible details */}
                <div className="material-detail-section">
                  <div className="material-detail-section-title">Customer-visible details</div>
                  <div className="material-detail-info-grid">
                    {selectedMaterial.color && <div className="material-detail-info-item"><div className="material-detail-info-label">Color</div><div className="material-detail-info-value">{selectedMaterial.color}</div></div>}
                    {selectedMaterial.texture && <div className="material-detail-info-item"><div className="material-detail-info-label">Texture</div><div className="material-detail-info-value">{selectedMaterial.texture}</div></div>}
                    {supplier && <div className="material-detail-info-item"><div className="material-detail-info-label">Supplier (internal)</div><div className="material-detail-info-value">{supplier.name}</div></div>}
                    {selectedMaterial.coveragePerUnit && <div className="material-detail-info-item"><div className="material-detail-info-label">Coverage</div><div className="material-detail-info-value">{selectedMaterial.coveragePerUnit}</div></div>}
                    {selectedMaterial.sku && <div className="material-detail-info-item"><div className="material-detail-info-label">SKU</div><div className="material-detail-info-value">{selectedMaterial.sku}</div></div>}
                  </div>
                </div>

                {/* Supplier links */}
                {(selectedMaterial.supplierUrl || selectedMaterial.supplierUrlAlt) && (
                  <div className="material-detail-section">
                    <div className="material-detail-section-title">Live Pricing Links</div>
                    <div className="material-detail-supplier-links">
                      {selectedMaterial.supplierUrl && (
                        <a href={selectedMaterial.supplierUrl} target="_blank" rel="noopener noreferrer" className="supplier-link-btn">
                          <div className="supplier-link-icon" style={{ background: 'rgba(58, 156, 74, 0.1)' }}>🔗</div>
                          <div className="supplier-link-text">
                            <div>{supplier?.name || 'Supplier'} Product Page</div>
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
        );
      })()}

      {/* Presentation Mode — defaults to customer view, "i" toggles internal stats */}
      {presMode && filtered.length > 0 && (() => {
        const m = filtered[presIndex];
        const supplier = supplierById.get(m.supplierId);
        const actualCost = getMaterialActualCost(m, supplier);
        return (
          <div className="catalog-presentation">
            <button className="catalog-presentation-close" onClick={() => setPresMode(false)}><X size={24} /></button>
            <div className="catalog-presentation-counter">{presIndex + 1} / {filtered.length}</div>
            {!isCustomerView && (
              <button
                className="catalog-presentation-internal-toggle"
                onClick={() => setPresShowInternal(v => !v)}
                title="Toggle internal pricing overlay (or press 'i')"
                style={{ position: 'absolute', top: 16, right: 64, padding: '6px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                {presShowInternal ? 'Hide' : 'Show'} pricing
              </button>
            )}
            <div className="catalog-presentation-content">
              <div className="catalog-presentation-image">
                {m.imageUrl ? <img src={m.imageUrl} alt={m.name} /> : <div className="material-emoji">📦</div>}
              </div>
              <div className="catalog-presentation-info">
                <div className="catalog-presentation-name">{m.name}</div>
                <div className="catalog-presentation-category">{m.category}{m.subcategory ? ` · ${m.subcategory}` : ''}</div>
                {m.description && <div className="catalog-presentation-description">{m.description}</div>}
                <div className="catalog-presentation-stats">
                  {m.color && (
                    <div className="catalog-presentation-stat">
                      <div className="catalog-presentation-stat-label">Color</div>
                      <div className="catalog-presentation-stat-value">{m.color}</div>
                    </div>
                  )}
                  {m.texture && (
                    <div className="catalog-presentation-stat">
                      <div className="catalog-presentation-stat-label">Texture</div>
                      <div className="catalog-presentation-stat-value">{m.texture}</div>
                    </div>
                  )}
                  {m.coveragePerUnit && (
                    <div className="catalog-presentation-stat">
                      <div className="catalog-presentation-stat-label">Coverage</div>
                      <div className="catalog-presentation-stat-value" style={{ fontSize: '0.9rem' }}>{m.coveragePerUnit}</div>
                    </div>
                  )}
                  {presShowInternal && !isCustomerView && (
                    <>
                      <div className="catalog-presentation-stat" style={{ background: 'rgba(239,68,68,0.12)', borderRadius: 8, padding: 10 }}>
                        <div className="catalog-presentation-stat-label">Cost (internal)</div>
                        <div className="catalog-presentation-stat-value price">{formatCurrency(actualCost)} / {m.unit}</div>
                      </div>
                      {supplier && (
                        <div className="catalog-presentation-stat" style={{ background: 'rgba(239,68,68,0.12)', borderRadius: 8, padding: 10 }}>
                          <div className="catalog-presentation-stat-label">Supplier (internal)</div>
                          <div className="catalog-presentation-stat-value">{supplier.name}</div>
                        </div>
                      )}
                    </>
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
          suppliers={suppliers.filter(s => s.isActive !== false)}
          onClose={() => { setShowForm(false); setEditingMaterial(null); }}
          onSave={handleSave}
        />
      )}

      {/* CSV import */}
      {showImport && (
        <ImportMaterialsModal onClose={() => setShowImport(false)} />
      )}

      {/* Refresh-batch modal — pick which suppliers to refresh, then fan out */}
      {showRefreshBatch && (
        <RefreshBatchModal
          suppliers={suppliers}
          materials={materials}
          onClose={() => { setShowRefreshBatch(false); setRefreshBatchResult(null); }}
          onResult={setRefreshBatchResult}
          onUpdate={updateMaterial}
          running={refreshBatchRunning}
          setRunning={setRefreshBatchRunning}
          result={refreshBatchResult}
        />
      )}

      {/* Supplier management */}
      {showSupplierMgmt && (
        <SupplierManagementModal
          suppliers={suppliers}
          onClose={() => setShowSupplierMgmt(false)}
          onAdd={addSupplier}
          onUpdate={updateSupplier}
          onDelete={deleteSupplier}
          onSeed={handleSeedSuppliers}
          materialCounts={Object.fromEntries(suppliers.map(s => [s.id, materials.filter(m => m.supplierId === s.id).length]))}
        />
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
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>&quot;{showDelete.name}&quot; will be permanently removed from your catalog.</div>
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

      {/* Clear catalog — confirm. Only kept for the "I want a clean slate"
          workflow when migrating from old data. */}
      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Clear entire catalog?</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setConfirmClear(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>This deletes all {materials.length} materials</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Suppliers stay. Use this before re-importing a fresh CSV.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={clearCatalog}>
                <Trash2 size={16} /> Delete all {materials.length} items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Manual price/stock refresh modal — picks suppliers to scope, fires
// /api/catalog/refresh-batch, writes successful results back via
// updateMaterial. Designed to be conservative: we only run when the user
// presses Go, never on a cron, and we surface stale-supplier errors
// inline so it's obvious which items are blocked by bot detection.
function RefreshBatchModal({ suppliers, materials, onClose, onResult, onUpdate, running, setRunning, result }) {
  const [picked, setPicked] = useState(() => new Set(suppliers.map(s => s.id)));
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const togglePick = (id) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const targets = materials.filter(m => m.supplierUrl && picked.has(m.supplierId));

  const run = async () => {
    if (targets.length === 0) return;
    setRunning(true);
    setProgress({ done: 0, total: targets.length });
    onResult(null);
    try {
      // The route handles delays internally; we just fire it. For very large
      // batches the user can split by supplier (chunking happens server-side
      // up to the 200-cap, which is plenty for Lucky's catalog scale).
      const res = await fetch('/api/catalog/refresh-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialIds: targets.map(m => m.id) }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Refresh failed');
      // Apply DB writes for the successful results
      for (const r of data.results) {
        if (!r.ok) continue;
        const patch = {};
        if (r.newPrice != null) patch.unitCost = r.newPrice;
        if (r.newStock) patch.stockStatus = r.newStock;
        if (r.checkedAt) { patch.lastPriceCheck = r.checkedAt; patch.stockLastChecked = r.checkedAt; }
        if (r.image) patch.imageUrl = r.image;
        if (Object.keys(patch).length > 0) {
          try { await onUpdate(r.id, patch); } catch { /* best-effort */ }
        }
      }
      onResult(data.results);
      setProgress({ done: data.results.length, total: data.results.length });
    } catch (err) {
      onResult([{ ok: false, name: 'batch', error: err.message || String(err) }]);
    } finally {
      setRunning(false);
    }
  };

  const successCount = (result || []).filter(r => r.ok).length;
  const failCount = (result || []).filter(r => !r.ok).length;

  return (
    <div className="modal-overlay" onClick={() => !running && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>Refresh prices &amp; stock</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose} disabled={running}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {!result && (
            <>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Hits each supplier&apos;s product page server-side. Outdoor Solutions is reliable; Menards and Home Depot use bot detection and may return errors — that&apos;s normal. Re-run later or update those manually.
              </p>
              <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                {suppliers.map(s => {
                  const count = materials.filter(m => m.supplierId === s.id && m.supplierUrl).length;
                  const total = materials.filter(m => m.supplierId === s.id).length;
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-sm)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <input type="checkbox" checked={picked.has(s.id)} onChange={() => togglePick(s.id)} />
                        <strong>{s.name}</strong>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        {count} with URL · {total} total
                      </span>
                    </label>
                  );
                })}
              </div>
              <div style={{ marginTop: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Will check <strong>{targets.length}</strong> material{targets.length === 1 ? '' : 's'} (those with a supplier URL).
              </div>
            </>
          )}
          {running && (
            <div style={{ marginTop: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <Loader2 size={16} className="spin" />
              Checking {progress.total} items… server runs them sequentially with a 500ms delay; this can take a minute.
            </div>
          )}
          {result && (
            <>
              <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(34,197,94,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#4ade80' }}>{successCount}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Updated</div>
                </div>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(239,68,68,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f87171' }}>{failCount}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Blocked / failed</div>
                </div>
              </div>
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '0.85rem' }}>Show per-item results</summary>
                <table style={{ marginTop: 'var(--space-sm)', fontSize: '0.78rem', width: '100%' }}>
                  <thead>
                    <tr><th style={{ textAlign: 'left' }}>Material</th><th>Old → New</th><th>Stock</th><th></th></tr>
                  </thead>
                  <tbody>
                    {result.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.ok ? `$${r.oldPrice ?? '—'} → $${r.newPrice ?? '—'}` : '—'}</td>
                        <td>{r.ok ? `${r.oldStock || '—'} → ${r.newStock || '—'}` : '—'}</td>
                        <td style={{ color: r.ok ? '#4ade80' : '#f87171' }}>{r.ok ? '✓' : (r.error || 'failed')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </div>
        <div className="modal-footer">
          {!result ? (
            <>
              <button className="btn btn-secondary" onClick={onClose} disabled={running}>Cancel</button>
              <button className="btn btn-primary" onClick={run} disabled={running || targets.length === 0}>
                {running ? <><Loader2 size={14} className="spin" /> Running…</> : `Refresh ${targets.length} item${targets.length === 1 ? '' : 's'}`}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline supplier management modal — defined here because it's only used on
// this page. Kept simple: list + add + inline edit + delete (with material-
// count guardrail).
function SupplierManagementModal({ suppliers, onClose, onAdd, onUpdate, onDelete, onSeed, materialCounts }) {
  const [editing, setEditing] = useState(null);  // supplier object (or 'new')
  const [form, setForm] = useState({ name: '', website: '', defaultTaxRate: '0.0725', contactPhone: '', address: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || '',
      website: s.website || '',
      defaultTaxRate: s.defaultTaxRate != null ? String(s.defaultTaxRate) : '0.0725',
      contactPhone: s.contactPhone || '',
      address: s.address || '',
      notes: s.notes || '',
    });
    setError('');
  };
  const startAdd = () => {
    setEditing('new');
    setForm({ name: '', website: '', defaultTaxRate: '0.0725', contactPhone: '', address: '', notes: '' });
    setError('');
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    const payload = {
      ...form,
      defaultTaxRate: form.defaultTaxRate === '' ? 0.0725 : parseFloat(form.defaultTaxRate) || 0.0725,
    };
    setBusy(true); setError('');
    try {
      if (editing === 'new') await onAdd(payload);
      else await onUpdate(editing.id, payload);
      setEditing(null);
    } catch (err) {
      setError(err.message || String(err));
    } finally { setBusy(false); }
  };

  const remove = async (s) => {
    const count = materialCounts[s.id] || 0;
    if (count > 0) { setError(`Can't delete ${s.name} — ${count} materials still reference it. Reassign or delete those first.`); return; }
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    setBusy(true); setError('');
    try { await onDelete(s.id); }
    catch (err) { setError(err.message || String(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '85vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>Suppliers</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

          {!editing && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                  {suppliers.length} suppliers · default tax rate is what gets applied to a material when its own tax rate is blank.
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  {suppliers.length === 0 && (
                    <button className="btn btn-secondary" onClick={onSeed}>
                      <Sparkles size={14} /> Add 3 defaults
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={startAdd}>
                    <Plus size={14} /> Add supplier
                  </button>
                </div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Default Tax</th>
                      <th>Items</th>
                      <th>Website</th>
                      <th style={{ width: 120 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr key={s.id}>
                        <td><strong>{s.name}</strong></td>
                        <td>{formatTaxRate(s.defaultTaxRate)}</td>
                        <td>{materialCounts[s.id] || 0}</td>
                        <td>
                          {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem' }}>{s.website.replace(/^https?:\/\//, '')}</a>}
                        </td>
                        <td>
                          <button className="btn btn-icon btn-ghost" onClick={() => startEdit(s)}><Edit3 size={14} /></button>
                          <button className="btn btn-icon btn-ghost" onClick={() => remove(s)} disabled={busy}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {editing && (
            <div className="material-form-grid">
              <div className="form-group full-width">
                <label className="form-label">Name <span className="required">*</span></label>
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Default tax rate</label>
                <input className="form-input" type="number" step="0.0001" min="0" max="1" value={form.defaultTaxRate} onChange={e => setForm(p => ({ ...p, defaultTaxRate: e.target.value }))} />
                <div className="form-hint">Decimal (0.0725 = 7.25%). Lincoln/Lancaster combined.</div>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {editing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !form.name.trim()}>
                {busy ? <><Loader2 size={14} className="spin" /> Saving…</> : 'Save supplier'}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
