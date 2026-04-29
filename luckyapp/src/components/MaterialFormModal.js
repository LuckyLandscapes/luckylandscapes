'use client';
import { useState, useRef } from 'react';
import { X, Upload, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Mulch','Rock','Pavers','Retaining Wall','Soil & Amendments','Edging','Flagstone','Boulders','Sand & Gravel','Sod & Seed','Pottery','Other'];
const SUPPLIERS = ['Outdoor Solutions','Menards','Home Depot','Other'];
const STOCK_STATUSES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

export default function MaterialFormModal({ material, onClose, onSave }) {
  const isEdit = !!material;
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(material?.imageUrl || material?.image || '');
  const [form, setForm] = useState({
    name: material?.name || '',
    category: material?.category || '',
    subcategory: material?.subcategory || '',
    description: material?.description || '',
    unit: material?.unit || 'cu yd',
    unitAlt: material?.unitAlt || '',
    costLow: material?.costLow || '',
    costHigh: material?.costHigh || '',
    supplier: material?.supplier || '',
    supplierUrl: material?.supplierUrl || '',
    supplierUrlAlt: material?.supplierUrlAlt || '',
    sku: material?.sku || '',
    color: material?.color || '',
    texture: material?.texture || '',
    coveragePerUnit: material?.coveragePerUnit || '',
    notes: material?.notes || '',
    isFavorite: material?.isFavorite || false,
    soldOut: material?.soldOut || false,
    stockStatus: material?.stockStatus || 'unknown',
    stockQty: material?.stockQty ?? '',
    stockLastChecked: material?.stockLastChecked || null,
  });
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

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
        costLow: data.price != null ? String(data.price) : p.costLow,
        costHigh: data.price != null ? String(data.price) : p.costHigh,
        stockStatus: data.stockStatus || p.stockStatus,
        stockLastChecked: data.checkedAt,
        soldOut: data.stockStatus === 'out_of_stock',
      }));
      setVerifyMsg(`Updated from supplier (${data.stockStatus.replace('_', ' ')}, $${data.price ?? '—'}).`);
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
    if (!form.name || !form.category) return;
    setSaving(true);
    try {
      let imageUrl = material?.imageUrl || material?.image || '';
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
        image: imageUrl,
        imageUrl: imageUrl,
        costLow: parseFloat(form.costLow) || 0,
        costHigh: parseFloat(form.costHigh) || 0,
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

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Material' : 'Add Material'}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
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
            <div className="form-group full-width">
              <label className="form-label">Name <span className="required">*</span></label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Crimson Red Mulch" />
            </div>
            <div className="form-group">
              <label className="form-label">Category <span className="required">*</span></label>
              <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <input className="form-input" value={form.subcategory} onChange={e => set('subcategory', e.target.value)} placeholder="e.g. Dyed" />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description for customers..." />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {['cu yd','ton','sqft','each','bag','pallet','ft','face ft','load'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Alt Unit</label>
              <input className="form-input" value={form.unitAlt} onChange={e => set('unitAlt', e.target.value)} placeholder="e.g. scoop" />
            </div>
            <div className="form-group">
              <label className="form-label">Cost Low ($)</label>
              <input className="form-input" type="number" step="0.01" value={form.costLow} onChange={e => set('costLow', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Cost High ($)</label>
              <input className="form-input" type="number" step="0.01" value={form.costHigh} onChange={e => set('costHigh', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-select" value={form.supplier} onChange={e => set('supplier', e.target.value)}>
                <option value="">Select...</option>
                {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input className="form-input" value={form.color} onChange={e => set('color', e.target.value)} placeholder="e.g. Dark Red" />
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
                {STOCK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
              <label className="form-label">Coverage per Unit</label>
              <input className="form-input" value={form.coveragePerUnit} onChange={e => set('coveragePerUnit', e.target.value)} placeholder='e.g. 1 cu yd ≈ 100 sqft at 3" depth' />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Internal Notes</label>
              <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes only you see..." />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <div className="toggle-row">
              <div><div className="toggle-row-label">⭐ Favorite</div><div className="toggle-row-hint">Pin to top of catalog</div></div>
              <button className={`toggle-switch ${form.isFavorite ? 'active' : ''}`} onClick={() => set('isFavorite', !form.isFavorite)} />
            </div>
            <div className="toggle-row">
              <div><div className="toggle-row-label">🚫 Sold Out</div><div className="toggle-row-hint">Mark as unavailable</div></div>
              <button className={`toggle-switch ${form.soldOut ? 'active' : ''}`} onClick={() => set('soldOut', !form.soldOut)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !form.name || !form.category}>
            {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Add Material'}
          </button>
        </div>
      </div>
    </div>
  );
}
