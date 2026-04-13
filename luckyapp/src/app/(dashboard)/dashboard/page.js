'use client';

import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
} from 'lucide-react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const activityIcons = {
  quote_created: <FileText size={14} />,
  quote_sent: <Send size={14} />,
  quote_accepted: <CheckCircle2 size={14} />,
  quote_declined: <AlertCircle size={14} />,
  customer_added: <Users size={14} />,
  note_added: <Clock size={14} />,
};

const activityColors = {
  quote_created: 'var(--status-info)',
  quote_sent: 'var(--lucky-gold)',
  quote_accepted: 'var(--status-success)',
  quote_declined: 'var(--status-danger)',
  customer_added: 'var(--status-info)',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { customers, quotes, activity } = useData();

  // Calculate metrics
  const totalRevenue = quotes
    .filter(q => q.status === 'accepted')
    .reduce((sum, q) => sum + (q.total || 0), 0);

  const pendingQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'sent');
  const pendingValue = pendingQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
  const acceptedCount = quotes.filter(q => q.status === 'accepted').length;
  const closeRate = quotes.length > 0 ? Math.round((acceptedCount / quotes.length) * 100) : 0;

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>{greeting}, {firstName} 👋</h1>
          <p>Here&apos;s what&apos;s happening with your business today.</p>
        </div>
        <div className="page-header-actions">
          <Link href="/quotes/new" className="btn btn-primary">
            <Plus size={18} />
            New Quote
          </Link>
          <Link href="/customers" className="btn btn-secondary">
            <Users size={18} />
            Add Customer
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--accent': 'var(--status-success)', '--accent-bg': 'var(--status-success-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <DollarSign />
            </div>
            <div className="stat-card-change up">
              <TrendingUp size={12} /> 100%
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
          <div className="stat-card-label">Total Revenue (Accepted)</div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--status-info)', '--accent-bg': 'var(--status-info-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <FileText />
            </div>
          </div>
          <div className="stat-card-value">{pendingQuotes.length}</div>
          <div className="stat-card-label">Pending Quotes ({formatCurrency(pendingValue)})</div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--lucky-green-light)', '--accent-bg': 'var(--lucky-green-glow)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <Users />
            </div>
          </div>
          <div className="stat-card-value">{customers.length}</div>
          <div className="stat-card-label">Total Customers</div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--lucky-gold)', '--accent-bg': 'rgba(212,169,62,0.12)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <TrendingUp />
            </div>
          </div>
          <div className="stat-card-value">{closeRate}%</div>
          <div className="stat-card-label">Quote Close Rate</div>
        </div>
      </div>

      {/* Two Column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        {/* Recent Quotes */}
        <div className="table-wrapper">
          <div className="table-header">
            <h3>Recent Quotes</h3>
            <Link href="/quotes" className="btn btn-ghost btn-sm">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Quote</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.slice(0, 5).map(q => {
                const customer = customers.find(c => c.id === q.customerId);
                return (
                  <tr key={q.id}>
                    <td>
                      <Link href={`/quotes/${q.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        #{q.quoteNumber}
                      </Link>
                      <div className="table-sub">{q.category}</div>
                    </td>
                    <td>
                      <div className="table-name">{customer?.firstName} {customer?.lastName}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(q.total)}</td>
                    <td>
                      <span className={`badge badge-${q.status}`}>
                        <span className="badge-dot" />
                        {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <h3>Recent Activity</h3>
          </div>
          <div className="timeline">
            {activity.slice(0, 6).map(a => (
              <div key={a.id} className="timeline-item">
                <div
                  className="timeline-dot"
                  style={{ background: activityColors[a.type] || 'var(--text-tertiary)' }}
                />
                <div className="timeline-title">
                  <span style={{ marginRight: '6px', opacity: 0.7 }}>
                    {activityIcons[a.type]}
                  </span>
                  {a.title}
                </div>
                {a.description && (
                  <div className="timeline-desc">{a.description}</div>
                )}
                <div className="timeline-time">{formatDate(a.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
