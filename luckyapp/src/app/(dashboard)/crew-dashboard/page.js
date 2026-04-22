'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import {
  Clock, MapPin, Phone, FileText, ChevronRight, Play, Square,
  Calendar, HardHat, Navigation, User, Timer, CheckCircle2,
} from 'lucide-react';

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function formatDuration(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatTimeSince(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}
function formatDateShort(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
}

export default function CrewDashboardPage() {
  const { user } = useAuth();
  const { jobs, calendarEvents, getCustomer, getActiveTimeEntry, getMemberTimeEntries, clockIn, clockOut, timeEntries } = useData();
  const [clockOutNotes, setClockOutNotes] = useState('');
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);

  const memberId = user?.id;
  const todayStr = new Date().toISOString().split('T')[0];

  // Merge jobs assigned to me + calendar events assigned to me (deduplicate by jobId)
  const myTodayJobs = useMemo(() => {
    // Start with jobs directly assigned to me
    const directJobs = jobs.filter(j => j.scheduledDate === todayStr && (j.assignedTo || []).includes(memberId));
    const jobIds = new Set(directJobs.map(j => j.id));

    // Add calendar events assigned to me that don't have a matching job already included
    calendarEvents.forEach(e => {
      if (e.date !== todayStr) return;
      if (!(e.assignedTo || []).includes(memberId)) return;
      if (e.jobId && jobIds.has(e.jobId)) return; // already have the job
      // Convert calendar event to job-like shape for display
      directJobs.push({
        id: e.jobId || `evt-${e.id}`,
        title: e.title,
        scheduledDate: e.date,
        scheduledTime: e.startTime,
        status: 'scheduled',
        customerId: e.customerId,
        assignedTo: e.assignedTo || [],
        crewNotes: e.notes,
        description: e.notes,
        address: '',
      });
    });

    return directJobs.sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
  }, [jobs, calendarEvents, todayStr, memberId]);

  const myWeekJobs = useMemo(() => {
    const end = new Date(); end.setDate(end.getDate() + (6 - end.getDay()));
    const endStr = end.toISOString().split('T')[0];
    const directJobs = jobs.filter(j => j.scheduledDate > todayStr && j.scheduledDate <= endStr && (j.assignedTo || []).includes(memberId));
    const jobIds = new Set(directJobs.map(j => j.id));

    calendarEvents.forEach(e => {
      if (!e.date || e.date <= todayStr || e.date > endStr) return;
      if (!(e.assignedTo || []).includes(memberId)) return;
      if (e.jobId && jobIds.has(e.jobId)) return;
      directJobs.push({
        id: e.jobId || `evt-${e.id}`,
        title: e.title,
        scheduledDate: e.date,
        scheduledTime: e.startTime,
        status: 'scheduled',
        customerId: e.customerId,
        assignedTo: e.assignedTo || [],
        crewNotes: e.notes,
        description: e.notes,
        address: '',
      });
    });

    return directJobs.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, [jobs, calendarEvents, todayStr, memberId]);

  const activeEntry = getActiveTimeEntry(memberId);
  const recentEntries = getMemberTimeEntries(memberId, 7).filter(t => t.clockOut);

  const weekTotalMinutes = useMemo(() => {
    const sow = new Date(); sow.setDate(sow.getDate() - sow.getDay()); sow.setHours(0,0,0,0);
    return timeEntries.filter(t => t.memberId === memberId && t.clockOut && new Date(t.clockIn) >= sow)
      .reduce((s, t) => s + (t.durationMinutes || 0), 0);
  }, [timeEntries, memberId]);

  const handleClockIn = async () => { setClockLoading(true); await clockIn(memberId); setClockLoading(false); };
  const handleClockOut = async () => {
    if (!activeEntry) return;
    setClockLoading(true); await clockOut(activeEntry.id, clockOutNotes);
    setClockOutNotes(''); setShowClockOutModal(false); setClockLoading(false);
  };

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>{greeting}, {firstName} 👋</h1>
          <p>Here&apos;s your work schedule for today.</p>
        </div>
      </div>

      {/* Clock Card */}
      <div className="card" style={{
        marginBottom: 'var(--space-lg)',
        background: activeEntry ? 'linear-gradient(135deg, rgba(58,156,74,0.12), rgba(58,156,74,0.04))' : undefined,
        border: activeEntry ? '1px solid rgba(58,156,74,0.3)' : undefined,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'var(--space-md)' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'var(--space-sm)', marginBottom:'4px' }}>
              <Timer size={20} style={{ color: activeEntry ? 'var(--lucky-green-light)' : 'var(--text-tertiary)' }} />
              <h3 style={{ margin:0 }}>Time Clock</h3>
            </div>
            {activeEntry ? (
              <div style={{ fontSize:'0.85rem', color:'var(--lucky-green-light)' }}>
                <span className="badge badge-accepted" style={{ marginRight:'8px' }}><span className="badge-dot" /> Clocked In</span>
                {formatTimeSince(activeEntry.clockIn)} elapsed
              </div>
            ) : (
              <p style={{ color:'var(--text-tertiary)', fontSize:'0.85rem', margin:0 }}>Not clocked in • This week: {formatDuration(weekTotalMinutes)}</p>
            )}
          </div>
          {activeEntry ? (
            <button className="btn" onClick={() => setShowClockOutModal(true)} disabled={clockLoading}
              style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', minWidth:'140px' }}>
              <Square size={16} fill="currentColor" /> Clock Out
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleClockIn} disabled={clockLoading} style={{ minWidth:'140px' }}>
              <Play size={16} fill="currentColor" /> Clock In
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', marginBottom:'var(--space-lg)' }}>
        <div className="stat-card" style={{ '--accent':'var(--lucky-green-light)', '--accent-bg':'var(--lucky-green-glow)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><HardHat /></div></div>
          <div className="stat-card-value">{myTodayJobs.length}</div>
          <div className="stat-card-label">Jobs Today</div>
        </div>
        <div className="stat-card" style={{ '--accent':'var(--status-info)', '--accent-bg':'var(--status-info-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><Calendar /></div></div>
          <div className="stat-card-value">{myWeekJobs.length}</div>
          <div className="stat-card-label">More This Week</div>
        </div>
        <div className="stat-card" style={{ '--accent':'var(--lucky-gold)', '--accent-bg':'rgba(212,169,62,0.12)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><Clock /></div></div>
          <div className="stat-card-value">{formatDuration(weekTotalMinutes)}</div>
          <div className="stat-card-label">Hours This Week</div>
        </div>
      </div>

      {/* Today's Jobs */}
      <h3 style={{ marginBottom:'var(--space-md)' }}><HardHat size={18} style={{ verticalAlign:'middle', marginRight:'8px' }} />Today&apos;s Jobs</h3>
      {myTodayJobs.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'var(--space-xl)', color:'var(--text-tertiary)' }}>
          <CheckCircle2 size={32} style={{ margin:'0 auto var(--space-sm)', display:'block', opacity:0.5 }} />
          <p style={{ margin:0, fontSize:'0.9rem' }}>No jobs scheduled for today.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-sm)', marginBottom:'var(--space-xl)' }}>
          {myTodayJobs.map(job => {
            const cust = job.customerId ? getCustomer(job.customerId) : null;
            return (
              <div key={job.id} className="card" style={{ padding:'var(--space-md)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-sm)' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'2px' }}>{job.title}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.82rem', color:'var(--text-tertiary)' }}>
                      <Clock size={13} /> {job.scheduledTime ? formatTime12(job.scheduledTime) : 'TBD'}
                      {job.estimatedDuration && <span>• {job.estimatedDuration}</span>}
                    </div>
                  </div>
                  <span className={`badge badge-${job.status}`}><span className="badge-dot" />{job.status.charAt(0).toUpperCase()+job.status.slice(1)}</span>
                </div>
                {cust && (
                  <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'var(--space-sm) var(--space-md)', marginBottom:'var(--space-sm)', fontSize:'0.85rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px', fontWeight:600 }}><User size={13} /> {cust.firstName} {cust.lastName||''}</div>
                    {cust.phone && <a href={`tel:${cust.phone}`} style={{ display:'flex', alignItems:'center', gap:'6px', color:'var(--lucky-green-light)', textDecoration:'none', marginBottom:'4px' }}><Phone size={13} /> {cust.phone}</a>}
                    {job.address && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:'6px', color:'var(--status-info)', textDecoration:'none' }}><Navigation size={13} /> {job.address}</a>}
                  </div>
                )}
                {(job.crewNotes||job.description) && (
                  <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', whiteSpace:'pre-wrap', padding:'var(--space-sm) 0', borderTop:'1px solid var(--border-subtle)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'4px', fontWeight:600, marginBottom:'4px', color:'var(--text-primary)' }}><FileText size={13} /> Notes</div>
                    {job.crewNotes||job.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of Week */}
      {myWeekJobs.length > 0 && (
        <div style={{ marginBottom:'var(--space-xl)' }}>
          <h3 style={{ marginBottom:'var(--space-md)' }}><Calendar size={18} style={{ verticalAlign:'middle', marginRight:'8px' }} />Coming Up This Week</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xs)' }}>
            {myWeekJobs.map(job => {
              const cust = job.customerId ? getCustomer(job.customerId) : null;
              return (
                <div key={job.id} className="card" style={{ padding:'var(--space-sm) var(--space-md)', display:'flex', alignItems:'center', gap:'var(--space-md)' }}>
                  <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'6px 10px', textAlign:'center', minWidth:'54px', fontSize:'0.75rem', fontWeight:700, color:'var(--text-tertiary)' }}>
                    {formatDateShort(job.scheduledDate)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{job.title}</div>
                    <div style={{ fontSize:'0.8rem', color:'var(--text-tertiary)' }}>
                      {job.scheduledTime ? formatTime12(job.scheduledTime) : 'TBD'}{cust && ` • ${cust.firstName} ${cust.lastName||''}`}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color:'var(--text-tertiary)' }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Time Entries */}
      {recentEntries.length > 0 && (
        <div>
          <h3 style={{ marginBottom:'var(--space-md)' }}><Clock size={18} style={{ verticalAlign:'middle', marginRight:'8px' }} />Recent Hours</h3>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Duration</th></tr></thead>
              <tbody>
                {recentEntries.slice(0,10).map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight:600 }}>{new Date(e.clockIn).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</td>
                    <td>{new Date(e.clockIn).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</td>
                    <td>{e.clockOut ? new Date(e.clockOut).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : '—'}</td>
                    <td style={{ fontWeight:600, color:'var(--lucky-green-light)' }}>{formatDuration(e.durationMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clock Out Modal */}
      {showClockOutModal && (
        <div className="modal-overlay" onClick={() => !clockLoading && setShowClockOutModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:'420px' }}>
            <div className="modal-header">
              <h2><Square size={18} style={{ marginRight:'8px', verticalAlign:'middle' }} /> Clock Out</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowClockOutModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', textAlign:'center', marginBottom:'var(--space-md)' }}>
                <div style={{ fontSize:'2rem', fontWeight:800, color:'var(--lucky-green-light)' }}>{activeEntry ? formatTimeSince(activeEntry.clockIn) : '—'}</div>
                <div style={{ fontSize:'0.82rem', color:'var(--text-tertiary)' }}>Time worked this session</div>
              </div>
              <div className="form-group">
                <label className="form-label">End of day notes (optional)</label>
                <textarea className="form-input" rows={3} placeholder="Any notes about today's work..." value={clockOutNotes} onChange={e => setClockOutNotes(e.target.value)} style={{ resize:'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClockOutModal(false)} disabled={clockLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleClockOut} disabled={clockLoading} style={{ background:'#ef4444', borderColor:'#ef4444' }}>
                {clockLoading ? '⏳ Clocking out...' : '⏹ Confirm Clock Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
