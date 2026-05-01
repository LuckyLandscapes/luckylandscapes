'use client';

// IRS-compliant mileage log. Each entry captures the four facts §274(d)
// requires: date, miles, business purpose, place. Odometer photos are the
// best contemporaneous proof and slot into the existing `receipts` storage
// bucket under a mileage/ folder.

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { fmtCurrency, isInPeriod } from '@/lib/finance';
import {
  Plus, X, Save, Car, Camera, Trash2, Edit3, MapPin, Briefcase, FileText,
  Download, AlertTriangle,
} from 'lucide-react';
import ReceiptUpload from '@/components/ReceiptUpload';

// Standard IRS business mileage rate. 2026 = $0.70/mi; bump this annually.
const MILEAGE_RATE_2026 = 0.70;

const PERIODS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All Time' },
];

const todayISO = () => new Date().toISOString().split('T')[0];

function emptyForm() {
  return {
    date: todayISO(),
    miles: '',
    purpose: '',
    startAddress: '',
    endAddress: '',
    startOdometer: '',
    endOdometer: '',
    vehicle: '',
    jobId: '',
    notes: '',
    startPhoto: { url: null, path: null },
    endPhoto: { url: null, path: null },
  };
}

export default function MileagePage() {
  const { mileageEntries, addMileageEntry, updateMileageEntry, deleteMileageEntry, jobs } = useData();
  const { user } = useAuth();

  const [period, setPeriod] = useState('month');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Auto-fill miles when odometer values are both present
  const setOdo = (which, value) => {
    setForm(f => {
      const next = { ...f, [which]: value };
      const s = parseFloat(next.startOdometer);
      const e = parseFloat(next.endOdometer);
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        next.miles = String((e - s).toFixed(1));
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    return mileageEntries
      .filter(m => period === 'all' || isInPeriod(m.date, period))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [mileageEntries, period]);

  const totalMiles = filtered.reduce((s, m) => s + Number(m.miles || 0), 0);
  const totalDeduction = totalMiles * MILEAGE_RATE_2026;

  const recentJobs = useMemo(() => {
    const today = todayISO();
    return jobs
      .filter(j => j.scheduledDate && j.scheduledDate <= today && j.scheduledDate >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .concat(jobs.filter(j => j.status === 'in_progress'))
      .filter((j, i, arr) => arr.findIndex(x => x.id === j.id) === i)
      .sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''))
      .slice(0, 50);
  }, [jobs]);

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      date: entry.date || todayISO(),
      miles: String(entry.miles || ''),
      purpose: entry.purpose || '',
      startAddress: entry.startAddress || '',
      endAddress: entry.endAddress || '',
      startOdometer: entry.startOdometer != null ? String(entry.startOdometer) : '',
      endOdometer: entry.endOdometer != null ? String(entry.endOdometer) : '',
      vehicle: entry.vehicle || '',
      jobId: entry.jobId || '',
      notes: entry.notes || '',
      startPhoto: { url: entry.startPhotoUrl || null, path: entry.startPhotoPath || null },
      endPhoto:   { url: entry.endPhotoUrl   || null, path: entry.endPhotoPath   || null },
    });
    setShowForm(true);
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  };

  const save = async () => {
    const miles = parseFloat(form.miles);
    if (!miles || miles <= 0) { setError('Miles must be greater than zero.'); return; }
    if (!form.purpose.trim()) { setError('Business purpose is required by the IRS.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date: form.date || todayISO(),
        miles,
        purpose: form.purpose.trim(),
        startAddress: form.startAddress.trim() || null,
        endAddress: form.endAddress.trim() || null,
        startOdometer: form.startOdometer ? parseFloat(form.startOdometer) : null,
        endOdometer: form.endOdometer ? parseFloat(form.endOdometer) : null,
        vehicle: form.vehicle.trim() || null,
        jobId: form.jobId || null,
        notes: form.notes.trim() || null,
        startPhotoUrl: form.startPhoto?.url || null,
        startPhotoPath: form.startPhoto?.path || null,
        endPhotoUrl: form.endPhoto?.url || null,
        endPhotoPath: form.endPhoto?.path || null,
      };
      if (editingId) {
        await updateMileageEntry(editingId, payload);
      } else {
        await addMileageEntry(payload);
      }
      cancel();
    } catch (err) {
      console.error('[MileagePage] save failed', err);
      setError(err?.message || 'Failed to save trip.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this trip? This is permanent and removes the odometer photos.')) return;
    try { await deleteMileageEntry(id); }
    catch (err) { alert(err?.message || 'Delete failed.'); }
  };

  // CSV export — IRS-compliant log shape: Date | Miles | Purpose | Start | End | Vehicle | Odometer In | Odometer Out
  const exportCSV = () => {
    const rows = [
      ['Date', 'Miles', 'Purpose', 'Start Address', 'End Address', 'Vehicle', 'Odometer In', 'Odometer Out', 'Job'],
      ...filtered.map(m => [
        m.date,
        m.miles,
        m.purpose,
        m.startAddress || '',
        m.endAddress || '',
        m.vehicle || '',
        m.startOdometer ?? '',
        m.endOdometer ?? '',
        jobs.find(j => j.id === m.jobId)?.title || '',
      ]),
    ];
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mileage-log-${period}-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1><Car size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Mileage Log</h1>
          <p>IRS-compliant log. {filtered.length} trip{filtered.length === 1 ? '' : 's'} this {period === 'all' ? 'period' : period}.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={exportCSV} disabled={!filtered.length}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}>
            <Plus size={16} /> Log Trip
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <div className="stat-card">
          <div className="stat-card-label">Miles</div>
          <div className="stat-card-value">{totalMiles.toFixed(1)}</div>
          <div className="stat-card-sub">{filtered.length} trip{filtered.length === 1 ? '' : 's'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Est. deduction</div>
          <div className="stat-card-value">{fmtCurrency(totalDeduction)}</div>
          <div className="stat-card-sub">@ ${MILEAGE_RATE_2026.toFixed(2)}/mi (2026 IRS rate)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avg per trip</div>
          <div className="stat-card-value">{filtered.length ? (totalMiles / filtered.length).toFixed(1) : '—'}</div>
          <div className="stat-card-sub">miles</div>
        </div>
      </div>

      {/* Period filter */}
      <div className="tabs" style={{ marginBottom: 'var(--space-lg)' }}>
        {PERIODS.map(p => (
          <button key={p.key} className={`tab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* IRS reminder */}
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-lg)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, color: 'var(--status-warning, #f59e0b)', marginTop: 2 }} />
          <div>
            <strong>Log it the day you drive it.</strong> The IRS requires <em>contemporaneous</em> records (Pub 463). Backfilled mileage logs lose deductions in audits. Standard mileage and actual-expenses methods can&apos;t both apply to the same vehicle in the same year — pick one with your CPA.
          </div>
      </div>

      {/* Trip list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', color: 'var(--text-tertiary)' }}>
          No trips logged yet. Click <strong>Log Trip</strong> the next time you drive.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {filtered.map(m => {
            const job = jobs.find(j => j.id === m.jobId);
            return (
              <div key={m.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{new Date(m.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                    <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{Number(m.miles).toFixed(1)} mi</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{fmtCurrency(Number(m.miles) * MILEAGE_RATE_2026)}</span>
                    {job && <span className="tag"><Briefcase size={11} /> {job.title}</span>}
                    {m.vehicle && <span className="tag"><Car size={11} /> {m.vehicle}</span>}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.9rem' }}>{m.purpose}</div>
                  {(m.startAddress || m.endAddress) && (
                    <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <MapPin size={12} />
                      {m.startAddress || '—'} → {m.endAddress || '—'}
                    </div>
                  )}
                  {(m.startOdometer != null || m.endOdometer != null) && (
                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Odometer: {m.startOdometer ?? '—'} → {m.endOdometer ?? '—'}
                    </div>
                  )}
                  {(m.startPhotoUrl || m.endPhotoUrl) && (
                    <div style={{ marginTop: '6px', display: 'flex', gap: '4px' }}>
                      {m.startPhotoUrl && <a href={m.startPhotoUrl} target="_blank" rel="noopener noreferrer"><img src={m.startPhotoUrl} alt="Start odometer" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} /></a>}
                      {m.endPhotoUrl && <a href={m.endPhotoUrl} target="_blank" rel="noopener noreferrer"><img src={m.endPhotoUrl} alt="End odometer" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} /></a>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-icon btn-ghost" onClick={() => startEdit(m)} title="Edit"><Edit3 size={16} /></button>
                  <button className="btn btn-icon btn-ghost" onClick={() => remove(m.id)} title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => !saving && cancel()}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2><Car size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {editingId ? 'Edit Trip' : 'Log a Trip'}</h2>
              <button className="btn btn-icon btn-ghost" onClick={cancel} disabled={saving}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '0 0 160px' }}>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
                  <label className="form-label">Vehicle</label>
                  <input className="form-input" placeholder="F-150" value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: '0 0 140px' }}>
                  <label className="form-label">Miles</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={form.miles}
                    onChange={e => setForm(f => ({ ...f, miles: e.target.value }))}
                    placeholder="14.2"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Business purpose <span style={{ color: 'var(--status-danger)' }}>*</span></label>
                <input
                  className="form-input"
                  placeholder='e.g. "to job site at 123 Maple", "supply run to OS for mulch", "consultation with prospect"'
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Required by IRS Pub 463. Be specific — &ldquo;errands&rdquo; doesn&apos;t survive an audit.
                </div>
              </div>

              <div className="form-row" style={{ gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Start address</label>
                  <input className="form-input" placeholder="Shop / yard" value={form.startAddress} onChange={e => setForm(f => ({ ...f, startAddress: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">End address</label>
                  <input className="form-input" placeholder="123 Maple St" value={form.endAddress} onChange={e => setForm(f => ({ ...f, endAddress: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tag to a job (optional)</label>
                <select className="form-select" value={form.jobId} onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}>
                  <option value="">— Not tied to a job —</option>
                  {recentJobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.scheduledDate ? new Date(j.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' : ''}
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row" style={{ gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Odometer start</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={form.startOdometer}
                    onChange={e => setOdo('startOdometer', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Odometer end</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={form.endOdometer}
                    onChange={e => setOdo('endOdometer', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row" style={{ gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label"><Camera size={12} style={{ verticalAlign: 'middle' }} /> Start odometer photo</label>
                  <ReceiptUpload
                    orgId={user?.orgId}
                    scope="mileage"
                    value={form.startPhoto}
                    onChange={(v) => setForm(f => ({ ...f, startPhoto: v }))}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label"><Camera size={12} style={{ verticalAlign: 'middle' }} /> End odometer photo</label>
                  <ReceiptUpload
                    orgId={user?.orgId}
                    scope="mileage"
                    value={form.endPhoto}
                    onChange={(v) => setForm(f => ({ ...f, endPhoto: v }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {error && (
                <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancel} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving…' : (editingId ? 'Update Trip' : 'Save Trip')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
