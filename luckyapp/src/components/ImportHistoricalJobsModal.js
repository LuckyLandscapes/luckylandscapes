'use client';

import { useState, useRef } from 'react';
import { X, Upload, AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useData } from '@/lib/data';
import {
  parseCsv,
  validateHistoricalJobRows,
  summarizeHistoricalJobs,
  historicalJobsTemplate,
  HISTORICAL_JOB_COLUMNS,
} from '@/lib/csvHistoricalImport';

// Two-step flow: paste/upload CSV → dry-run → apply. Mirrors
// ImportMaterialsModal.js so the UX is consistent across import surfaces.

export default function ImportHistoricalJobsModal({ onClose }) {
  const { customers, bulkImportHistoricalJobs } = useData();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const t = await file.text();
    setText(t);
    setParsed(null);
    setResult(null);
  };

  const handleValidate = () => {
    const { rows, errors: parseErrors } = parseCsv(text);
    if (parseErrors.length) {
      setParsed({ ok: [], errors: parseErrors.map(e => ({ rowIndex: e.row, name: '—', message: e.message })), summary: null });
      return;
    }
    if (rows.length === 0) {
      setParsed({ ok: [], errors: [{ rowIndex: 0, name: '—', message: 'No data rows. Add at least one job under the header.' }], summary: null });
      return;
    }
    const { ok, errors } = validateHistoricalJobRows(rows, customers);
    const summary = summarizeHistoricalJobs(ok);
    setParsed({ ok, errors, summary });
  };

  const handleApply = async () => {
    if (!parsed?.ok?.length) return;
    setApplying(true);
    try {
      const res = await bulkImportHistoricalJobs(parsed.ok);
      setResult(res);
    } catch (err) {
      setResult({ insertedJobs: 0, insertedCustomers: 0, insertedExpenses: 0, errors: [{ item: 'apply', error: err.message || String(err) }] });
    } finally {
      setApplying(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([historicalJobsTemplate()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lucky-historical-jobs-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 920, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2>Import historical jobs</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
          {!result && (
            <>
              <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
                <strong>Backfill old completed jobs from a Google Sheet.</strong> Each row becomes one <code>jobs</code> row tagged <code>completed</code>. Customers are matched by name (case-insensitive); new customers get created with the name only — fill in email/phone later. Optional cost columns spawn <code>job_expenses</code> rows so per-job profit math works.
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
                    <Download size={14} /> Download CSV template
                  </button>
                  <span style={{ marginLeft: 12, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    Required: date_completed, customer_name, title, revenue
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  All columns: {HISTORICAL_JOB_COLUMNS.join(', ')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> Upload .csv
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
                <button className="btn btn-secondary" onClick={() => { setText(historicalJobsTemplate()); setParsed(null); setResult(null); }}>
                  Paste template
                </button>
                <button className="btn btn-secondary" onClick={() => { setText(''); setParsed(null); setResult(null); }}>
                  Clear
                </button>
              </div>

              <textarea
                className="form-textarea"
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'pre' }}
                placeholder={`Paste CSV here. First row must be headers.\n\nExpected columns: ${HISTORICAL_JOB_COLUMNS.join(', ')}`}
                value={text}
                onChange={e => { setText(e.target.value); setParsed(null); }}
              />

              {parsed && (
                <div style={{ marginTop: 'var(--space-md)' }}>
                  {parsed.errors.length > 0 && (
                    <div className="alert alert-danger" style={{ marginBottom: 'var(--space-sm)' }}>
                      <AlertTriangle size={16} /> {parsed.errors.length} row{parsed.errors.length === 1 ? '' : 's'} skipped because of validation errors:
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.85rem' }}>Show errors</summary>
                        <ul style={{ fontSize: '0.78rem', maxHeight: 180, overflowY: 'auto', marginTop: 8 }}>
                          {parsed.errors.map((e, i) => (
                            <li key={i}><strong>Row {e.rowIndex}:</strong> {e.name} — {e.message}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  )}

                  {parsed.summary && parsed.ok.length > 0 && (
                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                      <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(34,197,94,0.10)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#4ade80' }}>{parsed.summary.jobs}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Jobs to create</div>
                      </div>
                      <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(59,130,246,0.10)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#60a5fa' }}>{parsed.summary.newCustomers}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>New customers</div>
                      </div>
                      <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(212,169,62,0.10)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#d4a93e' }}>{parsed.summary.expenses}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Expense rows</div>
                      </div>
                      <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(148,163,184,0.10)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>{parsed.errors.length}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Skipped</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {result && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <CheckCircle2 size={20} style={{ color: '#4ade80' }} />
                <h3 style={{ margin: 0 }}>Import complete</h3>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(34,197,94,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#4ade80' }}>{result.insertedJobs}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Jobs created</div>
                </div>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(59,130,246,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#60a5fa' }}>{result.insertedCustomers}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>New customers</div>
                </div>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: 'rgba(212,169,62,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#d4a93e' }}>{result.insertedExpenses}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Expense rows</div>
                </div>
                <div style={{ flex: 1, padding: 'var(--space-md)', background: result.errors.length ? 'rgba(239,68,68,0.10)' : 'rgba(148,163,184,0.10)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: result.errors.length ? '#f87171' : 'var(--text-tertiary)' }}>{result.errors.length}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Errors</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem' }}>Show errors</summary>
                  <ul style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 8, maxHeight: 220, overflow: 'auto' }}>
                    {result.errors.map((e, i) => <li key={i}><strong>{e.item}:</strong> {e.error}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {!result && !parsed && (
            <>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleValidate} disabled={!text.trim()}>
                Validate
              </button>
            </>
          )}
          {!result && parsed && (
            <>
              <button className="btn btn-secondary" onClick={() => setParsed(null)}>Back to edit</button>
              <button className="btn btn-primary" onClick={handleApply} disabled={applying || !parsed.ok.length}>
                {applying ? <><Loader2 size={14} className="spin" /> Applying…</> : `Import ${parsed.ok.length} job${parsed.ok.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
          {result && (
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
