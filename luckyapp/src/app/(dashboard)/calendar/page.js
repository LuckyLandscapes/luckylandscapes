'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import EventModal from '@/components/EventModal';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Briefcase,
  FileText,
  Users as UsersIcon,
  ExternalLink,
  Trash2,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function pad(n) { return String(n).padStart(2, '0'); }
function formatDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function formatTime12(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${pad(m)} ${ampm}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);
  const rows = [];
  let week = [];

  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dt = new Date(year, month - 1, d);
    week.push({ date: dt, day: d, currentMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    week.push({ date: dt, day: d, currentMonth: true });
    if (week.length === 7) { rows.push(week); week = []; }
  }

  // Next month fill
  if (week.length > 0) {
    let d = 1;
    while (week.length < 7) {
      const dt = new Date(year, month + 1, d);
      week.push({ date: dt, day: d, currentMonth: false });
      d++;
    }
    rows.push(week);
  }

  return rows;
}

function getWeekDates(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

const EVENT_TYPE_COLORS = {
  job: '#3a9c4a',
  quote_appointment: '#3b82f6',
  meeting: '#d4a93e',
  other: '#64748b',
};

const EVENT_TYPE_LABELS = {
  job: 'Job',
  quote_appointment: 'Quote Appt',
  meeting: 'Meeting',
  other: 'Event',
};

// ─── Main Calendar Page ─────────────────────────────────────
export default function CalendarPage() {
  const { calendarEvents, jobs, customers, getCustomer, quotes, updateJob, deleteCalendarEvent } = useData();
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const today = new Date();
  const todayStr = formatDate(today);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Build events map by date (merge calendar_events + jobs without events)
  const eventsByDate = useMemo(() => {
    const map = {};

    // Add all calendar events
    calendarEvents.forEach(e => {
      if (!e.date) return;
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push({ ...e, source: 'event' });
    });

    // Add jobs that don't have a corresponding calendar event
    jobs.forEach(j => {
      if (!j.scheduledDate) return;
      const hasEvent = calendarEvents.some(e => e.jobId === j.id);
      if (!hasEvent) {
        if (!map[j.scheduledDate]) map[j.scheduledDate] = [];
        map[j.scheduledDate].push({
          id: `job-${j.id}`,
          jobId: j.id,
          title: j.title,
          type: 'job',
          date: j.scheduledDate,
          startTime: j.scheduledTime,
          color: '#6B8E4E',
          customerId: j.customerId,
          source: 'job',
        });
      }
    });

    return map;
  }, [calendarEvents, jobs]);

  // Navigation
  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  // Selected day events
  const selectedDateStr = selectedDate || todayStr;
  const dayEvents = eventsByDate[selectedDateStr] || [];

  const handleDayClick = (dateObj) => {
    setSelectedDate(formatDate(dateObj));
    if (view === 'month') {
      // Don't switch view, just highlight
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const openNewEvent = (date) => {
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleEditEvent = (event) => {
    if (event.source === 'job') return;
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleDeleteEvent = async (event) => {
    if (!event) return;
    const ok = typeof window !== 'undefined'
      ? window.confirm('Remove this event from the calendar? This will not delete any related job records.')
      : true;
    if (!ok) return;

    try {
      // Try to remove from Google Calendar (non-blocking)
      if (event.googleEventId) {
        try {
          await fetch(`/api/google-calendar?eventId=${event.googleEventId}`, { method: 'DELETE' });
        } catch (err) {
          console.warn('Google Calendar delete failed (non-blocking):', err.message);
        }
      }

      if (event.source === 'event' && event.id) {
        await deleteCalendarEvent(event.id);
      }

      // Unschedule the linked job (so it doesn't reappear synthetically)
      if (event.jobId) {
        await updateJob(event.jobId, { scheduledDate: null, scheduledTime: null });
      }

      setSelectedEvent(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      if (typeof window !== 'undefined') {
        window.alert('Could not remove event. Please try again.');
      }
    }
  };

  // Title for current view
  const viewTitle = view === 'month'
    ? `${MONTHS[month]} ${year}`
    : view === 'week'
    ? (() => {
        const weekDates = getWeekDates(currentDate);
        const start = weekDates[0];
        const end = weekDates[6];
        if (start.getMonth() === end.getMonth()) {
          return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
        }
        return `${MONTHS[start.getMonth()].slice(0,3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0,3)} ${end.getDate()}, ${end.getFullYear()}`;
      })()
    : currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Calendar</h1>
          <p>Schedule jobs, quote appointments, and crew assignments</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => openNewEvent()}>
            <Plus size={18} /> New Event
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          <button className="btn btn-secondary btn-sm" onClick={goToday}>Today</button>
          <div className="cal-nav-arrows">
            <button className="btn btn-icon btn-ghost" onClick={() => navigate(-1)}><ChevronLeft size={20} /></button>
            <button className="btn btn-icon btn-ghost" onClick={() => navigate(1)}><ChevronRight size={20} /></button>
          </div>
          <h2 className="cal-title">{viewTitle}</h2>
        </div>
        <div className="tabs">
          {['month', 'week', 'day'].map(v => (
            <button key={v} className={`tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="cal-layout">
        {/* Calendar Grid */}
        <div className="cal-main">
          {view === 'month' && (
            <MonthView
              year={year}
              month={month}
              todayStr={todayStr}
              selectedDate={selectedDateStr}
              eventsByDate={eventsByDate}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              todayStr={todayStr}
              selectedDate={selectedDateStr}
              eventsByDate={eventsByDate}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              todayStr={todayStr}
              eventsByDate={eventsByDate}
              onEventClick={handleEventClick}
              getCustomer={getCustomer}
            />
          )}
        </div>

        {/* Day sidebar */}
        <div className="cal-sidebar-panel">
          <div className="cal-sidebar-header">
            <h3>
              {(() => {
                const d = new Date(selectedDateStr + 'T12:00:00');
                return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              })()}
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => openNewEvent(selectedDateStr)}>
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="cal-sidebar-events">
            {dayEvents.length === 0 ? (
              <div className="cal-sidebar-empty">
                <CalendarDays size={24} />
                <p>No events scheduled</p>
              </div>
            ) : (
              dayEvents.map(e => {
                const customer = e.customerId ? getCustomer(e.customerId) : null;
                return (
                  <div
                    key={e.id}
                    className="cal-sidebar-event"
                    onClick={() => handleEventClick(e)}
                  >
                    <div className="cal-sidebar-event-dot" style={{ background: e.color || EVENT_TYPE_COLORS[e.type] || '#64748b' }} />
                    <div className="cal-sidebar-event-content">
                      <div className="cal-sidebar-event-title">{e.title}</div>
                      <div className="cal-sidebar-event-meta">
                        {e.startTime && <span><Clock size={11} /> {formatTime12(e.startTime)}</span>}
                        <span className={`cal-type-badge cal-type-${e.type}`}>
                          {EVENT_TYPE_LABELS[e.type] || 'Event'}
                        </span>
                      </div>
                      {customer && (
                        <div className="cal-sidebar-event-customer">
                          <User size={11} /> {customer.firstName} {customer.lastName || ''}
                        </div>
                      )}
                    </div>
                    {/* Completed ticker for jobs */}
                    {(e.source === 'job' || (e.source === 'event' && e.type === 'job')) && e.jobId && (
                      <button
                        className={`cal-job-ticker ${e.jobStatus === 'completed' ? 'done' : ''}`}
                        title={e.jobStatus === 'completed' ? 'Completed' : 'Mark completed'}
                        onClick={async (ev) => {
                          ev.stopPropagation();
                          const job = jobs.find(j => j.id === e.jobId);
                          if (job) {
                            const newStatus = job.status === 'completed' ? 'scheduled' : 'completed';
                            await updateJob(job.id, { status: newStatus });
                          }
                        }}
                      >
                        {(() => {
                          const job = jobs.find(j => j.id === e.jobId);
                          return job?.status === 'completed' ? '✅' : '⬜';
                        })()}
                      </button>
                    )}
                    {e.jobId && (
                      <Link href={`/jobs/${e.jobId}`} className="cal-sidebar-event-link" onClick={ev => ev.stopPropagation()}>
                        <ExternalLink size={14} />
                      </Link>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Legend */}
          <div className="cal-legend">
            <div className="cal-legend-title">Event Types</div>
            <div className="cal-legend-items">
              <div className="cal-legend-item"><span className="cal-legend-dot" style={{ background: EVENT_TYPE_COLORS.job }} /> Jobs</div>
              <div className="cal-legend-item"><span className="cal-legend-dot" style={{ background: EVENT_TYPE_COLORS.quote_appointment }} /> Quote Appts</div>
              <div className="cal-legend-item"><span className="cal-legend-dot" style={{ background: EVENT_TYPE_COLORS.meeting }} /> Meetings</div>
              <div className="cal-legend-item"><span className="cal-legend-dot" style={{ background: EVENT_TYPE_COLORS.other }} /> Other</div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Overlay */}
      {selectedEvent && (
        <EventDetailOverlay
          event={selectedEvent}
          getCustomer={getCustomer}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => { handleEditEvent(selectedEvent); setSelectedEvent(null); }}
          onDelete={() => handleDeleteEvent(selectedEvent)}
        />
      )}

      {/* New/Edit Event Modal */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          defaultDate={selectedDateStr}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}

// ─── Month View ─────────────────────────────────────────────
function MonthView({ year, month, todayStr, selectedDate, eventsByDate, onDayClick, onEventClick }) {
  const grid = getMonthGrid(year, month);

  return (
    <div className="cal-month">
      <div className="cal-month-header">
        {DAYS.map(d => <div key={d} className="cal-month-header-cell">{d}</div>)}
      </div>
      <div className="cal-month-body">
        {grid.map((week, wi) => (
          <div key={wi} className="cal-month-row">
            {week.map(({ date, day, currentMonth }, di) => {
              const dateStr = formatDate(date);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const events = eventsByDate[dateStr] || [];

              return (
                <div
                  key={di}
                  className={`cal-month-cell ${!currentMonth ? 'out' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => onDayClick(date)}
                >
                  <div className={`cal-day-number ${isToday ? 'today' : ''}`}>{day}</div>
                  <div className="cal-day-events">
                    {events.slice(0, 3).map((e, i) => (
                      <div
                        key={e.id}
                        className="cal-event-pill"
                        style={{ '--event-color': e.color || EVENT_TYPE_COLORS[e.type] || '#64748b' }}
                        onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                      >
                        <span className="cal-event-pill-dot" />
                        <span className="cal-event-pill-text">{e.title}</span>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <div className="cal-day-more">+{events.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────────
function WeekView({ currentDate, todayStr, selectedDate, eventsByDate, onDayClick, onEventClick }) {
  const weekDates = getWeekDates(currentDate);
  const hours = Array.from({ length: 14 }, (_, i) => i + 6); // 6am to 7pm

  return (
    <div className="cal-week">
      <div className="cal-week-header">
        <div className="cal-week-gutter" />
        {weekDates.map((d, i) => {
          const dateStr = formatDate(d);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`cal-week-header-cell ${isToday ? 'today' : ''}`}
              onClick={() => onDayClick(d)}
            >
              <div className="cal-week-header-day">{DAYS[i]}</div>
              <div className={`cal-week-header-num ${isToday ? 'today' : ''}`}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className="cal-week-body">
        {hours.map(hour => (
          <div key={hour} className="cal-week-row">
            <div className="cal-week-gutter cal-time-label">
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </div>
            {weekDates.map((d, di) => {
              const dateStr = formatDate(d);
              const events = (eventsByDate[dateStr] || []).filter(e => {
                if (!e.startTime) return hour === 8; // default to 8am
                const h = parseInt(e.startTime.split(':')[0], 10);
                return h === hour;
              });
              return (
                <div key={di} className="cal-week-cell" onClick={() => onDayClick(d)}>
                  {events.map(e => (
                    <div
                      key={e.id}
                      className="cal-week-event"
                      style={{ '--event-color': e.color || EVENT_TYPE_COLORS[e.type] || '#64748b' }}
                      onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                    >
                      <span className="cal-week-event-time">{formatTime12(e.startTime)}</span>
                      <span className="cal-week-event-title">{e.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ───────────────────────────────────────────────
function DayView({ currentDate, todayStr, eventsByDate, onEventClick, getCustomer }) {
  const dateStr = formatDate(currentDate);
  const events = eventsByDate[dateStr] || [];
  const hours = Array.from({ length: 14 }, (_, i) => i + 6);

  // Group events by hour
  const eventsByHour = {};
  events.forEach(e => {
    const h = e.startTime ? parseInt(e.startTime.split(':')[0], 10) : 8;
    if (!eventsByHour[h]) eventsByHour[h] = [];
    eventsByHour[h].push(e);
  });

  return (
    <div className="cal-day-view">
      {hours.map(hour => (
        <div key={hour} className="cal-day-row">
          <div className="cal-day-time">
            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
          </div>
          <div className="cal-day-slot">
            {(eventsByHour[hour] || []).map(e => {
              const customer = e.customerId ? getCustomer(e.customerId) : null;
              return (
                <div
                  key={e.id}
                  className="cal-day-event"
                  style={{ '--event-color': e.color || EVENT_TYPE_COLORS[e.type] || '#64748b' }}
                  onClick={() => onEventClick(e)}
                >
                  <div className="cal-day-event-header">
                    <span className="cal-day-event-type">{EVENT_TYPE_LABELS[e.type]}</span>
                    {e.startTime && <span className="cal-day-event-time">{formatTime12(e.startTime)}{e.endTime ? ` – ${formatTime12(e.endTime)}` : ''}</span>}
                  </div>
                  <div className="cal-day-event-title">{e.title}</div>
                  {customer && (
                    <div className="cal-day-event-customer">
                      <User size={12} /> {customer.firstName} {customer.lastName || ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Event Detail Overlay ───────────────────────────────────
function EventDetailOverlay({ event, getCustomer, onClose, onEdit, onDelete }) {
  const customer = event.customerId ? getCustomer(event.customerId) : null;
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(event.googleEventId ? 'synced' : null);

  const syncToGoogleCalendar = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: event.title,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          description: event.notes || '',
          location: customer?.address || '',
          allDay: event.allDay,
        }),
      });
      const data = await res.json();

      if (data.synced) {
        setSyncStatus('synced');
      } else if (data.url) {
        // Fallback: open link manually
        window.open(data.url, '_blank');
        setSyncStatus('link');
      }
    } catch (err) {
      console.error('Google Calendar sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div className="cal-detail-dot" style={{ background: event.color || EVENT_TYPE_COLORS[event.type] || '#64748b' }} />
            <h2>{event.title}</h2>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="cal-detail-grid">
            <div className="cal-detail-row">
              <CalendarDays size={16} />
              <div>
                <div className="cal-detail-label">Date</div>
                <div className="cal-detail-value">
                  {event.date && new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
            {event.startTime && (
              <div className="cal-detail-row">
                <Clock size={16} />
                <div>
                  <div className="cal-detail-label">Time</div>
                  <div className="cal-detail-value">
                    {formatTime12(event.startTime)}{event.endTime ? ` – ${formatTime12(event.endTime)}` : ''}
                  </div>
                </div>
              </div>
            )}
            <div className="cal-detail-row">
              <Briefcase size={16} />
              <div>
                <div className="cal-detail-label">Type</div>
                <div className="cal-detail-value">
                  <span className={`cal-type-badge cal-type-${event.type}`}>{EVENT_TYPE_LABELS[event.type] || 'Event'}</span>
                </div>
              </div>
            </div>
            {customer && (
              <div className="cal-detail-row">
                <User size={16} />
                <div>
                  <div className="cal-detail-label">Customer</div>
                  <div className="cal-detail-value">{customer.firstName} {customer.lastName || ''}</div>
                  {customer.phone && <div className="cal-detail-sub">{customer.phone}</div>}
                  {customer.address && <div className="cal-detail-sub">{customer.address}</div>}
                </div>
              </div>
            )}
            {event.notes && (
              <div className="cal-detail-row">
                <FileText size={16} />
                <div>
                  <div className="cal-detail-label">Notes</div>
                  <div className="cal-detail-value" style={{ whiteSpace: 'pre-wrap' }}>{event.notes}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer cal-detail-footer">
          {syncStatus === 'synced' ? (
            <span className="btn btn-ghost btn-sm cal-detail-sync-status" style={{ color: 'var(--status-success)', cursor: 'default' }}>
              ✅ Synced
            </span>
          ) : (
            <button
              className="btn btn-secondary btn-sm cal-detail-sync"
              onClick={syncToGoogleCalendar}
              disabled={syncing}
            >
              {syncing ? '⏳ Syncing...' : '📅 Sync to Google'}
            </button>
          )}
          <div className="cal-detail-actions">
            {onDelete && (
              <button
                className="btn btn-danger btn-sm cal-detail-delete"
                onClick={onDelete}
                title="Remove from calendar"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            {event.source !== 'job' && (
              <button className="btn btn-secondary" onClick={onEdit}>Edit</button>
            )}
            {(event.jobId) && (
              <Link href={`/jobs/${event.jobId}`} className="btn btn-primary">
                <Briefcase size={16} /> Job Details
              </Link>
            )}
            <button className="btn btn-ghost cal-detail-close" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
