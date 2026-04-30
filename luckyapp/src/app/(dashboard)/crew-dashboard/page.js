'use client';

// ─── Crew "Today Cockpit" ─────────────────────────────────────
// One screen per worker, mobile-first. The shift state machine drives a single
// big primary action button:
//
//   OFF       → "Start Shift" (picks first job, or starts as Travel/Yard)
//   ON_JOB    → split actions: "Take Break", "Switch Job", "End Shift"
//   ON_TRAVEL → split actions: "Arrive at Job", "Take Break", "End Shift"
//   ON_BREAK  → "End Break"
//
// Breaks are recorded in real time (not estimated retroactively at clock-out).
// Job time is captured per segment, so a 3-property day produces 3 job-attributed
// labor blocks instead of one lumped together.

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  Clock, MapPin, Phone, CalendarDays, Briefcase, Timer,
  Navigation, ChevronRight, HardHat, CheckCircle2, Coffee,
  X, AlertCircle, Truck, Play, Pause, Square, ArrowRightLeft,
  CloudRain, Users, Home, Zap, MessageSquare, RotateCcw,
} from 'lucide-react';

// ─── format helpers ────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

function formatTime12(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m)} ${ampm}`;
}

function formatHHMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatHM(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

function clockTimeOf(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── Quick blocker chips — tagged onto the open segment as notes ─
// Riley sees these on the time log so issues surface without anyone
// having to type a paragraph at the end of the day.
const BLOCKER_CHIPS = [
  { id: 'rain',     label: 'Rain delay',          icon: CloudRain },
  { id: 'no-show',  label: 'Customer not home',   icon: Home },
  { id: 'material', label: 'Need more material',  icon: AlertCircle },
  { id: 'equip',    label: 'Equipment issue',     icon: AlertCircle },
];

export default function CrewDashboardPage() {
  const { user } = useAuth();
  const {
    jobs, getCustomer,
    timeEntries, timeSegments,
    startShift, endShift, switchSegment, annotateOpenSegment,
  } = useData();

  // ─── modal state ─────────────────────────────────────────
  const [pickerMode, setPickerMode] = useState(null); // 'start' | 'switch' | null
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showBlockerNote, setShowBlockerNote] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  // Tick once per second so live timers refresh.
  // Active tick is needed whenever there's an open shift, regardless of state.
  const activeShift = useMemo(
    () => timeEntries.find(t => t.teamMemberId === user?.id && !t.clockOut),
    [timeEntries, user?.id]
  );

  useEffect(() => {
    if (!activeShift) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeShift]);

  // ─── derived state ──────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];

  // The currently-open segment for this shift. This is the source of truth
  // for "what is the worker doing right now."
  const openSegment = useMemo(() => {
    if (!activeShift) return null;
    return timeSegments.find(s => s.timeEntryId === activeShift.id && !s.endedAt) || null;
  }, [activeShift, timeSegments]);

  // All segments belonging to today's active shift, ordered oldest-first.
  // Useful for "today's timeline" and break-total math.
  const shiftSegments = useMemo(() => {
    if (!activeShift) return [];
    return timeSegments
      .filter(s => s.timeEntryId === activeShift.id)
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  }, [activeShift, timeSegments]);

  // The job currently being worked (when openSegment.kind === 'job').
  const currentJob = useMemo(() => {
    if (!openSegment?.jobId) return null;
    return jobs.find(j => j.id === openSegment.jobId) || null;
  }, [openSegment, jobs]);

  // Today's assigned jobs, sorted by scheduled time.
  const myJobs = useMemo(() => {
    if (!user?.id) return [];
    return jobs.filter(j => Array.isArray(j.assignedTo) && j.assignedTo.includes(user.id));
  }, [jobs, user?.id]);

  const todayJobs = useMemo(() => myJobs
    .filter(j => j.scheduledDate === todayStr && j.status !== 'cancelled')
    .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || '')),
    [myJobs, todayStr]);

  // Jobs available to clock into right now: today's jobs + anything in_progress
  // assigned to me (covers multi-day jobs).
  const clockableJobs = useMemo(() => myJobs.filter(j =>
    j.status !== 'cancelled' && j.status !== 'completed' &&
    (j.scheduledDate === todayStr || j.status === 'in_progress')
  ), [myJobs, todayStr]);

  // ─── live timers ────────────────────────────────────────
  const segmentElapsedMs = openSegment
    ? Date.now() - new Date(openSegment.startedAt).getTime()
    : 0;

  // Total paid time today = sum of (job + travel) durations from all segments.
  // Active job/travel segment is included as "now - startedAt".
  const paidMsToday = useMemo(() => {
    if (!activeShift) return 0;
    let total = 0;
    for (const s of shiftSegments) {
      if (s.kind === 'break') continue;
      if (s.endedAt) {
        total += (Number(s.durationMinutes) || 0) * 60_000;
      } else {
        total += Date.now() - new Date(s.startedAt).getTime();
      }
    }
    return total;
    // tick included so it updates each second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShift, shiftSegments, tick]);

  // Total break minutes today (closed + open break).
  const breakMinutesToday = useMemo(() => {
    if (!activeShift) return 0;
    let total = 0;
    for (const s of shiftSegments) {
      if (s.kind !== 'break') continue;
      if (s.endedAt) total += Number(s.durationMinutes) || 0;
      else total += (Date.now() - new Date(s.startedAt).getTime()) / 60_000;
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShift, shiftSegments, tick]);

  // ─── this-week roll-up ──────────────────────────────────
  const weekHours = useMemo(() => {
    if (!user?.id) return 0;
    const now = new Date();
    const weekStart = new Date(now);
    const dow = weekStart.getDay() || 7; // Mon=1..Sun=7
    weekStart.setDate(weekStart.getDate() - (dow - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartTs = weekStart.getTime();

    let totalMs = 0;
    for (const t of timeEntries) {
      if (t.teamMemberId !== user.id) continue;
      const inTs = new Date(t.clockIn).getTime();
      if (isNaN(inTs) || inTs < weekStartTs) continue;
      const outTs = t.clockOut ? new Date(t.clockOut).getTime() : Date.now();
      const breakMs = Number(t.breakMinutes || 0) * 60_000;
      totalMs += Math.max(0, outTs - inTs - breakMs);
    }
    return totalMs / (1000 * 60 * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeEntries, user?.id, tick]);

  // ─── action handlers ────────────────────────────────────
  const handleStart = (jobId) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await startShift(user.id, { jobId });
      setPickerMode(null);
    } catch (err) {
      console.error('startShift failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchJob = (jobId) => async () => {
    if (busy || !activeShift) return;
    setBusy(true);
    try {
      await switchSegment(activeShift.id, { kind: 'job', jobId });
      setPickerMode(null);
    } catch (err) {
      console.error('switchSegment failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchTravel = async () => {
    if (busy || !activeShift) return;
    setBusy(true);
    try {
      await switchSegment(activeShift.id, { kind: 'travel' });
      setPickerMode(null);
    } catch (err) {
      console.error('switchSegment(travel) failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleStartBreak = async () => {
    if (busy || !activeShift) return;
    setBusy(true);
    try {
      await switchSegment(activeShift.id, { kind: 'break' });
    } catch (err) {
      console.error('start break failed', err);
    } finally {
      setBusy(false);
    }
  };

  // Ending a break resumes whatever they were doing before. We pull the most
  // recent non-break segment for context.
  const handleEndBreak = async () => {
    if (busy || !activeShift) return;
    const previousNonBreak = [...shiftSegments].reverse().find(s => s.kind !== 'break' && s.endedAt);
    setBusy(true);
    try {
      const next = previousNonBreak
        ? { kind: previousNonBreak.kind, jobId: previousNonBreak.jobId }
        : { kind: 'travel' };
      await switchSegment(activeShift.id, next);
    } catch (err) {
      console.error('end break failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleEndShift = async () => {
    if (busy || !activeShift) return;
    setBusy(true);
    try {
      await endShift(activeShift.id);
      setShowEndConfirm(false);
    } catch (err) {
      console.error('endShift failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleBlocker = (label) => async () => {
    if (busy || !activeShift) return;
    setBusy(true);
    try {
      await annotateOpenSegment(activeShift.id, label);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitCustomNote = async () => {
    const trimmed = customNote.trim();
    if (!trimmed || !activeShift) { setShowBlockerNote(false); return; }
    setBusy(true);
    try {
      await annotateOpenSegment(activeShift.id, trimmed);
      setCustomNote('');
      setShowBlockerNote(false);
    } finally {
      setBusy(false);
    }
  };

  // ─── header bits ────────────────────────────────────────
  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const initials = (user?.fullName || 'You')
    .split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // What the cockpit reports as the worker's current state.
  const stateLabel = !activeShift
    ? 'Off the clock'
    : openSegment?.kind === 'break'
      ? 'On break'
      : openSegment?.kind === 'travel'
        ? 'Travel / Yard'
        : currentJob ? `On site — ${currentJob.title}` : 'On the clock';

  // Color & icon swap so the worker can read the state in a glance.
  const stateColor = !activeShift
    ? 'var(--text-tertiary)'
    : openSegment?.kind === 'break'
      ? 'var(--lucky-gold)'
      : openSegment?.kind === 'travel'
        ? '#63b3ff'
        : 'var(--lucky-green-light)';

  const StateIcon = !activeShift
    ? Clock
    : openSegment?.kind === 'break'
      ? Coffee
      : openSegment?.kind === 'travel'
        ? Truck
        : HardHat;

  // ─── render ─────────────────────────────────────────────
  return (
    <div className="cockpit animate-fade-in">
      {/* Greeting strip */}
      <div className="cockpit-greet">
        <div className="cockpit-greet-avatar">{initials}</div>
        <div className="cockpit-greet-text">
          <div className="cockpit-greet-line">{greeting}, {firstName}</div>
          <div className="cockpit-greet-sub">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div className="cockpit-greet-week">
          <div className="cockpit-greet-week-num">{weekHours.toFixed(1)}h</div>
          <div className="cockpit-greet-week-label">this week</div>
        </div>
      </div>

      {/* The big state card — what's happening right now */}
      <div className="cockpit-state" style={{ '--state-color': stateColor }}>
        <div className="cockpit-state-row">
          <div className="cockpit-state-icon"><StateIcon size={20} /></div>
          <div className="cockpit-state-text">
            <div className="cockpit-state-label">{stateLabel}</div>
            {activeShift && openSegment && (
              <div className="cockpit-state-sub">
                Started at {clockTimeOf(openSegment.startedAt)}
              </div>
            )}
          </div>
        </div>

        {activeShift && (
          <>
            <div className="cockpit-timers">
              <div className="cockpit-timer">
                <div className="cockpit-timer-label">Current</div>
                <div className="cockpit-timer-value">{formatHHMMSS(segmentElapsedMs)}</div>
              </div>
              <div className="cockpit-timer cockpit-timer-total">
                <div className="cockpit-timer-label">Paid today</div>
                <div className="cockpit-timer-value">{formatHHMMSS(paidMsToday)}</div>
              </div>
              {breakMinutesToday > 0 && (
                <div className="cockpit-timer cockpit-timer-break">
                  <div className="cockpit-timer-label">Break</div>
                  <div className="cockpit-timer-value">{formatHM(breakMinutesToday)}</div>
                </div>
              )}
            </div>

            {/* Long-shift break nudge — landscape days are physical */}
            {paidMsToday > 5 * 3600_000 && breakMinutesToday < 15 && openSegment?.kind !== 'break' && (
              <div className="cockpit-nudge">
                <Coffee size={14} /> You've been working 5+ hours without a break. Take 15.
              </div>
            )}
          </>
        )}
      </div>

      {/* Action area — primary buttons drive the state machine */}
      <div className="cockpit-actions">
        {!activeShift && (
          <button
            className="cockpit-btn cockpit-btn-primary"
            onClick={() => setPickerMode('start')}
            disabled={busy}
          >
            <Play size={20} /> Start Shift
          </button>
        )}

        {activeShift && openSegment?.kind !== 'break' && (
          <>
            <button
              className="cockpit-btn cockpit-btn-primary"
              onClick={handleStartBreak}
              disabled={busy}
            >
              <Pause size={18} /> Take Break
            </button>
            <button
              className="cockpit-btn cockpit-btn-secondary"
              onClick={() => setPickerMode('switch')}
              disabled={busy}
            >
              <ArrowRightLeft size={18} /> Switch Job
            </button>
            <button
              className="cockpit-btn cockpit-btn-danger"
              onClick={() => setShowEndConfirm(true)}
              disabled={busy}
            >
              <Square size={18} /> End Shift
            </button>
          </>
        )}

        {activeShift && openSegment?.kind === 'break' && (
          <button
            className="cockpit-btn cockpit-btn-primary"
            onClick={handleEndBreak}
            disabled={busy}
          >
            <Play size={20} /> End Break
          </button>
        )}
      </div>

      {/* Quick blocker chips — only when on the clock */}
      {activeShift && openSegment?.kind !== 'break' && (
        <div className="cockpit-blockers">
          <div className="cockpit-blockers-label">
            <MessageSquare size={12} /> Flag an issue
          </div>
          <div className="cockpit-chips">
            {BLOCKER_CHIPS.map(c => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  className="cockpit-chip"
                  onClick={handleBlocker(c.label)}
                  disabled={busy}
                  title={`Tag this ${openSegment?.kind} segment with: ${c.label}`}
                >
                  <Icon size={12} /> {c.label}
                </button>
              );
            })}
            <button
              className="cockpit-chip cockpit-chip-custom"
              onClick={() => setShowBlockerNote(true)}
              disabled={busy}
            >
              + Note
            </button>
          </div>
        </div>
      )}

      {/* Quick navigation — call/navigate/job-page for the active context */}
      {activeShift && (currentJob || todayJobs[0]) && (
        <div className="cockpit-quick">
          {(() => {
            const j = currentJob || todayJobs[0];
            const cust = j.customerId ? getCustomer(j.customerId) : null;
            const addr = j.address || (cust?.address ? `${cust.address}${cust.city ? `, ${cust.city}` : ''} ${cust.zip || ''}`.trim() : '');
            const mapsUrl = addr ? `https://maps.google.com/?q=${encodeURIComponent(addr)}` : null;
            return (
              <>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="cockpit-quick-link">
                    <Navigation size={16} /> Navigate
                  </a>
                )}
                {cust?.phone && (
                  <a href={`tel:${cust.phone}`} className="cockpit-quick-link">
                    <Phone size={16} /> Call {cust.firstName}
                  </a>
                )}
                <Link href={`/jobs/${j.id}`} className="cockpit-quick-link">
                  <Zap size={16} /> Job Page
                </Link>
              </>
            );
          })()}
        </div>
      )}

      {/* Today's timeline — shows segment history of THIS shift */}
      {activeShift && shiftSegments.length > 1 && (
        <div className="cockpit-section">
          <div className="cockpit-section-head">
            <h3><Timer size={16} /> Today's Timeline</h3>
          </div>
          <div className="cockpit-timeline">
            {shiftSegments.map(seg => {
              const job = seg.jobId ? jobs.find(j => j.id === seg.jobId) : null;
              const dur = seg.endedAt
                ? Number(seg.durationMinutes || 0)
                : (Date.now() - new Date(seg.startedAt).getTime()) / 60_000;
              const isOpen = !seg.endedAt;
              const segLabel = seg.kind === 'job'
                ? (job?.title || 'Job')
                : seg.kind === 'travel' ? 'Travel / Yard' : 'Break';
              const segIcon = seg.kind === 'job' ? HardHat : seg.kind === 'travel' ? Truck : Coffee;
              const Icon = segIcon;
              return (
                <div key={seg.id} className={`cockpit-tl-row ${seg.kind} ${isOpen ? 'open' : ''}`}>
                  <div className="cockpit-tl-icon"><Icon size={14} /></div>
                  <div className="cockpit-tl-body">
                    <div className="cockpit-tl-title">{segLabel}</div>
                    <div className="cockpit-tl-meta">
                      {clockTimeOf(seg.startedAt)} {isOpen ? '→ now' : `→ ${clockTimeOf(seg.endedAt)}`} · {formatHM(dur)}
                    </div>
                    {seg.notes && <div className="cockpit-tl-note">{seg.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's jobs */}
      <div className="cockpit-section">
        <div className="cockpit-section-head">
          <h3><Briefcase size={16} /> Today's Jobs <span className="cockpit-badge">{todayJobs.length}</span></h3>
          <Link href="/crew-schedule" className="cockpit-section-link">
            <CalendarDays size={12} /> Full week
          </Link>
        </div>

        {todayJobs.length === 0 ? (
          <div className="cockpit-empty">
            <CheckCircle2 size={28} />
            <p>No jobs scheduled for today</p>
          </div>
        ) : (
          todayJobs.map(job => {
            const cust = job.customerId ? getCustomer(job.customerId) : null;
            const isCurrent = currentJob?.id === job.id;
            const fullAddr = job.address || (cust?.address ? `${cust.address}${cust.city ? `, ${cust.city}` : ''} ${cust.zip || ''}`.trim() : '');
            return (
              <div key={job.id} className={`cockpit-job ${isCurrent ? 'is-current' : ''}`}>
                <div className="cockpit-job-head">
                  <div className="cockpit-job-title">
                    {isCurrent && <span className="cockpit-job-now">NOW</span>}
                    {job.title}
                  </div>
                  {job.scheduledTime && (
                    <div className="cockpit-job-time">
                      <Clock size={12} /> {formatTime12(job.scheduledTime)}
                    </div>
                  )}
                </div>
                {cust && (
                  <div className="cockpit-job-cust">
                    <Users size={12} /> {cust.firstName} {cust.lastName?.[0] || ''}.
                    {cust.phone && <span className="cockpit-job-phone"> · {cust.phone}</span>}
                  </div>
                )}
                {fullAddr && (
                  <div className="cockpit-job-addr">
                    <MapPin size={12} /> {fullAddr}
                  </div>
                )}
                {job.crewNotes && <div className="cockpit-job-notes">{job.crewNotes}</div>}
                <div className="cockpit-job-actions">
                  <Link href={`/jobs/${job.id}`} className="cockpit-job-link">
                    Details <ChevronRight size={12} />
                  </Link>
                  {!isCurrent && activeShift && openSegment?.kind !== 'break' && (
                    <button
                      className="cockpit-job-clock"
                      onClick={handleSwitchJob(job.id)}
                      disabled={busy}
                    >
                      <ArrowRightLeft size={12} /> Switch here
                    </button>
                  )}
                  {!activeShift && (
                    <button
                      className="cockpit-job-clock"
                      onClick={handleStart(job.id)}
                      disabled={busy}
                    >
                      <Play size={12} /> Start here
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Modals ────────────────────────────────────────── */}

      {/* Job picker — start shift OR switch jobs */}
      {pickerMode && (
        <div className="modal-overlay" onClick={() => !busy && setPickerMode(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2>
                {pickerMode === 'start' ? <Play size={20} /> : <ArrowRightLeft size={20} />}
                <span style={{ marginLeft: 8 }}>
                  {pickerMode === 'start' ? 'Start Shift' : 'Switch Segment'}
                </span>
              </h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setPickerMode(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                {pickerMode === 'start'
                  ? 'Pick the job you\'re starting at, or "Travel / Yard" if you\'re loading up.'
                  : 'Pick the next job, or switch to Travel / Yard for driving.'}
              </p>

              <button
                className="cockpit-picker-row cockpit-picker-travel"
                onClick={pickerMode === 'start' ? handleStart(null) : handleSwitchTravel}
                disabled={busy}
              >
                <div className="cockpit-picker-icon"><Truck size={16} /></div>
                <div className="cockpit-picker-body">
                  <div className="cockpit-picker-title">Travel / Yard</div>
                  <div className="cockpit-picker-meta">Driving, loading, or general yard work</div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
              </button>

              {clockableJobs.length > 0 && (
                <div style={{ marginTop: 'var(--space-md)', fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Today's Jobs
                </div>
              )}

              {clockableJobs.map(job => {
                const cust = job.customerId ? getCustomer(job.customerId) : null;
                return (
                  <button
                    key={job.id}
                    className="cockpit-picker-row"
                    onClick={pickerMode === 'start' ? handleStart(job.id) : handleSwitchJob(job.id)}
                    disabled={busy}
                  >
                    <div className="cockpit-picker-icon"><HardHat size={16} /></div>
                    <div className="cockpit-picker-body">
                      <div className="cockpit-picker-title">{job.title}</div>
                      <div className="cockpit-picker-meta">
                        {job.scheduledTime && <>{formatTime12(job.scheduledTime)} · </>}
                        {cust ? `${cust.firstName} ${cust.lastName?.[0] || ''}.` : 'No customer'}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                );
              })}

              {clockableJobs.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                  <p>No jobs assigned to you for today.</p>
                  <p style={{ fontSize: '0.75rem' }}>Starting as Travel / Yard is fine.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* End-shift confirm — show summary so they don't end mid-shift by accident */}
      {showEndConfirm && activeShift && (
        <div className="modal-overlay" onClick={() => !busy && setShowEndConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2><Square size={20} /> <span style={{ marginLeft: 8 }}>End Shift?</span></h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowEndConfirm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="cockpit-summary">
                <div className="cockpit-summary-row">
                  <span>Shift started</span>
                  <strong>{clockTimeOf(activeShift.clockIn)}</strong>
                </div>
                <div className="cockpit-summary-row">
                  <span>Paid time</span>
                  <strong>{formatHM(paidMsToday / 60_000)}</strong>
                </div>
                <div className="cockpit-summary-row">
                  <span>Break time</span>
                  <strong>{breakMinutesToday > 0 ? formatHM(breakMinutesToday) : '—'}</strong>
                </div>
                <div className="cockpit-summary-row">
                  <span>Segments</span>
                  <strong>{shiftSegments.length}</strong>
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-md)' }}>
                Once ended, the shift can only be edited by an owner.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEndConfirm(false)} disabled={busy}>
                <RotateCcw size={14} /> Keep working
              </button>
              <button className="btn btn-danger" onClick={handleEndShift} disabled={busy}>
                <Square size={14} /> End Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom note modal */}
      {showBlockerNote && (
        <div className="modal-overlay" onClick={() => !busy && setShowBlockerNote(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2><MessageSquare size={20} /> <span style={{ marginLeft: 8 }}>Add a note</span></h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowBlockerNote(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                This note attaches to your current segment. Riley sees it on the time log.
              </p>
              <textarea
                className="form-input"
                rows={4}
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                placeholder="What happened?"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBlockerNote(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitCustomNote} disabled={busy || !customNote.trim()}>
                Add note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
