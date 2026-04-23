'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import {
  TrendingUp, DollarSign, Users, Briefcase, Clock,
  BarChart3, PieChart, CalendarDays, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';

function fmtCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);
}
function fmtCurrency2(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

export default function ReportsPage() {
  const { jobs, quotes, invoices, customers, teamMembers, timeEntries, jobExpenses, getCustomer, getTeamMember, getJobFinancials } = useData();
  const [period, setPeriod] = useState('month'); // 'week', 'month', 'quarter', 'year'

  // Period cutoff date
  const cutoff = useMemo(() => {
    const d = new Date();
    if (period === 'week') d.setDate(d.getDate() - 7);
    else if (period === 'month') d.setMonth(d.getMonth() - 1);
    else if (period === 'quarter') d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [period]);

  const cutoffStr = cutoff.toISOString();

  // Previous period for comparison
  const prevCutoff = useMemo(() => {
    const d = new Date(cutoff);
    if (period === 'week') d.setDate(d.getDate() - 7);
    else if (period === 'month') d.setMonth(d.getMonth() - 1);
    else if (period === 'quarter') d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [cutoff, period]);

  // Revenue metrics
  const revenueData = useMemo(() => {
    const periodJobs = jobs.filter(j => j.status === 'completed' && j.completedAt && new Date(j.completedAt) >= cutoff);
    const prevJobs = jobs.filter(j => j.status === 'completed' && j.completedAt && new Date(j.completedAt) >= prevCutoff && new Date(j.completedAt) < cutoff);

    const periodRevenue = periodJobs.reduce((s, j) => {
      const q = quotes.find(q => q.id === j.quoteId);
      return s + (q?.total || 0);
    }, 0);
    const prevRevenue = prevJobs.reduce((s, j) => {
      const q = quotes.find(q => q.id === j.quoteId);
      return s + (q?.total || 0);
    }, 0);

    return { periodJobs, periodRevenue, prevRevenue, jobCount: periodJobs.length, prevJobCount: prevJobs.length };
  }, [jobs, quotes, cutoff, prevCutoff]);

  // Profitability
  const profitData = useMemo(() => {
    const completedJobs = jobs.filter(j => j.status === 'completed');
    let totalRevenue = 0, totalExpenses = 0, totalLabor = 0;

    const jobProfits = completedJobs.map(j => {
      const fin = getJobFinancials(j.id);
      totalRevenue += fin.revenue;
      totalExpenses += fin.materialCost + fin.equipmentCost;
      totalLabor += fin.laborCost;
      return { job: j, ...fin };
    });

    const netProfit = totalRevenue - totalExpenses - totalLabor;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;

    // Top 5 most profitable jobs
    const topJobs = [...jobProfits].sort((a, b) => b.netProfit - a.netProfit).slice(0, 5);

    return { totalRevenue, totalExpenses, totalLabor, netProfit, margin, topJobs, jobProfits };
  }, [jobs, getJobFinancials]);

  // Crew performance
  const crewData = useMemo(() => {
    return teamMembers.filter(m => m.isActive).map(member => {
      const entries = timeEntries.filter(t => t.teamMemberId === member.id && t.clockOut);
      const periodEntries = entries.filter(t => new Date(t.clockIn) >= cutoff);
      const totalMinutes = periodEntries.reduce((s, t) => s + (t.durationMinutes || 0), 0);
      const totalHours = totalMinutes / 60;
      const jobsAssigned = jobs.filter(j => j.assignedTo?.includes(member.id) && j.scheduledDate && new Date(j.scheduledDate + 'T12:00:00') >= cutoff).length;
      const pay = totalHours * (member.hourlyRate || 15);
      return { member, totalHours, jobsAssigned, pay, entryCount: periodEntries.length };
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, [teamMembers, timeEntries, jobs, cutoff]);

  // Customer insights
  const customerData = useMemo(() => {
    return customers.map(c => {
      const customerQuotes = quotes.filter(q => q.customerId === c.id);
      const acceptedQuotes = customerQuotes.filter(q => q.status === 'accepted');
      const totalRevenue = acceptedQuotes.reduce((s, q) => s + (q.total || 0), 0);
      const customerJobs = jobs.filter(j => j.customerId === c.id);
      return { customer: c, quoteCount: customerQuotes.length, acceptedCount: acceptedQuotes.length, totalRevenue, jobCount: customerJobs.length };
    }).filter(c => c.totalRevenue > 0).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [customers, quotes, jobs]);

  // Invoice insights
  const invoiceData = useMemo(() => {
    const outstanding = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue');
    const paid = invoices.filter(i => i.status === 'paid');
    const totalOutstanding = outstanding.reduce((s, i) => s + ((i.total || 0) - (i.amountPaid || 0)), 0);
    const totalCollected = paid.reduce((s, i) => s + (i.total || 0), 0);
    return { outstanding: outstanding.length, totalOutstanding, collected: paid.length, totalCollected };
  }, [invoices]);

  const pctChange = (curr, prev) => {
    if (!prev) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev * 100);
  };

  const ChangeIndicator = ({ current, previous }) => {
    const change = pctChange(current, previous);
    const isUp = change > 0;
    const isDown = change < 0;
    return (
      <div className={`stat-card-change ${isUp ? 'up' : isDown ? 'down' : ''}`}>
        {isUp ? <ArrowUp size={12} /> : isDown ? <ArrowDown size={12} /> : <Minus size={12} />}
        {Math.abs(change).toFixed(0)}%
      </div>
    );
  };

  // Simple bar visualization
  const BarViz = ({ data, maxVal }) => {
    if (!maxVal) maxVal = Math.max(...data.map(d => d.value), 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{ width: '120px', fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {d.label}
            </div>
            <div style={{ flex: 1, height: '20px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(2, (d.value / maxVal) * 100)}%`,
                background: d.color || 'var(--lucky-green)',
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ width: '80px', textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>
              {d.display}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Reports & Analytics</h1>
          <p>Track performance across your entire operation.</p>
        </div>
        <div className="page-header-actions">
          <div className="tabs">
            {[
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: 'quarter', label: 'Quarter' },
              { key: 'year', label: 'Year' },
            ].map(p => (
              <button key={p.key} className={`tab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card" style={{ '--accent': 'var(--lucky-green)', '--accent-bg': 'var(--lucky-green-glow)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><DollarSign /></div>
            <ChangeIndicator current={revenueData.periodRevenue} previous={revenueData.prevRevenue} />
          </div>
          <div className="stat-card-value">{fmtCurrency(revenueData.periodRevenue)}</div>
          <div className="stat-card-label">Revenue ({period})</div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--status-success)', '--accent-bg': 'var(--status-success-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><TrendingUp /></div>
          </div>
          <div className="stat-card-value">{profitData.margin.toFixed(0)}%</div>
          <div className="stat-card-label">Profit Margin (all time)</div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--status-info)', '--accent-bg': 'var(--status-info-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><Briefcase /></div>
            <ChangeIndicator current={revenueData.jobCount} previous={revenueData.prevJobCount} />
          </div>
          <div className="stat-card-value">{revenueData.jobCount}</div>
          <div className="stat-card-label">Jobs Completed ({period})</div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--status-warning)', '--accent-bg': 'var(--status-warning-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><Clock /></div>
          </div>
          <div className="stat-card-value">{fmtCurrency(invoiceData.totalOutstanding)}</div>
          <div className="stat-card-label">Outstanding Invoices</div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        {/* Profitability Breakdown */}
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} style={{ color: 'var(--lucky-green-light)' }} /> Profitability Breakdown
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Revenue</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-success)' }}>{fmtCurrency(profitData.totalRevenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Net Profit</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: profitData.netProfit >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                {fmtCurrency(profitData.netProfit)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Labor Cost</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--status-info)' }}>{fmtCurrency(profitData.totalLabor)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Materials & Equipment</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--status-warning)' }}>{fmtCurrency(profitData.totalExpenses)}</div>
            </div>
          </div>

          {/* Cost Breakdown Bar */}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '8px', fontWeight: 600 }}>Cost Distribution</div>
          <div style={{ height: '24px', display: 'flex', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
            {profitData.totalRevenue > 0 && (
              <>
                <div style={{ width: `${(profitData.totalLabor / profitData.totalRevenue) * 100}%`, background: 'var(--status-info)', minWidth: '2px' }} title={`Labor: ${fmtCurrency(profitData.totalLabor)}`} />
                <div style={{ width: `${(profitData.totalExpenses / profitData.totalRevenue) * 100}%`, background: 'var(--status-warning)', minWidth: '2px' }} title={`Materials: ${fmtCurrency(profitData.totalExpenses)}`} />
                <div style={{ flex: 1, background: 'var(--status-success)', minWidth: '2px' }} title={`Profit: ${fmtCurrency(profitData.netProfit)}`} />
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-lg)', marginTop: '8px', fontSize: '0.72rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-info)' }} /> Labor</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-warning)' }} /> Materials</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-success)' }} /> Profit</span>
          </div>
        </div>

        {/* Crew Performance */}
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: 'var(--status-info)' }} /> Crew Performance
          </h3>
          {crewData.length > 0 ? (
            <BarViz
              data={crewData.map(c => ({
                label: c.member.fullName?.split(' ')[0] || 'Unknown',
                value: c.totalHours,
                display: `${c.totalHours.toFixed(1)}h`,
                color: 'var(--status-info)',
              }))}
            />
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-xl)' }}>No crew data for this period</p>
          )}

          {crewData.length > 0 && (
            <div className="table-wrapper" style={{ marginTop: 'var(--space-lg)', border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Hours</th>
                    <th>Jobs</th>
                    <th style={{ textAlign: 'right' }}>Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {crewData.map(c => (
                    <tr key={c.member.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.member.fullName}</td>
                      <td style={{ fontSize: '0.82rem' }}>{c.totalHours.toFixed(1)}h</td>
                      <td style={{ fontSize: '0.82rem' }}>{c.jobsAssigned}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.82rem' }}>{fmtCurrency2(c.pay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Second Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        {/* Top Customers */}
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: 'var(--lucky-gold)' }} /> Top Customers
          </h3>
          {customerData.length > 0 ? (
            <BarViz
              data={customerData.slice(0, 8).map(c => ({
                label: `${c.customer.firstName} ${c.customer.lastName?.[0] || ''}`,
                value: c.totalRevenue,
                display: fmtCurrency(c.totalRevenue),
                color: 'var(--lucky-gold)',
              }))}
            />
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-xl)' }}>No customer data yet</p>
          )}
        </div>

        {/* Top Jobs by Profit */}
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} style={{ color: 'var(--status-success)' }} /> Most Profitable Jobs
          </h3>
          {profitData.topJobs.length > 0 ? (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Revenue</th>
                    <th>Cost</th>
                    <th style={{ textAlign: 'right' }}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {profitData.topJobs.map(j => (
                    <tr key={j.job.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{j.job.title}</td>
                      <td style={{ fontSize: '0.82rem' }}>{fmtCurrency(j.revenue)}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--status-danger)' }}>{fmtCurrency(j.materialCost + j.equipmentCost + j.laborCost)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', color: j.netProfit >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                        {fmtCurrency(j.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-xl)' }}>Complete jobs to see profit data</p>
          )}
        </div>
      </div>
    </div>
  );
}
