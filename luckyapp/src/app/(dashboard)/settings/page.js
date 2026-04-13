'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { Save, Building2, DollarSign, Users } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { services } = useData();
  const [activeTab, setActiveTab] = useState('company');

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
              <button className="btn btn-primary btn-sm">
                <Users size={14} /> Invite Member
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
                <tr>
                  <td>
                    <div className="table-customer-cell">
                      <div className="table-avatar" style={{ background: 'var(--lucky-green)', color: 'white' }}>RK</div>
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
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 'var(--space-md)', textAlign: 'center', padding: 'var(--space-xl)' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
              Invite crew leads and team members to give them access to the app.
            </p>
            <button className="btn btn-secondary btn-sm">
              <Users size={14} /> Invite Team Member
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
