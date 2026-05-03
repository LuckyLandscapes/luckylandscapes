'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { apiFetch } from '@/lib/apiClient';
import {
  Users, Clock, DollarSign, UserPlus, Edit2, Save, X, Trash2,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader2, Send, Mail, Key,
  HardHat, Truck, Coffee, Pencil,
} from 'lucide-react';

// ─── Datetime helpers ─────────────────────────────────────
// HTML5 <input type="datetime-local"> uses local-tz strings (no Z suffix).
// We round-trip through Date so what you see in the input matches what's
// stored as an ISO timestamp.
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fmtDur(min) {
  if (!min || min <= 0) return '0h 0m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function computeDurationMinutes(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  return (new Date(clockOut) - new Date(clockIn)) / 60000;
}

function fmtCurrency(n) {
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(n);
}

export default function TeamPage() {
  const { user } = useAuth();
  const { teamMembers, timeEntries, timeSegments, jobs, updateTeamMember, loadTeamMembers, updateTimeEntry, deleteTimeEntry, addTeamMemberFromApi } = useData();
  const [editingId, setEditingId] = useState(null);
  const [editRate, setEditRate] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
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

  // Payroll data per member.
  //
  // For paid hours we prefer SEGMENTS when an entry has them: paid = sum of
  // (job + travel) durations. Falls back to the legacy
  // (clock_out - clock_in - break_minutes) for entries logged before the
  // segment system landed.
  const payrollData = useMemo(() => {
    return teamMembers.map(member => {
      const entries = timeEntries.filter(t =>
        t.teamMemberId === member.id && t.clockOut && new Date(t.clockIn) >= cutoffDate
      );
      let totalMinutes = 0;
      let totalBreakMinutes = 0;
      for (const t of entries) {
        const segs = (timeSegments || []).filter(s => s.timeEntryId === t.id);
        if (segs.length > 0) {
          const paidMins = segs.filter(s => s.kind !== 'break').reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
          const breakMins = segs.filter(s => s.kind === 'break').reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
          totalMinutes += paidMins;
          totalBreakMinutes += breakMins;
        } else {
          const shiftMins = computeDurationMinutes(t.clockIn, t.clockOut);
          const breakMins = Number(t.breakMinutes || 0);
          totalMinutes += Math.max(0, (shiftMins || 0) - breakMins);
          totalBreakMinutes += breakMins;
        }
      }
      const totalHours = totalMinutes / 60;
      const totalPay = totalHours * (member.hourlyRate || 15);
      const activeEntry = timeEntries.find(t => t.teamMemberId === member.id && !t.clockOut);
      return { member, entries, totalMinutes, totalBreakMinutes, totalHours, totalPay, activeEntry };
    });
  }, [teamMembers, timeEntries, timeSegments, cutoffDate]);

  const totalPayroll = payrollData.reduce((s, d) => s + d.totalPay, 0);
  const totalHours = payrollData.reduce((s, d) => s + d.totalHours, 0);
  const clockedInCount = payrollData.filter(d => d.activeEntry).length;

  const startEdit = (member) => {
    setEditingId(member.id);
    setEditRate(String(member.hourlyRate || 15));
    setEditRole(member.role);
    setEditName(member.fullName || '');
    setEditEmail(member.email || '');
    setEditPassword('');
    setEditError(null);
  };

  const saveEdit = async (id) => {
    setEditSaving(true);
    setEditError(null);
    try {
      // Update local fields (role, rate)
      await updateTeamMember(id, {
        hourlyRate: parseFloat(editRate) || 15,
        role: editRole,
        fullName: editName,
        email: editEmail,
      });

      // Update auth credentials (name, email, password) via server API
      const member = teamMembers.find(m => m.id === id);
      const authPayload = { memberId: id, orgId: user?.orgId };
      if (editName && editName !== member?.fullName) authPayload.fullName = editName;
      if (editEmail && editEmail !== member?.email) authPayload.email = editEmail;
      if (editPassword) authPayload.password = editPassword;

      if (authPayload.fullName || authPayload.email || authPayload.password) {
        const res = await apiFetch('/api/update-member', {
          method: 'POST',
          body: JSON.stringify(authPayload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update credentials');
      }

      setEditingId(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
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
      const res = await apiFetch('/api/invite-member', {
        method:'POST',
        body: JSON.stringify({
          email: inviteEmail,
          password: invitePassword,
          fullName: inviteName || inviteEmail.split('@')[0],
          role: inviteRole,
          hourlyRate: parseFloat(inviteRate) || 15,
          orgName: user?.orgName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create member');
      setInviteState({ loading:false, success:true, error:null });

      // Reload team list from Supabase
      if (loadTeamMembers) await loadTeamMembers();

      // Fallback: if RLS blocked the reload from seeing the new member,
      // inject the API-returned record directly into state
      if (data.member) {
        addTeamMemberFromApi(data.member);
      }

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
                        {isEditing ? (
                          <>
                            <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)}
                              style={{ width:'160px', padding:'4px 8px', fontSize:'0.82rem', marginBottom:'2px' }}
                              onClick={e => e.stopPropagation()} placeholder="Full Name" />
                            <input className="form-input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                              style={{ width:'160px', padding:'4px 8px', fontSize:'0.78rem' }}
                              onClick={e => e.stopPropagation()} placeholder="Email" />
                          </>
                        ) : (
                          <>
                            <div className="table-name">{member.fullName}</div>
                            <div className="table-sub">{member.email}</div>
                          </>
                        )}
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
                        <button className="btn btn-icon btn-ghost" onClick={() => saveEdit(member.id)} title="Save" disabled={editSaving}>
                          {editSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                        </button>
                        <button className="btn btn-icon btn-ghost" onClick={() => { setEditingId(null); setEditError(null); }} title="Cancel"><X size={14} /></button>
                      </div>
                    ) : (
                      <button className="btn btn-icon btn-ghost" onClick={() => startEdit(member)} title="Edit"><Edit2 size={14} /></button>
                    )}
                  </td>
                </tr>,
                // Password field when editing
                isEditing && (
                  <tr key={`${member.id}-edit-extra`}>
                    <td colSpan={7} style={{ padding:0 }}>
                      <div style={{ background:'var(--bg-elevated)', padding:'var(--space-sm) var(--space-md)', borderTop:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:'var(--space-md)', flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-sm)' }}>
                          <Key size={14} style={{ color:'var(--text-tertiary)' }} />
                          <span style={{ fontSize:'0.78rem', color:'var(--text-tertiary)' }}>New Password:</span>
                          <input className="form-input" type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)}
                            style={{ width:'180px', padding:'4px 8px', fontSize:'0.82rem' }}
                            placeholder="Leave blank to keep current" minLength={6} />
                        </div>
                        {editError && (
                          <div style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'0.78rem', color:'var(--status-danger)' }}>
                            <AlertCircle size={14} /> {editError}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
                // Expanded time log
                isExpanded && !isEditing && (
                  <tr key={`${member.id}-detail`}>
                    <td colSpan={7} style={{ padding:0 }}>
                      <div style={{ background:'var(--bg-elevated)', padding:'var(--space-md)', borderTop:'1px solid var(--border-subtle)' }}>
                        <h4 style={{ margin:'0 0 var(--space-sm)', fontSize:'0.85rem' }}>Time Log — {member.fullName}</h4>
                        <TimeLog memberId={member.id} timeEntries={timeEntries} timeSegments={timeSegments} jobs={jobs} updateTimeEntry={updateTimeEntry} deleteTimeEntry={deleteTimeEntry} />
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

// Sub-component: Time log for a member.
//
// Each row is one shift (a closed time_entries row). Click chevron to expand
// and see the per-segment breakdown (job / travel / break). The pencil icon
// opens an edit modal; the trash icon prompts a delete. Both are owner-gated
// at the page level (Team & Payroll is in the owner-only sidebar).
function TimeLog({ memberId, timeEntries, timeSegments = [], jobs = [], updateTimeEntry, deleteTimeEntry }) {
  const [openRow, setOpenRow] = useState(null);
  const [editing, setEditing] = useState(null); // entry being edited
  const [editForm, setEditForm] = useState({ clockIn: '', clockOut: '', breakMinutes: 0, notes: '' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const entries = timeEntries
    .filter(t => t.teamMemberId === memberId && t.clockOut)
    .sort((a,b) => new Date(b.clockIn) - new Date(a.clockIn))
    .slice(0, 20);

  const startEdit = (entry, hasSegs) => {
    setEditing({ ...entry, hasSegs });
    setEditForm({
      clockIn: isoToLocalInput(entry.clockIn),
      clockOut: isoToLocalInput(entry.clockOut),
      breakMinutes: Number(entry.breakMinutes || 0),
      notes: entry.notes || '',
    });
    setEditError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    const clockInIso = localInputToIso(editForm.clockIn);
    const clockOutIso = localInputToIso(editForm.clockOut);
    if (!clockInIso || !clockOutIso) {
      setEditError('Both clock-in and clock-out times are required.');
      return;
    }
    if (new Date(clockOutIso) <= new Date(clockInIso)) {
      setEditError('Clock-out must be after clock-in.');
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      await updateTimeEntry(editing.id, {
        clockIn: clockInIso,
        clockOut: clockOutIso,
        breakMinutes: Math.max(0, Number(editForm.breakMinutes) || 0),
        notes: editForm.notes,
      });
      setEditing(null);
    } catch (err) {
      console.error('updateTimeEntry failed', err);
      setEditError(err?.message || 'Could not save changes.');
    } finally {
      setEditBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await deleteTimeEntry(deleteId);
      setDeleteId(null);
    } catch (err) {
      console.error('deleteTimeEntry failed', err);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (entries.length === 0) {
    return <p style={{ color:'var(--text-tertiary)', fontSize:'0.82rem' }}>No time entries yet.</p>;
  }

  return (
    <>
      <table style={{ width:'100%', fontSize:'0.82rem' }}>
        <thead><tr><th></th><th>Date</th><th>In</th><th>Out</th><th>Shift</th><th>Break</th><th>Paid</th><th>Notes</th><th style={{ width:60 }}></th></tr></thead>
        <tbody>
          {entries.map(e => {
            const segs = timeSegments.filter(s => s.timeEntryId === e.id);
            const hasSegs = segs.length > 0;
            const shiftMins = computeDurationMinutes(e.clockIn, e.clockOut);
            // Prefer segment math when available
            const breakMins = hasSegs
              ? segs.filter(s => s.kind === 'break').reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0)
              : Number(e.breakMinutes || 0);
            const paidMins = hasSegs
              ? segs.filter(s => s.kind !== 'break').reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0)
              : Math.max(0, shiftMins - breakMins);
            const isOpen = openRow === e.id;
            return [
              <tr key={e.id}>
                <td style={{ color:'var(--text-tertiary)', width:18, cursor: hasSegs ? 'pointer' : 'default' }} onClick={() => hasSegs && setOpenRow(isOpen ? null : e.id)}>
                  {hasSegs ? (isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
                </td>
                <td>{new Date(e.clockIn).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
                <td>{new Date(e.clockIn).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</td>
                <td>{new Date(e.clockOut).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</td>
                <td style={{ color:'var(--text-tertiary)' }}>{fmtDur(shiftMins)}</td>
                <td style={{ color: breakMins > 0 ? 'var(--lucky-gold)' : 'var(--text-tertiary)' }}>
                  {breakMins > 0 ? `${breakMins}m` : '—'}
                </td>
                <td style={{ fontWeight:600 }}>{fmtDur(paidMins)}</td>
                <td style={{ color:'var(--text-tertiary)', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.notes || '—'}</td>
                <td>
                  <div style={{ display:'flex', gap:'2px', justifyContent:'flex-end' }}>
                    <button className="btn btn-icon btn-ghost" title="Edit shift" onClick={() => startEdit(e, hasSegs)} style={{ padding:'4px' }}>
                      <Pencil size={12} />
                    </button>
                    <button className="btn btn-icon btn-ghost" title="Delete shift" onClick={() => setDeleteId(e.id)} style={{ padding:'4px', color:'var(--status-danger)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>,
              hasSegs && isOpen && (
                <tr key={`${e.id}-segs`}>
                  <td colSpan={9} style={{ padding:'0', background:'var(--bg-card)' }}>
                    <div style={{ padding:'8px 16px 12px 38px' }}>
                      {segs
                        .slice()
                        .sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt))
                        .map(s => {
                          const job = s.jobId ? jobs.find(j => j.id === s.jobId) : null;
                          const Icon = s.kind === 'job' ? HardHat : s.kind === 'travel' ? Truck : Coffee;
                          const tint = s.kind === 'break' ? 'var(--lucky-gold)' : s.kind === 'travel' ? '#63b3ff' : 'var(--lucky-green-light)';
                          const label = s.kind === 'job' ? (job?.title || 'Job') : s.kind === 'travel' ? 'Travel / Yard' : 'Break';
                          return (
                            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', fontSize:'0.78rem' }}>
                              <Icon size={12} style={{ color: tint, flexShrink:0 }} />
                              <span style={{ minWidth:140, fontWeight:600 }}>{label}</span>
                              <span style={{ color:'var(--text-tertiary)' }}>
                                {new Date(s.startedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
                                {s.endedAt && <> → {new Date(s.endedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</>}
                              </span>
                              <span style={{ color:'var(--text-secondary)' }}>{fmtDur(Number(s.durationMinutes||0))}</span>
                              {s.notes && (
                                <span style={{ color:'var(--lucky-gold)', fontStyle:'italic', fontSize:'0.75rem' }}>{s.notes}</span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>

      {/* Edit shift modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => !editBusy && setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:'440px' }}>
            <div className="modal-header">
              <h2><Pencil size={18} style={{ marginRight:8, verticalAlign:'middle' }} />Edit Shift</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setEditing(null)} disabled={editBusy}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Clock In</label>
                <input className="form-input" type="datetime-local" value={editForm.clockIn} onChange={ev => setEditForm(f => ({ ...f, clockIn: ev.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Clock Out</label>
                <input className="form-input" type="datetime-local" value={editForm.clockOut} onChange={ev => setEditForm(f => ({ ...f, clockOut: ev.target.value }))} />
              </div>
              {!editing.hasSegs && (
                <div className="form-group">
                  <label className="form-label">Break Minutes</label>
                  <input className="form-input" type="number" min={0} step={5} value={editForm.breakMinutes} onChange={ev => setEditForm(f => ({ ...f, breakMinutes: ev.target.value }))} />
                </div>
              )}
              {editing.hasSegs && (
                <div style={{ display:'flex', gap:8, padding:'10px 12px', background:'var(--status-info-bg)', borderRadius:'var(--radius-md)', color:'var(--status-info)', fontSize:'0.78rem', marginBottom:'var(--space-md)' }}>
                  <AlertCircle size={14} style={{ flexShrink:0, marginTop:2 }} />
                  <span>This shift has detailed segments — payroll math comes from those, not the entry-level break minutes. Editing the bounds here only changes shift display, not job-cost attribution. To re-do segment math, delete and have the worker re-clock.</span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={editForm.notes} onChange={ev => setEditForm(f => ({ ...f, notes: ev.target.value }))} placeholder="e.g. forgot to clock out, fixed manually" />
              </div>
              {editError && (
                <div style={{ display:'flex', gap:6, padding:'8px 12px', background:'var(--status-danger-bg)', color:'var(--status-danger)', borderRadius:'var(--radius-md)', fontSize:'0.78rem' }}>
                  <AlertCircle size={14} /> {editError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditing(null)} disabled={editBusy}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={editBusy}>
                {editBusy ? <><Loader2 size={14} className="spin" /> Saving</> : <><Save size={14} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleteBusy && setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:'400px' }}>
            <div className="modal-header">
              <h2><Trash2 size={18} style={{ marginRight:8, verticalAlign:'middle' }} />Delete Shift?</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setDeleteId(null)} disabled={deleteBusy}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:'0.85rem', marginBottom:8 }}>
                This permanently removes the shift and all its segments. Payroll totals will recompute.
              </p>
              <p style={{ fontSize:'0.78rem', color:'var(--text-tertiary)' }}>
                You can&apos;t undo this. If you just want to fix the times, use Edit instead.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleteBusy}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleteBusy}>
                {deleteBusy ? <><Loader2 size={14} className="spin" /> Deleting</> : <><Trash2 size={14} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
