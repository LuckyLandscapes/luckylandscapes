'use client';
import { useState, useRef } from 'react';
import { X, Upload, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  MATERIAL_CATEGORIES, MATERIAL_UNITS, STOCK_STATUSES,
  getEffectiveTaxRate, getMaterialActualCost, formatCurrency, formatTaxRate,
} from '@/lib/catalog';

const STOCK_LABELS = {
  unknown: 'Unknown',
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

export default function MaterialFormModal({ material, suppliers = [], onClose, onSave }) {
  const isEdit = !!material;
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(material?.imageUrl || '');
  const [form, setForm] = useState({
    supplierId: material?.supplierId || (suppliers[0]?.id ?? ''),
    name: material?.name || '',
    category: material?.category || '',
    subcategory: material?.subcategory || '',
    description: material?.description || '',
    unit: material?.unit || 'cu yd',
    unitCost: material?.unitCost ?? '',
    taxRate: material?.taxRate != null ? material.taxRate : '',  // empty = inherit supplier default
    sku: material?.sku || '',
    color: material?.color || '',
    texture: material?.texture || '',
    coveragePerUnit: material?.coveragePerUnit || '',
    supplierUrl: material?.supplierUrl || '',
    supplierUrlAlt: material?.supplierUrlAlt || '',
    notes: material?.notes || '',
    isFavorite: material?.isFavorite ?? false,
    isActive: material?.isActive ?? true,
    isCustomerVisible: material?.isCustomerVisible ?? true,
    stockStatus: material?.stockStatus || 'unknown',
    stockQty: material?.stockQty ?? '',
    stockLastChecked: material?.stockLastChecked || null,
  });
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const selectedSupplier = suppliers.find(s => s.id === form.supplierId) || null;

  // Live preview of "what cost actually flows into a job", using the supplier's
  // default tax rate when the per-item rate is blank.
  const previewMaterial = {
    unitCost: parseFloat(form.unitCost) || 0,
    taxRate: form.taxRate === '' ? null : parseFloat(form.taxRate),
  };
  const effectiveRate = getEffectiveTaxRate(previewMaterial, selectedSupplier);
  const actualCost = getMaterialActualCost(previewMaterial, selectedSupplier);

  const verifyNow = async () => {
    if (!form.supplierUrl) { setVerifyMsg('Add a supplier product URL first.'); return; }
    setVerifying(true); setVerifyMsg('');
    try {
      const res = await fetch('/api/catalog/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.supplierUrl }),
      });
      const data = await res.json();
      if (!data.ok) { setVerifyMsg(data.error || 'Could not read live data.'); return; }
      setForm(p => ({
        ...p,
        unitCost: data.price != null ? String(data.price) : p.unitCost,
        stockStatus: data.stockStatus || p.stockStatus,
        stockLastChecked: data.checkedAt,
      }));
      if (data.image && !imagePreview) setImagePreview(data.image);
      setVerifyMsg(`Updated from supplier (${(data.stockStatus || 'unknown').replace('_', ' ')}, $${data.price ?? '—'}).`);
    } catch (err) {
      setVerifyMsg('Lookup failed: ' + (err.message || err));
    } finally {
      setVerifying(false);
    }
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.category || !form.supplierId) return;
    setSaving(true);
    try {
      let imageUrl = material?.imageUrl || '';
      if (imagePreview && imagePreview.startsWith('http')) imageUrl = imagePreview;
      if (imageFile && supabase) {
        const ext = imageFile.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('materials').upload(path, imageFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('materials').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      await onSave({
        ...form,
        imageUrl,
        unitCost: parseFloat(form.unitCost) || 0,
        taxRate: form.taxRate === '' ? null : parseFloat(form.taxRate),
        stockQty: form.stockQty === '' ? null : parseInt(form.stockQty, 10) || 0,
        lastPriceCheck: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      console.error('Save material error:', err);
      alert('Failed to save: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const noSuppliers = suppliers.length === 0;

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Material' : 'Add Material'}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {noSuppliers && (
            <div className="alert alert-warn" style={{ marginBottom: 'var(--space-md)' }}>
              You don&apos;t have any suppliers yet. Add a supplier first (Outdoor Solutions, Menards, Home Depot) — every material has to be linked to one.
            </div>
          )}

          {/* Image Upload */}
          <div className="form-group full-width" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="form-label">Photo</label>
            <div className={`material-image-upload ${imagePreview ? 'has-image' : ''}`} onClick={() => fileRef.current?.click()}>
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" />
                  <button className="material-image-remove" onClick={e => { e.stopPropagation(); setImagePreview(''); setImageFile(null); }}><X size={16} /></button>
                </>
              ) : (
                <div className="upload-placeholder">
                  <Upload size={32} />
                  <div className="upload-text">Click to upload photo</div>
                  <div className="upload-hint">JPG, PNG up to 10MB</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
          </div>

          <div className="material-form-grid">
            {/* Supplier comes first now — it's the gating choice */}
            <div className="form-group full-width">
              <label className="form-label">Supplier <span className="required">*</span></label>
              <select className="form-select" value={form.supplierId} onChange={e => set('supplierId', e.target.value)} disabled={noSuppliers}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.defaultTaxRate != null ? ` (default tax ${formatTaxRate(s.defaultTaxRate)})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group full-width">
              <label className="form-label">Name <span className="required">*</span></label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Crimson Red Mulch" />
            </div>
            <div className="form-group">
              <label className="form-label">Category <span className="required">*</span></label>
              <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select...</option>
                {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <input className="form-input" value={form.subcategory} onChange={e => set('subcategory', e.target.value)} placeholder="e.g. Dyed" />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Description (customer-visible)</label>
              <textarea className="form-textarea" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description for customers..." />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {MATERIAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unit Cost ($)</label>
              <input className="form-input" type="number" step="0.01" value={form.unitCost} onChange={e => set('unitCost', e.target.value)} placeholder="35.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Tax Rate (override)</label>
              <input
                className="form-input"
                type="number"
                step="0.0001"
                min="0"
                max="1"
                value={form.taxRate}
                onChange={e => set('taxRate', e.target.value)}
                placeholder={selectedSupplier ? formatTaxRate(selectedSupplier.defaultTaxRate) + ' (supplier default)' : '0.0725'}
              />
              <div className="form-hint">Decimal (e.g. 0.0725 = 7.25%). Blank = use supplier default.</div>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div className="info-card" style={{ background: 'var(--surface-2)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Actual cost (incl. tax)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatCurrency(actualCost)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                  {formatCurrency(parseFloat(form.unitCost) || 0)} × (1 + {formatTaxRate(effectiveRate)})
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Color</label>
              <input className="form-input" value={form.color} onChange={e => set('color', e.target.value)} placeholder="e.g. Dark Red" />
            </div>
            <div className="form-group">
              <label className="form-label">Texture</label>
              <input className="form-input" value={form.texture} onChange={e => set('texture', e.target.value)} placeholder="e.g. Coarse / Smooth" />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Coverage per Unit</label>
              <input className="form-input" value={form.coveragePerUnit} onChange={e => set('coveragePerUnit', e.target.value)} placeholder='e.g. 1 cu yd ≈ 100 sqft at 3" depth' />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Supplier Product URL</label>
              <input className="form-input" value={form.supplierUrl} onChange={e => set('supplierUrl', e.target.value)} placeholder="https://..." />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Alt Supplier URL</label>
              <input className="form-input" value={form.supplierUrlAlt} onChange={e => set('supplierUrlAlt', e.target.value)} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label className="form-label">SKU / Model #</label>
              <input className="form-input" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. 100571540" />
            </div>
            <div className="form-group">
              <label className="form-label">Stock Status</label>
              <select className="form-select" value={form.stockStatus} onChange={e => set('stockStatus', e.target.value)}>
                {STOCK_STATUSES.map(s => <option key={s} value={s}>{STOCK_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Stock Qty (optional)</label>
              <input className="form-input" type="number" value={form.stockQty} onChange={e => set('stockQty', e.target.value)} placeholder="e.g. 24" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={verifyNow}
                disabled={verifying || !form.supplierUrl}
                style={{ width: '100%' }}
                title={form.supplierUrl ? 'Fetch live price/stock from supplier URL' : 'Add a supplier URL above first'}
              >
                {verifying ? <><Loader2 size={14} className="spin" /> Checking…</> : <><RefreshCw size={14} /> Verify live</>}
              </button>
            </div>
            {verifyMsg && (
              <div className="form-group full-width" style={{ marginTop: 'calc(-1 * var(--space-sm))' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CheckCircle2 size={12} /> {verifyMsg}
                </div>
              </div>
            )}
            <div className="form-group full-width">
              <label className="form-label">Internal Notes</label>
              <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes only you see — never shown to customers..." />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <div className="toggle-row">
              <div><div className="toggle-row-label">⭐ Favorite</div><div className="toggle-row-hint">Pin to top of catalog</div></div>
              <button className={`toggle-switch ${form.isFavorite ? 'active' : ''}`} onClick={() => set('isFavorite', !form.isFavorite)} />
            </div>
            <div className="toggle-row">
              <div><div className="toggle-row-label">👁 Show in customer view</div><div className="toggle-row-hint">When off, hidden from quote galleries and customer-facing presentations</div></div>
              <button className={`toggle-switch ${form.isCustomerVisible ? 'active' : ''}`} onClick={() => set('isCustomerVisible', !form.isCustomerVisible)} />
            </div>
            <div className="toggle-row">
              <div><div className="toggle-row-label">✓ Active</div><div className="toggle-row-hint">Inactive items are hidden everywhere except the catalog admin list</div></div>
              <button className={`toggle-switch ${form.isActive ? 'active' : ''}`} onClick={() => set('isActive', !form.isActive)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !form.name || !form.category || !form.supplierId}>
            {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Add Material'}
          </button>
        </div>
      </div>
    </div>
  );
}
