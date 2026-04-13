'use client';

import { useData } from '@/lib/data';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, DollarSign,
  Clock, CheckCircle2, Send, Plus,
} from 'lucide-react';

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
  const { getCustomer, getCustomerQuotes, getCustomerActivity } = useData();

  const customer = getCustomer(id);
  const customerQuotes = getCustomerQuotes(id);
  const customerActivity = getCustomerActivity(id);

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
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: '4px' }}>
              {customer.tags?.map(tag => (
                <span key={tag} className={`tag ${tag === 'vip' ? 'tag-gold' : tag === 'active' ? 'tag-green' : 'tag-blue'}`}>
                  {tag}
                </span>
              ))}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                Customer since {customer.createdAt}
              </span>
            </div>
          </div>
        </div>
        <div className="page-header-actions">
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
    </div>
  );
}
