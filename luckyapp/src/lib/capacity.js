// Daily scheduling capacity model.
// Single source of truth for "is this day booked / open / overbooked?".
// 8h is the working-day budget; overflow goes to status='overbooked' (red).
// When we add a per-org setting later, only this constant has to change.
export const DAILY_CAPACITY_HOURS = 8;

// Parse anything we might get for a job duration:
//   - number  (4)
//   - "4 hours" / "4h"
//   - Postgres interval text "04:00:00" or "1 day 02:30:00"
//   - null/undefined → fallback
export function parseDurationHours(value, fallback = 4) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return fallback;

  const s = value.trim();

  let total = 0;
  let matched = false;

  const dayMatch = s.match(/(\d+(?:\.\d+)?)\s*days?/i);
  if (dayMatch) { total += parseFloat(dayMatch[1]) * 24; matched = true; }

  const hourWord = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hourWord) { total += parseFloat(hourWord[1]); matched = true; }

  const minWord = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/i);
  if (minWord) { total += parseFloat(minWord[1]) / 60; matched = true; }

  if (matched) return total;

  // hh:mm or hh:mm:ss
  const colon = s.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (colon) {
    return parseInt(colon[1], 10) + parseInt(colon[2], 10) / 60 + (colon[3] ? parseInt(colon[3], 10) / 3600 : 0);
  }

  const num = parseFloat(s);
  return Number.isFinite(num) ? num : fallback;
}

// How many hours does a single calendar event consume?
// Prefers explicit start+end. Falls back to estimatedDuration. All-day = full day.
export function eventDurationHours(e) {
  if (!e) return 0;
  if (e.allDay) return DAILY_CAPACITY_HOURS;
  if (e.startTime && e.endTime) {
    const [sh, sm] = String(e.startTime).split(':').map(Number);
    const [eh, em] = String(e.endTime).split(':').map(Number);
    if ([sh, sm, eh, em].some(Number.isNaN)) return parseDurationHours(e.estimatedDuration, 1);
    const diff = (eh * 60 + em - sh * 60 - sm) / 60;
    if (diff > 0) return diff;
  }
  if (e.estimatedDuration != null) return parseDurationHours(e.estimatedDuration, 1);
  // Quote appts / meetings without an end default to 1h.
  return 1;
}

// Aggregate the day's events into a load summary used by capacity bars + status pills.
export function dayLoad(events = []) {
  let hours = 0;
  let allDayCount = 0;
  events.forEach(e => {
    if (e.allDay) { allDayCount++; hours += DAILY_CAPACITY_HOURS; return; }
    hours += eventDurationHours(e);
  });
  const count = events.length;
  let status;
  if (count === 0) status = 'open';
  else if (hours <= DAILY_CAPACITY_HOURS * 0.5) status = 'light';
  else if (hours < DAILY_CAPACITY_HOURS * 0.95) status = 'busy';
  else if (hours <= DAILY_CAPACITY_HOURS * 1.05) status = 'full';
  else status = 'overbooked';
  return { hours, count, allDayCount, status, capacity: DAILY_CAPACITY_HOURS };
}

// "Find next day with at least N hours of headroom." Skips Sundays by default.
// Used by the EventModal "Next open slot" helper.
export function findNextOpenSlot(eventsByDate, fromDateStr, neededHours = 4, opts = {}) {
  const { lookAheadDays = 60, skipSunday = true } = opts;
  if (!fromDateStr) return null;
  const start = new Date(fromDateStr + 'T12:00:00');
  if (Number.isNaN(start.getTime())) return null;

  for (let i = 0; i < lookAheadDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (skipSunday && d.getDay() === 0) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const load = dayLoad(eventsByDate[key] || []);
    if (load.hours + neededHours <= DAILY_CAPACITY_HOURS + 0.001) return key;
  }
  return null;
}

export const STATUS_LABELS = {
  open: 'Open',
  light: 'Light',
  busy: 'Busy',
  full: 'Full',
  overbooked: 'Overbooked',
};
