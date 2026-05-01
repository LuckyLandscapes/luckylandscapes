'use client';

// Inline month-grid date picker that bakes capacity into each cell.
// Two modes:
//   - 'single' (default): emits onChange(dateStr)
//   - 'range': emits onChange({ start, end }). Click 1 sets both start &
//     end to clicked. Click 2 extends the range; clicking before the
//     current start swaps. Click 3 (after a complete range) starts over.

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
    const d = cells.length - daysInMonth - firstDay + 1;
    cells.push({ date: new Date(year, month + 1, d), day: d, currentMonth: false });
  }
  return cells;
}

export default function MiniMonthPicker({
  value,                  // 'YYYY-MM-DD' (single) OR { start, end } (range)
  onChange,
  mode = 'single',        // 'single' | 'range'
  eventsByDate = {},
  neededHours = 0,
  minDate = null,
  className = '',
}) {
  const isRange = mode === 'range';

  // Normalize value so internal logic always sees { start, end }.
  const range = isRange
    ? (value && value.start ? { start: value.start, end: value.end || value.start } : { start: '', end: '' })
    : { start: value || '', end: value || '' };

  // Anchor month for navigation.
  const initialAnchor = (() => {
    const seed = range.start;
    if (seed) {
      const [y, m] = seed.split('-').map(Number);
      if (Number.isFinite(y) && Number.isFinite(m)) return new Date(y, m - 1, 1);
    }
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  })();

  const [anchor, setAnchor] = useState(initialAnchor);
  // 'idle' = ready to start a new range. 'extending' = next click sets end.
  const [pickState, setPickState] = useState('idle');
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

  const handleClick = (dateStr) => {
    if (!isRange) {
      onChange?.(dateStr);
      return;
    }

    if (pickState === 'idle' || !range.start) {
      // Start fresh: single-day range, awaiting end click.
      onChange?.({ start: dateStr, end: dateStr });
      setPickState('extending');
    } else {
      // Extending an existing range.
      if (dateStr >= range.start) {
        onChange?.({ start: range.start, end: dateStr });
      } else {
        // Clicked before current start → make clicked the new start, old start the new end.
        onChange?.({ start: dateStr, end: range.start });
      }
      setPickState('idle');
    }
  };

  const inRange = (dateStr) => {
    if (!isRange || !range.start || !range.end) return false;
    return dateStr >= range.start && dateStr <= range.end;
  };
  const isStart = (dateStr) => isRange && range.start && dateStr === range.start && range.end !== range.start;
  const isEnd = (dateStr) => isRange && range.end && dateStr === range.end && range.end !== range.start;
  const isOnlyDay = (dateStr) => isRange && range.start && range.start === range.end && dateStr === range.start;

  return (
    <div className={`mini-picker ${isRange ? 'range-mode' : ''} ${className}`}>
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

      {isRange && (
        <div className="mini-picker-hint">
          {pickState === 'extending'
            ? 'Click another day to set the end date (or click again for a single-day job).'
            : 'Click a day to start. Click another to extend the range.'}
        </div>
      )}

      <div className="mini-picker-weekdays">
        {DAYS.map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="mini-picker-grid">
        {cells.map((c, i) => {
          const dateStr = fmt(c.date);
          const events = eventsByDate[dateStr] || [];
          const load = dayLoad(events);
          const isPast = minDate ? dateStr < minDate : false;
          const wouldOverbook = neededHours > 0 && (load.hours + neededHours) > DAILY_CAPACITY_HOURS + 0.001;
          const disabled = isPast;

          const selected = !isRange
            ? dateStr === value
            : (isOnlyDay(dateStr) || isStart(dateStr) || isEnd(dateStr));

          const inside = !selected && inRange(dateStr);

          return (
            <button
              type="button"
              key={i}
              className={`mini-picker-day
                ${c.currentMonth ? '' : 'out'}
                ${selected ? 'selected' : ''}
                ${inside ? 'in-range' : ''}
                ${isStart(dateStr) ? 'range-start' : ''}
                ${isEnd(dateStr) ? 'range-end' : ''}
                ${dateStr === todayStr ? 'today' : ''}
                ${wouldOverbook ? 'no-fit' : ''}
                ${disabled ? 'disabled' : ''}
              `}
              data-status={load.status}
              onClick={() => !disabled && handleClick(dateStr)}
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
