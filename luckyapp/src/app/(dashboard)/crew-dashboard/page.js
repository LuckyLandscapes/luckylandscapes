'use client';

import { useMemo } from 'react';
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

const PRIORITY_COLORS = {
  low: 'var(--text-tertiary)',
  normal: 'var(--status-info)',
  high: 'var(--status-warning)',
  urgent: 'var(--status-danger)',
};

export default function CrewDashboardPage() {
  const { user } = useAuth();
  const { jobs, getCustomer, getQuote, timeEntries, clockIn, clockOut } = useData();

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = new Date().toISOString().split('T')[0];

  // Get active clock entry for this user
  const activeClockEntry = useMemo(() => {
    return timeEntries.find(t => t.teamMemberId === user?.id && !t.clockOut);
  }, [timeEntries, user?.id]);

  // My jobs: filter by assignedTo containing my user ID
  const myJobs = useMemo(() => {
    if (!user?.id) return [];
    return jobs.filter(j => {
      const assigned = j.assignedTo || [];
      // assigned can be UUID[] or JSONB array
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

  const handleClockToggle = async () => {
    if (activeClockEntry) {
      await clockOut(activeClockEntry.id);
    } else {
      await clockIn(user.id);
    }
  };

  return (
    <div className="crew-dash animate-fade-in">
      {/* Header */}
      <div className="crew-dash-header">
        <div className="crew-dash-greeting">
          <h1>{greeting}, {firstName} 👷</h1>
          <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Clock Widget */}
      <div className="crew-clock-widget">
        <div className="crew-clock-status">
          <div className={`crew-clock-dot ${activeClockEntry ? 'active' : 'inactive'}`} />
          <span>{activeClockEntry ? 'Clocked In' : 'Clocked Out'}</span>
        </div>
        {activeClockEntry && (
          <div className="crew-clock-time">
            Since {new Date(activeClockEntry.clockIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
        )}
        <button
          className={`btn ${activeClockEntry ? 'btn-danger' : 'btn-primary'} btn-sm`}
          onClick={handleClockToggle}
          style={{ marginLeft: 'auto' }}
        >
          <Clock size={14} />
          {activeClockEntry ? 'Clock Out' : 'Clock In'}
        </button>
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
    <Link href={`/calendar/job/${job.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
