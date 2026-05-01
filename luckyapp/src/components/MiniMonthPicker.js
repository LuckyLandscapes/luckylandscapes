'use client';

// Inline month-grid date picker that bakes capacity into each cell.
// Two modes:
//   - 'single' (default): emits onChange(dateStr)
//   - 'multi':  emits onChange(string[]). Click toggles a day in/out of the
//     selection. Shift-click fills the gap from the last-clicked day to
//     the current click (mouse only — touch users just tap each day).
//     This handles every shape: 1 day, contiguous run, "Fri + Mon split",
//     "Mon-Fri but skip Wed", whatever.

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
  value,                  // 'YYYY-MM-DD' (single) OR string[] (multi)
  onChange,
  mode = 'single',        // 'single' | 'multi'
  eventsByDate = {},
  neededHours = 0,
  minDate = null,
  className = '',
}) {
  const isMulti = mode === 'multi';

  // Normalize value so internal lookup is a Set of YYYY-MM-DD strings.
  const selectedSet = useMemo(() => {
    if (isMulti) {
      const arr = Array.isArray(value) ? value.filter(Boolean) : [];
      return new Set(arr);
    }
    return new Set(value ? [value] : []);
  }, [value, isMulti]);

  // Anchor month for navigation — seed from first selected day or today.
  const initialAnchor = (() => {
    const seed = isMulti
      ? (Array.isArray(value) && value.length > 0 ? [...value].sort()[0] : null)
      : value;
    if (seed) {
      const [y, m] = seed.split('-').map(Number);
      if (Number.isFinite(y) && Number.isFinite(m)) return new Date(y, m - 1, 1);
    }
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  })();

  const [anchor, setAnchor] = useState(initialAnchor);
  // Last-clicked day, used as the anchor for shift-click range fill.
  const [lastClicked, setLastClicked] = useState(null);
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

  const enumerateRange = (a, b) => {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const out = [];
    const cur = new Date(lo + 'T12:00:00');
    const end = new Date(hi + 'T12:00:00');
    while (cur <= end) {
      out.push(fmt(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  };

  const handleClick = (dateStr, ev) => {
    if (!isMulti) {
      onChange?.(dateStr);
      return;
    }

    const current = new Set(selectedSet);

    // Shift-click: fill range from lastClicked → dateStr (additive).
    if (ev?.shiftKey && lastClicked) {
      enumerateRange(lastClicked, dateStr).forEach(d => current.add(d));
    } else {
      // Plain click: toggle the single day.
      if (current.has(dateStr)) current.delete(dateStr);
      else current.add(dateStr);
    }

    setLastClicked(dateStr);
    onChange?.(Array.from(current).sort());
  };

  const isSelected = (dateStr) => selectedSet.has(dateStr);

  const handleClearAll = () => {
    if (!isMulti) return;
    setLastClicked(null);
    onChange?.([]);
  };

  return (
    <div className={`mini-picker ${isMulti ? 'multi-mode' : ''} ${className}`}>
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

      {isMulti && (
        <div className="mini-picker-hint">
          {selectedSet.size === 0
            ? 'Click days to add. Shift-click fills a range.'
            : `${selectedSet.size} day${selectedSet.size === 1 ? '' : 's'} selected · Shift-click to fill a range`}
          {selectedSet.size > 0 && (
            <button type="button" className="mini-picker-clear" onClick={handleClearAll}>Clear</button>
          )}
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

          const selected = isSelected(dateStr);

          return (
            <button
              type="button"
              key={i}
              className={`mini-picker-day
                ${c.currentMonth ? '' : 'out'}
                ${selected ? 'selected' : ''}
                ${dateStr === todayStr ? 'today' : ''}
                ${wouldOverbook && !selected ? 'no-fit' : ''}
                ${disabled ? 'disabled' : ''}
              `}
              data-status={load.status}
              onClick={(ev) => !disabled && handleClick(dateStr, ev)}
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
