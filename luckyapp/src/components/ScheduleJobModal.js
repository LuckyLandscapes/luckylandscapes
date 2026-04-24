'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import {
  X,
  CalendarDays,
  Clock,
  FileText,
  Users,
  Loader2,
  CheckCircle,
} from 'lucide-react';

export default function ScheduleJobModal({ quoteId, onClose, onScheduled }) {
  const { convertQuoteToJob, teamMembers, getQuote, getCustomer } = useData();

  const quote = getQuote(quoteId);
  const customer = quote ? getCustomer(quote.customerId) : null;

  const [form, setForm] = useState({
    scheduledDate: '',
    scheduledTime: '08:00',
    crewNotes: '',
    assignedTo: [],
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
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
    if (!form.scheduledDate) return;
    setSaving(true);

    try {
      const job = await convertQuoteToJob({
        quoteId,
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime,
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
              date: form.scheduledDate,
              startTime: form.scheduledTime || '08:00',
              description: `${form.crewNotes || ''}\n\nQuote #${quote?.quoteNumber}`,
              location: customer?.address ? `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.zip || ''}`.trim() : '',
            }),
          });
        } catch (syncErr) {
          console.warn('Google Calendar sync failed (non-blocking):', syncErr.message);
        }
      }
    } catch (err) {
      console.error('Error scheduling job:', err);
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
                {new Date(form.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
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

              {/* Date & Time */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Scheduled Date <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.scheduledDate}
                    onChange={e => setForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  />
                </div>
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
            </>
          )}
        </div>

        {!success && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSchedule}
              disabled={saving || !form.scheduledDate}
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
