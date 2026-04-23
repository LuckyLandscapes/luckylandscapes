'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import {
  X,
  CalendarDays,
  Clock,
  User,
  Users,
  FileText,
  Tag,
  Search,
  Check,
  Phone,
  Mail,
  MapPin,
  Flag,
  Timer,
  DollarSign,
  Navigation,
} from 'lucide-react';

const EVENT_TYPES = [
  { value: 'quote_appointment', label: 'Quote Appointment', color: '#3b82f6', icon: '📋' },
  { value: 'job', label: 'Schedule Job', color: '#3a9c4a', icon: '🔨' },
  { value: 'meeting', label: 'Meeting', color: '#d4a93e', icon: '🤝' },
  { value: 'other', label: 'Other', color: '#64748b', icon: '📌' },
];

export default function EventModal({ event, defaultDate, onClose }) {
  const {
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    convertQuoteToJob, customers, teamMembers, quotes, jobs, getCustomer,
  } = useData();

  // Find accepted quotes that don't already have a job
  const availableQuotes = useMemo(() => {
    const jobQuoteIds = new Set(jobs.filter(j => j.quoteId).map(j => j.quoteId));
    return quotes.filter(q => q.status === 'accepted' && !jobQuoteIds.has(q.id));
  }, [quotes, jobs]);

  const [form, setForm] = useState({
    title: event?.title || '',
    type: event?.type || 'other',
    date: event?.date || defaultDate || new Date().toISOString().split('T')[0],
    startTime: event?.startTime || '09:00',
    endTime: event?.endTime || '10:00',
    allDay: event?.allDay || false,
    customerId: event?.customerId || '',
    notes: event?.notes || '',
    color: event?.color || '#3a9c4a',
    assignedTo: event?.assignedTo || [],
    selectedQuoteId: '',
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [crewSearch, setCrewSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCustomer = form.customerId ? customers.find(c => c.id === form.customerId) : null;
  const selectedQuote = form.selectedQuoteId ? quotes.find(q => q.id === form.selectedQuoteId) : null;

  const filteredCustomers = customerSearch
    ? customers.filter(c =>
      `${c.firstName} ${c.lastName || ''} ${c.email || ''} ${c.phone || ''}`
        .toLowerCase()
        .includes(customerSearch.toLowerCase())
    ).slice(0, 6)
    : customers.slice(0, 6);

  const activeMembers = teamMembers.filter(m => m.isActive);

  const filteredMembers = useMemo(() => {
    if (!crewSearch) return activeMembers;
    return activeMembers.filter(m =>
      m.fullName?.toLowerCase().includes(crewSearch.toLowerCase()) ||
      m.role?.toLowerCase().includes(crewSearch.toLowerCase())
    );
  }, [activeMembers, crewSearch]);

  const selectedMembers = activeMembers.filter(m => form.assignedTo.includes(m.id));

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleTypeChange = (type) => {
    const typeObj = EVENT_TYPES.find(t => t.value === type);
    setForm(prev => ({
      ...prev,
      type,
      color: typeObj?.color || '#64748b',
      selectedQuoteId: type !== 'job' ? '' : prev.selectedQuoteId,
    }));
  };

  const handleSelectQuote = (quoteId) => {
    const q = quotes.find(x => x.id === quoteId);
    if (!q) return;
    const cust = q.customerId ? getCustomer(q.customerId) : null;
    setForm(prev => ({
      ...prev,
      selectedQuoteId: quoteId,
      title: `${q.category || 'Job'} — ${cust ? `${cust.firstName} ${cust.lastName || ''}`.trim() : 'No Customer'}`,
      customerId: q.customerId || '',
      notes: q.notes || '',
    }));
  };

  const handleToggleMember = (id) => {
    setForm(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(id)
        ? prev.assignedTo.filter(m => m !== id)
        : [...prev.assignedTo, id],
    }));
  };

  const handleSave = async () => {
    if (!form.date) return;
    if (form.type === 'job' && !form.selectedQuoteId) return;
    if (form.type !== 'job' && !form.title) return;
    setSaving(true);

    try {
      if (form.type === 'job') {
        // Schedule job from accepted quote
        const job = await convertQuoteToJob({
          quoteId: form.selectedQuoteId,
          scheduledDate: form.date,
          scheduledTime: form.allDay ? null : form.startTime,
          crewNotes: form.notes || '',
          assignedTo: form.assignedTo,
        });

        // Also create a calendar event for the job
        if (job) {
          const calEvent = await addCalendarEvent({
            title: job.title,
            type: 'job',
            date: form.date,
            startTime: form.allDay ? null : form.startTime,
            endTime: form.allDay ? null : form.endTime,
            allDay: form.allDay,
            customerId: job.customerId || null,
            notes: form.notes,
            color: '#3a9c4a',
            assignedTo: form.assignedTo,
            jobId: job.id,
          });

          // Fire-and-forget Google Calendar sync
          if (calEvent?.id) {
            syncToGoogleCalendar('POST', {
              title: job.title,
              date: form.date,
              startTime: form.allDay ? null : form.startTime,
              endTime: form.allDay ? null : form.endTime,
              notes: form.notes,
            }, calEvent.id);
          }
        }
      } else if (event?.id) {
        // Editing existing non-job event
        const eventData = {
          title: form.title,
          type: form.type,
          date: form.date,
          startTime: form.allDay ? null : form.startTime,
          endTime: form.allDay ? null : form.endTime,
          allDay: form.allDay,
          customerId: form.customerId || null,
          notes: form.notes,
          color: form.color,
          assignedTo: form.assignedTo,
        };
        await updateCalendarEvent(event.id, eventData);
        if (event.googleEventId) {
          syncToGoogleCalendar('PUT', { ...eventData, googleEventId: event.googleEventId });
        }
      } else {
        // Creating new non-job event
        const eventData = {
          title: form.title,
          type: form.type,
          date: form.date,
          startTime: form.allDay ? null : form.startTime,
          endTime: form.allDay ? null : form.endTime,
          allDay: form.allDay,
          customerId: form.customerId || null,
          notes: form.notes,
          color: form.color,
          assignedTo: form.assignedTo,
        };
        const created = await addCalendarEvent(eventData);
        if (created?.id) {
          syncToGoogleCalendar('POST', eventData, created.id);
        }
      }
      onClose();
    } catch (err) {
      console.error('Error saving event:', err);
    } finally {
      setSaving(false);
    }
  };

  const syncToGoogleCalendar = async (method, eventData, supabaseEventId) => {
    try {
      const res = await fetch('/api/google-calendar', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventData, description: eventData.notes || '' }),
      });
      const data = await res.json();
      if (method === 'POST' && data.synced && data.googleEventId && supabaseEventId) {
        await updateCalendarEvent(supabaseEventId, { googleEventId: data.googleEventId });
      }
    } catch (err) {
      console.warn('Google Calendar sync failed (non-blocking):', err.message);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    if (event.googleEventId) {
      try {
        await fetch(`/api/google-calendar?eventId=${event.googleEventId}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Google Calendar delete failed (non-blocking):', err.message);
      }
    }
    await deleteCalendarEvent(event.id);
    onClose();
  };

  const customerAddress = selectedCustomer?.address
    ? `${selectedCustomer.address}${selectedCustomer.city ? `, ${selectedCustomer.city}` : ''}${selectedCustomer.state ? ` ${selectedCustomer.state}` : ''} ${selectedCustomer.zip || ''}`.trim()
    : '';

  const isJobType = form.type === 'job';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <h2>{event ? 'Edit Event' : isJobType ? 'Schedule Job from Quote' : 'New Event'}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Event Type Selector */}
          <div className="form-group">
            <label className="form-label">Event Type</label>
            <div className="cal-type-selector">
              {EVENT_TYPES.map(t => (
                <button
                  key={t.value}
                  className={`cal-type-option ${form.type === t.value ? 'active' : ''}`}
                  style={{ '--type-color': t.color }}
                  onClick={() => handleTypeChange(t.value)}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── JOB TYPE: Accepted Quote Picker ─────────── */}
          {isJobType && (
            <div className="form-group">
              <label className="form-label">
                <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Select Accepted Quote <span className="required">*</span>
              </label>
              {availableQuotes.length === 0 ? (
                <div style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  fontSize: '0.85rem',
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                }}>
                  <p style={{ marginBottom: '4px' }}>No accepted quotes available to schedule.</p>
                  <p style={{ fontSize: '0.78rem' }}>Accept a quote first from the Quotes page.</p>
                </div>
              ) : (
                <div className="quote-picker-list">
                  {availableQuotes.map(q => {
                    const cust = q.customerId ? getCustomer(q.customerId) : null;
                    const isSelected = form.selectedQuoteId === q.id;
                    return (
                      <button
                        key={q.id}
                        className={`quote-picker-item ${isSelected ? 'active' : ''}`}
                        onClick={() => handleSelectQuote(q.id)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            Quote #{q.quoteNumber} — {q.category || 'General'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            {cust ? `${cust.firstName} ${cust.lastName || ''}` : 'No customer'}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--lucky-green-light)', fontSize: '0.95rem' }}>
                          ${Number(q.total || 0).toLocaleString()}
                        </div>
                        {isSelected && <Check size={16} style={{ color: 'var(--lucky-green-light)', marginLeft: '8px' }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Title — for non-job events */}
          {!isJobType && (
            <div className="form-group">
              <label className="form-label">
                Title <span className="required">*</span>
              </label>
              <input
                className="form-input"
                value={form.title}
                onChange={e => updateField('title', e.target.value)}
                placeholder="e.g., Site walkthrough at 123 Oak St"
              />
            </div>
          )}

          {/* Date & Time */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                <CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Date <span className="required">*</span>
              </label>
              <input
                className="form-input"
                type="date"
                value={form.date}
                onChange={e => updateField('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={e => updateField('allDay', e.target.checked)}
                  style={{ accentColor: 'var(--lucky-green)' }}
                />
                All Day
              </label>
            </div>
          </div>

          {!form.allDay && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Start Time
                </label>
                <input
                  className="form-input"
                  type="time"
                  value={form.startTime}
                  onChange={e => updateField('startTime', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <input
                  className="form-input"
                  type="time"
                  value={form.endTime}
                  onChange={e => updateField('endTime', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ─── Customer Section — non-job only ──────────── */}
          {!isJobType && (
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">
                <User size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Customer (optional)
              </label>
              {selectedCustomer ? (
                <div className="customer-info-card">
                  <div className="customer-info-card-header">
                    <div className="customer-info-card-avatar">
                      {(selectedCustomer.firstName?.[0] || '') + (selectedCustomer.lastName?.[0] || '')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="customer-info-card-name">
                        {selectedCustomer.firstName} {selectedCustomer.lastName || ''}
                      </div>
                    </div>
                    <button className="btn btn-icon btn-ghost" style={{ width: 28, height: 28 }} onClick={() => updateField('customerId', '')}>
                      <X size={14} />
                    </button>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="customer-info-card-row">
                      <Phone size={14} />
                      <a href={`tel:${selectedCustomer.phone}`}>{selectedCustomer.phone}</a>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                      className="form-input"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      style={{ paddingLeft: '32px' }}
                    />
                  </div>
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="cal-customer-dropdown">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          className="cal-customer-item"
                          onClick={() => {
                            updateField('customerId', c.id);
                            setCustomerSearch('');
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <div className="table-avatar" style={{ width: 32, height: 32, fontSize: '0.65rem' }}>
                            {(c.firstName?.[0] || '') + (c.lastName?.[0] || '')}
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.firstName} {c.lastName || ''}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── Crew Assignment ─────────────────────────────── */}
          {activeMembers.length > 0 && (isJobType || form.type === 'quote_appointment') && (
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">
                <Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Assign Crew ({form.assignedTo.length} selected)
              </label>

              {selectedMembers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {selectedMembers.map(m => (
                    <div key={m.id} className="crew-selected-chip">
                      <div className="table-avatar" style={{ width: 22, height: 22, fontSize: '0.55rem', background: 'var(--lucky-green)', color: 'white' }}>
                        {m.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                      </div>
                      <span>{m.fullName?.split(' ')[0]}</span>
                      <button onClick={() => handleToggleMember(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--text-tertiary)', display: 'flex' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  className="form-input"
                  placeholder="Search crew members..."
                  value={crewSearch}
                  onChange={e => setCrewSearch(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                />
              </div>

              <div className="crew-assignment-list">
                {filteredMembers.map(m => {
                  const isSelected = form.assignedTo.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      className={`crew-assignment-item ${isSelected ? 'active' : ''}`}
                      onClick={() => handleToggleMember(m.id)}
                    >
                      <div className="table-avatar" style={{
                        width: 30, height: 30, fontSize: '0.6rem',
                        background: isSelected ? 'var(--lucky-green)' : 'var(--bg-elevated)',
                        color: isSelected ? 'white' : 'var(--text-secondary)',
                      }}>
                        {m.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{m.fullName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{m.role}</div>
                      </div>
                      {isSelected && <Check size={16} style={{ color: 'var(--lucky-green-light)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">
              <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {isJobType ? 'Crew Notes & Instructions' : 'Notes'}
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder={isJobType
                ? 'Access instructions, materials to bring, gate codes, special requirements...'
                : 'Additional details...'}
            />
          </div>
        </div>

        <div className="modal-footer">
          {event?.id && (
            <button className="btn btn-danger btn-sm" onClick={handleDelete} style={{ marginRight: 'auto' }}>
              Delete
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !form.date || (isJobType ? !form.selectedQuoteId : !form.title)}
          >
            {saving ? 'Saving...' : isJobType ? 'Schedule Job' : event ? 'Update Event' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
