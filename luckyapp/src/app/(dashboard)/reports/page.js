'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data';
import {
  buildPnL, buildARAging, jobFinancials, fmtCurrency, pctChange,
  COGS_LABELS, OPEX_LABELS, AGING_LABELS,
} from '@/lib/finance';
import {
  TrendingUp, DollarSign, Briefcase, Receipt,
  PieChart, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';

const PERIODS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All Time' },
];

const BASES = [
  { key: 'completed', label: 'Accrual (completed jobs)' },
  { key: 'paid', label: 'Cash (paid invoices)' },
];

export default function ReportsPage() {
  const {
    jobs, jobExpenses, timeEntries, teamMembers, invoices,
    companyExpenses, getCustomer,
  } = useData();

  const [period, setPeriod] = useState('month');
  const [basis, setBasis] = useState('completed');

  const pnl = useMemo(
    () => buildPnL({ jobs, jobExpenses, timeEntries, teamMembers, invoices, companyExpenses, period, basis }),
    [jobs, jobExpenses, timeEntries, teamMembers, invoices, companyExpenses, period, basis]
  );

  const aging = useMemo(() => buildARAging(invoices), [invoices]);

  const range = pnl.range;

  // Per-job financials for the period (top-jobs table & customer rollup)
  const periodJobFinancials = useMemo(() => {
    return pnl.periodJobs.map(j => ({
      job: j,
      ...jobFinancials(j, jobExpenses, timeEntries, teamMembers),
    }));
  }, [pnl.periodJobs, jobExpenses, timeEntries, teamMembers]);

  const topJobs = useMemo(
    () => [...periodJobFinancials].sort((a, b) => b.profit - a.profit).slice(0, 5),
    [periodJobFinancials]
  );

  // Top customers — by revenue from completed jobs in period
  const topCustomers = useMemo(() => {
    const map = new Map();
    for (const jf of periodJobFinancials) {
      const cid = jf.job.customerId;
      if (!cid) continue;
      const cur = map.get(cid) || { revenue: 0, profit: 0, jobCount: 0 };
      cur.revenue += jf.revenue;
      cur.profit += jf.profit;
      cur.jobCount += 1;
      map.set(cid, cur);
    }
    return [...map.entries()]
      .map(([cid, v]) => ({ customer: getCustomer(cid), ...v }))
      .filter(x => x.customer)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [periodJobFinancials, getCustomer]);

  // Crew performance (period-aware)
  const crewData = useMemo(() => {
    const { start, end } = range;
    return teamMembers.filter(m => m.isActive).map(member => {
      const entries = timeEntries.filter(t =>
        t.teamMemberId === member.id && t.clockIn && t.clockOut &&
        new Date(t.clockIn) >= start && new Date(t.clockIn) <= end
      );
      let mins = 0, breakMins = 0;
      for (const t of entries) {
        const shift = (new Date(t.clockOut) - new Date(t.clockIn)) / 60000;
        const b = Number(t.breakMinutes || 0);
        mins += Math.max(0, shift - b);
        breakMins += b;
      }
      const totalHours = mins / 60;
      const pay = totalHours * Number(member.hourlyRate || 0);
      const jobsTouched = new Set(entries.map(t => t.jobId).filter(Boolean)).size;
      return { member, totalHours, pay, jobsTouched, breakMins, entryCount: entries.length };
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, [teamMembers, timeEntries, range]);

  // Revenue change vs prior period
  const revenueChange = pctChange(pnl.revenue, pnl.previous.revenue);
  const profitChange = pctChange(pnl.netProfit, pnl.previous.netProfit);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Profit &amp; Loss</h1>
          <p>{fmtRange(range, period)} · {basis === 'paid' ? 'Cash basis' : 'Accrual basis'}</p>
        </div>
        <div className="page-header-actions" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <select className="form-select" value={basis} onChange={e => setBasis(e.target.value)} style={{ maxWidth: '220px', padding: '0.45rem 0.6rem', fontSize: '0.82rem' }}>
            {BASES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
          <div className="tabs">
            {PERIODS.map(p => (
              <button key={p.key} className={`tab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Headline P&L stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard
          color="var(--status-success)" bg="var(--status-success-bg)"
          icon={<DollarSign />}
          label="Revenue" value={fmtCurrency(pnl.revenue)}
          change={revenueChange}
        />
        <StatCard
          color="var(--status-warning)" bg="var(--status-warning-bg)"
          icon={<Briefcase />}
          label="Cost of Goods Sold" value={fmtCurrency(pnl.cogs)}
        />
        <StatCard
          color="var(--lucky-green-light)" bg="var(--lucky-green-glow)"
          icon={<TrendingUp />}
          label="Gross Profit"
          value={fmtCurrency(pnl.grossProfit)}
          subtitle={`${pnl.grossMargin.toFixed(0)}% margin`}
        />
        <StatCard
          color="var(--status-info)" bg="var(--status-info-bg)"
          icon={<PieChart />}
          label="Operating Expenses" value={fmtCurrency(pnl.opex)}
        />
        <StatCard
          color={pnl.netProfit >= 0 ? 'var(--status-success)' : 'var(--status-danger)'}
          bg={pnl.netProfit >= 0 ? 'var(--status-success-bg)' : 'var(--status-danger-bg)'}
          icon={<TrendingUp />}
          label="Net Profit"
          value={fmtCurrency(pnl.netProfit)}
          subtitle={`${pnl.netMargin.toFixed(0)}% margin`}
          change={profitChange}
        />
      </div>

      {/* P&L Statement */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <h3 style={{ marginBottom: 'var(--space-lg)' }}>Profit &amp; Loss Statement</h3>
        <div className="pnl-statement">
          <PnLSection title="Income">
            <PnLRow label={basis === 'paid' ? 'Payments collected' : 'Job revenue (completed)'} amount={pnl.revenue} bold />
          </PnLSection>
          <PnLTotal label="Total Income" amount={pnl.revenue} />

          <PnLSection title="Cost of Goods Sold" subtitle="Direct costs to deliver jobs">
            {Object.entries(pnl.cogsByCat).filter(([, v]) => v > 0).map(([cat, val]) => (
              <PnLRow key={cat} label={COGS_LABELS[cat] || cat} amount={val} />
            ))}
            {pnl.directLabor > 0 && <PnLRow label="Direct Labor (logged to jobs)" amount={pnl.directLabor} />}
            {pnl.cogs === 0 && <EmptyRow text="No direct costs recorded" />}
          </PnLSection>
          <PnLTotal label="Total COGS" amount={pnl.cogs} />

          <PnLBigTotal label="Gross Profit" amount={pnl.grossProfit} suffix={`${pnl.grossMargin.toFixed(1)}% margin`} />

          <PnLSection title="Operating Expenses" subtitle="Overhead — not tied to specific jobs">
            {Object.entries(pnl.opexByCat).filter(([, v]) => v > 0).map(([cat, val]) => (
              <PnLRow key={cat} label={OPEX_LABELS[cat] || cat} amount={val} />
            ))}
            {pnl.indirectLabor > 0 && <PnLRow label="Indirect Labor (overhead time)" amount={pnl.indirectLabor} />}
            {pnl.opex === 0 && <EmptyRow text={<>No overhead logged. <Link href="/finance" style={{ color: 'var(--lucky-green-light)' }}>Add company expenses →</Link></>} />}
          </PnLSection>
          <PnLTotal label="Total Operating Expenses" amount={pnl.opex} />

          <PnLBigTotal
            label="Net Profit"
            amount={pnl.netProfit}
            suffix={`${pnl.netMargin.toFixed(1)}% margin`}
            negative={pnl.netProfit < 0}
            highlight
          />
        </div>
      </div>

      {/* A/R Aging + Cost Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={18} style={{ color: 'var(--status-warning)' }} /> Accounts Receivable Aging
          </h3>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
            Total outstanding: <strong style={{ color: 'var(--text-primary)' }}>{fmtCurrency(aging.totalAR)}</strong>
          </div>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Bucket</th>
                <th style={{ textAlign: 'right' }}>Invoices</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(aging.totals).map(key => {
                const amount = aging.totals[key];
                const count = aging.buckets[key].length;
                const isOver = key !== 'current';
                return (
                  <tr key={key}>
                    <td style={{ fontWeight: 600, color: isOver && amount > 0 ? 'var(--status-danger)' : 'inherit' }}>
                      {AGING_LABELS[key]}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {aging.totalAR === 0 && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-lg)' }}>
              No outstanding invoices. 🎉
            </p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Cost Distribution</h3>
          {pnl.revenue > 0 ? (
            <>
              <div style={{ height: '32px', display: 'flex', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-elevated)', marginBottom: 'var(--space-md)' }}>
                <Segment label="COGS" amount={pnl.cogs} total={pnl.revenue} color="var(--status-warning)" />
                <Segment label="OpEx" amount={pnl.opex} total={pnl.revenue} color="var(--status-info)" />
                <Segment label="Profit" amount={Math.max(0, pnl.netProfit)} total={pnl.revenue} color="var(--status-success)" />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                <Legend color="var(--status-warning)" label="COGS" amount={pnl.cogs} pct={pnl.revenue ? (pnl.cogs / pnl.revenue) * 100 : 0} />
                <Legend color="var(--status-info)" label="OpEx" amount={pnl.opex} pct={pnl.revenue ? (pnl.opex / pnl.revenue) * 100 : 0} />
                <Legend color={pnl.netProfit >= 0 ? 'var(--status-success)' : 'var(--status-danger)'} label="Net Profit" amount={pnl.netProfit} pct={pnl.netMargin} />
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-lg)' }}>
              No revenue in this period.
            </p>
          )}
        </div>
      </div>

      {/* Top jobs + crew */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Most Profitable Jobs</h3>
          {topJobs.length > 0 ? (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Costs</th>
                    <th style={{ textAlign: 'right' }}>Profit</th>
                    <th style={{ textAlign: 'right' }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {topJobs.map(j => (
                    <tr key={j.job.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                        <Link href={`/jobs/${j.job.id}`} style={{ color: 'inherit' }}>{j.job.title}</Link>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{fmtCurrency(j.revenue)}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--status-warning)' }}>{fmtCurrency(j.totalExpenses)}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: j.profit >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                        {fmtCurrency(j.profit)}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{j.margin.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-lg)' }}>
              Complete jobs in this period to see profit data.
            </p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Crew Performance</h3>
          {crewData.some(c => c.totalHours > 0) ? (
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th style={{ textAlign: 'right' }}>Hours</th>
                  <th style={{ textAlign: 'right' }}>Jobs</th>
                  <th style={{ textAlign: 'right' }}>Pay</th>
                </tr>
              </thead>
              <tbody>
                {crewData.filter(c => c.totalHours > 0).map(c => (
                  <tr key={c.member.id}>
                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.member.fullName}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{c.totalHours.toFixed(1)}h</td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{c.jobsTouched}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 600 }}>{fmtCurrency(c.pay, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-lg)' }}>
              No clocked time in this period.
            </p>
          )}
        </div>
      </div>

      {/* Top customers */}
      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>Top Customers (by revenue)</h3>
        {topCustomers.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th style={{ textAlign: 'right' }}>Jobs</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Profit</th>
                <th style={{ textAlign: 'right' }}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map(c => {
                const margin = c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0;
                return (
                  <tr key={c.customer.id}>
                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      <Link href={`/customers/${c.customer.id}`} style={{ color: 'inherit' }}>
                        {c.customer.firstName} {c.customer.lastName || ''}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{c.jobCount}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 600 }}>{fmtCurrency(c.revenue)}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', color: c.profit >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>{fmtCurrency(c.profit)}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{margin.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-lg)' }}>
            No customer revenue in this period.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────

function StatCard({ color, bg, icon, label, value, subtitle, change }) {
  return (
    <div className="stat-card" style={{ '--accent': color, '--accent-bg': bg }}>
      <div className="stat-card-header">
        <div className="stat-card-icon">{icon}</div>
        {typeof change === 'number' && <ChangeIndicator change={change} />}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {subtitle && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{subtitle}</div>
      )}
    </div>
  );
}

function ChangeIndicator({ change }) {
  const up = change > 0, down = change < 0;
  return (
    <div className={`stat-card-change ${up ? 'up' : down ? 'down' : ''}`}>
      {up ? <ArrowUp size={12} /> : down ? <ArrowDown size={12} /> : <Minus size={12} />}
      {Math.abs(change).toFixed(0)}%
    </div>
  );
}

function PnLSection({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 'var(--space-md)' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', opacity: 0.7, marginBottom: '6px' }}>{subtitle}</div>
      )}
      <div>{children}</div>
    </div>
  );
}

function PnLRow({ label, amount, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: bold ? 600 : 400, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{fmtCurrency(amount, 2)}</span>
    </div>
  );
}

function EmptyRow({ text }) {
  return (
    <div style={{ padding: '6px 0', fontSize: '0.82rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{text}</div>
  );
}

function PnLTotal({ label, amount }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-secondary)', borderBottom: '1px solid var(--border-secondary)', marginBottom: 'var(--space-md)' }}>
      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{fmtCurrency(amount, 2)}</span>
    </div>
  );
}

function PnLBigTotal({ label, amount, suffix, negative, highlight }) {
  const color = negative ? 'var(--status-danger)' : highlight ? 'var(--lucky-green-light)' : 'var(--text-primary)';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0', borderTop: '2px solid var(--border-secondary)', borderBottom: highlight ? '3px double var(--border-secondary)' : '2px solid var(--border-secondary)',
      marginBottom: 'var(--space-md)',
    }}>
      <span style={{ fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-md)' }}>
        {suffix && <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{suffix}</span>}
        <span style={{ fontWeight: 800, fontSize: '1.15rem', color }}>{fmtCurrency(amount, 2)}</span>
      </div>
    </div>
  );
}

function Segment({ amount, total, color, label }) {
  if (total <= 0) return null;
  const pct = Math.max(0, (amount / total) * 100);
  if (pct < 0.5) return null;
  return <div style={{ width: `${pct}%`, background: color, minWidth: '2px' }} title={`${label}: ${fmtCurrency(amount)}`} />;
}

function Legend({ color, label, amount, pct }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <strong>{label}</strong>
      <span style={{ color: 'var(--text-tertiary)' }}>{fmtCurrency(amount)} ({pct.toFixed(0)}%)</span>
    </span>
  );
}

function fmtRange({ start, end }, period) {
  if (period === 'all') return 'All time';
  const f = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${f(start)} – ${f(end)}`;
}
