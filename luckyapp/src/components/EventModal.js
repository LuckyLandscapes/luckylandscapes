'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import {
  X,
  CalendarDays,
  Clock,
  User,
  FileText,
  Tag,
} from 'lucide-react';

const EVENT_TYPES = [
  { value: 'quote_appointment', label: 'Quote Appointment', color: '#3b82f6', icon: '📋' },
  { value: 'job', label: 'Job', color: '#3a9c4a', icon: '🔨' },
  { value: 'meeting', label: 'Meeting', color: '#d4a93e', icon: '🤝' },
  { value: 'other', label: 'Other', color: '#64748b', icon: '📌' },
];

export default function EventModal({ event, defaultDate, onClose }) {
  const { addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, customers } = useData();

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
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedCustomer = form.customerId ? customers.find(c => c.id === form.customerId) : null;

  const filteredCustomers = customerSearch
    ? customers.filter(c =>
        `${c.firstName} ${c.lastName || ''} ${c.email || ''} ${c.phone || ''}`
          .toLowerCase()
          .includes(customerSearch.toLowerCase())
      ).slice(0, 6)
    : customers.slice(0, 6);

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

  const handleSave = async () => {
    if (!form.title || !form.date) return;
    setSaving(true);

    try {
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
      };

      if (event?.id) {
        await updateCalendarEvent(event.id, eventData);

        // Sync update to Google Calendar
        if (event.googleEventId) {
          syncToGoogleCalendar('PUT', { ...eventData, googleEventId: event.googleEventId });
        }
      } else {
        const created = await addCalendarEvent(eventData);

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2>{event ? 'Edit Event' : 'New Event'}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
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

          {/* Customer */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">
              <User size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Customer (optional)
            </label>
            {selectedCustomer ? (
              <div className="cal-selected-customer">
                <div className="table-avatar" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>
                  {(selectedCustomer.firstName?.[0] || '') + (selectedCustomer.lastName?.[0] || '')}
                </div>
                <span>{selectedCustomer.firstName} {selectedCustomer.lastName || ''}</span>
                <button className="btn btn-icon btn-ghost" style={{ width: 24, height: 24 }} onClick={() => updateField('customerId', '')}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <input
                  className="form-input"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
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
                        <div className="table-avatar" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>
                          {(c.firstName?.[0] || '') + (c.lastName?.[0] || '')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.firstName} {c.lastName || ''}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{c.phone || c.email || ''}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">
              <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Notes
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="Additional details..."
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
