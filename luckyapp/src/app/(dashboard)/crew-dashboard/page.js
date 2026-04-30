'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  Clock,
  MapPin,
  Phone,
  Mail,
  CalendarDays,
  Briefcase,
  Timer,
  Flag,
  FileText,
  Navigation,
  ChevronRight,
  HardHat,
  CheckCircle2,
  Coffee,
  X,
  AlertCircle,
  Award,
  Sun,
  CloudRain,
  Cloud,
  Zap,
} from 'lucide-react';

function formatTime12(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatLiveDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PRIORITY_COLORS = {
  low: 'var(--text-tertiary)',
  normal: 'var(--status-info)',
  high: 'var(--status-warning)',
  urgent: 'var(--status-danger)',
};

// Legal break time options based on shift length (US DOL / common state laws)
// These are the legally compliant break options for different shift durations
function getBreakOptions(shiftDurationHours) {
  const options = [
    { value: 0, label: 'No break taken', description: 'Shift under 5 hours' },
  ];

  if (shiftDurationHours >= 5) {
    options.push(
      { value: 15, label: '15 min break', description: 'Paid rest break' },
      { value: 30, label: '30 min break', description: 'Standard meal break (unpaid)' },
    );
  }
  if (shiftDurationHours >= 6) {
    options.push(
      { value: 45, label: '45 min break', description: '30 min meal + 15 min rest' },
    );
  }
  if (shiftDurationHours >= 8) {
    options.push(
      { value: 60, label: '1 hour break', description: '30 min meal + two 15 min rests' },
    );
  }
  if (shiftDurationHours >= 10) {
    options.push(
      { value: 90, label: '1.5 hour break', description: 'Two 30 min meals + 30 min rest' },
    );
  }
  if (shiftDurationHours >= 12) {
    options.push(
      { value: 120, label: '2 hour break', description: 'Extended shift double meal break' },
    );
  }

  return options;
}

export default function CrewDashboardPage() {
  const { user } = useAuth();
  const { jobs, getCustomer, getQuote, timeEntries, clockIn, clockOut, updateTimeEntry } = useData();

  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [liveTick, setLiveTick] = useState(0);

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = new Date().toISOString().split('T')[0];
  const initials = (user?.fullName || 'You')
    .split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  // Get active clock entry for this user
  const activeClockEntry = useMemo(() => {
    return timeEntries.find(t => t.teamMemberId === user?.id && !t.clockOut);
  }, [timeEntries, user?.id]);

  // Tick every second while clocked in so the elapsed timer updates live
  useEffect(() => {
    if (!activeClockEntry) return;
    const id = setInterval(() => setLiveTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeClockEntry]);

  // Active job being clocked into
  const activeJob = useMemo(() => {
    if (!activeClockEntry?.jobId) return null;
    return jobs.find(j => j.id === activeClockEntry.jobId) || null;
  }, [activeClockEntry, jobs]);

  // My jobs: filter by assignedTo containing my user ID
  const myJobs = useMemo(() => {
    if (!user?.id) return [];
    return jobs.filter(j => {
      const assigned = j.assignedTo || [];
      return Array.isArray(assigned) && assigned.includes(user.id);
    });
  }, [jobs, user?.id]);

  // Today's jobs
  const todayJobs = useMemo(() => {
    return myJobs
      .filter(j => j.scheduledDate === todayStr && j.status !== 'cancelled')
      .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
  }, [myJobs, todayStr]);

  // Upcoming jobs (next 7 days, excluding today)
  const upcomingJobs = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    return myJobs
      .filter(j => j.scheduledDate >= tomorrowStr && j.scheduledDate <= nextWeekStr && j.status !== 'cancelled')
      .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || '') || (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
  }, [myJobs]);

  // Clockable jobs: today's jobs or any in-progress jobs assigned to this worker
  const clockableJobs = useMemo(() => {
    return myJobs.filter(j =>
      j.status !== 'cancelled' && j.status !== 'completed' &&
      (j.scheduledDate === todayStr || j.status === 'in_progress')
    );
  }, [myJobs, todayStr]);

  // ── This-week stats ────────────────────────────────────────
  const weekStats = useMemo(() => {
    if (!user?.id) return { hours: 0, jobsDone: 0, jobsScheduled: 0, breaks: 0 };
    const now = new Date();
    const weekStart = new Date(now);
    // Monday-based week
    const day = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - (day - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartTs = weekStart.getTime();

    let totalMs = 0;
    let breaks = 0;
    timeEntries.forEach(t => {
      if (t.teamMemberId !== user.id) return;
      const inTs = new Date(t.clockIn).getTime();
      if (isNaN(inTs) || inTs < weekStartTs) return;
      const outTs = t.clockOut ? new Date(t.clockOut).getTime() : Date.now();
      const breakMin = Number(t.breakMinutes || 0);
      const span = Math.max(0, outTs - inTs - breakMin * 60_000);
      totalMs += span;
      if (breakMin > 0) breaks += 1;
    });

    const jobsDone = myJobs.filter(j => {
      if (j.status !== 'completed') return false;
      const d = j.completedAt || j.scheduledDate;
      if (!d) return false;
      return new Date(d).getTime() >= weekStartTs;
    }).length;

    const jobsScheduled = myJobs.filter(j =>
      j.scheduledDate &&
      new Date(j.scheduledDate + 'T12:00:00').getTime() >= weekStartTs &&
      j.status !== 'cancelled'
    ).length;

    return {
      hours: totalMs / (1000 * 60 * 60),
      jobsDone,
      jobsScheduled,
      breaks,
    };
    // liveTick included so an active (no clockOut) entry recomputes its elapsed hours each second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeEntries, myJobs, user?.id, liveTick]);

  // Today's earnings (rough estimate from active clock entry)
  const todayElapsedMs = activeClockEntry
    ? Date.now() - new Date(activeClockEntry.clockIn).getTime()
    : 0;

  const handleClockInClick = () => {
    if (activeClockEntry) {
      // Opening the break prompt for clock out
      setShowBreakPrompt(true);
    } else {
      if (clockableJobs.length === 1) {
        // Only one job available, clock in directly
        handleClockInToJob(clockableJobs[0].id);
      } else {
        setShowJobPicker(true);
      }
    }
  };

  const handleClockInToJob = async (jobId) => {
    setClockingIn(true);
    try {
      await clockIn(user.id, jobId);
      setShowJobPicker(false);
    } catch (err) {
      console.error('Error clocking in:', err);
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOutWithBreak = async (breakMinutes) => {
    setClockingOut(true);
    try {
      // Store break minutes on the time entry, then clock out
      if (breakMinutes > 0 && activeClockEntry?.id) {
        await updateTimeEntry(activeClockEntry.id, { breakMinutes });
      }
      await clockOut(activeClockEntry.id);
      setShowBreakPrompt(false);
    } catch (err) {
      console.error('Error clocking out:', err);
    } finally {
      setClockingOut(false);
    }
  };

  // Calculate shift duration for break options
  const shiftDurationHours = activeClockEntry
    ? (Date.now() - new Date(activeClockEntry.clockIn).getTime()) / (1000 * 60 * 60)
    : 0;

  const breakOptions = getBreakOptions(shiftDurationHours);

  // Live elapsed time string (updates each second via liveTick)
  const liveElapsedStr = activeClockEntry ? formatLiveDuration(todayElapsedMs) : null;

  // Pick a daypart icon for the hero (purely visual flavor)
  const HeroIcon = hour < 6 || hour >= 19 ? Cloud : hour < 11 ? Sun : hour < 16 ? Sun : CloudRain;

  return (
    <div className="crew-dash animate-fade-in">
      {/* ── Hero Header ────────────────────────────────────── */}
      <div className="crew-hero">
        <div className="crew-hero-bg" />
        <div className="crew-hero-content">
          <div className="crew-hero-avatar">{initials}</div>
          <div className="crew-hero-text">
            <div className="crew-hero-greeting">
              {greeting}, {firstName}
              <HeroIcon size={18} className="crew-hero-icon" />
            </div>
            <div className="crew-hero-date">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className="crew-hero-badge">
            <HardHat size={14} />
            <span>Crew</span>
          </div>
        </div>
      </div>

      {/* ── Clock Widget (rich, with live timer) ───────────── */}
      <div className={`crew-clock-card ${activeClockEntry ? 'is-active' : ''}`}>
        <div className="crew-clock-card-top">
          <div className="crew-clock-status">
            <div className={`crew-clock-dot ${activeClockEntry ? 'active' : 'inactive'}`} />
            <div className="crew-clock-status-text">
              <span className="crew-clock-status-label">{activeClockEntry ? 'On the clock' : 'Off the clock'}</span>
              {activeJob && (
                <span className="crew-clock-active-job">
                  <Briefcase size={10} />
                  {activeJob.title}
                </span>
              )}
              {!activeClockEntry && clockableJobs.length > 0 && (
                <span className="crew-clock-status-sub">
                  {clockableJobs.length} job{clockableJobs.length !== 1 ? 's' : ''} ready to start
                </span>
              )}
            </div>
          </div>
          <button
            className={`crew-clock-btn ${activeClockEntry ? 'is-out' : 'is-in'}`}
            onClick={handleClockInClick}
            disabled={clockingIn || clockingOut || (!activeClockEntry && clockableJobs.length === 0)}
          >
            <Clock size={16} />
            {activeClockEntry ? 'Clock Out' : 'Clock In'}
          </button>
        </div>

        {activeClockEntry && (
          <div className="crew-clock-timer">
            <div className="crew-clock-timer-num">{liveElapsedStr}</div>
            <div className="crew-clock-timer-label">
              Since {new Date(activeClockEntry.clockIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
        )}
      </div>

      {/* No clockable jobs message */}
      {!activeClockEntry && clockableJobs.length === 0 && (
        <div className="crew-alert">
          <AlertCircle size={14} />
          No active or scheduled jobs to clock into today.
        </div>
      )}

      {/* ── This Week Stats ────────────────────────────────── */}
      <div className="crew-week-stats">
        <div className="crew-week-stat">
          <div className="crew-week-stat-icon" style={{ background: 'rgba(58, 156, 74, 0.12)', color: 'var(--lucky-green-light)' }}>
            <Timer size={16} />
          </div>
          <div className="crew-week-stat-body">
            <div className="crew-week-stat-value">{weekStats.hours.toFixed(1)}h</div>
            <div className="crew-week-stat-label">Hours this week</div>
          </div>
        </div>
        <div className="crew-week-stat">
          <div className="crew-week-stat-icon" style={{ background: 'rgba(99, 179, 255, 0.12)', color: '#63b3ff' }}>
            <CheckCircle2 size={16} />
          </div>
          <div className="crew-week-stat-body">
            <div className="crew-week-stat-value">{weekStats.jobsDone}<span className="crew-week-stat-total"> / {weekStats.jobsScheduled}</span></div>
            <div className="crew-week-stat-label">Jobs done this week</div>
          </div>
        </div>
        <div className="crew-week-stat">
          <div className="crew-week-stat-icon" style={{ background: 'rgba(212, 169, 62, 0.14)', color: 'var(--lucky-gold)' }}>
            <Award size={16} />
          </div>
          <div className="crew-week-stat-body">
            <div className="crew-week-stat-value">{todayJobs.length}</div>
            <div className="crew-week-stat-label">On deck today</div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────── */}
      <div className="crew-quick-actions">
        <Link href="/crew-schedule" className="crew-quick-action">
          <CalendarDays size={18} />
          <span>Schedule</span>
        </Link>
        {(activeJob || todayJobs[0]) && (() => {
          const j = activeJob || todayJobs[0];
          const cust = j.customerId ? getCustomer(j.customerId) : null;
          const addr = j.address || (cust?.address ? `${cust.address}${cust.city ? `, ${cust.city}` : ''} ${cust.zip || ''}`.trim() : '');
          const url = addr ? `https://maps.google.com/?q=${encodeURIComponent(addr)}` : null;
          return url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="crew-quick-action">
              <Navigation size={18} />
              <span>Navigate</span>
            </a>
          ) : null;
        })()}
        {(activeJob || todayJobs[0]) && (() => {
          const j = activeJob || todayJobs[0];
          const cust = j.customerId ? getCustomer(j.customerId) : null;
          return cust?.phone ? (
            <a href={`tel:${cust.phone}`} className="crew-quick-action">
              <Phone size={18} />
              <span>Call</span>
            </a>
          ) : null;
        })()}
        {activeJob && (
          <Link href={`/jobs/${activeJob.id}`} className="crew-quick-action crew-quick-action-primary">
            <Zap size={18} />
            <span>Job Page</span>
          </Link>
        )}
      </div>

      {/* Today's Jobs */}
      <div className="crew-section-header">
        <h2>
          <Briefcase size={20} />
          Today&apos;s Jobs
          <span className="crew-section-count">{todayJobs.length}</span>
        </h2>
      </div>

      {todayJobs.length === 0 ? (
        <div className="crew-no-jobs">
          <CheckCircle2 size={48} />
          <p>No jobs scheduled for today</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Check back later or view your upcoming schedule</p>
        </div>
      ) : (
        todayJobs.map(job => (
          <JobCard key={job.id} job={job} getCustomer={getCustomer} getQuote={getQuote} />
        ))
      )}

      {/* Upcoming Jobs */}
      {upcomingJobs.length > 0 && (
        <>
          <div className="crew-section-header" style={{ marginTop: 'var(--space-xl)' }}>
            <h2>
              <CalendarDays size={20} />
              Upcoming
              <span className="crew-section-count">{upcomingJobs.length}</span>
            </h2>
            <Link href="/crew-schedule" className="btn btn-ghost btn-sm">
              Full Schedule <ChevronRight size={14} />
            </Link>
          </div>
          {upcomingJobs.map(job => (
            <JobCard key={job.id} job={job} getCustomer={getCustomer} getQuote={getQuote} showDate />
          ))}
        </>
      )}

      {/* ═══ Job Picker Modal ═══ */}
      {showJobPicker && (
        <div className="modal-overlay" onClick={() => !clockingIn && setShowJobPicker(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2><Clock size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Select Job to Clock In</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowJobPicker(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                Select which job you are working on. Your hours will be tracked against this job.
              </p>
              {clockableJobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>
                  <Briefcase size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <p>No active jobs to clock into</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {clockableJobs.map(job => {
                    const customer = job.customerId ? getCustomer(job.customerId) : null;
                    return (
                      <button
                        key={job.id}
                        className="crew-job-picker-item"
                        onClick={() => handleClockInToJob(job.id)}
                        disabled={clockingIn}
                      >
                        <div style={{ flex: 1 }}>
                          <div className="crew-job-picker-title">{job.title}</div>
                          <div className="crew-job-picker-meta">
                            {job.scheduledTime && (
                              <span><Clock size={11} /> {formatTime12(job.scheduledTime)}</span>
                            )}
                            {customer && (
                              <span>• {customer.firstName} {customer.lastName?.[0] || ''}.</span>
                            )}
                          </div>
                          {job.address && (
                            <div className="crew-job-picker-address">
                              <MapPin size={11} /> {job.address}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Break Time Prompt Modal ═══ */}
      {showBreakPrompt && (
        <div className="modal-overlay" onClick={() => !clockingOut && setShowBreakPrompt(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2><Coffee size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Log Break Time</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowBreakPrompt(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
                borderRadius: '10px', background: 'var(--bg-elevated)', marginBottom: 'var(--space-md)',
              }}>
                <Clock size={18} style={{ color: 'var(--lucky-green-light)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    Shift: {formatDuration(Date.now() - new Date(activeClockEntry?.clockIn).getTime())}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    {new Date(activeClockEntry?.clockIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} → Now
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                Select the break time taken during this shift. Break time will be deducted from your paid hours.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {breakOptions.map(option => (
                  <button
                    key={option.value}
                    className="crew-break-option"
                    onClick={() => handleClockOutWithBreak(option.value)}
                    disabled={clockingOut}
                  >
                    <div className="crew-break-option-main">
                      <Coffee size={16} style={{ color: option.value === 0 ? 'var(--text-tertiary)' : 'var(--lucky-gold)' }} />
                      <span className="crew-break-option-label">{option.label}</span>
                    </div>
                    <span className="crew-break-option-desc">{option.description}</span>
                  </button>
                ))}
              </div>

              <div style={{
                marginTop: 'var(--space-md)', padding: '10px 12px', borderRadius: '8px',
                background: 'rgba(85, 158, 79, 0.06)', border: '1px solid rgba(85, 158, 79, 0.15)',
                fontSize: '0.72rem', color: 'var(--text-tertiary)'
              }}>
                💡 <strong>Tip:</strong> Rest breaks (15 min) are typically paid. Meal breaks (30+ min) are typically unpaid. Check your local labor laws.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rich Job Card Component ────────────────────────────────
function JobCard({ job, getCustomer, getQuote, showDate }) {
  const customer = job.customerId ? getCustomer(job.customerId) : null;
  const quote = job.quoteId ? getQuote(job.quoteId) : null;

  const customerInitials = customer
    ? `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}`.toUpperCase()
    : '??';

  const fullAddress = job.address || (customer?.address
    ? `${customer.address}${customer.city ? `, ${customer.city}` : ''}${customer.state ? ` ${customer.state}` : ''} ${customer.zip || ''}`.trim()
    : '');

  const mapsUrl = fullAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`
    : '';

  const priorityAccent = job.priority === 'urgent' ? 'var(--status-danger)'
    : job.priority === 'high' ? 'var(--status-warning)'
    : job.priority === 'normal' ? 'var(--lucky-green)'
    : 'var(--text-tertiary)';

  return (
    <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="crew-job-card" style={{ '--card-accent': priorityAccent }}>
        {/* Header — title + priority */}
        <div className="crew-job-card-header">
          <div>
            <div className="crew-job-card-title">{job.title}</div>
            <div className="crew-job-card-time">
              <Clock size={13} />
              {showDate && <span>{formatDate(job.scheduledDate)} • </span>}
              {job.scheduledTime ? formatTime12(job.scheduledTime) : 'Time TBD'}
              {job.estimatedDuration && (
                <span style={{ marginLeft: '8px', color: 'var(--text-tertiary)' }}>
                  <Timer size={12} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                  {job.estimatedDuration}
                </span>
              )}
            </div>
          </div>
          {job.priority && (
            <span className={`crew-job-card-priority ${job.priority}`}>
              {job.priority}
            </span>
          )}
        </div>

        {/* Customer Info */}
        {customer && (
          <div className="crew-job-card-customer">
            <div className="crew-job-card-customer-avatar">{customerInitials}</div>
            <div className="crew-job-card-customer-info">
              <div className="crew-job-card-customer-name">
                {customer.firstName} {customer.lastName || ''}
              </div>
              {customer.phone && (
                <div className="crew-job-card-customer-detail">
                  <Phone size={11} />
                  <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()}>
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="crew-job-card-customer-detail">
                  <Mail size={11} />
                  <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()}>
                    {customer.email}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Address with Map Link */}
        {fullAddress && (
          <div className="crew-job-card-address">
            <MapPin size={14} />
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                {fullAddress}
              </a>
            ) : (
              <span>{fullAddress}</span>
            )}
          </div>
        )}

        {/* Crew Notes */}
        {job.crewNotes && (
          <div className="crew-job-card-notes">
            {job.crewNotes}
          </div>
        )}

        {/* Footer — tags */}
        <div className="crew-job-card-footer">
          {quote && (
            <span className="crew-job-card-tag">
              <FileText size={12} />
              Quote #{quote.quoteNumber}
            </span>
          )}
          {job.status && (
            <span className="crew-job-card-tag" style={{ textTransform: 'capitalize' }}>
              <Flag size={12} />
              {job.status.replace('_', ' ')}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            Tap for details <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
          </span>
        </div>
      </div>
    </Link>
  );
}
