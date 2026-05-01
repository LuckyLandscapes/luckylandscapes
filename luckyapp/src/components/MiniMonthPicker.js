'use client';

// A small month grid date picker that renders capacity right inside each cell.
// Replaces <input type="date"> when scheduling — the user needs to SEE which
// days are open/busy/full before clicking, not after.

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayLoad, DAILY_CAPACITY_HOURS } from '@/lib/capacity';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function pad(n) { return String(n).padStart(2, '0'); }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells.push({ date: new Date(year, month - 1, d), day: d, currentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), day: d, currentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const d = cells.length - daysInMonth - (firstDay) + 1;
    cells.push({ date: new Date(year, month + 1, d), day: d, currentMonth: false });
  }
  return cells;
}

export default function MiniMonthPicker({
  value,                  // 'YYYY-MM-DD' or '' / null
  onChange,
  eventsByDate = {},
  neededHours = 0,        // if > 0, days that won't fit get a "no-fit" treatment
  minDate = null,         // 'YYYY-MM-DD' — disable past days when set (e.g. today)
  className = '',
}) {
  // Anchor month: show the selected date's month, falling back to today.
  const initialAnchor = (() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      if (Number.isFinite(y) && Number.isFinite(m)) return new Date(y, m - 1, 1);
    }
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  })();

  const [anchor, setAnchor] = useState(initialAnchor);
  const todayStr = fmt(new Date());

  const cells = useMemo(
    () => getMonthGrid(anchor.getFullYear(), anchor.getMonth()),
    [anchor],
  );

  const goPrev = () => setAnchor(a => new Date(a.getFullYear(), a.getMonth() - 1, 1));
  const goNext = () => setAnchor(a => new Date(a.getFullYear(), a.getMonth() + 1, 1));
  const goToday = () => {
    const t = new Date();
    setAnchor(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  return (
    <div className={`mini-picker ${className}`}>
      <div className="mini-picker-header">
        <button type="button" className="mini-picker-nav" onClick={goPrev} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <div className="mini-picker-title">{MONTHS[anchor.getMonth()]} {anchor.getFullYear()}</div>
        <button type="button" className="mini-picker-today" onClick={goToday}>Today</button>
        <button type="button" className="mini-picker-nav" onClick={goNext} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mini-picker-weekdays">
        {DAYS.map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="mini-picker-grid">
        {cells.map((c, i) => {
          const dateStr = fmt(c.date);
          const isSelected = dateStr === value;
          const isToday = dateStr === todayStr;
          const events = eventsByDate[dateStr] || [];
          const load = dayLoad(events);
          const isPast = minDate ? dateStr < minDate : false;
          const wouldOverbook = neededHours > 0 && (load.hours + neededHours) > DAILY_CAPACITY_HOURS + 0.001;
          const disabled = isPast;

          return (
            <button
              type="button"
              key={i}
              className={`mini-picker-day
                ${c.currentMonth ? '' : 'out'}
                ${isSelected ? 'selected' : ''}
                ${isToday ? 'today' : ''}
                ${wouldOverbook ? 'no-fit' : ''}
                ${disabled ? 'disabled' : ''}
              `}
              data-status={load.status}
              onClick={() => !disabled && onChange?.(dateStr)}
              disabled={disabled}
              title={
                load.count === 0
                  ? 'Open — 0h scheduled'
                  : `${load.hours.toFixed(1)}h scheduled · ${load.count} event${load.count === 1 ? '' : 's'}${wouldOverbook ? ' · would overbook' : ''}`
              }
            >
              <span className="mini-picker-day-num">{c.day}</span>
              {load.count > 0 && (
                <span className="mini-picker-day-bar">
                  <span
                    className="mini-picker-day-bar-fill"
                    style={{ width: `${Math.min(100, (load.hours / load.capacity) * 100)}%` }}
                  />
                </span>
              )}
              {load.count > 0 && (
                <span className="mini-picker-day-count">{load.hours < 10 ? load.hours.toFixed(1) : Math.round(load.hours)}h</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mini-picker-legend">
        <span className="mini-picker-legend-item"><span className="mini-picker-legend-swatch" data-status="open" /> Open</span>
        <span className="mini-picker-legend-item"><span className="mini-picker-legend-swatch" data-status="light" /> Light</span>
        <span className="mini-picker-legend-item"><span className="mini-picker-legend-swatch" data-status="busy" /> Busy</span>
        <span className="mini-picker-legend-item"><span className="mini-picker-legend-swatch" data-status="full" /> Full</span>
        <span className="mini-picker-legend-item"><span className="mini-picker-legend-swatch" data-status="overbooked" /> Over</span>
      </div>
    </div>
  );
}
