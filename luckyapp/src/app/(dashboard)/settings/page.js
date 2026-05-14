'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { apiFetch } from '@/lib/apiClient';
import { Save, Building2, DollarSign, Users, X, Mail, Loader2, CheckCircle, AlertCircle, UserPlus, Percent } from 'lucide-react';
import {
  DEFAULT_CASH_DISCOUNT_PCT,
  getCashDiscountPct,
  estimateCardFee,
  effectiveCardFeePct,
} from '@/lib/paymentFees';

export default function SettingsPage() {
  const { user } = useAuth();
  const { services, teamMembers, loadTeamMembers, org, updateOrgSettings } = useData();
  const [activeTab, setActiveTab] = useState('company');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteState, setInviteState] = useState({ loading: false, success: false, error: null });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [toast, setToast] = useState(null);
  const [cashDiscountInput, setCashDiscountInput] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);

  // Sync the input with the stored value when org loads
  useEffect(() => {
    if (org) setCashDiscountInput(String(getCashDiscountPct(org)));
  }, [org]);

  const tabs = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'rates', label: 'Service Rates', icon: DollarSign },
    { id: 'payments', label: 'Payments', icon: Percent },
    { id: 'team', label: 'Team', icon: Users },
  ];

  const handleSaveDiscount = async () => {
    const pct = parseFloat(cashDiscountInput);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      showToast('error', 'Enter a number between 0 and 50.');
      return;
    }
    setSavingDiscount(true);
    try {
      await updateOrgSettings({ cash_discount_percent: pct });
      showToast('success', `Cash discount set to ${pct}%.`);
    } catch (err) {
      showToast('error', err?.message || 'Could not save.');
    } finally {
      setSavingDiscount(false);
    }
  };

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
      const res = await apiFetch('/api/invite-member', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName || inviteEmail.split('@')[0],
          role: inviteRole,
          orgName: user?.orgName,
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

      {/* Payments */}
      {activeTab === 'payments' && (
        <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-md)' }}>Cash Discount</h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
              Show customers a discount for paying by cash, check, Venmo, or Zelle — anything that doesn&apos;t cost you a Stripe fee. The discount appears on the public payment page and the invoice SMS. The Stripe link itself still charges the full amount; honor the discount when you record the cash payment.
            </p>

            <div className="form-group">
              <label className="form-label">Discount percentage</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  className="form-input"
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={cashDiscountInput}
                  onChange={(e) => setCashDiscountInput(e.target.value)}
                  style={{ width: '120px' }}
                />
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>%</span>
                <button className="btn btn-primary btn-sm" onClick={handleSaveDiscount} disabled={savingDiscount} style={{ marginLeft: 'var(--space-sm)' }}>
                  {savingDiscount ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
                Set to 0 to disable the discount entirely. Default is {DEFAULT_CASH_DISCOUNT_PCT}%.
              </div>
            </div>

            {/* Math preview */}
            <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>What this means on a $1,000 invoice:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Card path</div>
                  <div>Customer pays: $1,000.00</div>
                  <div>Stripe takes: −${estimateCardFee(1000).toFixed(2)} ({effectiveCardFeePct(1000).toFixed(2)}%)</div>
                  <div style={{ fontWeight: 700, color: 'var(--status-success)' }}>You net: ${(1000 - estimateCardFee(1000)).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--lucky-green-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cash path ({cashDiscountInput || 0}% off)</div>
                  <div>Customer pays: ${(1000 * (1 - (parseFloat(cashDiscountInput) || 0) / 100)).toFixed(2)}</div>
                  <div>Stripe takes: −$0.00</div>
                  <div style={{ fontWeight: 700, color: 'var(--status-success)' }}>You net: ${(1000 * (1 - (parseFloat(cashDiscountInput) || 0) / 100)).toFixed(2)}</div>
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                Difference: ${((1000 * (1 - (parseFloat(cashDiscountInput) || 0) / 100)) - (1000 - estimateCardFee(1000))).toFixed(2)} extra to you on the cash path.
                {parseFloat(cashDiscountInput) > 2.95 && (parseFloat(cashDiscountInput) < 3.5) && (
                  <> · You&apos;re passing the entire Stripe fee through as savings (roughly break-even).</>
                )}
                {parseFloat(cashDiscountInput) <= 2.5 && parseFloat(cashDiscountInput) > 0 && (
                  <> · You&apos;re keeping some of the Stripe savings (more profitable on cash).</>
                )}
                {parseFloat(cashDiscountInput) >= 3.5 && (
                  <> · You&apos;re discounting MORE than Stripe&apos;s fee — you lose money on every cash payment compared to card. Drop to 2.5–3% to fix.</>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-md)' }}>Stripe Fees (reference)</h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
              Standard US pricing. Lucky&apos;s actual fees come from each charge&apos;s balance_transaction (read live by the webhook) — these are estimates for the &ldquo;what you&apos;d net&rdquo; calculator on invoices.
            </p>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Method</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>On $1,000</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>💳 Card (online)</td>
                  <td style={{ textAlign: 'right' }}>2.9% + $0.30</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${estimateCardFee(1000).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>🏦 ACH / bank transfer</td>
                  <td style={{ textAlign: 'right' }}>0.8% (capped at $5)</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>$5.00</td>
                </tr>
                <tr>
                  <td>💵 Cash / check / Zelle / Venmo</td>
                  <td style={{ textAlign: 'right' }}>$0</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--status-success)' }}>$0.00</td>
                </tr>
              </tbody>
            </table>
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
