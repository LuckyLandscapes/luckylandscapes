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

// ─── Multi-day jobs ────────────────────────────────────────
// A job may span scheduledDate → scheduledEndDate. We auto-distribute
// `estimated_duration` evenly across the workdays in that range so each
// touched day reports a realistic per-day load against capacity.

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Returns [{date, hours, dayIndex, totalDays}, ...] — one entry per workday
// the job touches.
//
// Resolution order:
//   1. If `scheduledDates` is a non-empty array, use it verbatim. The user
//      picked these days explicitly (multi-select) and their gaps are
//      intentional ("Fri + Mon, skip the weekend"). No automatic skipping.
//   2. Otherwise fall back to a single day at `scheduledDate` (legacy rows).
export function expandJobToWorkdays(job) {
  if (!job?.scheduledDate && (!Array.isArray(job?.scheduledDates) || job.scheduledDates.length === 0)) {
    return [];
  }

  let dates = Array.isArray(job?.scheduledDates) ? job.scheduledDates.filter(Boolean) : [];
  if (dates.length === 0 && job?.scheduledDate) dates = [job.scheduledDate];
  if (dates.length === 0) return [];

  // De-duplicate + sort lexicographically (YYYY-MM-DD strings sort naturally).
  dates = Array.from(new Set(dates)).sort();

  const totalHours = parseDurationHours(job.estimatedDuration, 4);
  const perDay = totalHours / dates.length;

  return dates.map((date, i) => ({
    date,
    hours: perDay,
    dayIndex: i,
    totalDays: dates.length,
  }));
}

// Per-day share for a specific date.
export function jobDayHours(job, dateStr) {
  const days = expandJobToWorkdays(job);
  const day = days.find(d => d.date === dateStr);
  return day?.hours ?? parseDurationHours(job?.estimatedDuration, 4);
}

// Single source of truth: turn (calendarEvents, jobs) into a date-keyed
// map of enriched events used by the calendar, EventModal, and
// ScheduleJobModal. Multi-day jobs are expanded onto every workday in
// their range. calendar_events linked to a multi-day job have their
// per-day capacity rebased to the day's share (so a 20h job's day-1
// event doesn't claim the full 20h).
export function buildEventsByDate({ calendarEvents = [], jobs = [], excludeEventId = null } = {}) {
  const map = {};
  const TYPE_FALLBACK = {
    job: '#6B8E4E',
    quote_appointment: '#3b82f6',
    meeting: '#d4a93e',
    other: '#64748b',
  };

  // 1) Calendar events first, rebasing job-linked events to per-day share.
  calendarEvents.forEach(e => {
    if (!e.date) return;
    if (excludeEventId && e.id === excludeEventId) return;
    const linkedJob = e.jobId ? jobs.find(j => j.id === e.jobId) : null;
    const perDay = linkedJob ? jobDayHours(linkedJob, e.date) : null;
    const wd = linkedJob ? expandJobToWorkdays(linkedJob).find(d => d.date === e.date) : null;
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push({
      ...e,
      source: 'event',
      color: e.color || TYPE_FALLBACK[e.type] || '#64748b',
      // For job-linked events without an explicit endTime, use the
      // per-day share so capacity reflects reality on multi-day jobs.
      estimatedDuration: e.endTime ? null : (perDay != null ? `${perDay} hours` : null),
      jobStatus: linkedJob?.status,
      multiDayInfo: (wd && wd.totalDays > 1)
        ? { dayIndex: wd.dayIndex + 1, totalDays: wd.totalDays }
        : null,
    });
  });

  // 2) Synthesize entries for jobs on each workday they touch where no
  //    calendar_event already covers that day.
  jobs.forEach(j => {
    if (!j.scheduledDate) return;
    const days = expandJobToWorkdays(j);
    days.forEach(d => {
      const covered = calendarEvents.some(e => e.jobId === j.id && e.date === d.date);
      if (covered) return;
      if (!map[d.date]) map[d.date] = [];
      map[d.date].push({
        id: `job-${j.id}-${d.dayIndex}`,
        jobId: j.id,
        title: j.title,
        type: 'job',
        date: d.date,
        startTime: d.dayIndex === 0 ? j.scheduledTime : null,
        endTime: null,
        allDay: false,
        color: '#6B8E4E',
        customerId: j.customerId,
        assignedTo: j.assignedTo || [],
        source: 'job',
        estimatedDuration: `${d.hours} hours`,
        jobStatus: j.status,
        multiDayInfo: d.totalDays > 1 ? { dayIndex: d.dayIndex + 1, totalDays: d.totalDays } : null,
      });
    });
  });

  // 3) Stable sort within each day by start time.
  Object.values(map).forEach(arr => arr.sort((a, b) => {
    const aa = a.allDay ? '' : (a.startTime || '99:99');
    const bb = b.allDay ? '' : (b.startTime || '99:99');
    return String(aa).localeCompare(String(bb));
  }));

  return map;
}

// Convenience: format a sorted scheduled-dates array for a label like
// "Fri May 1, Mon May 4" (or "Mon May 4 – Wed May 6" when contiguous).
export function summarizeWorkdays(dates = []) {
  const arr = Array.isArray(dates) ? dates.filter(Boolean) : [];
  if (arr.length === 0) return '';
  const sorted = Array.from(new Set(arr)).sort();
  const fmt = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Contiguous?
  let contiguous = true;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00');
    const cur = new Date(sorted[i] + 'T12:00:00');
    const diff = (cur - prev) / 86400000;
    if (diff !== 1) { contiguous = false; break; }
  }

  if (sorted.length === 1) return fmt(sorted[0]);
  if (contiguous) return `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`;
  if (sorted.length <= 4) return sorted.map(fmt).join(', ');
  return `${fmt(sorted[0])} … ${fmt(sorted[sorted.length - 1])} (${sorted.length} days)`;
}
