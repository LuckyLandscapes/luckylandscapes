'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  Search, Briefcase, Plus, ArrowRight, DollarSign, TrendingUp, TrendingDown,
  CalendarDays, Users, Filter,
} from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'var(--status-info)' },
  in_progress: { label: 'In Progress', color: 'var(--status-warning)' },
  completed: { label: 'Completed', color: 'var(--status-success)' },
  cancelled: { label: 'Cancelled', color: 'var(--status-danger)' },
};

export default function JobsPage() {
  const { jobs, customers, getCustomer, getJobFinancials } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statuses = ['all', 'scheduled', 'in_progress', 'completed', 'cancelled'];

  const filtered = jobs.filter(j => {
    const customer = j.customerId ? getCustomer(j.customerId) : null;
    const matchSearch = `${j.title} ${customer?.firstName || ''} ${customer?.lastName || ''}`
      .toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = {};
  statuses.forEach(s => {
    statusCounts[s] = s === 'all' ? jobs.length : jobs.filter(j => j.status === s).length;
  });

  // Aggregate financial stats — only completed jobs (revenue isn't realized until done)
  const allFinancials = useMemo(() => {
    let totalRevenue = 0, totalExpenses = 0, totalLabor = 0, totalProfit = 0;
    jobs.filter(j => j.status === 'completed').forEach(j => {
      const fin = getJobFinancials(j.id);
      if (fin) {
        totalRevenue += fin.revenue;
        totalExpenses += fin.materialCosts + fin.equipmentCosts + fin.otherExpenses;
        totalLabor += fin.laborCosts;
        totalProfit += fin.profit;
      }
    });
    return { totalRevenue, totalExpenses, totalLabor, totalProfit };
  }, [jobs, getJobFinancials]);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Jobs</h1>
          <p>{jobs.length} total jobs from accepted quotes</p>
        </div>
        <div className="page-header-actions">
          <Link href="/calendar" className="btn btn-secondary">
            <CalendarDays size={18} /> View Calendar
          </Link>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="stat-card" style={{ '--accent': 'var(--status-success)', '--accent-bg': 'var(--status-success-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><DollarSign /></div>
          </div>
          <div className="stat-card-value">{formatCurrency(allFinancials.totalRevenue)}</div>
          <div className="stat-card-label">Revenue (completed)</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--status-danger)', '--accent-bg': 'var(--status-danger-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><TrendingDown /></div>
          </div>
          <div className="stat-card-value">{formatCurrency(allFinancials.totalExpenses)}</div>
          <div className="stat-card-label">Material & Equipment</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--lucky-gold)', '--accent-bg': 'rgba(212,169,62,0.12)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><Users /></div>
          </div>
          <div className="stat-card-value">{formatCurrency(allFinancials.totalLabor)}</div>
          <div className="stat-card-label">Labor Costs</div>
        </div>
        <div className="stat-card" style={{ '--accent': allFinancials.totalProfit >= 0 ? 'var(--status-success)' : 'var(--status-danger)', '--accent-bg': allFinancials.totalProfit >= 0 ? 'var(--status-success-bg)' : 'var(--status-danger-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><TrendingUp /></div>
          </div>
          <div className="stat-card-value" style={{ color: allFinancials.totalProfit >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
            {formatCurrency(allFinancials.totalProfit)}
          </div>
          <div className="stat-card-label">Gross Job Profit</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input-wrap" style={{ flex: 1, maxWidth: '400px' }}>
          <Search size={16} />
          <input
            className="search-input"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tabs">
          {statuses.map(s => (
            <button
              key={s}
              className={`tab ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
              {statusCounts[s] > 0 && s !== 'all' && (
                <span style={{ marginLeft: '4px', opacity: 0.7 }}>({statusCounts[s]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Status</th>
              <th>Revenue</th>
              <th>Costs</th>
              <th>Profit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(j => {
              const customer = j.customerId ? getCustomer(j.customerId) : null;
              const fin = getJobFinancials(j.id);
              const profit = fin?.profit || 0;
              const statusConf = STATUS_CONFIG[j.status] || STATUS_CONFIG.scheduled;

              return (
                <tr key={j.id}>
                  <td>
                    <Link href={`/jobs/${j.id}`} style={{ fontWeight: 700, color: 'var(--lucky-green-light)' }}>
                      {j.title}
                    </Link>
                  </td>
                  <td>
                    {customer ? (
                      <div className="table-customer-cell">
                        <div className="table-avatar">
                          {(customer.firstName?.[0] || '?') + (customer.lastName?.[0] || '')}
                        </div>
                        <div>
                          <div className="table-name">{customer.firstName} {customer.lastName}</div>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{formatDate(j.scheduledDate)}</td>
                  <td>
                    <span className="badge" style={{
                      background: `${statusConf.color}18`,
                      color: statusConf.color,
                      border: `1px solid ${statusConf.color}30`,
                    }}>
                      <span className="badge-dot" style={{ background: statusConf.color }} />
                      {statusConf.label}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(fin?.revenue)}</td>
                  <td style={{ color: 'var(--status-danger)' }}>{formatCurrency(fin?.totalExpenses)}</td>
                  <td style={{ fontWeight: 700, color: profit >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    {formatCurrency(profit)}
                  </td>
                  <td>
                    <Link href={`/jobs/${j.id}`} className="btn btn-ghost btn-sm">
                      View <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Briefcase size={28} /></div>
                    <h3>No jobs found</h3>
                    <p>Jobs are created when you accept and schedule a quote.</p>
                    <Link href="/quotes" className="btn btn-primary btn-sm">
                      View Quotes
                    </Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
