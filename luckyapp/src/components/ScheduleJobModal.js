'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import { DayLoadBar } from '@/components/DaySchedulePreview';
import MiniMonthPicker from '@/components/MiniMonthPicker';
import { dayLoad, findNextOpenSlot, buildEventsByDate, summarizeWorkdays } from '@/lib/capacity';
import {
  X,
  CalendarDays,
  Clock,
  FileText,
  Users,
  Timer,
  Zap,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function ScheduleJobModal({ quoteId, onClose, onScheduled }) {
  const { convertQuoteToJob, teamMembers, getQuote, getCustomer, calendarEvents, jobs } = useData();

  const quote = getQuote(quoteId);
  const customer = quote ? getCustomer(quote.customerId) : null;

  const [form, setForm] = useState({
    scheduledDates: [],          // string[] — explicit set of workdays
    scheduledTime: '08:00',
    estimatedHours: 4,
    crewNotes: '',
    assignedTo: [],
  });

  const anchorDate = form.scheduledDates[0] || '';

  const eventsByDate = useMemo(
    () => buildEventsByDate({ calendarEvents, jobs }),
    [calendarEvents, jobs],
  );

  const dateLoad = useMemo(
    () => anchorDate ? dayLoad(eventsByDate[anchorDate] || []) : null,
    [eventsByDate, anchorDate],
  );

  const workdays = form.scheduledDates.length;
  const totalHours = Number(form.estimatedHours) || 0;
  const perDayHours = workdays > 0 ? totalHours / workdays : totalHours;

  // For the per-day "would overbook" hatching on the picker.
  const neededPerDay = workdays > 0 ? perDayHours : totalHours;

  const handleFindOpenSlot = () => {
    const needed = perDayHours || 4;
    const seed = anchorDate || new Date().toISOString().split('T')[0];
    const slot = findNextOpenSlot(eventsByDate, seed, needed);
    if (slot) setForm(prev => ({ ...prev, scheduledDates: [slot] }));
  };

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [createdJobId, setCreatedJobId] = useState(null);

  const handleToggleMember = (id) => {
    setForm(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(id)
        ? prev.assignedTo.filter(m => m !== id)
        : [...prev.assignedTo, id],
    }));
  };

  const handleSchedule = async () => {
    if (form.scheduledDates.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const job = await convertQuoteToJob({
        quoteId,
        scheduledDate: anchorDate,
        scheduledDates: form.scheduledDates,
        scheduledTime: form.scheduledTime,
        estimatedHours: Number(form.estimatedHours) || null,
        crewNotes: form.crewNotes,
        assignedTo: form.assignedTo,
      });

      if (job) {
        setCreatedJobId(job.id);
        setSuccess(true);
        if (onScheduled) onScheduled(job);

        // Fire-and-forget Google Calendar sync
        try {
          await fetch('/api/google-calendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: job.title,
              date: anchorDate,
              startTime: form.scheduledTime || '08:00',
              description: `${form.crewNotes || ''}\n\nQuote #${quote?.quoteNumber}`,
              location: customer?.address ? `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.zip || ''}`.trim() : '',
            }),
          });
        } catch (syncErr) {
          console.warn('Google Calendar sync failed (non-blocking):', syncErr.message);
        }
      } else {
        setError('Failed to create job. The quote may not exist.');
      }
    } catch (err) {
      console.error('Error scheduling job:', err);
      setError(err.message || 'Failed to schedule job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2>
            <CalendarDays size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Schedule Job
          </h2>
          <button className="btn btn-icon btn-ghost" onClick={() => !saving && onClose()}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {success ? (
            <div className="send-success-state">
              <div className="send-success-icon">
                <CheckCircle size={48} />
              </div>
              <h3>Job Scheduled!</h3>
              <p style={{ marginBottom: 'var(--space-lg)' }}>
                {quote?.category} job has been scheduled for{' '}
                {summarizeWorkdays(form.scheduledDates)}
              </p>
              <a href={`/jobs/${createdJobId}`} className="btn btn-primary">
                View Job Details
              </a>
            </div>
          ) : (
            <>
              {/* Quote Summary */}
              <div style={{
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Quote #{quote?.quoteNumber}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    {quote?.category} • {customer ? `${customer.firstName} ${customer.lastName || ''}` : 'No customer'}
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--lucky-green-light)' }}>
                  ${quote?.total?.toLocaleString() || '0'}
                </div>
              </div>

              {/* Date range — inline mini calendar with capacity per day */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                  <span>
                    <CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Job Dates <span className="required">*</span>
                    {form.scheduledDates.length > 0 && (
                      <span style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                        {summarizeWorkdays(form.scheduledDates)}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={handleFindOpenSlot}
                    title="Jump to the next day with enough headroom"
                    style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Zap size={11} /> Next open slot
                  </button>
                </label>
                <MiniMonthPicker
                  mode="multi"
                  value={form.scheduledDates}
                  onChange={(dates) => setForm(prev => ({ ...prev, scheduledDates: dates }))}
                  eventsByDate={eventsByDate}
                  neededHours={neededPerDay}
                />
                {workdays > 1 && totalHours > 0 && (
                  <div className="multiday-summary">
                    <span className="multiday-summary-pill">
                      <strong>{workdays}</strong> workdays
                    </span>
                    <span className="multiday-summary-pill">
                      <strong>{totalHours}h</strong> total
                    </span>
                    <span className="multiday-summary-pill highlight">
                      ~<strong>{perDayHours.toFixed(1)}h</strong>/day
                    </span>
                    <span className="multiday-summary-note">Hours split evenly across selected days.</span>
                  </div>
                )}
                {dateLoad && (
                  <div style={{ marginTop: 8 }}>
                    <DayLoadBar load={dateLoad} />
                  </div>
                )}
              </div>

              {/* Time + Duration */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Start Time
                  </label>
                  <input
                    className="form-input"
                    type="time"
                    value={form.scheduledTime}
                    onChange={e => setForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <Timer size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Estimated Hours
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={form.estimatedHours}
                    onChange={e => setForm(prev => ({ ...prev, estimatedHours: e.target.value }))}
                  />
                </div>
              </div>

              {/* Crew Assignment */}
              {teamMembers.length > 0 && (
                <div className="form-group">
                  <label className="form-label">
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Assign Crew
                  </label>
                  <div className="cal-crew-grid">
                    {teamMembers.filter(m => m.isActive).map(m => {
                      const isSelected = form.assignedTo.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          className={`cal-crew-chip ${isSelected ? 'active' : ''}`}
                          onClick={() => handleToggleMember(m.id)}
                        >
                          <div className="table-avatar" style={{
                            width: 26, height: 26, fontSize: '0.6rem',
                            background: isSelected ? 'var(--lucky-green)' : 'var(--bg-elevated)',
                            color: isSelected ? 'white' : 'var(--text-secondary)',
                          }}>
                            {m.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                          </div>
                          <span>{m.fullName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Crew Notes */}
              <div className="form-group">
                <label className="form-label">
                  <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Crew Notes
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={form.crewNotes}
                  onChange={e => setForm(prev => ({ ...prev, crewNotes: e.target.value }))}
                  placeholder="Access instructions, special requirements, materials to bring..."
                />
              </div>

              {error && (
                <div style={{
                  background: 'var(--status-danger-bg, rgba(239,68,68,0.08))',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginTop: 'var(--space-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-sm)',
                  fontSize: '0.82rem',
                  color: 'var(--status-danger, #ef4444)',
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {!success && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSchedule}
              disabled={saving || form.scheduledDates.length === 0}
            >
              {saving ? (
                <><Loader2 size={16} className="spin" /> Scheduling...</>
              ) : (
                <><CalendarDays size={16} /> Schedule Job</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
