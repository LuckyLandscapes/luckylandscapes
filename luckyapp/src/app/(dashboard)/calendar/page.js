'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import EventModal from '@/components/EventModal';
import DaySchedulePreview, { DayLoadBar } from '@/components/DaySchedulePreview';
import { dayLoad, eventDurationHours, STATUS_LABELS } from '@/lib/capacity';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Clock,
  User,
  Briefcase,
  FileText,
  ExternalLink,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dt = new Date(year, month - 1, d);
    week.push({ date: dt, day: d, currentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    week.push({ date: dt, day: d, currentMonth: true });
    if (week.length === 7) { rows.push(week); week = []; }
  }
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
  job: '#6B8E4E',
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

  // Build a date-keyed index of events. Synthesize entries for jobs that
  // don't have a calendar_event row, and attach estimatedDuration so the
  // capacity model has a reasonable hours estimate even when end_time is null.
  const eventsByDate = useMemo(() => {
    const map = {};

    calendarEvents.forEach(e => {
      if (!e.date) return;
      const linkedJob = e.jobId ? jobs.find(j => j.id === e.jobId) : null;
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push({
        ...e,
        source: 'event',
        estimatedDuration: e.endTime ? null : linkedJob?.estimatedDuration,
        jobStatus: linkedJob?.status,
      });
    });

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
          estimatedDuration: j.estimatedDuration,
          jobStatus: j.status,
        });
      }
    });

    // Sort each day by start time so timeline blocks render in order.
    Object.values(map).forEach(arr => arr.sort((a, b) => {
      const aa = a.allDay ? '' : (a.startTime || '99:99');
      const bb = b.allDay ? '' : (b.startTime || '99:99');
      return String(aa).localeCompare(String(bb));
    }));

    return map;
  }, [calendarEvents, jobs]);

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

  const selectedDateStr = selectedDate || todayStr;
  const dayEvents = eventsByDate[selectedDateStr] || [];
  const sidebarLoad = useMemo(() => dayLoad(dayEvents), [dayEvents]);

  const handleDayClick = (dateObj) => {
    setSelectedDate(formatDate(dateObj));
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const openNewEvent = (date) => {
    setEditingEvent(null);
    setShowEventModal(true);
    if (date) setSelectedDate(date);
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
      if (event.jobId) {
        await updateJob(event.jobId, { scheduledDate: null, scheduledTime: null });
      }
      setSelectedEvent(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      if (typeof window !== 'undefined') window.alert('Could not remove event. Please try again.');
    }
  };

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
              onAddOnDay={(d) => openNewEvent(d)}
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
              onAddOnDay={(d) => openNewEvent(d)}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              eventsByDate={eventsByDate}
              onEventClick={handleEventClick}
              getCustomer={getCustomer}
            />
          )}
        </div>

        {/* Day drawer */}
        <div className="cal-sidebar-panel">
          <div className="cal-sidebar-header">
            <div>
              <h3>
                {(() => {
                  const d = new Date(selectedDateStr + 'T12:00:00');
                  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                })()}
              </h3>
              <div className="cal-sidebar-status" data-status={sidebarLoad.status}>
                <span className="cal-sidebar-status-dot" />
                {STATUS_LABELS[sidebarLoad.status]}
                {sidebarLoad.count > 0 && (
                  <span className="cal-sidebar-status-meta">
                    · {sidebarLoad.hours.toFixed(1)}h / {sidebarLoad.capacity}h · {sidebarLoad.count} {sidebarLoad.count === 1 ? 'event' : 'events'}
                  </span>
                )}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => openNewEvent(selectedDateStr)}>
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="cal-sidebar-loadbar">
            <DayLoadBar load={sidebarLoad} />
          </div>

          {sidebarLoad.status === 'overbooked' && (
            <div className="cal-conflict-banner danger" style={{ margin: '0 var(--space-md) var(--space-md)' }}>
              <div className="cal-conflict-banner-title">
                <AlertTriangle size={14} /> Overbooked — {sidebarLoad.hours.toFixed(1)}h scheduled, capacity {sidebarLoad.capacity}h
              </div>
            </div>
          )}

          {/* Vertical timeline view of the day */}
          <div className="cal-sidebar-timeline">
            <DaySchedulePreview events={dayEvents} height={360} />
          </div>

          <div className="cal-sidebar-events">
            <div className="cal-sidebar-events-title">Bookings</div>
            {dayEvents.length === 0 ? (
              <div className="cal-sidebar-empty">
                <CalendarDays size={24} />
                <p>No events scheduled</p>
              </div>
            ) : (
              dayEvents.map(e => {
                const customer = e.customerId ? getCustomer(e.customerId) : null;
                const hours = eventDurationHours(e);
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
                        {e.startTime && <span><Clock size={11} /> {formatTime12(e.startTime)}{e.endTime ? ` – ${formatTime12(e.endTime)}` : ` (${hours.toFixed(1)}h est)`}</span>}
                        {e.allDay && <span>All day</span>}
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

          <div className="cal-legend">
            <div className="cal-legend-title">Day capacity</div>
            <div className="cal-legend-items">
              <div className="cal-legend-item"><span className="cal-load-swatch" data-status="open" /> Open</div>
              <div className="cal-legend-item"><span className="cal-load-swatch" data-status="light" /> Light</div>
              <div className="cal-legend-item"><span className="cal-load-swatch" data-status="busy" /> Busy</div>
              <div className="cal-legend-item"><span className="cal-load-swatch" data-status="full" /> Full</div>
              <div className="cal-legend-item"><span className="cal-load-swatch" data-status="overbooked" /> Overbooked</div>
            </div>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <EventDetailOverlay
          event={selectedEvent}
          getCustomer={getCustomer}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => { handleEditEvent(selectedEvent); setSelectedEvent(null); }}
          onDelete={() => handleDeleteEvent(selectedEvent)}
        />
      )}

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
function MonthView({ year, month, todayStr, selectedDate, eventsByDate, onDayClick, onEventClick, onAddOnDay }) {
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
              const load = dayLoad(events);

              return (
                <div
                  key={di}
                  className={`cal-month-cell ${!currentMonth ? 'out' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  data-status={load.status}
                  onClick={() => onDayClick(date)}
                >
                  <div className="cal-month-cell-top">
                    <div className={`cal-day-number ${isToday ? 'today' : ''}`}>{day}</div>
                    {events.length > 0 && (
                      <div className="cal-day-load-pill" data-status={load.status} title={`${load.hours.toFixed(1)}h scheduled, ${load.count} event${load.count === 1 ? '' : 's'}`}>
                        {load.hours.toFixed(load.hours < 10 ? 1 : 0)}h
                      </div>
                    )}
                    {currentMonth && (
                      <button
                        className="cal-day-add"
                        onClick={(ev) => { ev.stopPropagation(); onAddOnDay(dateStr); }}
                        title="Add event on this day"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                  {events.length > 0 && (
                    <div className="cal-day-load-track">
                      <div
                        className="cal-day-load-fill"
                        data-status={load.status}
                        style={{ width: `${Math.min(100, (load.hours / load.capacity) * 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="cal-day-events">
                    {events.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        className="cal-event-pill"
                        style={{ '--event-color': e.color || EVENT_TYPE_COLORS[e.type] || '#64748b' }}
                        onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                        title={`${e.title}${e.startTime ? ` — ${formatTime12(e.startTime)}${e.endTime ? ' – ' + formatTime12(e.endTime) : ''}` : ''}`}
                      >
                        <span className="cal-event-pill-dot" />
                        <span className="cal-event-pill-text">
                          {e.startTime && <strong style={{ marginRight: 4, fontWeight: 700 }}>{formatTime12(e.startTime).replace(':00', '')}</strong>}
                          {e.title}
                        </span>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <button
                        className="cal-day-more"
                        onClick={(ev) => { ev.stopPropagation(); onDayClick(date); }}
                      >
                        +{events.length - 3} more
                      </button>
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

// ─── Week View — time-block layout (events positioned by start + duration) ──
function WeekView({ currentDate, todayStr, selectedDate, eventsByDate, onDayClick, onEventClick, onAddOnDay }) {
  const weekDates = getWeekDates(currentDate);
  const startHour = 6;
  const endHour = 21;
  const totalMin = (endHour - startHour) * 60;
  const hours = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  // Pack overlapping blocks into side-by-side columns within each day.
  const dayBlocks = weekDates.map(d => {
    const dateStr = formatDate(d);
    const events = eventsByDate[dateStr] || [];

    const blocks = events.map(e => {
      if (e.allDay) {
        return { e, top: 0, height: 100, allDay: true };
      }
      const [sh, sm] = String(e.startTime || '').split(':').map(Number);
      if (Number.isNaN(sh)) return null;
      const start = sh * 60 + (sm || 0);
      const dur = Math.max(0.25, eventDurationHours(e)) * 60;
      const baseline = startHour * 60;
      const top = Math.max(0, ((start - baseline) / totalMin) * 100);
      const bottom = Math.min(100, ((start + dur - baseline) / totalMin) * 100);
      if (bottom <= top) return null;
      return { e, top, height: bottom - top, allDay: false };
    }).filter(Boolean).sort((a, b) => a.top - b.top);

    const cols = [];
    blocks.forEach(b => {
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

    return { dateStr, date: d, blocks, totalCols: Math.max(1, cols.length), load: dayLoad(events) };
  });

  return (
    <div className="cal-week-v2">
      {/* Day header strip with capacity */}
      <div className="cal-week-v2-header">
        <div className="cal-week-v2-gutter" />
        {dayBlocks.map((db, i) => {
          const isToday = db.dateStr === todayStr;
          const isSelected = db.dateStr === selectedDate;
          return (
            <div
              key={i}
              className={`cal-week-v2-header-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              data-status={db.load.status}
              onClick={() => onDayClick(db.date)}
            >
              <div className="cal-week-v2-header-row">
                <div>
                  <div className="cal-week-v2-day">{DAYS[i]}</div>
                  <div className={`cal-week-v2-num ${isToday ? 'today' : ''}`}>{db.date.getDate()}</div>
                </div>
                <button
                  className="cal-day-add"
                  onClick={(ev) => { ev.stopPropagation(); onAddOnDay(db.dateStr); }}
                  title="Add event"
                >
                  <Plus size={12} />
                </button>
              </div>
              <DayLoadBar load={db.load} compact showLabel={true} />
            </div>
          );
        })}
      </div>

      {/* Time-block body — single scroll, hour grid + absolutely-positioned events */}
      <div className="cal-week-v2-body">
        <div className="cal-week-v2-gutter cal-week-v2-times">
          {hours.map((h, i) => (
            <div key={h} className="cal-week-v2-time" style={{ top: `${(i / (hours.length - 1)) * 100}%` }}>
              <span>{h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}</span>
            </div>
          ))}
        </div>
        {dayBlocks.map((db, di) => (
          <div
            key={di}
            className="cal-week-v2-col"
            onClick={() => onDayClick(db.date)}
          >
            {hours.slice(0, -1).map((h, i) => (
              <div key={h} className="cal-week-v2-gridline" style={{ top: `${(i / (hours.length - 1)) * 100}%` }} />
            ))}
            {db.blocks.map((b, i) => {
              const colWidth = 100 / db.totalCols;
              const e = b.e;
              return (
                <div
                  key={`${e.id}-${i}`}
                  className="cal-week-v2-block"
                  style={{
                    '--event-color': e.color || EVENT_TYPE_COLORS[e.type] || '#64748b',
                    top: `${b.top}%`,
                    height: `${b.height}%`,
                    left: `calc(${b.col * colWidth}% + 2px)`,
                    width: `calc(${colWidth}% - 4px)`,
                  }}
                  onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                  title={`${e.title}${e.startTime ? ` — ${formatTime12(e.startTime)}` : ''}`}
                >
                  <div className="cal-week-v2-block-title">{e.title}</div>
                  {e.startTime && (
                    <div className="cal-week-v2-block-time">
                      {formatTime12(e.startTime)}
                      {e.endTime ? ` – ${formatTime12(e.endTime)}` : ''}
                    </div>
                  )}
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
function DayView({ currentDate, eventsByDate, onEventClick, getCustomer }) {
  const dateStr = formatDate(currentDate);
  const events = eventsByDate[dateStr] || [];
  const load = dayLoad(events);

  return (
    <div className="cal-day-v2">
      <div className="cal-day-v2-header">
        <div>
          <div className="cal-day-v2-date">{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div className="cal-sidebar-status" data-status={load.status}>
            <span className="cal-sidebar-status-dot" />
            {STATUS_LABELS[load.status]}
            {load.count > 0 && (
              <span className="cal-sidebar-status-meta">
                · {load.hours.toFixed(1)}h / {load.capacity}h · {load.count} {load.count === 1 ? 'event' : 'events'}
              </span>
            )}
          </div>
        </div>
        <DayLoadBar load={load} />
      </div>
      <div style={{ flex: 1, minHeight: 480 }}>
        <DaySchedulePreview events={events} height={520} />
      </div>
      {events.length > 0 && (
        <div className="cal-day-v2-list">
          {events.map(e => {
            const customer = e.customerId ? getCustomer(e.customerId) : null;
            const hours = eventDurationHours(e);
            return (
              <button key={e.id} className="cal-day-v2-card" style={{ '--event-color': e.color || EVENT_TYPE_COLORS[e.type] || '#64748b' }} onClick={() => onEventClick(e)}>
                <div className="cal-day-v2-card-time">
                  {e.allDay ? 'All day' : (
                    <>
                      {formatTime12(e.startTime)}
                      <span style={{ opacity: 0.6 }}> · {hours.toFixed(1)}h</span>
                    </>
                  )}
                </div>
                <div className="cal-day-v2-card-title">{e.title}</div>
                <div className="cal-day-v2-card-meta">
                  <span className={`cal-type-badge cal-type-${e.type}`}>{EVENT_TYPE_LABELS[e.type] || 'Event'}</span>
                  {customer && (
                    <span><User size={11} style={{ verticalAlign: 'middle' }} /> {customer.firstName} {customer.lastName || ''}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
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
      if (data.synced) setSyncStatus('synced');
      else if (data.url) {
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
                    {formatTime12(event.startTime)}{event.endTime ? ` – ${formatTime12(event.endTime)}` : ` (${eventDurationHours(event).toFixed(1)}h est)`}
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
