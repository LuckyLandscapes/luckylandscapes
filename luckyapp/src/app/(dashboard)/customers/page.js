'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  Plus, Search, Phone, Mail, MapPin, X, UserPlus, ArrowRight,
  AlertCircle, CheckCircle, Home, Briefcase, HardHat,
} from 'lucide-react';
import AddressAutocomplete from '@/components/AddressAutocomplete';

// ─── Customer type tags ───────────────────────────────
// 'homeowner'           — residential property owner (default)
// 'business'            — commercial customer (HOA, business, property mgmt)
// 'general_contractor'  — GC who hires Lucky as a sub. Subcontract jobs
//                          attach to this customer record so billing flows
//                          to the GC, not the end-property-owner.
export const CUSTOMER_TYPES = [
  { value: 'homeowner',          label: 'Homeowner',          short: 'Homeowner',  icon: Home,      tone: '' },
  { value: 'business',           label: 'Business',           short: 'Business',   icon: Briefcase, tone: 'tag-blue' },
  { value: 'general_contractor', label: 'General Contractor', short: 'GC',         icon: HardHat,   tone: 'tag-gold' },
];

export function customerTypeMeta(type) {
  return CUSTOMER_TYPES.find(t => t.value === type) || CUSTOMER_TYPES[0];
}

/**
 * Format a phone number as (XXX) XXX-XXXX as the user types.
 * Strips all non-digit characters, then applies formatting.
 */
function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function CustomersPage() {
  const { customers, quotes, addCustomer } = useData();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [filterTag, setFilterTag] = useState('all');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', city: 'Lincoln', state: 'NE', zip: '', notes: '',
    customerType: 'homeowner',
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const filtered = customers.filter(c => {
    const matchSearch = `${c.firstName} ${c.lastName} ${c.email} ${c.phone} ${c.address}`
      .toLowerCase().includes(search.toLowerCase());
    const matchTag = filterTag === 'all' || (c.tags && c.tags.includes(filterTag));
    return matchSearch && matchTag;
  });

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setForm({ ...form, phone: formatted });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      setFormError('First name is required.');
      return;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await addCustomer(form);
      setForm({ firstName: '', lastName: '', email: '', phone: '', address: '', city: 'Lincoln', state: 'NE', zip: '', notes: '', customerType: 'homeowner' });
      setShowModal(false);
      showToast('success', `Customer ${form.firstName.trim()} added`);
    } catch (err) {
      console.error('Error adding customer:', err);
      setFormError(err?.message || 'Could not save the customer. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const getCustomerQuoteCount = (cId) => quotes.filter(q => q.customerId === cId).length;
  const getCustomerTotal = (cId) => quotes
    .filter(q => q.customerId === cId && q.status === 'accepted')
    .reduce((sum, q) => sum + (q.total || 0), 0);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Customers</h1>
          <p>{customers.length} total customers in your CRM</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Add Customer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input-wrap" style={{ flex: '1', maxWidth: '400px' }}>
          <Search size={16} />
          <input
            className="search-input"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tabs">
          {['all', 'lead', 'active', 'vip'].map(tag => (
            <button
              key={tag}
              className={`tab ${filterTag === tag ? 'active' : ''}`}
              onClick={() => setFilterTag(tag)}
            >
              {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Location</th>
              <th>Tags</th>
              <th>Quotes</th>
              <th>Revenue</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="table-customer-cell">
                    <div className="table-avatar">
                      {(c.firstName?.[0] || '') + (c.lastName?.[0] || '')}
                    </div>
                    <div>
                      <div className="table-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.firstName} {c.lastName}
                        {c.customerType && c.customerType !== 'homeowner' && (() => {
                          const meta = customerTypeMeta(c.customerType);
                          const Icon = meta.icon;
                          return (
                            <span className={`tag ${meta.tone}`} title={meta.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', padding: '1px 6px' }}>
                              <Icon size={10} /> {meta.short}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="table-sub">Since {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {c.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}>
                        <Phone size={12} style={{ color: 'var(--text-tertiary)' }} /> {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        <Mail size={12} /> {c.email}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}>
                    <MapPin size={12} style={{ color: 'var(--text-tertiary)' }} />
                    {c.city}, {c.state}
                  </span>
                </td>
                <td>
                  {c.tags?.map(tag => (
                    <span key={tag} className={`tag ${tag === 'vip' ? 'tag-gold' : tag === 'active' ? 'tag-green' : tag === 'lead' ? 'tag-blue' : ''}`}>
                      {tag}
                    </span>
                  ))}
                </td>
                <td style={{ fontWeight: 600 }}>{getCustomerQuoteCount(c.id)}</td>
                <td style={{ fontWeight: 600, color: 'var(--status-success)' }}>
                  {getCustomerTotal(c.id) > 0 ? `$${getCustomerTotal(c.id).toLocaleString()}` : '—'}
                </td>
                <td>
                  <Link href={`/customers/${c.id}`} className="btn btn-ghost btn-sm">
                    View <ArrowRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><UserPlus size={28} /></div>
                    <h3>No customers found</h3>
                    <p>{search ? 'Try a different search term' : 'Add your first customer to get started'}</p>
                    {!search && (
                      <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Add Customer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Customer</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !saving && setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Type</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {CUSTOMER_TYPES.map(t => {
                      const Icon = t.icon;
                      const isActive = form.customerType === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setForm({ ...form, customerType: t.value })}
                          style={{ flex: 1, minWidth: 110, justifyContent: 'center' }}
                        >
                          <Icon size={14} /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                  {form.customerType === 'general_contractor' && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
                      Use the GC&apos;s name and billing info here. The end-property-owner gets captured per-job as a site contact.
                    </p>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{form.customerType === 'business' || form.customerType === 'general_contractor' ? 'Contact First Name' : 'First Name'} <span className="required">*</span></label>
                    <input className="form-input" placeholder="John" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{form.customerType === 'business' || form.customerType === 'general_contractor' ? 'Company / Last Name' : 'Last Name'}</label>
                    <input className="form-input" placeholder={form.customerType === 'general_contractor' ? 'Acme Construction' : 'Doe'} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="tel" placeholder="(402) 555-1234" value={form.phone} onChange={handlePhoneChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <AddressAutocomplete
                    value={form.address}
                    onChange={(val) => setForm({ ...form, address: val })}
                    onPlaceSelect={({ address, city, state, zip }) => {
                      setForm(prev => ({
                        ...prev,
                        address: address || prev.address,
                        city: city || prev.city,
                        state: state || prev.state,
                        zip: zip || prev.zip,
                      }));
                    }}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input className="form-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ZIP</label>
                    <input className="form-input" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={3} placeholder="Any notes about this customer..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                {formError && (
                  <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} /> {formError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <UserPlus size={16} /> {saving ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
