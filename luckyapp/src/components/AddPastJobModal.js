'use client';

import { useState, useMemo } from 'react';
import { X, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { useData } from '@/lib/data';

// Typed single-job entry for backfilling old completed work. The CSV
// importer is for power users; this is what Riley uses. One job at a time;
// "Save and add another" keeps the customer + date so logging a day's
// worth of historical jobs is fast.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function emptyForm() {
  return {
    customerMode: 'existing',  // 'existing' | 'new'
    customerId: '',
    firstName: '',
    lastName: '',
    title: '',
    dateCompleted: todayISO(),
    address: '',
    revenue: '',
    materialsCost: '',
    equipmentCost: '',
    laborCost: '',
    otherCost: '',
    notes: '',
  };
}

export default function AddPastJobModal({ onClose }) {
  const { customers, addHistoricalJob } = useData();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedToast, setSavedToast] = useState(null);

  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

  // Pre-sort customers alphabetically for the dropdown
  const sortedCustomers = useMemo(() =>
    [...customers].sort((a, b) =>
      (`${a.firstName || ''} ${a.lastName || ''}`).localeCompare(`${b.firstName || ''} ${b.lastName || ''}`)
    ),
  [customers]);

  // Auto-fill address when picking an existing customer
  const handlePickCustomer = (id) => {
    const c = customers.find(x => x.id === id);
    set({
      customerId: id,
      address: c?.address || form.address,
    });
  };

  const validate = () => {
    if (form.customerMode === 'existing' && !form.customerId) return 'Pick a customer (or click "Add new").';
    if (form.customerMode === 'new' && !form.firstName.trim()) return 'New customer needs at least a first name.';
    if (!form.title.trim()) return 'Job title is required.';
    if (!form.dateCompleted) return 'Date completed is required.';
    const revenue = Number(form.revenue);
    if (!Number.isFinite(revenue) || revenue < 0) return 'Revenue must be a number ≥ 0.';
    for (const [key, label] of [
      ['materialsCost', 'Materials cost'],
      ['equipmentCost', 'Equipment cost'],
      ['laborCost', 'Labor cost'],
      ['otherCost', 'Other cost'],
    ]) {
      if (form[key] === '' || form[key] == null) continue;
      const v = Number(form[key]);
      if (!Number.isFinite(v) || v < 0) return `${label} must be a number ≥ 0 (or blank).`;
    }
    return null;
  };

  const submit = async (addAnother) => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const input = {
        title: form.title.trim(),
        dateCompleted: form.dateCompleted,
        address: form.address.trim(),
        notes: form.notes.trim(),
        revenue: Number(form.revenue) || 0,
        materialsCost: Number(form.materialsCost) || 0,
        equipmentCost: Number(form.equipmentCost) || 0,
        laborCost: Number(form.laborCost) || 0,
        otherCost: Number(form.otherCost) || 0,
      };
      if (form.customerMode === 'existing') {
        input.customerId = form.customerId;
      } else {
        input.firstName = form.firstName.trim();
        input.lastName = form.lastName.trim();
      }
      const res = await addHistoricalJob(input);
      const customerLabel = res.createdCustomer
        ? `${res.createdCustomer.firstName} ${res.createdCustomer.lastName || ''}`.trim()
        : (customers.find(c => c.id === form.customerId) ? `${customers.find(c => c.id === form.customerId).firstName} ${customers.find(c => c.id === form.customerId).lastName || ''}`.trim() : 'customer');
      if (addAnother) {
        // Keep customer + date so logging a string of jobs for the same
        // customer or the same day is fast.
        setForm({
          ...emptyForm(),
          customerMode: form.customerMode,
          customerId: form.customerId || (res.createdCustomer?.id || ''),
          dateCompleted: form.dateCompleted,
        });
        setSavedToast(`Saved "${input.title}" for ${customerLabel}`);
        setTimeout(() => setSavedToast(null), 2500);
      } else {
        onClose?.();
      }
    } catch (e) {
      setError(e.message || 'Failed to save job.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2>Add a past job</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
          <p style={{ marginTop: 0, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            For logging old jobs you tracked outside the app. Saves as <strong>completed</strong> on the date you pick. Cost fields are optional — fill what you know.
          </p>

          {savedToast && (
            <div className="alert alert-success" style={{ marginBottom: 'var(--space-md)' }}>
              <CheckCircle2 size={16} /> {savedToast}
            </div>
          )}
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>
          )}

          {/* Customer */}
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
              <button
                type="button"
                className={`btn btn-sm ${form.customerMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => set({ customerMode: 'existing' })}
              >
                Existing
              </button>
              <button
                type="button"
                className={`btn btn-sm ${form.customerMode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => set({ customerMode: 'new' })}
              >
                <Plus size={12} /> Add new
              </button>
            </div>
            {form.customerMode === 'existing' ? (
              <select
                className="form-select"
                value={form.customerId}
                onChange={e => handlePickCustomer(e.target.value)}
              >
                <option value="">— pick a customer —</option>
                {sortedCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {`${c.firstName || ''} ${c.lastName || ''}`.trim() || '(no name)'}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <input
                  className="form-input"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={e => set({ firstName: e.target.value })}
                />
                <input
                  className="form-input"
                  placeholder="Last name (optional)"
                  value={form.lastName}
                  onChange={e => set({ lastName: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Date + Title */}
          <div className="form-row" style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Date completed *</label>
              <input
                type="date"
                className="form-input"
                value={form.dateCompleted}
                onChange={e => set({ dateCompleted: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Job title *</label>
              <input
                className="form-input"
                placeholder="e.g. Mulch refresh — front beds"
                value={form.title}
                onChange={e => set({ title: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              className="form-input"
              placeholder="Street, City, State Zip"
              value={form.address}
              onChange={e => set({ address: e.target.value })}
            />
          </div>

          {/* Revenue */}
          <div className="form-group">
            <label className="form-label">Revenue (what you charged) *</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="form-input"
              placeholder="0.00"
              value={form.revenue}
              onChange={e => set({ revenue: e.target.value })}
            />
          </div>

          {/* Costs grid */}
          <div style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
            Costs (all optional — fill what you remember)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Materials</label>
              <input
                type="number" inputMode="decimal" step="0.01" min="0" className="form-input" placeholder="0.00"
                value={form.materialsCost}
                onChange={e => set({ materialsCost: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Equipment</label>
              <input
                type="number" inputMode="decimal" step="0.01" min="0" className="form-input" placeholder="0.00"
                value={form.equipmentCost}
                onChange={e => set({ equipmentCost: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Labor (paid out)</label>
              <input
                type="number" inputMode="decimal" step="0.01" min="0" className="form-input" placeholder="0.00"
                value={form.laborCost}
                onChange={e => set({ laborCost: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Other (fuel, dump fees, etc.)</label>
              <input
                type="number" inputMode="decimal" step="0.01" min="0" className="form-input" placeholder="0.00"
                value={form.otherCost}
                onChange={e => set({ otherCost: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Anything to remember about this job"
              value={form.notes}
              onChange={e => set({ notes: e.target.value })}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => submit(true)} disabled={saving}>
            {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : 'Save & add another'}
          </button>
          <button className="btn btn-primary" onClick={() => submit(false)} disabled={saving}>
            {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
