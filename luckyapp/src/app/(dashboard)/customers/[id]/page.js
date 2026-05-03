'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, DollarSign,
  Clock, CheckCircle2, Send, Plus, Edit3, Trash2, X, AlertTriangle, Save,
} from 'lucide-react';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { CUSTOMER_TYPES, customerTypeMeta } from '../page';

function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const activityIcons = {
  quote_created: <FileText size={14} />,
  quote_sent: <Send size={14} />,
  quote_accepted: <CheckCircle2 size={14} />,
  customer_added: <Clock size={14} />,
};

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getCustomer, getCustomerQuotes, getCustomerJobs, getCustomerActivity, updateCustomer, deleteCustomer, calendarEvents, invoices } = useData();

  const customer = getCustomer(id);
  const customerQuotes = getCustomerQuotes(id);
  const customerJobs = getCustomerJobs(id);
  const customerActivity = getCustomerActivity(id);
  const customerJobIds = customerJobs.map(j => j.id);
  const customerInvoices = invoices.filter(i => i.customerId === id);
  const customerEvents = calendarEvents.filter(
    e => e.customerId === id || (e.jobId && customerJobIds.includes(e.jobId))
  );

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editForm, setEditForm] = useState({});

  const openEditModal = () => {
    setEditForm({
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zip: customer.zip || '',
      notes: customer.notes || '',
      tags: customer.tags || [],
      customerType: customer.customerType || 'homeowner',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.firstName) return;
    await updateCustomer(id, editForm);
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    await deleteCustomer(id);
    router.push('/customers');
  };

  const handleTagToggle = (tag) => {
    const tags = editForm.tags || [];
    if (tags.includes(tag)) {
      setEditForm({ ...editForm, tags: tags.filter(t => t !== tag) });
    } else {
      setEditForm({ ...editForm, tags: [...tags, tag] });
    }
  };

  if (!customer) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Customer not found</h3>
          <Link href="/customers" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-md)' }}>
            <ArrowLeft size={16} /> Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  const totalRevenue = customerQuotes
    .filter(q => q.status === 'accepted')
    .reduce((sum, q) => sum + (q.total || 0), 0);

  return (
    <div className="page animate-fade-in">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/customers" className="btn btn-ghost btn-sm" style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={16} /> Customers
        </Link>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div className="table-avatar" style={{ width: 56, height: 56, fontSize: '1.1rem', background: 'var(--lucky-green)', color: 'white' }}>
            {(customer.firstName?.[0] || '') + (customer.lastName?.[0] || '')}
          </div>
          <div>
            <h1>{customer.firstName} {customer.lastName}</h1>
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
              {customer.customerType && customer.customerType !== 'homeowner' && (() => {
                const meta = customerTypeMeta(customer.customerType);
                const Icon = meta.icon;
                return (
                  <span className={`tag ${meta.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon size={12} /> {meta.label}
                  </span>
                );
              })()}
              {customer.tags?.map(tag => (
                <span key={tag} className={`tag ${tag === 'vip' ? 'tag-gold' : tag === 'active' ? 'tag-green' : 'tag-blue'}`}>
                  {tag}
                </span>
              ))}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                Customer since {formatDate(customer.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={openEditModal}>
            <Edit3 size={16} /> Edit
          </button>
          <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
            <Trash2 size={16} /> Delete
          </button>
          <Link href={`/quotes/new?customer=${id}`} className="btn btn-primary">
            <Plus size={18} /> New Quote
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FileText /></div>
          </div>
          <div className="stat-card-value">{customerQuotes.length}</div>
          <div className="stat-card-label">Total Quotes</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--status-success)', '--accent-bg': 'var(--status-success-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><DollarSign /></div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
          <div className="stat-card-label">Total Revenue</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--lucky-gold)', '--accent-bg': 'rgba(212,169,62,0.12)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><CheckCircle2 /></div>
          </div>
          <div className="stat-card-value">
            {customerQuotes.filter(q => q.status === 'accepted').length}/{customerQuotes.length}
          </div>
          <div className="stat-card-label">Accepted Quotes</div>
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-md)' }}>
        {/* Quotes Table */}
        <div className="table-wrapper">
          <div className="table-header">
            <h3>Quotes</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {customerQuotes.map(q => (
                <tr key={q.id}>
                  <td>
                    <Link href={`/quotes/${q.id}`} style={{ fontWeight: 600, color: 'var(--lucky-green-light)' }}>
                      #{q.quoteNumber}
                    </Link>
                  </td>
                  <td>{q.category}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(q.total)}</td>
                  <td>
                    <span className={`badge badge-${q.status}`}>
                      <span className="badge-dot" /> {q.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                    {formatDate(q.createdAt)}
                  </td>
                </tr>
              ))}
              {customerQuotes.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem' }}>No quotes yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Contact Info Card */}
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Contact Info</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {customer.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <Phone size={16} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: '0.85rem' }}>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <Mail size={16} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: '0.85rem' }}>{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <MapPin size={16} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: '0.85rem' }}>
                    {customer.address}<br />
                    {customer.city}, {customer.state} {customer.zip}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes Card */}
          {customer.notes && (
            <div className="card">
              <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Notes</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{customer.notes}</p>
            </div>
          )}

          {/* Activity */}
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Activity</h4>
            <div className="timeline">
              {customerActivity.map(a => (
                <div key={a.id} className="timeline-item">
                  <div className="timeline-dot green" />
                  <div className="timeline-title">{a.title}</div>
                  {a.description && <div className="timeline-desc">{a.description}</div>}
                  <div className="timeline-time">{formatDate(a.createdAt)}</div>
                </div>
              ))}
              {customerActivity.length === 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Customer</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Type</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {CUSTOMER_TYPES.map(t => {
                      const Icon = t.icon;
                      const isActive = (editForm.customerType || 'homeowner') === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setEditForm({ ...editForm, customerType: t.value })}
                          style={{ flex: 1, minWidth: 110, justifyContent: 'center' }}
                        >
                          <Icon size={14} /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{editForm.customerType === 'business' || editForm.customerType === 'general_contractor' ? 'Contact First Name' : 'First Name'} <span className="required">*</span></label>
                    <input className="form-input" placeholder="John" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{editForm.customerType === 'business' || editForm.customerType === 'general_contractor' ? 'Company / Last Name' : 'Last Name'}</label>
                    <input className="form-input" placeholder={editForm.customerType === 'general_contractor' ? 'Acme Construction' : 'Doe'} value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="john@example.com" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="tel" placeholder="(402) 555-1234" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: formatPhoneNumber(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <AddressAutocomplete
                    value={editForm.address}
                    onChange={(val) => setEditForm({ ...editForm, address: val })}
                    onPlaceSelect={({ address, city, state, zip }) => {
                      setEditForm(prev => ({
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
                    <input className="form-input" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input className="form-input" value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ZIP</label>
                    <input className="form-input" value={editForm.zip} onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    {['lead', 'active', 'vip'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`tag ${editForm.tags?.includes(tag) ? (tag === 'vip' ? 'tag-gold' : tag === 'active' ? 'tag-green' : 'tag-blue') : ''}`}
                        style={{
                          cursor: 'pointer',
                          opacity: editForm.tags?.includes(tag) ? 1 : 0.4,
                          border: '1px solid var(--border-primary)',
                          padding: '4px 12px',
                        }}
                        onClick={() => handleTagToggle(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={3} placeholder="Any notes about this customer..." value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Delete Customer</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>This action cannot be undone</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>{customer.firstName} {customer.lastName}</strong> will be permanently deleted along with:
                  </div>
                  <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 0', paddingLeft: '20px' }}>
                    <li><strong>{customerQuotes.length}</strong> quote{customerQuotes.length !== 1 ? 's' : ''}</li>
                    <li><strong>{customerJobs.length}</strong> job{customerJobs.length !== 1 ? 's' : ''}</li>
                    <li><strong>{customerEvents.length}</strong> calendar event{customerEvents.length !== 1 ? 's' : ''}</li>
                    <li><strong>{customerInvoices.length}</strong> invoice{customerInvoices.length !== 1 ? 's' : ''}</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>
                <Trash2 size={16} /> Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

