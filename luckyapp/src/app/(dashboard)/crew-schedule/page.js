'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { ChevronLeft, ChevronRight, Clock, MapPin, User, HardHat, Calendar } from 'lucide-react';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function pad(n) { return String(n).padStart(2,'0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h%12||12}:${pad(m)} ${h>=12?'PM':'AM'}`;
}

function getWeekDates(date) {
  const s = new Date(date); s.setDate(s.getDate() - s.getDay());
  return Array.from({length:7}, (_,i) => { const d = new Date(s); d.setDate(d.getDate()+i); return d; });
}

export default function CrewSchedulePage() {
  const { user } = useAuth();
  const { jobs, calendarEvents, getCustomer } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const memberId = user?.id;
  const todayStr = fmtDate(new Date());

  const weekDates = getWeekDates(currentDate);

  // My jobs + calendar events grouped by date (deduplicated)
  const myJobsByDate = useMemo(() => {
    const map = {};

    // Add jobs assigned to me
    jobs.forEach(j => {
      if (!j.scheduledDate || !(j.assignedTo || []).includes(memberId)) return;
      if (!map[j.scheduledDate]) map[j.scheduledDate] = [];
      map[j.scheduledDate].push(j);
    });

    // Add calendar events assigned to me (deduplicate by jobId)
    calendarEvents.forEach(e => {
      if (!e.date || !(e.assignedTo || []).includes(memberId)) return;
      const dateJobs = map[e.date] || [];
      // Skip if we already have the linked job
      if (e.jobId && dateJobs.some(j => j.id === e.jobId)) return;
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push({
        id: e.jobId || `evt-${e.id}`,
        title: e.title,
        scheduledDate: e.date,
        scheduledTime: e.startTime,
        status: 'scheduled',
        customerId: e.customerId,
        assignedTo: e.assignedTo || [],
        crewNotes: e.notes,
        address: '',
      });
    });

    Object.values(map).forEach(arr => arr.sort((a,b) => (a.scheduledTime||'').localeCompare(b.scheduledTime||'')));
    return map;
  }, [jobs, calendarEvents, memberId]);

  const navigate = (dir) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const startDate = weekDates[0];
  const endDate = weekDates[6];
  const titleText = startDate.getMonth() === endDate.getMonth()
    ? `${startDate.toLocaleDateString('en-US',{month:'long'})} ${startDate.getDate()} – ${endDate.getDate()}, ${startDate.getFullYear()}`
    : `${startDate.toLocaleDateString('en-US',{month:'short'})} ${startDate.getDate()} – ${endDate.toLocaleDateString('en-US',{month:'short'})} ${endDate.getDate()}, ${endDate.getFullYear()}`;

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>My Schedule</h1>
          <p>Your assigned jobs for the week</p>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="cal-toolbar" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="cal-toolbar-left">
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())}>This Week</button>
          <div className="cal-nav-arrows">
            <button className="btn btn-icon btn-ghost" onClick={() => navigate(-1)}><ChevronLeft size={20} /></button>
            <button className="btn btn-icon btn-ghost" onClick={() => navigate(1)}><ChevronRight size={20} /></button>
          </div>
          <h2 className="cal-title">{titleText}</h2>
        </div>
      </div>

      {/* Week Grid */}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-sm)' }}>
        {weekDates.map(date => {
          const dateStr = fmtDate(date);
          const isToday = dateStr === todayStr;
          const dayJobs = myJobsByDate[dateStr] || [];

          return (
            <div key={dateStr} style={{
              borderRadius: 'var(--radius-lg)',
              border: isToday ? '1px solid rgba(58,156,74,0.4)' : '1px solid var(--border-subtle)',
              background: isToday ? 'rgba(58,156,74,0.05)' : 'var(--bg-card)',
              overflow: 'hidden',
            }}>
              {/* Day Header */}
              <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: dayJobs.length > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'var(--space-sm)' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem',
                    background: isToday ? 'var(--lucky-green)' : 'var(--bg-elevated)',
                    color: isToday ? '#fff' : 'var(--text-tertiary)',
                  }}>
                    {date.getDate()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isToday ? 'var(--lucky-green-light)' : 'var(--text-primary)' }}>
                      {DAYS[date.getDay()]}{isToday && ' (Today)'}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize:'0.75rem', color:'var(--text-tertiary)' }}>
                  {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Jobs */}
              {dayJobs.map(job => {
                const cust = job.customerId ? getCustomer(job.customerId) : null;
                return (
                  <div key={job.id} style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                  }}>
                    <div style={{
                      width: '4px', height: '36px', borderRadius: '2px',
                      background: 'var(--lucky-green)', flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{job.title}</div>
                      <div style={{ fontSize:'0.8rem', color:'var(--text-tertiary)', display:'flex', flexWrap:'wrap', gap:'8px' }}>
                        {job.scheduledTime && <span style={{ display:'flex', alignItems:'center', gap:'3px' }}><Clock size={11} /> {fmtTime12(job.scheduledTime)}</span>}
                        {cust && <span style={{ display:'flex', alignItems:'center', gap:'3px' }}><User size={11} /> {cust.firstName} {cust.lastName||''}</span>}
                        {job.address && <span style={{ display:'flex', alignItems:'center', gap:'3px' }}><MapPin size={11} /> {job.address.split(',')[0]}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {dayJobs.length === 0 && (
                <div style={{ padding:'var(--space-xs) var(--space-md)', fontSize:'0.8rem', color:'var(--text-tertiary)', opacity:0.5 }}>
                  No jobs
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
