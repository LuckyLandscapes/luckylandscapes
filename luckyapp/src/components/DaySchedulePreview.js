'use client';

// Reusable "vertical timeline of one day" component.
// Renders existing bookings + an optional dashed "tentative" block (the new
// event being created). Used by EventModal AND the calendar sidebar drawer.

import { eventDurationHours } from '@/lib/capacity';

function pad(n) { return String(n).padStart(2, '0'); }

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m || 0)} ${ampm}`;
}

function toMin(t) {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Resolve a block's start/end window in minutes-since-midnight.
// Falls back to estimatedDuration when an end time isn't set (jobs).
function resolveWindow(e) {
  if (!e) return null;
  if (e.allDay) return { start: 6 * 60, end: 21 * 60, allDay: true };
  const s = toMin(e.startTime);
  if (s == null) return null;
  let en = toMin(e.endTime);
  if (en == null) {
    en = s + Math.max(0.25, eventDurationHours(e)) * 60;
  }
  return { start: s, end: en, allDay: false };
}

export default function DaySchedulePreview({ events = [], tentative = null, height = 240 }) {
  const startHour = 6;
  const endHour = 21; // 9pm
  const totalMin = (endHour - startHour) * 60;

  const toBlock = (e, isTentative = false) => {
    const w = resolveWindow(e);
    if (!w) return null;
    if (w.allDay) {
      return {
        top: 0, height: 100,
        label: e.title || (isTentative ? 'New event' : ''),
        color: e.color, isTentative, time: 'All day',
      };
    }
    const baseline = startHour * 60;
    const top = Math.max(0, ((w.start - baseline) / totalMin) * 100);
    const bottom = Math.min(100, ((w.end - baseline) / totalMin) * 100);
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

  // Column-pack overlapping blocks side-by-side.
  const sorted = [...blocks].sort((a, b) => a.top - b.top);
  const cols = [];
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
  const totalCols = Math.max(1, cols.length);

  const hourMarks = [];
  for (let h = startHour; h <= endHour; h++) hourMarks.push(h);

  return (
    <div className="day-schedule" style={height ? { height: `${height}px` } : undefined}>
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
          {sorted.map((b, i) => {
            const colWidth = 100 / totalCols;
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

// Compact horizontal capacity meter — used on month cells, week headers,
// and inline in modals next to the date input.
export function DayLoadBar({ load, compact = false, showLabel = true }) {
  if (!load) return null;
  const pct = Math.min(100, Math.round((load.hours / load.capacity) * 100));
  const overflowPct = load.hours > load.capacity
    ? Math.min(100, Math.round(((load.hours - load.capacity) / load.capacity) * 100))
    : 0;

  return (
    <div className={`day-load ${compact ? 'compact' : ''}`} data-status={load.status}>
      <div className="day-load-track">
        <div className="day-load-fill" style={{ width: `${pct}%` }} />
        {overflowPct > 0 && (
          <div className="day-load-overflow" style={{ width: `${overflowPct}%` }} />
        )}
      </div>
      {showLabel && (
        <div className="day-load-label">
          {load.count > 0 ? (
            <>
              <strong>{load.hours.toFixed(load.hours < 10 ? 1 : 0)}h</strong>
              <span>/{load.capacity}h</span>
            </>
          ) : (
            <span>Open</span>
          )}
        </div>
      )}
    </div>
  );
}
