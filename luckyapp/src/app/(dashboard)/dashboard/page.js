'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  DollarSign, FileText, Users, TrendingUp, Plus, ArrowRight,
  Clock, CheckCircle2, Send, AlertCircle, HardHat, Briefcase,
  CalendarDays, Receipt, MapPin, ChevronRight, BarChart3,
} from 'lucide-react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime12(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatCalDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
  const { customers, quotes, activity, teamMembers, timeEntries, jobs, invoices, getJobFinancials, getCustomer } = useData();

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = new Date().toISOString().split('T')[0];

  // Revenue — use completed jobs' revenue, not accepted quote totals (Phase 1C)
  const totalRevenue = jobs.filter(j => j.status === 'completed').reduce((sum, j) => sum + Number(j.revenue || j.total || 0), 0);
  const pendingQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'sent');
  const pendingValue = pendingQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
  const acceptedCount = quotes.filter(q => q.status === 'accepted').length;
  const closeRate = quotes.length > 0 ? Math.round((acceptedCount / quotes.length) * 100) : 0;

  // Crew stats
  const clockedInWorkers = timeEntries.filter(t => !t.clockOut).length;
  const activeWorkers = teamMembers.filter(m => m.role === 'worker' && m.isActive).length;

  // Net profit
  let netProfit = 0;
  jobs.forEach(j => {
    const fin = getJobFinancials(j.id);
    if (fin) netProfit += fin.profit;
  });

  // Invoice stats
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue');
  const outstandingAmount = unpaidInvoices.reduce((s, i) => s + ((i.total || 0) - (i.amountPaid || 0)), 0);

  // Today's jobs
  const todayJobs = useMemo(() => {
    return jobs
      .filter(j => j.scheduledDate === todayStr && j.status !== 'cancelled')
      .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
  }, [jobs, todayStr]);

  // Upcoming jobs (next 7 days, excluding today)
  const upcomingJobs = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    return jobs
      .filter(j => j.scheduledDate >= tomorrowStr && j.scheduledDate <= nextWeekStr && j.status !== 'cancelled')
      .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''))
      .slice(0, 5);
  }, [jobs]);

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
            <Plus size={18} /> New Quote
          </Link>
          <Link href="/customers" className="btn btn-secondary">
            <Users size={18} /> Customers
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--accent': 'var(--status-success)', '--accent-bg': 'var(--status-success-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><DollarSign /></div></div>
          <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
          <div className="stat-card-label">Total Revenue</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--status-info)', '--accent-bg': 'var(--status-info-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><FileText /></div></div>
          <div className="stat-card-value">{pendingQuotes.length}</div>
          <div className="stat-card-label">Pending Quotes ({formatCurrency(pendingValue)})</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--lucky-green-light)', '--accent-bg': 'var(--lucky-green-glow)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><HardHat /></div></div>
          <div className="stat-card-value">{clockedInWorkers}<span style={{ fontSize: '0.6em', fontWeight: 400, color: 'var(--text-tertiary)' }}> / {activeWorkers}</span></div>
          <div className="stat-card-label">Crew On Clock</div>
        </div>
        <div className="stat-card" style={{ '--accent': netProfit >= 0 ? 'var(--status-success)' : 'var(--status-danger)', '--accent-bg': netProfit >= 0 ? 'var(--status-success-bg)' : 'var(--status-danger-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><TrendingUp /></div></div>
          <div className="stat-card-value" style={{ color: netProfit >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>{formatCurrency(netProfit)}</div>
          <div className="stat-card-label">Net Profit</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--lucky-gold)', '--accent-bg': 'rgba(212,169,62,0.12)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><BarChart3 /></div></div>
          <div className="stat-card-value">{closeRate}%</div>
          <div className="stat-card-label">Quote Close Rate</div>
        </div>
        <div className="stat-card" style={{ '--accent': outstandingAmount > 0 ? 'var(--status-warning)' : 'var(--status-success)', '--accent-bg': outstandingAmount > 0 ? 'var(--status-warning-bg)' : 'var(--status-success-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><Receipt /></div></div>
          <div className="stat-card-value">{formatCurrency(outstandingAmount)}</div>
          <div className="stat-card-label">{unpaidInvoices.length} Unpaid Invoice{unpaidInvoices.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Today's Schedule + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        {/* Today's Jobs */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={18} style={{ color: 'var(--lucky-green-light)' }} />
              Today&apos;s Schedule
              <span style={{ background: 'var(--lucky-green-glow)', color: 'var(--lucky-green-light)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 700 }}>
                {todayJobs.length}
              </span>
            </h3>
            <Link href="/calendar" className="btn btn-ghost btn-sm">Calendar <ArrowRight size={14} /></Link>
          </div>

          {todayJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>
              <CheckCircle2 size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p style={{ fontWeight: 600 }}>No jobs scheduled today</p>
              <p style={{ fontSize: '0.82rem' }}>Check the calendar for upcoming work.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayJobs.map(job => {
                const customer = job.customerId ? getCustomer(job.customerId) : null;
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                      padding: 'var(--space-md)', background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${job.status === 'completed' ? 'var(--status-success)' : 'var(--lucky-green)'}`,
                      transition: 'all var(--transition-fast)',
                    }} className="card-clickable">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '2px' }}>{job.title}</div>
                        <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          {job.scheduledTime && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={11} /> {formatTime12(job.scheduledTime)}</span>}
                          {customer && <span>{customer.firstName} {customer.lastName?.[0] || ''}.</span>}
                        </div>
                      </div>
                      <span className={`badge badge-${job.status === 'completed' ? 'accepted' : 'sent'}`} style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                        <span className="badge-dot" /> {job.status?.replace('_', ' ')}
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Upcoming Jobs */}
          {upcomingJobs.length > 0 && (
            <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-primary)' }}>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)' }}>
                Upcoming This Week
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {upcomingJobs.map(job => {
                  const customer = job.customerId ? getCustomer(job.customerId) : null;
                  return (
                    <Link key={job.id} href={`/jobs/${job.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' }} className="card-clickable">
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', width: '60px', flexShrink: 0 }}>{formatCalDate(job.scheduledDate)}</div>
                        <div style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600 }}>{job.title}</div>
                        {customer && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{customer.firstName}</div>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Quick Actions + Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Quick Actions */}
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Quick Actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Link href="/quotes/new" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', width: '100%' }}>
                <Plus size={14} /> Create Quote
              </Link>
              <Link href="/calendar" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', width: '100%' }}>
                <CalendarDays size={14} /> Schedule Job
              </Link>
              <Link href="/invoices" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', width: '100%' }}>
                <Receipt size={14} /> View Invoices
              </Link>
              <Link href="/reports" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', width: '100%' }}>
                <BarChart3 size={14} /> View Reports
              </Link>
              <Link href="/team" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', width: '100%' }}>
                <Users size={14} /> Team & Payroll
              </Link>
            </div>
          </div>

          {/* Activity */}
          <div className="card" style={{ flex: 1 }}>
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Recent Activity</h4>
            <div className="timeline">
              {activity.slice(0, 5).map(a => (
                <div key={a.id} className="timeline-item">
                  <div className="timeline-dot" style={{ background: activityColors[a.type] || 'var(--text-tertiary)' }} />
                  <div className="timeline-title">
                    <span style={{ marginRight: '6px', opacity: 0.7 }}>{activityIcons[a.type]}</span>
                    {a.title}
                  </div>
                  {a.description && <div className="timeline-desc">{a.description}</div>}
                  <div className="timeline-time">{formatDate(a.createdAt)}</div>
                </div>
              ))}
              {activity.length === 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Quotes */}
      <div className="table-wrapper">
        <div className="table-header">
          <h3>Recent Quotes</h3>
          <Link href="/quotes" className="btn btn-ghost btn-sm">View All <ArrowRight size={14} /></Link>
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
                    <Link href={`/quotes/${q.id}`} style={{ fontWeight: 600, color: 'var(--lucky-green-light)' }}>
                      #{q.quoteNumber}
                    </Link>
                    <div className="table-sub">{q.category}</div>
                  </td>
                  <td><div className="table-name">{customer?.firstName} {customer?.lastName}</div></td>
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
    </div>
  );
}
