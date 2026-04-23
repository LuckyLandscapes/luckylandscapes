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
  { value: 'job', label: 'Job', color: '#3a9c4a', icon: '🔨' },
  { value: 'meeting', label: 'Meeting', color: '#d4a93e', icon: '🤝' },
  { value: 'other', label: 'Other', color: '#64748b', icon: '📌' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'var(--text-tertiary)', icon: '🟢' },
  { value: 'normal', label: 'Normal', color: 'var(--status-info)', icon: '🔵' },
  { value: 'high', label: 'High', color: 'var(--status-warning)', icon: '🟠' },
  { value: 'urgent', label: 'Urgent', color: 'var(--status-danger)', icon: '🔴' },
];

const DURATION_OPTIONS = [
  { value: '1 hour', label: '1 hour' },
  { value: '2 hours', label: '2 hours' },
  { value: '3 hours', label: '3 hours' },
  { value: '4 hours', label: '4 hours' },
  { value: '6 hours', label: '6 hours' },
  { value: '8 hours', label: '8 hours (Full Day)' },
  { value: 'custom', label: 'Custom...' },
];

export default function EventModal({ event, defaultDate, onClose }) {
  const {
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    addJob, customers, teamMembers,
  } = useData();

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
    priority: event?.priority || 'normal',
    estimatedDuration: event?.estimatedDuration || '4 hours',
    customDuration: '',
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [crewSearch, setCrewSearch] = useState('');
  const [showCrewDropdown, setShowCrewDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedCustomer = form.customerId ? customers.find(c => c.id === form.customerId) : null;

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
    if (!form.title || !form.date) return;
    setSaving(true);

    try {
      const duration = form.estimatedDuration === 'custom' ? form.customDuration : form.estimatedDuration;

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

      if (event?.id) {
        await updateCalendarEvent(event.id, eventData);

        // Sync update to Google Calendar
        if (event.googleEventId) {
          syncToGoogleCalendar('PUT', { ...eventData, googleEventId: event.googleEventId });
        }
      } else {
        // For job-type events, also create a backing job record so workers see it
        let jobId = null;
        if (form.type === 'job') {
          const customer = form.customerId ? customers.find(c => c.id === form.customerId) : null;
          const job = await addJob({
            customerId: form.customerId || null,
            title: form.title,
            description: form.notes || '',
            address: customer?.address
              ? `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.zip || ''}`.trim()
              : '',
            scheduledDate: form.date,
            scheduledTime: form.allDay ? null : form.startTime,
            estimatedDuration: duration || '4 hours',
            assignedTo: form.assignedTo,
            crewNotes: form.notes || '',
            total: 0,
            priority: form.priority,
          });
          if (job) jobId = job.id;
        }

        const created = await addCalendarEvent({
          ...eventData,
          jobId,
        });

        // Sync new event to Google Calendar
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

  // Fire-and-forget Google Calendar sync
  const syncToGoogleCalendar = async (method, eventData, supabaseEventId) => {
    try {
      const res = await fetch('/api/google-calendar', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventData,
          description: eventData.notes || '',
        }),
      });
      const data = await res.json();

      // If a new event was synced, store the Google event ID back
      if (method === 'POST' && data.synced && data.googleEventId && supabaseEventId) {
        await updateCalendarEvent(supabaseEventId, { googleEventId: data.googleEventId });
      }
    } catch (err) {
      console.warn('Google Calendar sync failed (non-blocking):', err.message);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;

    // Delete from Google Calendar first (if synced)
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

  // Build full address for display
  const customerAddress = selectedCustomer?.address
    ? `${selectedCustomer.address}${selectedCustomer.city ? `, ${selectedCustomer.city}` : ''}${selectedCustomer.state ? ` ${selectedCustomer.state}` : ''} ${selectedCustomer.zip || ''}`.trim()
    : '';
  const mapsUrl = customerAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(customerAddress)}`
    : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <h2>{event ? 'Edit Event' : 'New Event'}</h2>
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

          {/* Title */}
          <div className="form-group">
            <label className="form-label">
              Title <span className="required">*</span>
            </label>
            <input
              className="form-input"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="e.g., Mulch install at 123 Oak St"
            />
          </div>

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

          {/* Priority & Duration — Job only */}
          {form.type === 'job' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <Flag size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Priority
                </label>
                <div className="priority-selector">
                  {PRIORITY_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      className={`priority-option ${form.priority === p.value ? 'active' : ''}`}
                      style={{ '--priority-color': p.color }}
                      onClick={() => updateField('priority', p.value)}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <Timer size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Est. Duration
                </label>
                <select
                  className="form-input"
                  value={form.estimatedDuration}
                  onChange={e => updateField('estimatedDuration', e.target.value)}
                >
                  {DURATION_OPTIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {form.estimatedDuration === 'custom' && (
                  <input
                    className="form-input"
                    value={form.customDuration}
                    onChange={e => updateField('customDuration', e.target.value)}
                    placeholder="e.g., 5 hours"
                    style={{ marginTop: '6px' }}
                  />
                )}
              </div>
            </div>
          )}

          {/* ─── Customer Section ──────────────────────────── */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">
              <User size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Customer {form.type !== 'job' ? '(optional)' : ''}
            </label>
            {selectedCustomer ? (
              <>
                {/* Rich customer info card */}
                <div className="customer-info-card">
                  <div className="customer-info-card-header">
                    <div className="customer-info-card-avatar">
                      {(selectedCustomer.firstName?.[0] || '') + (selectedCustomer.lastName?.[0] || '')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="customer-info-card-name">
                        {selectedCustomer.firstName} {selectedCustomer.lastName || ''}
                      </div>
                      {selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
                        <div className="customer-info-card-tags">
                          {selectedCustomer.tags.map((tag, i) => (
                            <span key={i} className="customer-info-card-tag">{tag}</span>
                          ))}
                        </div>
                      )}
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
                  {selectedCustomer.email && (
                    <div className="customer-info-card-row">
                      <Mail size={14} />
                      <a href={`mailto:${selectedCustomer.email}`}>{selectedCustomer.email}</a>
                    </div>
                  )}
                  {customerAddress && (
                    <div className="customer-info-card-row">
                      <MapPin size={14} />
                      {mapsUrl ? (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">{customerAddress}</a>
                      ) : (
                        <span>{customerAddress}</span>
                      )}
                    </div>
                  )}
                  {selectedCustomer.notes && (
                    <div className="customer-info-card-row" style={{ alignItems: 'flex-start' }}>
                      <FileText size={14} style={{ marginTop: '2px' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{selectedCustomer.notes}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    className="form-input"
                    placeholder="Search customers by name, phone, or email..."
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
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'flex', gap: '8px' }}>
                            {c.phone && <span><Phone size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />{c.phone}</span>}
                            {c.email && <span><Mail size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />{c.email}</span>}
                          </div>
                          {c.address && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                              <MapPin size={9} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                              {c.address}{c.city ? `, ${c.city}` : ''}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─── Crew Assignment — Scalable ─────────────────── */}
          {activeMembers.length > 0 && (
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">
                <Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Assign Crew ({form.assignedTo.length} selected)
              </label>

              {/* Selected crew chips */}
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

              {/* Search input — always shown for scalability */}
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  className="form-input"
                  placeholder="Search crew members..."
                  value={crewSearch}
                  onChange={e => setCrewSearch(e.target.value)}
                  onFocus={() => setShowCrewDropdown(true)}
                  style={{ paddingLeft: '32px' }}
                />
              </div>

              {/* Crew list */}
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
                {filteredMembers.length === 0 && crewSearch && (
                  <div style={{ padding: '8px 12px', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                    No crew members match &quot;{crewSearch}&quot;
                  </div>
                )}
              </div>

              {form.assignedTo.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  💡 Assign crew members so they can see this job on their schedule
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">
              <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {form.type === 'job' ? 'Crew Notes & Instructions' : 'Notes'}
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder={form.type === 'job'
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
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title || !form.date}>
            {saving ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
