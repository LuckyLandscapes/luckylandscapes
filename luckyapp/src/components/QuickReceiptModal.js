'use client';

// Universal "log a receipt" modal — works tied to a job (COGS) or
// standalone (OpEx). One-tap entry point from the sidebar so workers
// out in the truck can capture fuel/food/etc. before they forget.

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { COGS_CATEGORIES, COGS_LABELS, OPEX_CATEGORIES, OPEX_LABELS } from '@/lib/finance';
import { X, Save, Receipt, Briefcase, Building2 } from 'lucide-react';
import ReceiptUpload from './ReceiptUpload';

const COGS_ICONS = {
  materials: '🧱', equipment: '🔧', fuel: '⛽', dump_fees: '🚛',
  subcontractor: '👷', permits: '📄', other: '📦',
};
const OPEX_ICONS = {
  vehicle: '🚐', insurance: '🛡️', rent: '🏢', utilities: '💡',
  software: '💻', marketing: '📢', office_supplies: '📎',
  fuel: '⛽', payroll_tax: '🧾', other: '📦',
};

const todayISO = () => new Date().toISOString().split('T')[0];

export default function QuickReceiptModal({ open, onClose }) {
  const { user } = useAuth();
  const { jobs, contractors = [], addJobExpense, addCompanyExpense } = useData();

  // Default category per scope: 'fuel' if untagged (OpEx vehicle gas);
  // 'materials' if tagged to a job (COGS).
  const [jobId, setJobId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [form, setForm] = useState({
    category: 'fuel',
    description: '',
    amount: '',
    date: todayISO(),
    vendor: '',
    receipt: { url: null, path: null },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setJobId('');
      setContractorId('');
      setForm({
        category: 'fuel',
        description: '',
        amount: '',
        date: todayISO(),
        vendor: '',
        receipt: { url: null, path: null },
      });
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  // Job pick-list: today + in-progress + scheduled in the next 7 days,
  // sorted by date so today is always at the top.
  const jobOptions = useMemo(() => {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(now.getDate() + 7);
    const horizonISO = horizon.toISOString().split('T')[0];
    return jobs
      .filter(j => {
        if (j.status === 'in_progress') return true;
        if (j.status === 'scheduled' && j.scheduledDate && j.scheduledDate <= horizonISO) return true;
        return false;
      })
      .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
  }, [jobs]);

  // Switch category set when toggling job tag — pick a sane default
  // for whichever scope the user just chose.
  const handleJobChange = (newJobId) => {
    setJobId(newJobId);
    setForm(f => {
      const valid = newJobId ? COGS_CATEGORIES : OPEX_CATEGORIES;
      if (valid.includes(f.category)) return f;
      return { ...f, category: newJobId ? 'materials' : 'fuel' };
    });
  };

  if (!open) return null;

  const tagged = !!jobId;
  const categories = tagged ? COGS_CATEGORIES : OPEX_CATEGORIES;
  const labels = tagged ? COGS_LABELS : OPEX_LABELS;
  const icons = tagged ? COGS_ICONS : OPEX_ICONS;

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!form.description.trim() || !amount || amount <= 0) {
      setError('Description and a positive amount are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const shared = {
        category: form.category,
        description: form.description.trim(),
        amount,
        date: form.date || todayISO(),
        vendor: form.vendor.trim() || null,
        contractorId: contractorId || null,
        receiptUrl: form.receipt?.url || null,
        receiptPath: form.receipt?.path || null,
      };
      if (tagged) {
        await addJobExpense({ jobId, ...shared });
      } else {
        await addCompanyExpense({ ...shared, recurring: false, recurringInterval: null });
      }
      setSuccess(tagged ? 'Saved to job expenses.' : 'Saved to company expenses.');
      // Auto-close after a beat so workers can see confirmation
      setTimeout(() => { onClose?.(); }, 700);
    } catch (err) {
      console.error('[QuickReceiptModal] save failed', err);
      setError(err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose?.()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2><Receipt size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Log Receipt</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose} disabled={saving}><X size={20} /></button>
        </div>
        <div className="modal-body">

          {/* Job tagger — the key piece. Toggles whole form between COGS and OpEx. */}
          <div className="form-group">
            <label className="form-label">
              {tagged
                ? <><Briefcase size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Tied to a job</>
                : <><Building2 size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> General expense</>}
            </label>
            <select className="form-select" value={jobId} onChange={e => handleJobChange(e.target.value)}>
              <option value="">— Not tied to a job (fuel, food, supplies, etc.) —</option>
              {jobOptions.map(j => (
                <option key={j.id} value={j.id}>
                  {j.scheduledDate ? new Date(j.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' : ''}
                  {j.title}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {tagged
                ? 'Will count as a job cost (COGS) and affect that job\'s margin.'
                : 'Will count as company overhead (OpEx). Picks fuel for driving, meals, office supplies, etc.'}
            </div>
          </div>

          <ReceiptUpload
            orgId={user?.orgId}
            scope={tagged ? 'job' : 'company'}
            value={form.receipt}
            onChange={(receipt) => setForm(f => ({ ...f, receipt }))}
          />

          <div className="form-row" style={{ marginTop: 'var(--space-md)', gap: '8px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{icons[c]} {labels[c]}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: '0 0 160px' }}>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">What was this for?</label>
            <input
              className="form-input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={tagged ? 'e.g. mulch + bagged stone' : 'e.g. truck fuel between quotes, lunch for crew'}
            />
          </div>

          {/* Contractor tag — only shown if any contractors exist. Tagging here
              rolls the expense into the year-end 1099-NEC totals. */}
          {contractors.filter(c => !c.archived).length > 0 && (
            <div className="form-group">
              <label className="form-label">Paid to a 1099 contractor? (optional)</label>
              <select className="form-select" value={contractorId} onChange={e => setContractorId(e.target.value)}>
                <option value="">— Not paid to a contractor —</option>
                {contractors.filter(c => !c.archived).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.contactName}{c.businessName ? ` — ${c.businessName}` : ''}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Tagging counts toward the contractor&apos;s 1099-NEC total ($600+ triggers a filing requirement).
              </div>
            </div>
          )}

          <div className="form-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
              <label className="form-label">Vendor</label>
              <input
                className="form-input"
                value={form.vendor}
                onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                placeholder="Casey's, OS, Menards…"
              />
            </div>
            <div className="form-group" style={{ flex: '0 0 140px' }}>
              <label className="form-label">Amount</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>$</span>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ paddingLeft: '24px' }}
                />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginTop: 'var(--space-sm)' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--status-success-bg)', color: 'var(--status-success)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginTop: 'var(--space-sm)' }}>
              {success}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
