'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { Save, Building2, DollarSign, Users, X, Mail, Loader2, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { services, teamMembers, loadTeamMembers } = useData();
  const [activeTab, setActiveTab] = useState('company');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteState, setInviteState] = useState({ loading: false, success: false, error: null });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [toast, setToast] = useState(null);

  const tabs = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'rates', label: 'Service Rates', icon: DollarSign },
    { id: 'team', label: 'Team', icon: Users },
  ];

  // Group services by category
  const servicesByCategory = {};
  services.forEach(s => {
    if (!servicesByCategory[s.category]) servicesByCategory[s.category] = [];
    servicesByCategory[s.category].push(s);
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const openInviteModal = () => {
    setInviteEmail('');
    setInviteName('');
    setInviteRole('member');
    setInviteState({ loading: false, success: false, error: null });
    setShowInviteModal(true);
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;

    setInviteState({ loading: true, success: false, error: null });

    try {
      const res = await fetch('/api/invite-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName || inviteEmail.split('@')[0],
          role: inviteRole,
          orgId: user?.orgId,
          orgName: user?.orgName,
          invitedBy: user?.fullName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setInviteState({ loading: false, success: true, error: null });

      // Reload team members
      if (loadTeamMembers) await loadTeamMembers();

      setTimeout(() => {
        setShowInviteModal(false);
        showToast('success', `Invitation sent to ${inviteEmail}`);
      }, 1500);
    } catch (err) {
      console.error('Invite error:', err);
      setInviteState({ loading: false, success: false, error: err.message });
    }
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Role colors
  const roleColors = {
    owner: 'tag-gold',
    admin: 'tag-blue',
    member: 'tag-green',
    viewer: 'tag-gray',
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Settings</h1>
          <p>Manage your organization and service configuration.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tabs" style={{ marginBottom: 'var(--space-xl)' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Company Profile */}
      {activeTab === 'company' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Company Profile</h3>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="form-input" defaultValue={user?.orgName || 'Lucky Landscapes'} />
          </div>
          <div className="form-group">
            <label className="form-label">Industry</label>
            <select className="form-select" defaultValue="landscaping">
              <option value="landscaping">Landscaping</option>
              <option value="construction">Construction</option>
              <option value="plumbing">Plumbing</option>
              <option value="hvac">HVAC</option>
              <option value="electrical">Electrical</option>
              <option value="painting">Painting</option>
              <option value="cleaning">Cleaning</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" defaultValue="(402) 405-5475" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" defaultValue="rileykopf@luckylandscapes.com" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" defaultValue="109 South Canopy ST" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" defaultValue="Lincoln" />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input className="form-input" defaultValue="NE" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Website</label>
            <input className="form-input" defaultValue="https://luckylandscapes.com" />
          </div>
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-primary">
              <Save size={16} /> Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Service Rates */}
      {activeTab === 'rates' && (
        <div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 'var(--space-lg)' }}>
            Configure your default service rates. These are used as starting prices when building quotes.
          </p>
          {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <div key={category} className="table-wrapper" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="table-header">
                <h3>{category}</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Unit</th>
                    <th>Default Price</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryServices.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ color: 'var(--text-tertiary)' }}>per {s.unit}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>$</span>
                          <input
                            className="form-input"
                            type="number"
                            defaultValue={s.defaultPrice}
                            style={{ width: '120px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-primary">
              <Save size={16} /> Save Rates
            </button>
          </div>
        </div>
      )}

      {/* Team */}
      {activeTab === 'team' && (
        <div style={{ maxWidth: '700px' }}>
          <div className="table-wrapper">
            <div className="table-header">
              <h3>Team Members</h3>
              <button className="btn btn-primary btn-sm" onClick={openInviteModal}>
                <UserPlus size={14} /> Invite Member
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Current user (always shown) */}
                <tr>
                  <td>
                    <div className="table-customer-cell">
                      <div className="table-avatar" style={{ background: 'var(--lucky-green)', color: 'white' }}>
                        {getInitials(user?.fullName)}
                      </div>
                      <div>
                        <div className="table-name">{user?.fullName}</div>
                        <div className="table-sub">{user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="tag tag-gold">Owner</span>
                  </td>
                  <td>
                    <span className="badge badge-accepted">
                      <span className="badge-dot" /> Active
                    </span>
                  </td>
                </tr>

                {/* Other team members from DB */}
                {(teamMembers || [])
                  .filter(m => m.email !== user?.email)
                  .map(member => (
                    <tr key={member.id}>
                      <td>
                        <div className="table-customer-cell">
                          <div className="table-avatar" style={{
                            background: member.isActive ? 'var(--status-info-bg)' : 'var(--bg-elevated)',
                            color: member.isActive ? 'var(--status-info)' : 'var(--text-tertiary)',
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
                        <span className={`tag ${roleColors[member.role] || 'tag-gray'}`}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      </td>
                      <td>
                        {member.isActive ? (
                          <span className="badge badge-accepted">
                            <span className="badge-dot" /> Active
                          </span>
                        ) : (
                          <span className="badge badge-sent">
                            <span className="badge-dot" /> Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 'var(--space-md)', textAlign: 'center', padding: 'var(--space-xl)' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
              Invite crew leads and team members to give them access to the app.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={openInviteModal}>
              <UserPlus size={14} /> Invite Team Member
            </button>
          </div>
        </div>
      )}

      {/* ========== INVITE MODAL ========== */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => !inviteState.loading && setShowInviteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2><UserPlus size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Invite Team Member</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !inviteState.loading && setShowInviteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {inviteState.success ? (
                <div className="send-success-state">
                  <div className="send-success-icon">
                    <CheckCircle size={48} />
                  </div>
                  <h3>Invitation Sent!</h3>
                  <p>An invitation email has been sent to {inviteEmail}</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      Email Address <span className="required">*</span>
                    </label>
                    <input
                      className="form-input"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@email.com"
                      disabled={inviteState.loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="John Smith"
                      disabled={inviteState.loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      disabled={inviteState.loading}
                    >
                      <option value="worker">Worker — Crew member</option>
                      <option value="admin">Admin — Full access</option>
                      <option value="member">Member — Can create & edit</option>
                      <option value="viewer">Viewer — Read-only access</option>
                    </select>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      {inviteRole === 'worker' && 'Sees assigned jobs, clock in/out, customer info for their jobs. Mobile-optimized.'}
                      {inviteRole === 'admin' && 'Can manage customers, quotes, catalog, and team settings.'}
                      {inviteRole === 'member' && 'Can create and edit customers and quotes. Cannot manage team.'}
                      {inviteRole === 'viewer' && 'Can view all data but cannot create or edit anything.'}
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--status-info-bg)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-sm)',
                    fontSize: '0.82rem',
                    color: 'var(--status-info)',
                  }}>
                    <Mail size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>An invitation email will be sent. They&apos;ll automatically join {user?.orgName || 'your organization'} when they accept.</span>
                  </div>

                  {inviteState.error && (
                    <div style={{
                      background: 'var(--status-danger-bg)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-md)',
                      marginTop: 'var(--space-md)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-sm)',
                      fontSize: '0.82rem',
                      color: 'var(--status-danger)',
                    }}>
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{inviteState.error}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {!inviteState.success && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowInviteModal(false)} disabled={inviteState.loading}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleInvite}
                  disabled={!inviteEmail || inviteState.loading}
                >
                  {inviteState.loading ? (
                    <>
                      <Loader2 size={16} className="spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Send Invitation
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
