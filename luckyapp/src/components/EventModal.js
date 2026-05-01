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
  AlertTriangle,
} from 'lucide-react';

const EVENT_TYPES = [
  { value: 'quote_appointment', label: 'Quote Appointment', color: '#3b82f6', icon: '📋' },
  { value: 'job', label: 'Schedule Job', color: '#6B8E4E', icon: '🔨' },
  { value: 'meeting', label: 'Meeting', color: '#d4a93e', icon: '🤝' },
  { value: 'other', label: 'Other', color: '#64748b', icon: '📌' },
];

const TYPE_FALLBACK_COLORS = {
  job: '#6B8E4E',
  quote_appointment: '#3b82f6',
  meeting: '#d4a93e',
  other: '#64748b',
};

// Parse "HH:MM" → minutes-since-midnight (or null)
function toMin(t) {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function EventModal({ event, defaultDate, onClose }) {
  const {
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    convertQuoteToJob, customers, teamMembers, quotes, jobs, getCustomer,
    calendarEvents,
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

  // Existing bookings on the chosen date — calendar events + jobs (without their own event), excluding the one being edited.
  const dayEvents = useMemo(() => {
    if (!form.date) return [];
    const out = [];
    calendarEvents.forEach(e => {
      if (e.date !== form.date) return;
      if (event?.id && e.id === event.id) return;
      out.push({
        id: e.id,
        title: e.title,
        type: e.type,
        color: e.color || TYPE_FALLBACK_COLORS[e.type] || '#64748b',
        startTime: e.startTime,
        endTime: e.endTime,
        allDay: !!e.allDay,
        assignedTo: e.assignedTo || [],
      });
    });
    jobs.forEach(j => {
      if (j.scheduledDate !== form.date) return;
      if (calendarEvents.some(e => e.jobId === j.id)) return;
      out.push({
        id: `job-${j.id}`,
        title: j.title,
        type: 'job',
        color: '#6B8E4E',
        startTime: j.scheduledTime,
        endTime: null,
        allDay: false,
        assignedTo: j.assignedTo || [],
      });
    });
    return out;
  }, [calendarEvents, jobs, form.date, event?.id]);

  // Tentative window for the new/edited event (in minutes)
  const tentativeWindow = useMemo(() => {
    if (form.allDay) return { allDay: true, start: 0, end: 24 * 60 };
    const s = toMin(form.startTime);
    const e = toMin(form.endTime);
    if (s == null || e == null || e <= s) return null;
    return { allDay: false, start: s, end: e };
  }, [form.allDay, form.startTime, form.endTime]);

  // Time conflicts: events whose window overlaps the tentative window
  const timeConflicts = useMemo(() => {
    if (!tentativeWindow) return [];
    return dayEvents.filter(e => {
      if (e.allDay || tentativeWindow.allDay) return true;
      const s = toMin(e.startTime);
      let en = toMin(e.endTime);
      if (s == null) return false;
      if (en == null) en = s + 60; // assume 1hr if end missing
      return s < tentativeWindow.end && en > tentativeWindow.start;
    });
  }, [dayEvents, tentativeWindow]);

  // Crew double-bookings: assigned crew already on a conflicting event
  const crewConflicts = useMemo(() => {
    if (!form.assignedTo?.length || !timeConflicts.length) return [];
    const out = [];
    timeConflicts.forEach(e => {
      const overlap = form.assignedTo.filter(id => (e.assignedTo || []).includes(id));
      overlap.forEach(memberId => {
        const m = teamMembers.find(tm => tm.id === memberId);
        out.push({
          memberId,
          memberName: m?.fullName || 'Crew member',
          eventTitle: e.title,
          eventTimes: e.allDay
            ? 'All day'
            : `${formatTime12(e.startTime)}${e.endTime ? ' – ' + formatTime12(e.endTime) : ''}`,
        });
      });
    });
    return out;
  }, [timeConflicts, form.assignedTo, teamMembers]);

  // Capacity summary for the day
  const dayCapacity = useMemo(() => {
    let totalMin = 0;
    let allDayCount = 0;
    dayEvents.forEach(e => {
      if (e.allDay) { allDayCount++; return; }
      const s = toMin(e.startTime);
      let en = toMin(e.endTime);
      if (s == null) return;
      if (en == null) en = s + 60;
      if (en > s) totalMin += (en - s);
    });
    return { count: dayEvents.length, hours: totalMin / 60, allDayCount };
  }, [dayEvents]);

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
            color: '#6B8E4E',
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

          {/* ─── Day Schedule Preview & Conflicts ─────────── */}
          {form.date && (
            <div className="form-group">
              <div className="day-schedule-summary">
                <span>
                  <strong>{dayCapacity.count}</strong>{' '}
                  {dayCapacity.count === 1 ? 'event' : 'events'} on this day
                  {dayCapacity.allDayCount > 0 && ` (${dayCapacity.allDayCount} all-day)`}
                </span>
                {dayCapacity.hours > 0 && (
                  <span className="day-schedule-summary-pill">
                    <Clock size={11} /> {dayCapacity.hours.toFixed(1)}h scheduled
                  </span>
                )}
              </div>

              {timeConflicts.length > 0 && (
                <div className="cal-conflict-banner danger">
                  <div className="cal-conflict-banner-title">
                    <AlertTriangle size={14} /> Time conflict — overlaps {timeConflicts.length}{' '}
                    existing {timeConflicts.length === 1 ? 'event' : 'events'}
                  </div>
                  <ul className="cal-conflict-list">
                    {timeConflicts.map(e => (
                      <li key={e.id}>
                        <strong>{e.title}</strong>
                        {' — '}
                        {e.allDay
                          ? 'All day'
                          : `${formatTime12(e.startTime)}${e.endTime ? ' – ' + formatTime12(e.endTime) : ''}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {crewConflicts.length > 0 && (
                <div className="cal-conflict-banner danger">
                  <div className="cal-conflict-banner-title">
                    <AlertTriangle size={14} /> Crew double-booked
                  </div>
                  <ul className="cal-conflict-list">
                    {crewConflicts.map((c, i) => (
                      <li key={i}>
                        <strong>{c.memberName}</strong> already on “{c.eventTitle}” ({c.eventTimes})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <DaySchedulePreview
                events={dayEvents}
                tentative={
                  tentativeWindow
                    ? {
                        title: form.title || (isJobType ? 'New job' : 'New event'),
                        color: form.color,
                        allDay: tentativeWindow.allDay,
                        startTime: form.startTime,
                        endTime: form.endTime,
                      }
                    : null
                }
              />
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

// ─── Day Schedule Preview ──────────────────────────────────
// A vertical 6am–9pm timeline showing existing bookings on the chosen date
// plus a dashed "tentative" block for the in-progress event.
function DaySchedulePreview({ events, tentative }) {
  const startHour = 6;
  const endHour = 21; // 9pm
  const totalMin = (endHour - startHour) * 60;

  const toBlock = (e, isTentative = false) => {
    if (!e) return null;
    if (e.allDay) {
      return { top: 0, height: 100, label: e.title, color: e.color, isTentative, time: 'All day' };
    }
    const s = toMin(e.startTime);
    let en = toMin(e.endTime);
    if (s == null) return null;
    if (en == null) en = s + 60;
    const startBaseline = startHour * 60;
    const top = Math.max(0, ((s - startBaseline) / totalMin) * 100);
    const bottom = Math.min(100, ((en - startBaseline) / totalMin) * 100);
    if (bottom <= top) return null;
    return {
      top,
      height: bottom - top,
      label: e.title || (isTentative ? 'New event' : ''),
      color: e.color,
      isTentative,
      time: `${formatTime12(e.startTime)}${e.endTime ? ' – ' + formatTime12(e.endTime) : ''}`,
    };
  };

  const blocks = events.map(e => toBlock(e)).filter(Boolean);
  const tentBlock = tentative ? toBlock(tentative, true) : null;

  // Side-by-side layout for overlapping blocks (column packing)
  const withColumns = (() => {
    const sorted = [...blocks].sort((a, b) => a.top - b.top);
    const cols = []; // each col is array of blocks (their bottom edge)
    sorted.forEach(b => {
      let placed = false;
      for (let i = 0; i < cols.length; i++) {
        const last = cols[i][cols[i].length - 1];
        if (last.top + last.height <= b.top) {
          b.col = i;
          cols[i].push(b);
          placed = true;
          break;
        }
      }
      if (!placed) {
        b.col = cols.length;
        cols.push([b]);
      }
    });
    return { blocks: sorted, totalCols: Math.max(1, cols.length) };
  })();

  const hourMarks = [];
  for (let h = startHour; h <= endHour; h++) hourMarks.push(h);

  return (
    <div className="day-schedule">
      <div className="day-schedule-grid">
        <div className="day-schedule-hours">
          {hourMarks.map((h, i) => (
            <div key={h} className="day-schedule-hour" style={{ top: `${(i / (hourMarks.length - 1)) * 100}%` }}>
              <span className="day-schedule-hour-label">
                {h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
              </span>
            </div>
          ))}
        </div>
        <div className="day-schedule-events">
          {hourMarks.slice(0, -1).map((h, i) => (
            <div
              key={h}
              className="day-schedule-gridline"
              style={{ top: `${(i / (hourMarks.length - 1)) * 100}%` }}
            />
          ))}
          {events.length === 0 && !tentBlock && (
            <div className="day-schedule-empty">No events scheduled</div>
          )}
          {withColumns.blocks.map((b, i) => {
            const colWidth = 100 / withColumns.totalCols;
            return (
              <div
                key={i}
                className="day-schedule-block"
                style={{
                  '--event-color': b.color,
                  top: `${b.top}%`,
                  height: `${b.height}%`,
                  left: `calc(${b.col * colWidth}% + 2px)`,
                  width: `calc(${colWidth}% - 4px)`,
                }}
                title={`${b.label} — ${b.time}`}
              >
                <div className="day-schedule-block-title">{b.label}</div>
                <div className="day-schedule-block-time">{b.time}</div>
              </div>
            );
          })}
          {tentBlock && (
            <div
              className="day-schedule-block tentative"
              style={{
                '--event-color': tentBlock.color || '#3a9c4a',
                top: `${tentBlock.top}%`,
                height: `${tentBlock.height}%`,
              }}
              title={`${tentBlock.label} — ${tentBlock.time}`}
            >
              <div className="day-schedule-block-title">⚡ {tentBlock.label}</div>
              <div className="day-schedule-block-time">{tentBlock.time}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
