'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import {
  Users, Clock, DollarSign, UserPlus, Edit2, Save, X, Trash2,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader2, Send, Mail,
} from 'lucide-react';

function fmtDur(min) {
  if (!min) return '0h 0m';
  return `${Math.floor(min/60)}h ${min%60}m`;
}
function fmtCurrency(n) {
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(n);
}

export default function TeamPage() {
  const { user } = useAuth();
  const { teamMembers, timeEntries, updateTeamMember, loadTeamMembers, deleteTimeEntry } = useData();
  const [editingId, setEditingId] = useState(null);
  const [editRate, setEditRate] = useState('');
  const [editRole, setEditRole] = useState('');
  const [dateRange, setDateRange] = useState('week'); // 'week', 'biweek', 'month'
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteConfirmPw, setInviteConfirmPw] = useState('');
  const [inviteRole, setInviteRole] = useState('worker');
  const [inviteRate, setInviteRate] = useState('15');
  const [inviteState, setInviteState] = useState({ loading:false, success:false, error:null });
  const [expandedMember, setExpandedMember] = useState(null);

  // Date range cutoff
  const cutoffDate = useMemo(() => {
    const d = new Date();
    if (dateRange === 'week') { d.setDate(d.getDate() - d.getDay()); }
    else if (dateRange === 'biweek') { d.setDate(d.getDate() - 14); }
    else { d.setDate(d.getDate() - 30); }
    d.setHours(0,0,0,0);
    return d;
  }, [dateRange]);

  // Payroll data per member
  const payrollData = useMemo(() => {
    return teamMembers.map(member => {
      const entries = timeEntries.filter(t =>
        t.memberId === member.id && t.clockOut && new Date(t.clockIn) >= cutoffDate
      );
      const totalMinutes = entries.reduce((s, t) => s + (t.durationMinutes || 0), 0);
      const totalHours = totalMinutes / 60;
      const totalPay = totalHours * (member.hourlyRate || 15);
      const activeEntry = timeEntries.find(t => t.memberId === member.id && !t.clockOut);
      return { member, entries, totalMinutes, totalHours, totalPay, activeEntry };
    });
  }, [teamMembers, timeEntries, cutoffDate]);

  const totalPayroll = payrollData.reduce((s, d) => s + d.totalPay, 0);
  const totalHours = payrollData.reduce((s, d) => s + d.totalHours, 0);
  const clockedInCount = payrollData.filter(d => d.activeEntry).length;

  const startEdit = (member) => {
    setEditingId(member.id);
    setEditRate(String(member.hourlyRate || 15));
    setEditRole(member.role);
  };

  const saveEdit = async (id) => {
    await updateTeamMember(id, {
      hourlyRate: parseFloat(editRate) || 15,
      role: editRole,
    });
    setEditingId(null);
  };

  const getInitials = (name) => name ? name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) : '??';

  const roleColors = { owner:'tag-gold', admin:'tag-blue', worker:'tag-green', member:'tag-green', viewer:'tag-gray' };

  const handleInvite = async () => {
    if (!inviteEmail || !invitePassword) return;
    if (invitePassword !== inviteConfirmPw) {
      setInviteState({ loading:false, success:false, error:'Passwords do not match.' });
      return;
    }
    if (invitePassword.length < 6) {
      setInviteState({ loading:false, success:false, error:'Password must be at least 6 characters.' });
      return;
    }
    setInviteState({ loading:true, success:false, error:null });
    try {
      const res = await fetch('/api/invite-member', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          email: inviteEmail,
          password: invitePassword,
          fullName: inviteName || inviteEmail.split('@')[0],
          role: inviteRole,
          hourlyRate: parseFloat(inviteRate) || 15,
          orgId: user?.orgId,
          orgName: user?.orgName,
          invitedBy: user?.fullName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create member');
      setInviteState({ loading:false, success:true, error:null });
      if (loadTeamMembers) await loadTeamMembers();
      setTimeout(() => { setShowInviteModal(false); }, 2000);
    } catch (err) {
      setInviteState({ loading:false, success:false, error:err.message });
    }
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Team & Payroll</h1>
          <p>Manage your crew, track hours, and review payroll.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => {
            setInviteEmail(''); setInviteName(''); setInvitePassword(''); setInviteConfirmPw('');
            setInviteRole('worker'); setInviteRate('15');
            setInviteState({loading:false,success:false,error:null}); setShowInviteModal(true);
          }}>
            <UserPlus size={18} /> Add Member
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom:'var(--space-lg)' }}>
        <div className="stat-card" style={{ '--accent':'var(--lucky-green-light)', '--accent-bg':'var(--lucky-green-glow)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><Users /></div></div>
          <div className="stat-card-value">{clockedInCount}</div>
          <div className="stat-card-label">Currently Clocked In</div>
        </div>
        <div className="stat-card" style={{ '--accent':'var(--status-info)', '--accent-bg':'var(--status-info-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><Clock /></div></div>
          <div className="stat-card-value">{totalHours.toFixed(1)}h</div>
          <div className="stat-card-label">Total Hours ({dateRange === 'week' ? 'This Week' : dateRange === 'biweek' ? 'Last 2 Weeks' : 'This Month'})</div>
        </div>
        <div className="stat-card" style={{ '--accent':'var(--lucky-gold)', '--accent-bg':'rgba(212,169,62,0.12)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><DollarSign /></div></div>
          <div className="stat-card-value">{fmtCurrency(totalPayroll)}</div>
          <div className="stat-card-label">Est. Payroll ({dateRange === 'week' ? 'This Week' : dateRange === 'biweek' ? 'Last 2 Weeks' : 'This Month'})</div>
        </div>
      </div>

      {/* Date range picker */}
      <div style={{ display:'flex', alignItems:'center', gap:'var(--space-sm)', marginBottom:'var(--space-lg)' }}>
        <span style={{ fontSize:'0.82rem', color:'var(--text-tertiary)' }}>Period:</span>
        <div className="tabs">
          {[{id:'week',label:'This Week'},{id:'biweek',label:'2 Weeks'},{id:'month',label:'Month'}].map(r => (
            <button key={r.id} className={`tab ${dateRange===r.id?'active':''}`} onClick={() => setDateRange(r.id)}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Team Roster + Payroll */}
      <div className="table-wrapper">
        <div className="table-header">
          <h3>Team Roster & Payroll</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Rate</th>
              <th>Hours</th>
              <th>Pay</th>
              <th>Status</th>
              <th style={{ width:'60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {payrollData.map(({ member, totalMinutes, totalHours: hrs, totalPay, activeEntry: active }) => {
              const isEditing = editingId === member.id;
              const isExpanded = expandedMember === member.id;

              return [
                <tr key={member.id} style={{ cursor:'pointer' }} onClick={() => setExpandedMember(isExpanded ? null : member.id)}>
                  <td>
                    <div className="table-customer-cell">
                      <div className="table-avatar" style={{
                        background: active ? 'var(--lucky-green)' : member.isActive ? 'var(--status-info-bg)' : 'var(--bg-elevated)',
                        color: active ? '#fff' : member.isActive ? 'var(--status-info)' : 'var(--text-tertiary)',
                      }}>
                        {getInitials(member.fullName)}
                      </div>
                      <div>
                        <div className="table-name">{member.fullName}</div>
                        <div className="table-sub">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {isEditing ? (
                      <select className="form-select" value={editRole} onChange={e => setEditRole(e.target.value)} style={{ width:'110px', padding:'4px 8px', fontSize:'0.82rem' }} onClick={e => e.stopPropagation()}>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="worker">Worker</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`tag ${roleColors[member.role]||'tag-gray'}`}>{member.role.charAt(0).toUpperCase()+member.role.slice(1)}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'2px' }} onClick={e => e.stopPropagation()}>
                        <span style={{ color:'var(--text-tertiary)', fontSize:'0.82rem' }}>$</span>
                        <input className="form-input" type="number" value={editRate} onChange={e => setEditRate(e.target.value)}
                          style={{ width:'70px', padding:'4px 8px', fontSize:'0.82rem' }} step="0.50" min="0" />
                        <span style={{ color:'var(--text-tertiary)', fontSize:'0.75rem' }}>/hr</span>
                      </div>
                    ) : (
                      <span style={{ fontWeight:600 }}>${member.hourlyRate || 15}/hr</span>
                    )}
                  </td>
                  <td style={{ fontWeight:600 }}>{fmtDur(totalMinutes)}</td>
                  <td style={{ fontWeight:600, color:'var(--lucky-green-light)' }}>{fmtCurrency(totalPay)}</td>
                  <td>
                    {active ? (
                      <span className="badge badge-accepted"><span className="badge-dot" /> On Clock</span>
                    ) : member.isActive ? (
                      <span className="badge badge-sent"><span className="badge-dot" /> Active</span>
                    ) : (
                      <span className="badge badge-draft"><span className="badge-dot" /> Pending</span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {isEditing ? (
                      <div style={{ display:'flex', gap:'4px' }}>
                        <button className="btn btn-icon btn-ghost" onClick={() => saveEdit(member.id)} title="Save"><Save size={14} /></button>
                        <button className="btn btn-icon btn-ghost" onClick={() => setEditingId(null)} title="Cancel"><X size={14} /></button>
                      </div>
                    ) : (
                      <button className="btn btn-icon btn-ghost" onClick={() => startEdit(member)} title="Edit"><Edit2 size={14} /></button>
                    )}
                  </td>
                </tr>,
                // Expanded time log
                isExpanded && (
                  <tr key={`${member.id}-detail`}>
                    <td colSpan={7} style={{ padding:0 }}>
                      <div style={{ background:'var(--bg-elevated)', padding:'var(--space-md)', borderTop:'1px solid var(--border-subtle)' }}>
                        <h4 style={{ margin:'0 0 var(--space-sm)', fontSize:'0.85rem' }}>Time Log — {member.fullName}</h4>
                        <TimeLog memberId={member.id} timeEntries={timeEntries} />
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => !inviteState.loading && setShowInviteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:'480px' }}>
            <div className="modal-header">
              <h2><UserPlus size={20} style={{ marginRight:'8px', verticalAlign:'middle' }} /> Add Team Member</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !inviteState.loading && setShowInviteModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {inviteState.success ? (
                <div className="send-success-state">
                  <div className="send-success-icon"><CheckCircle size={48} /></div>
                  <h3>Member Added!</h3>
                  <p><strong>{inviteName || inviteEmail}</strong> can now log in at the login page with their email and the password you set.</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name <span className="required">*</span></label>
                    <input className="form-input" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="John Smith" disabled={inviteState.loading} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address <span className="required">*</span></label>
                    <input className="form-input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="worker@email.com" disabled={inviteState.loading} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Password <span className="required">*</span></label>
                      <input className="form-input" type="password" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="••••••••" disabled={inviteState.loading} minLength={6} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm Password <span className="required">*</span></label>
                      <input className="form-input" type="password" value={inviteConfirmPw} onChange={e => setInviteConfirmPw(e.target.value)} placeholder="••••••••" disabled={inviteState.loading} minLength={6}
                        style={inviteConfirmPw && invitePassword !== inviteConfirmPw ? {borderColor:'#ef4444'} : {}} />
                      {inviteConfirmPw && invitePassword !== inviteConfirmPw && (
                        <div style={{ color:'#ef4444', fontSize:'0.72rem', marginTop:'3px' }}>Passwords don&apos;t match</div>
                      )}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select className="form-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)} disabled={inviteState.loading}>
                        <option value="worker">Worker — Crew member</option>
                        <option value="admin">Admin — Full access</option>
                        <option value="viewer">Viewer — Read-only</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hourly Rate</label>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <span style={{ color:'var(--text-tertiary)' }}>$</span>
                        <input className="form-input" type="number" value={inviteRate} onChange={e => setInviteRate(e.target.value)} style={{ width:'80px' }} step="0.50" min="0" disabled={inviteState.loading} />
                        <span style={{ color:'var(--text-tertiary)', fontSize:'0.82rem' }}>/hr</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'var(--text-tertiary)', marginBottom:'var(--space-md)' }}>
                    {inviteRole === 'worker' && 'Workers see their schedule, job details, and can clock in/out. Mobile-optimized.'}
                    {inviteRole === 'admin' && 'Admins can manage customers, quotes, scheduling. Cannot view payroll.'}
                    {inviteRole === 'viewer' && 'Viewers can see all data but cannot edit anything.'}
                  </div>
                  <div style={{ background:'var(--status-info-bg)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', display:'flex', alignItems:'flex-start', gap:'var(--space-sm)', fontSize:'0.82rem', color:'var(--status-info)' }}>
                    <UserPlus size={16} style={{ flexShrink:0, marginTop:'2px' }} />
                    <span>This will create an account. Give them their email and the password you set — they can log in immediately.</span>
                  </div>
                  {inviteState.error && (
                    <div style={{ background:'var(--status-danger-bg)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', marginTop:'var(--space-md)', display:'flex', alignItems:'flex-start', gap:'var(--space-sm)', fontSize:'0.82rem', color:'var(--status-danger)' }}>
                      <AlertCircle size={16} style={{ flexShrink:0, marginTop:'2px' }} />
                      <span>{inviteState.error}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {!inviteState.success && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowInviteModal(false)} disabled={inviteState.loading}>Cancel</button>
                <button className="btn btn-primary" onClick={handleInvite} disabled={!inviteEmail || !invitePassword || inviteState.loading}>
                  {inviteState.loading ? <><Loader2 size={16} className="spin" /> Creating...</> : <><UserPlus size={16} /> Create Account</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Time log for a member
function TimeLog({ memberId, timeEntries }) {
  const entries = timeEntries
    .filter(t => t.memberId === memberId && t.clockOut)
    .sort((a,b) => new Date(b.clockIn) - new Date(a.clockIn))
    .slice(0, 20);

  if (entries.length === 0) {
    return <p style={{ color:'var(--text-tertiary)', fontSize:'0.82rem' }}>No time entries yet.</p>;
  }

  return (
    <table style={{ width:'100%', fontSize:'0.82rem' }}>
      <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Duration</th><th>Notes</th></tr></thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.id}>
            <td>{new Date(e.clockIn).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
            <td>{new Date(e.clockIn).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</td>
            <td>{new Date(e.clockOut).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</td>
            <td style={{ fontWeight:600 }}>{fmtDur(e.durationMinutes)}</td>
            <td style={{ color:'var(--text-tertiary)', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.notes || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
