'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarDays,
  User,
  MapPin,
} from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatTime12(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m)} ${ampm}`;
}

function getWeekDates(refDate) {
  const d = new Date(refDate);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(day.getDate() + i);
    return day;
  });
}

export default function CrewSchedulePage() {
  const { user } = useAuth();
  const { jobs, getCustomer } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const todayStr = fmtDate(new Date());

  const weekDates = getWeekDates(currentDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  // My jobs indexed by date
  const jobsByDate = useMemo(() => {
    if (!user?.id) return {};
    const map = {};
    jobs.forEach(j => {
      if (!j.scheduledDate || j.status === 'cancelled') return;
      const assigned = j.assignedTo || [];
      if (!Array.isArray(assigned) || !assigned.includes(user.id)) return;
      if (!map[j.scheduledDate]) map[j.scheduledDate] = [];
      map[j.scheduledDate].push(j);
    });
    // Sort each day by time
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || '')));
    return map;
  }, [jobs, user?.id]);

  const navigate = (dir) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const weekLabel = (() => {
    const s = weekStart;
    const e = weekEnd;
    const sMonth = s.toLocaleString('en-US', { month: 'short' });
    const eMonth = e.toLocaleString('en-US', { month: 'short' });
    if (s.getMonth() === e.getMonth()) {
      return `${sMonth} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`;
  })();

  const priorityColor = (priority) => {
    if (priority === 'urgent') return 'var(--status-danger)';
    if (priority === 'high') return 'var(--status-warning)';
    if (priority === 'normal') return 'var(--lucky-green)';
    return 'var(--text-tertiary)';
  };

  return (
    <div className="crew-schedule animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>My Schedule</h1>
          <p>Your assigned jobs for the week</p>
        </div>
      </div>

      {/* Nav */}
      <div className="crew-schedule-nav">
        <button className="btn btn-secondary btn-sm" onClick={goToday}>Today</button>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn btn-icon btn-ghost" onClick={() => navigate(-1)}>
            <ChevronLeft size={20} />
          </button>
          <button className="btn btn-icon btn-ghost" onClick={() => navigate(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
        <h2>{weekLabel}</h2>
      </div>

      {/* Week Grid */}
      <div className="crew-schedule-week">
        {weekDates.map((date, i) => {
          const dateStr = fmtDate(date);
          const isToday = dateStr === todayStr;
          const dayJobs = jobsByDate[dateStr] || [];

          return (
            <div key={i} className={`crew-schedule-day ${isToday ? 'today' : ''}`}>
              <div className="crew-schedule-day-header">
                <div className="crew-schedule-day-name">{DAYS[i]}</div>
                <div className="crew-schedule-day-num">{date.getDate()}</div>
              </div>

              {dayJobs.length === 0 ? (
                <div className="crew-schedule-empty">No jobs</div>
              ) : (
                dayJobs.map(job => {
                  const customer = job.customerId ? getCustomer(job.customerId) : null;
                  return (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div
                        className="crew-schedule-mini-card"
                        style={{ '--card-accent': priorityColor(job.priority) }}
                      >
                        <div className="crew-schedule-mini-card-title">{job.title}</div>
                        {job.scheduledTime && (
                          <div className="crew-schedule-mini-card-time">
                            <Clock size={10} />
                            {formatTime12(job.scheduledTime)}
                          </div>
                        )}
                        {customer && (
                          <div className="crew-schedule-mini-card-customer">
                            {customer.firstName} {customer.lastName?.[0] || ''}.
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
