'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  Plus, Search, Phone, Mail, MapPin, X, UserPlus, ArrowRight,
} from 'lucide-react';

export default function CustomersPage() {
  const { customers, quotes, addCustomer } = useData();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [filterTag, setFilterTag] = useState('all');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', city: 'Lincoln', state: 'NE', zip: '', notes: '',
  });

  const filtered = customers.filter(c => {
    const matchSearch = `${c.firstName} ${c.lastName} ${c.email} ${c.phone} ${c.address}`
      .toLowerCase().includes(search.toLowerCase());
    const matchTag = filterTag === 'all' || (c.tags && c.tags.includes(filterTag));
    return matchSearch && matchTag;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName) return;
    await addCustomer(form);
    setForm({ firstName: '', lastName: '', email: '', phone: '', address: '', city: 'Lincoln', state: 'NE', zip: '', notes: '' });
    setShowModal(false);
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
                      <div className="table-name">{c.firstName} {c.lastName}</div>
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Customer</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name <span className="required">*</span></label>
                    <input className="form-input" placeholder="John" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input className="form-input" placeholder="Doe" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="tel" placeholder="(402) 555-1234" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" placeholder="1234 Main St" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={3} placeholder="Any notes about this customer..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <UserPlus size={16} /> Add Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
