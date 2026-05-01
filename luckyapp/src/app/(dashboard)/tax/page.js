'use client';

// Year-end tax dashboard. Two reports:
//
//   1. 1099-NEC totals — per-contractor sums for the selected tax year,
//      flagging anyone ≥ $600 (the federal threshold). Excludes contractors
//      marked exempt (C-corps / S-corps don't get a 1099-NEC).
//
//   2. Schedule C export — buildScheduleC() rolls every category into the
//      IRS line a single-member LLC / sole prop reports it on. Honors the
//      "entity start date" so a mid-year LLC formation doesn't double-count
//      pre-formation activity.
//
// Both views export to CSV. Neither view is "tax advice" — they're starting
// points the user hands to a CPA. A red banner makes that explicit.

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data';
import {
  buildScheduleC, fmtCurrency, SCHEDULE_C_LINES,
} from '@/lib/finance';
import {
  FileText, Download, AlertTriangle, FileSignature, Car, Calendar,
  CheckCircle2, ExternalLink, Clock,
} from 'lucide-react';

// Federal 1040-ES quarterly estimated tax due dates (calendar year).
// Q4 of year N is due Jan 15 of year N+1 — that's why we carry the source
// `year` separately from the due date.
const QUARTERLY_DUE_DATES = (year) => [
  { quarter: 'Q1', taxYear: year, covers: `Jan 1 – Mar 31, ${year}`, due: new Date(`${year}-04-15T12:00:00`) },
  { quarter: 'Q2', taxYear: year, covers: `Apr 1 – May 31, ${year}`, due: new Date(`${year}-06-15T12:00:00`) },
  { quarter: 'Q3', taxYear: year, covers: `Jun 1 – Aug 31, ${year}`, due: new Date(`${year}-09-15T12:00:00`) },
  { quarter: 'Q4', taxYear: year, covers: `Sep 1 – Dec 31, ${year}`, due: new Date(`${year + 1}-01-15T12:00:00`) },
];

function nextQuarterly(today = new Date()) {
  const dates = [
    ...QUARTERLY_DUE_DATES(today.getFullYear() - 1).slice(-1), // last year's Q4 (due Jan 15 this year)
    ...QUARTERLY_DUE_DATES(today.getFullYear()),
    ...QUARTERLY_DUE_DATES(today.getFullYear() + 1).slice(0, 1),
  ];
  return dates.find(d => d.due >= today) || dates[dates.length - 1];
}

// Rough placeholder for federal quarterly estimated tax. Hand-waves at:
//   - SE tax (15.3% on .9235 of net, capped at SS wage base)
//   - Income tax (10-22% bracket for low-income sole prop)
// Combined ≈ 25% of net is a defensible "you should have at least this set
// aside" floor for an LLC owner with no other income. NOT tax advice — the
// disclaimer makes that explicit.
const ROUGH_TAX_RATE = 0.25;

// 2026 IRS standard mileage rate. Update annually.
const MILEAGE_RATES = { 2024: 0.67, 2025: 0.70, 2026: 0.70 };

// LLC formation date (per memory project_llc_formation.md). When set, the
// Schedule C aggregation only counts activity on/after this date for the
// LLC entity. Pre-formation income belongs on a personal sole-prop Schedule C.
const DEFAULT_ENTITY_START = '2026-03-26';

const todayISO = () => new Date().toISOString().split('T')[0];
const currentYear = () => new Date().getFullYear();

function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TaxPage() {
  const {
    contractors, jobs, jobExpenses, companyExpenses,
    mileageEntries, getContractorPaymentsForYear,
    getPnL,
  } = useData();

  const [year, setYear] = useState(currentYear());
  const [entityStartDate, setEntityStartDate] = useState(DEFAULT_ENTITY_START);
  const [useEntityStart, setUseEntityStart] = useState(true);
  const [scheduleCBasis, setScheduleCBasis] = useState('llc'); // 'llc' = post-cutover only, 'all' = full year

  // ─── Quarterly estimated tax ──────────────────────────────
  // Rough YTD-net × 25% as a "set aside at least this" floor. Real number
  // depends on filing status, total income, deductions, prior-year safe
  // harbor — that's the CPA's job, not the app's.
  const today = useMemo(() => new Date(), []);
  const next1040ES = useMemo(() => nextQuarterly(today), [today]);
  const ytdPnL = useMemo(() => getPnL ? getPnL('ytd', 'completed') : null, [getPnL]);
  const ytdNet = ytdPnL ? Math.max(0, Number(ytdPnL.netProfit || 0)) : 0;
  const roughEstimate = ytdNet * ROUGH_TAX_RATE;
  const daysUntilDue = Math.max(0, Math.ceil((next1040ES.due - today) / (1000 * 60 * 60 * 24)));
  const dueDateStr = next1040ES.due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ─── 1099-NEC totals ──────────────────────────────────────
  const c1099 = useMemo(() => {
    const rows = contractors
      .filter(c => !c.archived)
      .map(c => {
        const { total, payments } = getContractorPaymentsForYear(c.id, year);
        const owes = !c.exemptFrom1099 && total >= 600;
        return { contractor: c, total, payments, owes };
      })
      .sort((a, b) => b.total - a.total);
    const owedCount = rows.filter(r => r.owes).length;
    const totalReportable = rows.filter(r => r.owes).reduce((s, r) => s + r.total, 0);
    return { rows, owedCount, totalReportable };
  }, [contractors, year, getContractorPaymentsForYear]);

  // Build all expense rows tagged to a contractor that DON'T have a W-9 on file.
  // These are landmines for the user — they paid someone with no W-9, the IRS
  // will require backup withholding (24%) on those payments.
  const missingW9 = c1099.rows.filter(r => r.total > 0 && !r.contractor.w9Url);

  // ─── Schedule C ───────────────────────────────────────────
  const sched = useMemo(() => buildScheduleC({
    jobs,
    jobExpenses,
    companyExpenses,
    contractorPayments: c1099.rows.flatMap(r => r.payments.map(p => ({
      ...p,
      paidDate: p.date,
      contractorId: r.contractor.id,
    }))),
    mileageEntries,
    taxYear: year,
    entityStartDate: scheduleCBasis === 'llc' && useEntityStart ? entityStartDate : null,
    mileageRate: MILEAGE_RATES[year] || 0.70,
  }), [jobs, jobExpenses, companyExpenses, c1099.rows, mileageEntries, year, scheduleCBasis, useEntityStart, entityStartDate]);

  // ─── CSV exports ──────────────────────────────────────────
  const export1099 = () => {
    const rows = [
      ['Contractor', 'Business', 'Tax ID type', 'Tax ID', 'Address', 'City', 'State', 'ZIP',
        `${year} payments`, '1099-NEC required?', 'W-9 on file', 'Backup withholding'],
      ...c1099.rows
        .filter(r => r.total > 0)
        .map(r => [
          r.contractor.contactName,
          r.contractor.businessName || '',
          r.contractor.taxIdType || '',
          r.contractor.taxId || '',
          r.contractor.address || '',
          r.contractor.city || '',
          r.contractor.state || '',
          r.contractor.zip || '',
          r.total.toFixed(2),
          r.owes ? 'YES' : 'no',
          r.contractor.w9Url ? 'yes' : 'NO',
          r.contractor.backupWithholding ? 'yes' : 'no',
        ]),
    ];
    downloadCsv(`1099-nec-${year}.csv`, rows);
  };

  const exportScheduleC = () => {
    const rows = [
      ['Schedule C 2025/Form 1040', `Tax Year ${year}`],
      [`Entity start: ${sched.range.entityStartDate || `${year}-01-01`}`],
      [],
      ['Part', 'Line', 'Label', 'Amount'],
      ...sched.lines.map(l => [l.part, l.line, l.label, l.amount.toFixed(2)]),
      [],
      ['', '', 'Total Part II (Expenses)', sched.totalPartII.toFixed(2)],
      ['', '', 'Total Part III (COGS)', sched.totalPartIII.toFixed(2)],
      [],
      ['MILEAGE (informational — not auto-added to Line 9)'],
      ['', '', 'Total business miles', sched.mileage.miles.toFixed(1)],
      ['', '', `Standard rate ($${sched.mileage.rate.toFixed(2)}/mi)`, sched.mileage.deductionStandardMethod.toFixed(2)],
    ];
    downloadCsv(`schedule-c-${year}.csv`, rows);
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1><FileText size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Tax Center</h1>
          <p>1099-NEC totals and Schedule C export. Hand to your CPA — not a substitute for one.</p>
        </div>
        <div className="page-header-actions">
          <select className="form-select" value={year} onChange={e => setYear(Number(e.target.value))} style={{ maxWidth: '120px' }}>
            {[currentYear(), currentYear() - 1, currentYear() - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-lg)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, color: 'var(--status-danger)', marginTop: 2 }} />
        <div>
          <strong>Not tax advice.</strong> These reports compute totals from the data you&apos;ve entered — they don&apos;t audit it for completeness, depreciation method, accountable plan reimbursements, or anything else only a CPA should call. File 1099-NECs through a service like Tax1099 or Track1099; don&apos;t print and mail.
        </div>
      </div>

      {/* ─── Quarterly Estimated Tax Banner ─────────────────────
          Federal quarterly is a real, hard deadline most first-year LLC
          owners miss. Surfacing it with a rough number forces awareness
          and gives the CPA something concrete to react to. */}
      <div style={{
        background: daysUntilDue <= 30 ? 'rgba(220,38,38,0.07)' : 'rgba(45,122,58,0.06)',
        border: `1px solid ${daysUntilDue <= 30 ? 'rgba(220,38,38,0.30)' : 'rgba(45,122,58,0.25)'}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md) var(--space-lg)',
        marginBottom: 'var(--space-lg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0, padding: '8px', borderRadius: 'var(--radius-md)', background: daysUntilDue <= 30 ? 'rgba(220,38,38,0.12)' : 'rgba(45,122,58,0.12)' }}>
            <Clock size={20} style={{ color: daysUntilDue <= 30 ? 'var(--status-danger)' : 'var(--lucky-green-light)' }} />
          </div>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
                Federal Quarterly Estimated Tax — {next1040ES.quarter} {next1040ES.taxYear}
              </h3>
              <span style={{
                background: daysUntilDue <= 30 ? 'var(--status-danger-bg)' : 'var(--status-info-bg)',
                color: daysUntilDue <= 30 ? 'var(--status-danger)' : 'var(--status-info)',
                fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)',
              }}>
                {daysUntilDue === 0 ? 'DUE TODAY' : daysUntilDue === 1 ? 'Due tomorrow' : `${daysUntilDue} days`}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Form 1040-ES · Covers {next1040ES.covers} · Due <strong>{dueDateStr}</strong>
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: '180px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Rough estimate
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: daysUntilDue <= 30 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
              {fmtCurrency(roughEstimate)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
              25% × {fmtCurrency(ytdNet)} YTD net
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 'var(--space-md)',
          fontSize: '0.78rem',
          color: 'var(--text-tertiary)',
          lineHeight: 1.55,
          paddingTop: 'var(--space-sm)',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>This is a placeholder, not a calculation.</strong> The real number depends on your filing status, total household income, deductions, prior-year safe harbor, and SE tax. {ytdNet === 0
            ? 'YTD net is $0 or negative — you may owe nothing this quarter, but confirm with your CPA before skipping a payment.'
            : 'Set this aside in a separate account at minimum until your CPA tells you the actual amount.'}
          {' '}
          <a href="https://www.irs.gov/forms-pubs/about-form-1040-es" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lucky-green-light)', whiteSpace: 'nowrap' }}>
            Form 1040-ES instructions <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
          </a>
          {' · '}
          <a href="https://www.irs.gov/payments/direct-pay" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lucky-green-light)', whiteSpace: 'nowrap' }}>
            Pay via IRS Direct Pay <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
          </a>
        </div>
      </div>

      {/* ─── 1099-NEC ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <FileSignature size={18} /> 1099-NEC Totals — {year}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/contractors" className="btn btn-secondary">
              <ExternalLink size={14} /> Manage contractors
            </Link>
            <button className="btn btn-primary" onClick={export1099} disabled={!c1099.rows.some(r => r.total > 0)}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>1099-NECs to file</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c1099.owedCount > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
              {c1099.owedCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>contractors paid ≥ $600</div>
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Total reportable</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{fmtCurrency(c1099.totalReportable)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>across flagged contractors</div>
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Filing deadline</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Jan 31, {year + 1}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>both to recipient AND IRS</div>
          </div>
        </div>

        {missingW9.length > 0 && (
          <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)', fontSize: '0.85rem' }}>
            <strong>{missingW9.length} contractor{missingW9.length === 1 ? '' : 's'} paid without a W-9 on file.</strong> The IRS expects 24% backup withholding on payments to anyone who didn&apos;t return a W-9. Get one signed before the next payment.
          </div>
        )}

        {c1099.rows.filter(r => r.total > 0).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            No contractor payments tagged for {year}. Tag expenses to a contractor in the receipt modal to see them here.
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Contractor</th>
                  <th style={{ textAlign: 'right' }}>Paid {year}</th>
                  <th>1099?</th>
                  <th>W-9</th>
                  <th>Tax ID</th>
                </tr>
              </thead>
              <tbody>
                {c1099.rows.filter(r => r.total > 0).map(r => (
                  <tr key={r.contractor.id}>
                    <td>
                      <strong>{r.contractor.contactName}</strong>
                      {r.contractor.businessName && <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{r.contractor.businessName}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(r.total)}</td>
                    <td>
                      {r.contractor.exemptFrom1099 ? (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Exempt</span>
                      ) : r.owes ? (
                        <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>Required</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Below $600</span>
                      )}
                    </td>
                    <td>
                      {r.contractor.w9Url ? (
                        <span style={{ color: 'var(--accent-primary, var(--lucky-green-light))', display: 'inline-flex', gap: '4px', alignItems: 'center', fontSize: '0.8rem' }}>
                          <CheckCircle2 size={12} /> on file
                        </span>
                      ) : (
                        <span style={{ color: 'var(--status-danger)', fontSize: '0.78rem' }}>missing</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      {r.contractor.taxIdType?.toUpperCase()} {r.contractor.taxIdLast4 ? `••••${r.contractor.taxIdLast4}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Schedule C ────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Calendar size={18} /> Schedule C Lines — {year}
          </h3>
          <button className="btn btn-primary" onClick={exportScheduleC} disabled={!sched.lines.length}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Mid-year entity cutover controls */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)', fontSize: '0.85rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="checkbox"
              checked={useEntityStart}
              onChange={e => setUseEntityStart(e.target.checked)}
            />
            <span>LLC formed mid-year — only count activity from</span>
            <input
              className="form-input"
              type="date"
              value={entityStartDate}
              onChange={e => setEntityStartDate(e.target.value)}
              disabled={!useEntityStart}
              style={{ flex: '0 0 160px', padding: '4px 8px', fontSize: '0.85rem' }}
            />
            <span style={{ color: 'var(--text-tertiary)' }}>onward (pre-cutover activity goes on personal Schedule C as sole prop)</span>
          </label>
        </div>

        {sched.lines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            No expenses or COGS in {year} {useEntityStart ? `from ${entityStartDate}` : ''}.
          </div>
        ) : (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Part</th>
                <th style={{ width: 70 }}>Line</th>
                <th>Label</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sched.lines.map(l => (
                <tr key={`${l.part}-${l.line}`}>
                  <td><span className="tag" style={{ fontSize: '0.7rem' }}>Part {l.part}</span></td>
                  <td style={{ fontFamily: 'monospace' }}>{l.line}</td>
                  <td>{l.label}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(l.amount)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border-secondary)' }}>
                <td colSpan={2}></td>
                <td style={{ fontWeight: 700 }}>Total Part II (Expenses)</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCurrency(sched.totalPartII)}</td>
              </tr>
              <tr>
                <td colSpan={2}></td>
                <td style={{ fontWeight: 700 }}>Total Part III (COGS)</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCurrency(sched.totalPartIII)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Mileage informational box */}
        {sched.mileage.miles > 0 && (
          <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', background: 'rgba(45,122,58,0.08)', border: '1px solid rgba(45,122,58,0.25)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Car size={16} style={{ flexShrink: 0, color: 'var(--accent-primary)', marginTop: 2 }} />
              <div>
                <strong>Mileage:</strong> {sched.mileage.miles.toFixed(1)} mi × ${sched.mileage.rate.toFixed(2)}/mi = <strong>{fmtCurrency(sched.mileage.deductionStandardMethod)}</strong> standard-method deduction (Schedule C Line 9). Not auto-added because vehicle/fuel OpEx is separately on Lines 9/22 — pick one method per vehicle with your CPA at year-end.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* What's missing */}
      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>What this report does NOT do</h3>
        <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: '1.2rem' }}>
          <li><strong>Depreciation (Form 4562, Line 13).</strong> Equipment over the de-minimis safe harbor ($2,500/item) needs MACRS depreciation or §179 election. Not in here.</li>
          <li><strong>Quarterly estimated tax (1040-ES).</strong> Q2 due Jun 15, Q3 Sep 15, Q4 Jan 15. Calculate with your CPA based on prior-year safe harbor.</li>
          <li><strong>Self-employment tax (Schedule SE).</strong> 15.3% on net Schedule C income, half deductible. Not auto-computed here.</li>
          <li><strong>Sales tax.</strong> NE applies sales tax to <em>some</em> landscaping services (varies by service type). Verify with NE Dept of Revenue + your CPA.</li>
          <li><strong>State income tax / NE filings.</strong> Federal-only computations here.</li>
        </ul>
      </div>
    </div>
  );
}
