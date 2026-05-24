'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import {
  buildInsuranceClassReport, getWcClasses, getPayrollSettings, fmtCurrency,
} from '@/lib/finance';
import {
  Shield, DollarSign, Briefcase, Download, Settings2,
  AlertTriangle, TrendingDown, ChevronDown, ChevronRight, X,
} from 'lucide-react';

const UNCLASSIFIED_KEY = '__unclassified__';
const currentYear = () => new Date().getFullYear();

// Calendar-year range, capped at "now" for the current year (so it reads YTD
// rather than projecting a full year that hasn't happened yet).
function yearRange(year) {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
  const now = new Date();
  return { start, end: endOfYear > now ? now : endOfYear };
}

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

const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

export default function InsurancePage() {
  const {
    jobs, timeEntries, timeSegments, teamMembers, org,
    updateOrgSettings, updateJob, getCustomer,
  } = useData();

  const [year, setYear] = useState(currentYear());
  const [showConfig, setShowConfig] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);

  const wcClasses = useMemo(() => getWcClasses(org), [org]);
  const payrollSettings = useMemo(() => getPayrollSettings(org), [org]);
  const { start, end } = useMemo(() => yearRange(year), [year]);

  const report = useMemo(() => buildInsuranceClassReport({
    jobs, timeEntries, timeSegments, teamMembers,
    wcClasses, start, end,
    experienceMod: Number(payrollSettings.wcExperienceMod) || 1,
  }), [jobs, timeEntries, timeSegments, teamMembers, wcClasses, start, end, payrollSettings]);

  // Completed jobs in range grouped by class — powers the drill-down + inline re-tag.
  const jobsByClass = useMemo(() => {
    const map = {};
    for (const j of jobs) {
      if (j.status !== 'completed' || !j.completedAt) continue;
      const d = new Date(j.completedAt);
      if (d < start || d > end) continue;
      const key = j.wcClass || UNCLASSIFIED_KEY;
      (map[key] = map[key] || []).push(j);
    }
    return map;
  }, [jobs, start, end]);

  const years = [];
  for (let y = currentYear(); y >= currentYear() - 3; y--) years.push(y);

  const classOptions = [
    ...wcClasses.map(c => ({ value: c.key, label: `${c.label}${c.code ? ` (${c.code})` : ''}` })),
    { value: UNCLASSIFIED_KEY, label: 'Unclassified' },
  ];
  const classLabel = (key) => {
    if (key === UNCLASSIFIED_KEY) return 'Unclassified';
    return wcClasses.find(c => c.key === key)?.label || key;
  };

  const showWc = report.wc.anyRate;
  const showGl = report.gl.anyRate;

  const handleExport = () => {
    const header = ['Class', 'Code', 'Payroll', '% payroll', 'Revenue', '% revenue', 'Crew', 'Hours', 'Jobs'];
    if (showWc) header.push('WC rate /$100', 'Est WC premium');
    if (showGl) header.push('GL rate /$1000', 'Est GL premium');
    const rows = [
      [`Lucky Landscapes — insurance class split — ${year}`],
      [`Generated ${new Date().toLocaleDateString()}  ·  Payroll from clocked time; revenue from completed jobs. Estimate — verify against payroll records & policy.`],
      [],
      header,
    ];
    for (const r of report.rows) {
      const row = [
        r.label, r.code, r.payroll.toFixed(2), pct(r.payroll, report.totals.payroll).toFixed(1),
        r.revenue.toFixed(2), pct(r.revenue, report.totals.revenue).toFixed(1),
        r.headcount, r.hours.toFixed(1), r.jobCount,
      ];
      if (showWc) row.push(r.wcRatePer100 ?? '', r.estWcPremium != null ? r.estWcPremium.toFixed(2) : '');
      if (showGl) row.push(r.glRatePer1000 ?? '', r.estGlPremium != null ? r.estGlPremium.toFixed(2) : '');
      rows.push(row);
    }
    if (report.unallocated.payroll > 0) {
      const row = ['Travel / shop / unallocated', '', report.unallocated.payroll.toFixed(2), '', '', '', '', report.unallocated.hours.toFixed(1), ''];
      rows.push(row);
    }
    const totalRow = ['TOTAL', '', report.totals.payroll.toFixed(2), '', report.totals.revenue.toFixed(2), '', '', report.totals.hours.toFixed(1), ''];
    rows.push(totalRow);
    downloadCsv(`insurance-class-split-${year}.csv`, rows);
  };

  const colSpan = 7 + (showWc ? 1 : 0) + (showGl ? 1 : 0);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Insurance / Audit</h1>
          <p>Payroll &amp; revenue split by class code — {year}{year === currentYear() ? ' (year-to-date)' : ''}</p>
        </div>
        <div className="page-header-actions" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <select className="form-select" value={year} onChange={e => setYear(Number(e.target.value))} style={{ maxWidth: '120px', padding: '0.45rem 0.6rem', fontSize: '0.82rem' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => setShowConfig(true)}>
            <Settings2 size={16} /> Codes &amp; rates
          </button>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Disclaimer — what this is and what to trust */}
      <div className="card" style={{ marginBottom: 'var(--space-md)', borderLeft: '3px solid #f59e0b', background: 'rgba(245, 158, 11, 0.06)' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.84rem', lineHeight: 1.5 }}>
            <strong>Estimate to support an audit — not the audit itself.</strong> Payroll here is derived from
            clocked time (segments → job → the job&apos;s class code), so a job with revenue but no logged hours
            shows revenue but <strong>$0 payroll</strong>. Before sending anything to your carrier, reconcile the
            payroll totals against your actual payroll. Also confirm the <strong>code numbers</strong> below match
            your policy declarations page — the three you gave are 5-digit (general-liability / ISO style); your
            workers&apos;-comp codes may differ (landscaping WC is NCCI&nbsp;0042 / lawn care 9102 / masonry 5022).
            Edit them under <strong>Codes &amp; rates</strong>.
          </div>
        </div>
      </div>

      {/* Savings headline (only once WC rates are entered) */}
      {report.wc.ratesComplete && report.wc.estSavings != null ? (
        <div className="card" style={{ marginBottom: 'var(--space-md)', borderLeft: '3px solid var(--lucky-green)', background: 'var(--lucky-green-glow)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <TrendingDown size={22} style={{ color: 'var(--lucky-green)' }} />
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                ~{fmtCurrency(Math.max(0, report.wc.estSavings))}/yr saved by documenting the split
              </div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                Est. WC premium with records: <strong>{fmtCurrency(report.wc.estPremiumSplit)}</strong> ·
                without records (all payroll at your highest rate): <strong>{fmtCurrency(report.wc.estPremiumAllHighest)}</strong>
                {report.wc.experienceMod !== 1 ? ` · experience mod ${report.wc.experienceMod}` : ''}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              <Shield size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6, color: 'var(--lucky-green)' }} />
              Add the <strong>rate per $100 of payroll</strong> (and/or per $1,000 of revenue) from your policy to
              see your estimated premium per code and how much the split saves you.
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowConfig(true)}>Enter rates</button>
          </div>
        </div>
      )}

      {/* Headline stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${2 + (showWc ? 1 : 0) + (showGl ? 1 : 0)}, 1fr)` }}>
        <StatCard color="var(--status-info)" bg="var(--status-info-bg)" icon={<DollarSign />} label="Total payroll" value={fmtCurrency(report.totals.payroll)} subtitle={`${report.totals.hours.toFixed(0)} paid hrs`} />
        <StatCard color="var(--status-success)" bg="var(--status-success-bg)" icon={<Briefcase />} label="Total revenue" value={fmtCurrency(report.totals.revenue)} subtitle="completed jobs" />
        {showWc && (
          <StatCard color="var(--lucky-green-light)" bg="var(--lucky-green-glow)" icon={<Shield />} label="Est. WC premium"
            value={report.wc.ratesComplete ? fmtCurrency(report.wc.estPremiumSplit) : '—'}
            subtitle={report.wc.ratesComplete ? 'with the split' : 'set all rates'} />
        )}
        {showGl && (
          <StatCard color="var(--status-warning)" bg="var(--status-warning-bg)" icon={<Shield />} label="Est. GL premium"
            value={report.gl.ratesComplete ? fmtCurrency(report.gl.estPremiumTotal) : '—'}
            subtitle={report.gl.ratesComplete ? 'on revenue' : 'set all rates'} />
        )}
      </div>

      {/* Per-code table */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)' }}>By class code</h3>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Class</th>
                <th style={{ textAlign: 'right' }}>Payroll</th>
                <th style={{ textAlign: 'right' }}>% </th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>%</th>
                <th style={{ textAlign: 'right' }}>Crew</th>
                <th style={{ textAlign: 'right' }}>Hours</th>
                {showWc && <th style={{ textAlign: 'right' }}>Est WC</th>}
                {showGl && <th style={{ textAlign: 'right' }}>Est GL</th>}
              </tr>
            </thead>
            <tbody>
              {report.rows.map(r => (
                <tr key={r.key} style={r.isUnclassified ? { background: 'rgba(245, 158, 11, 0.05)' } : undefined}>
                  <td>
                    <strong>{r.label}</strong>
                    {r.code && <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-tertiary)', marginLeft: 6 }}>{r.code}</span>}
                    {r.isUnclassified && r.payroll + r.revenue > 0 && (
                      <div style={{ fontSize: '0.74rem', color: '#f59e0b' }}>Tag these jobs below to classify them</div>
                    )}
                    {!r.isUnclassified && r.desc && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>{r.desc}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(r.payroll)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{pct(r.payroll, report.totals.payroll).toFixed(0)}%</td>
                  <td style={{ textAlign: 'right' }}>{fmtCurrency(r.revenue)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{pct(r.revenue, report.totals.revenue).toFixed(0)}%</td>
                  <td style={{ textAlign: 'right' }}>{r.headcount || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.hours.toFixed(1)}</td>
                  {showWc && <td style={{ textAlign: 'right' }}>{r.estWcPremium != null ? fmtCurrency(r.estWcPremium) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>}
                  {showGl && <td style={{ textAlign: 'right' }}>{r.estGlPremium != null ? fmtCurrency(r.estGlPremium) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>}
                </tr>
              ))}
              {report.unallocated.payroll > 0 && (
                <tr style={{ color: 'var(--text-secondary)' }}>
                  <td>
                    <em>Travel / shop / unallocated</em>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>Driving &amp; yard time not tied to one job&apos;s class</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{fmtCurrency(report.unallocated.payroll)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{pct(report.unallocated.payroll, report.totals.payroll).toFixed(0)}%</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>{report.unallocated.hours.toFixed(1)}</td>
                  {showWc && <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>—</td>}
                  {showGl && <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>—</td>}
                </tr>
              )}
              <tr style={{ borderTop: '2px solid var(--border-color, rgba(255,255,255,0.1))', fontWeight: 700 }}>
                <td>Total</td>
                <td style={{ textAlign: 'right' }}>{fmtCurrency(report.totals.payroll)}</td>
                <td></td>
                <td style={{ textAlign: 'right' }}>{fmtCurrency(report.totals.revenue)}</td>
                <td></td>
                <td></td>
                <td style={{ textAlign: 'right' }}>{report.totals.hours.toFixed(1)}</td>
                {showWc && <td style={{ textAlign: 'right' }}>{report.wc.ratesComplete ? fmtCurrency(report.wc.estPremiumSplit) : ''}</td>}
                {showGl && <td style={{ textAlign: 'right' }}>{report.gl.ratesComplete ? fmtCurrency(report.gl.estPremiumTotal) : ''}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-job drill-down + inline re-tag */}
      <div className="card">
        <button
          onClick={() => setDrillOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 0, cursor: 'pointer', width: '100%', textAlign: 'left', color: 'inherit' }}
        >
          {drillOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <h3 style={{ margin: 0 }}>Completed jobs by class ({year})</h3>
        </button>
        {drillOpen && (
          <div style={{ marginTop: 'var(--space-md)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
              Change a job&apos;s class here to re-bucket its payroll &amp; revenue. New jobs inherit a class from the quote category automatically.
            </p>
            {[...wcClasses.map(c => c.key), UNCLASSIFIED_KEY].map(key => {
              const list = jobsByClass[key] || [];
              if (list.length === 0) return null;
              return (
                <div key={key} style={{ marginBottom: 'var(--space-md)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem', marginBottom: 6, color: key === UNCLASSIFIED_KEY ? '#f59e0b' : 'inherit' }}>
                    {classLabel(key)} · {list.length} job{list.length !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {list.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).map(j => {
                      const cust = j.customerId ? getCustomer(j.customerId) : null;
                      return (
                        <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '6px 8px', background: 'var(--bg-secondary, rgba(255,255,255,0.02))', borderRadius: 8 }}>
                          <span style={{ flex: '1 1 200px', fontSize: '0.84rem' }}>
                            <strong>{j.title || 'Job'}</strong>
                            {cust && <span style={{ color: 'var(--text-tertiary)' }}> · {cust.firstName} {cust.lastName || ''}</span>}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{j.completedAt ? new Date(j.completedAt).toLocaleDateString() : ''}</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{fmtCurrency(Number(j.revenue || j.total || 0))}</span>
                          <select
                            className="form-select"
                            value={j.wcClass || UNCLASSIFIED_KEY}
                            onChange={e => { const v = e.target.value; updateJob(j.id, { wcClass: v === UNCLASSIFIED_KEY ? null : v }); }}
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', maxWidth: 200 }}
                          >
                            {classOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {Object.keys(jobsByClass).length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No completed jobs in {year} yet.</p>
            )}
          </div>
        )}
      </div>

      {showConfig && (
        <WcClassesModal
          wcClasses={wcClasses}
          updateOrgSettings={updateOrgSettings}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}

function StatCard({ color, bg, icon, label, value, subtitle }) {
  return (
    <div className="stat-card" style={{ '--accent': color, '--accent-bg': bg }}>
      <div className="stat-card-header">
        <div className="stat-card-icon">{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {subtitle && <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// Edits organizations.settings.payroll.wcClasses — code number, label, and the
// WC ($/100 payroll) + GL ($/1000 revenue) rates per class. Federal/state burden
// rates and the experience mod are edited separately (Team & Payroll).
function WcClassesModal({ wcClasses, updateOrgSettings, onClose }) {
  const [rows, setRows] = useState(() => wcClasses.map(c => ({
    key: c.key,
    label: c.label || '',
    code: c.code || '',
    desc: c.desc || '',
    wcRatePer100: c.wcRatePer100 != null ? String(c.wcRatePer100) : '',
    glRatePer1000: c.glRatePer1000 != null ? String(c.glRatePer1000) : '',
  })));
  const [saving, setSaving] = useState(false);

  const setField = (i, field, val) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = rows.map(r => ({
        key: r.key,
        label: r.label.trim() || r.key,
        code: r.code.trim(),
        desc: r.desc.trim(),
        wcRatePer100: r.wcRatePer100 !== '' && !isNaN(Number(r.wcRatePer100)) ? Number(r.wcRatePer100) : null,
        glRatePer1000: r.glRatePer1000 !== '' && !isNaN(Number(r.glRatePer1000)) ? Number(r.glRatePer1000) : null,
      }));
      await updateOrgSettings({ payroll: { wcClasses: cleaned } });
      onClose();
    } catch (e) {
      console.error('[insurance] save classes failed', e);
      alert('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>Class codes &amp; rates</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Pull the exact <strong>code numbers</strong> and <strong>rates</strong> from your policy declarations
            page so the estimate matches what your carrier uses. Leave a rate blank if you don&apos;t have it yet —
            the split still works; the premium estimate just stays hidden until both are entered for every class.
          </p>
          {rows.map((r, i) => (
            <div key={r.key} style={{ border: '1px solid var(--border-color, rgba(255,255,255,0.08))', borderRadius: 10, padding: 'var(--space-md)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                <label style={{ fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Name</span>
                  <input className="form-input" value={r.label} onChange={e => setField(i, 'label', e.target.value)} />
                </label>
                <label style={{ fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Code #</span>
                  <input className="form-input" value={r.code} onChange={e => setField(i, 'code', e.target.value)} placeholder="e.g. 97447" />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>WC rate ($ / $100 payroll)</span>
                  <input className="form-input" type="number" step="0.01" min="0" value={r.wcRatePer100} onChange={e => setField(i, 'wcRatePer100', e.target.value)} placeholder="e.g. 8.50" />
                </label>
                <label style={{ fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>GL rate ($ / $1,000 revenue)</span>
                  <input className="form-input" type="number" step="0.01" min="0" value={r.glRatePer1000} onChange={e => setField(i, 'glRatePer1000', e.target.value)} placeholder="e.g. 12.00" />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
