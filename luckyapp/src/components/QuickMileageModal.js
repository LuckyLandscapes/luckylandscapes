'use client';

// Phone-first "Log Mileage" modal — designed for crew in the field after a
// trip. Workers can clock a quick entry without seeing the full /mileage tax
// page. Required: miles + purpose. Everything else (odometer photo, vehicle,
// job link, notes) is optional and tucked behind "More details" so the
// default view fits on a phone screen.
//
// `team_member_id` is auto-filled from the current auth user (which IS the
// member id — see lib/auth.js loadUserProfile). RLS on mileage_entries
// (migration 025) allows any active team member in the org to insert/select,
// so this works for workers out-of-the-box; the only thing that previously
// gated them was the sidebar nav visibility.

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { X, Save, Car, Camera, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import ReceiptUpload from './ReceiptUpload';

const todayISO = () => new Date().toISOString().split('T')[0];

const PURPOSE_PRESETS = [
  'To job site',
  'Job → home',
  'Supply run',
  'Dump run',
  'Between jobs',
  'Quote visit',
];

function emptyForm() {
  return {
    date: todayISO(),
    miles: '',
    purpose: '',
    jobId: '',
    vehicle: '',
    startOdometer: '',
    endOdometer: '',
    notes: '',
    startPhoto: { url: null, path: null },
    endPhoto: { url: null, path: null },
  };
}

export default function QuickMileageModal({ open, onClose }) {
  const { user } = useAuth();
  const { jobs, addMileageEntry } = useData();

  const [form, setForm] = useState(emptyForm);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setShowMore(false);
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  // Show in-progress + today/upcoming-week jobs first; everything else past
  // that is rarely the right answer for a fresh trip log.
  const jobOptions = useMemo(() => {
    const today = todayISO();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 7);
    const horizonISO = horizon.toISOString().split('T')[0];
    return jobs
      .filter(j => {
        if (j.status === 'in_progress') return true;
        if (j.status === 'scheduled' && j.scheduledDate && j.scheduledDate >= today && j.scheduledDate <= horizonISO) return true;
        return false;
      })
      .sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
        return (a.scheduledDate || '').localeCompare(b.scheduledDate || '');
      });
  }, [jobs]);

  if (!open) return null;

  const handleSave = async () => {
    const miles = parseFloat(form.miles);
    if (!Number.isFinite(miles) || miles <= 0) {
      setError('Enter the miles driven (e.g. 12.4).');
      return;
    }
    if (!form.purpose.trim()) {
      setError('Tell us what the trip was for (e.g. "To job site").');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addMileageEntry({
        teamMemberId: user?.id || null,
        date: form.date || todayISO(),
        miles,
        purpose: form.purpose.trim(),
        jobId: form.jobId || null,
        vehicle: form.vehicle.trim() || null,
        startOdometer: form.startOdometer ? parseFloat(form.startOdometer) : null,
        endOdometer: form.endOdometer ? parseFloat(form.endOdometer) : null,
        startPhotoUrl: form.startPhoto?.url || null,
        startPhotoPath: form.startPhoto?.path || null,
        endPhotoUrl: form.endPhoto?.url || null,
        endPhotoPath: form.endPhoto?.path || null,
        notes: form.notes.trim() || null,
      });
      setSuccess(`Logged ${miles} miles.`);
      setTimeout(() => { onClose?.(); }, 700);
    } catch (err) {
      console.error('[QuickMileageModal] save failed', err);
      setError(err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose?.()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2><Car size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Log Mileage</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose} disabled={saving}><X size={20} /></button>
        </div>
        <div className="modal-body">

          {/* Required: miles + purpose ─ keep the default screen short */}
          <div className="form-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '0 0 140px' }}>
              <label className="form-label">Miles <span className="required">*</span></label>
              <input
                className="form-input"
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                placeholder="12.4"
                value={form.miles}
                onChange={e => setForm(f => ({ ...f, miles: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ flex: '0 0 160px' }}>
              <label className="form-label">Date</label>
              <input
                className="form-input"
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">What was the trip for? <span className="required">*</span></label>
            <input
              className="form-input"
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              placeholder="e.g. To job site at 12th & A"
            />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              {PURPOSE_PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setForm(f => ({ ...f, purpose: p }))}
                  style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Job tag — auto-shows in-progress + this week's jobs */}
          {jobOptions.length > 0 && (
            <div className="form-group">
              <label className="form-label">
                <Briefcase size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Job (optional)
              </label>
              <select
                className="form-select"
                value={form.jobId}
                onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}
              >
                <option value="">— Not tied to a job —</option>
                {jobOptions.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.status === 'in_progress' ? '▶ ' : ''}
                    {j.scheduledDate ? new Date(j.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' : ''}
                    {j.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* "More details" toggle — keeps the default form short for phone use */}
          <button
            type="button"
            onClick={() => setShowMore(s => !s)}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--text-tertiary)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: 'var(--space-sm)',
            }}
          >
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showMore ? 'Hide details' : 'More details (odometer, vehicle, photo, notes)'}
          </button>

          {showMore && (
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <div className="form-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
                  <label className="form-label">Vehicle</label>
                  <input
                    className="form-input"
                    value={form.vehicle}
                    onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))}
                    placeholder="F-150, trailer truck…"
                  />
                </div>
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                  <label className="form-label">Start odo</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    placeholder="84210"
                    value={form.startOdometer}
                    onChange={e => setForm(f => ({ ...f, startOdometer: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                  <label className="form-label">End odo</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    placeholder="84222"
                    value={form.endOdometer}
                    onChange={e => setForm(f => ({ ...f, endOdometer: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Camera size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Start odometer photo
                </label>
                <ReceiptUpload
                  orgId={user?.orgId}
                  scope="mileage"
                  value={form.startPhoto}
                  onChange={(p) => setForm(f => ({ ...f, startPhoto: p }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Camera size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  End odometer photo
                </label>
                <ReceiptUpload
                  orgId={user?.orgId}
                  scope="mileage"
                  value={form.endPhoto}
                  onChange={(p) => setForm(f => ({ ...f, endPhoto: p }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Anything else worth remembering."
                />
              </div>
            </div>
          )}

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
            <Save size={16} /> {saving ? 'Saving…' : 'Save Trip'}
          </button>
        </div>
      </div>
    </div>
  );
}
