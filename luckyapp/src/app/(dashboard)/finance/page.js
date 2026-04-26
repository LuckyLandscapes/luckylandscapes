'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data';
import {
  OPEX_CATEGORIES, OPEX_LABELS, RECURRING_INTERVALS,
  buildARAging, AGING_LABELS, fmtCurrency, getPeriodRange, isInPeriod,
} from '@/lib/finance';
import {
  Plus, X, Trash2, Edit3, Save, DollarSign, Calendar, Repeat,
  Receipt, AlertTriangle, BarChart3, TrendingDown, FileText, Building2,
} from 'lucide-react';

const CATEGORY_ICONS = {
  vehicle: '🚐',
  insurance: '🛡️',
  rent: '🏢',
  utilities: '💡',
  software: '💻',
  marketing: '📢',
  office_supplies: '📎',
  fuel: '⛽',
  payroll_tax: '🧾',
  other: '📦',
};

const PERIODS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All Time' },
];

const todayISO = () => new Date().toISOString().split('T')[0];

function emptyForm() {
  return {
    category: 'vehicle',
    description: '',
    amount: '',
    date: todayISO(),
    vendor: '',
    recurring: false,
    recurringInterval: 'monthly',
  };
}

export default function FinancePage() {
  const {
    companyExpenses, addCompanyExpense, updateCompanyExpense, deleteCompanyExpense,
    invoices,
  } = useData();

  const [period, setPeriod] = useState('month');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Filtered expenses (period + category)
  const filtered = useMemo(() => {
    return companyExpenses
      .filter(e => period === 'all' || isInPeriod(e.date || e.createdAt, period))
      .filter(e => categoryFilter === 'all' || e.category === categoryFilter)
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }, [companyExpenses, period, categoryFilter]);

  // Stats
  const totalSpent = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
  const recurringCount = filtered.filter(e => e.recurring).length;
  const recurringTotal = filtered.filter(e => e.recurring).reduce((s, e) => s + Number(e.amount || 0), 0);

  const byCategory = useMemo(() => {
    const map = {};
    for (const cat of OPEX_CATEGORIES) map[cat] = 0;
    for (const e of filtered) {
      const cat = OPEX_CATEGORIES.includes(e.category) ? e.category : 'other';
      map[cat] += Number(e.amount || 0);
    }
    return Object.entries(map)
      .map(([cat, amount]) => ({ cat, amount }))
      .filter(x => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const aging = useMemo(() => buildARAging(invoices), [invoices]);

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (expense) => {
    setForm({
      category: expense.category,
      description: expense.description || '',
      amount: String(expense.amount || ''),
      date: expense.date || todayISO(),
      vendor: expense.vendor || '',
      recurring: !!expense.recurring,
      recurringInterval: expense.recurringInterval || 'monthly',
    });
    setEditingId(expense.id);
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!form.category || !amount || amount <= 0) {
      setError('Category and a positive amount are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        category: form.category,
        description: form.description.trim(),
        amount,
        date: form.date || todayISO(),
        vendor: form.vendor.trim() || null,
        recurring: form.recurring,
        recurringInterval: form.recurring ? form.recurringInterval : null,
      };
      if (editingId) await updateCompanyExpense(editingId, payload);
      else await addCompanyExpense(payload);
      setShowForm(false);
      setForm(emptyForm());
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    await deleteCompanyExpense(id);
  };

  const range = getPeriodRange(period);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Finance</h1>
          <p>Track company overhead, recurring bills, and outstanding invoices.</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-secondary">
            <BarChart3 size={16} /> P&amp;L Report
          </Link>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> New Expense
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card" style={{ '--accent': 'var(--status-warning)', '--accent-bg': 'var(--status-warning-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><TrendingDown /></div></div>
          <div className="stat-card-value">{fmtCurrency(totalSpent)}</div>
          <div className="stat-card-label">Total Overhead ({periodLabel(period)})</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--status-info)', '--accent-bg': 'var(--status-info-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><Repeat /></div></div>
          <div className="stat-card-value">{fmtCurrency(recurringTotal)}</div>
          <div className="stat-card-label">{recurringCount} Recurring Bill{recurringCount !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--status-danger)', '--accent-bg': 'var(--status-danger-bg)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><Receipt /></div></div>
          <div className="stat-card-value">{fmtCurrency(aging.totalAR)}</div>
          <div className="stat-card-label">Accounts Receivable</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--lucky-gold)', '--accent-bg': 'rgba(212,169,62,0.12)' }}>
          <div className="stat-card-header"><div className="stat-card-icon"><AlertTriangle /></div></div>
          <div className="stat-card-value">{fmtCurrency(aging.totals.days30 + aging.totals.days60 + aging.totals.days90 + aging.totals.days90plus)}</div>
          <div className="stat-card-label">Past Due (A/R)</div>
        </div>
      </div>

      {/* Period & filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <div className="tabs">
          {PERIODS.map(p => (
            <button key={p.key} className={`tab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ maxWidth: '220px', padding: '0.45rem 0.6rem', fontSize: '0.82rem' }}>
          <option value="all">All Categories</option>
          {OPEX_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {OPEX_LABELS[c]}</option>)}
        </select>
        {period !== 'all' && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
            {fmtRange(range)}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-md)' }}>
        {/* Expense list */}
        <div className="table-wrapper">
          <div className="table-header">
            <h3>Company Expenses</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{filtered.length} entries</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Vendor</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {fmtDate(e.date || e.createdAt)}
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                      <span>{CATEGORY_ICONS[e.category] || '📦'}</span>
                      {OPEX_LABELS[e.category] || e.category}
                      {e.recurring && (
                        <span title={`Recurring (${e.recurringInterval || 'monthly'})`} style={{ color: 'var(--status-info)' }}>
                          <Repeat size={12} />
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{e.description || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{e.vendor || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--status-warning)' }}>
                    {fmtCurrency(e.amount, 2)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-icon btn-ghost" onClick={() => openEdit(e)} title="Edit">
                        <Edit3 size={14} />
                      </button>
                      <button className="btn btn-icon btn-ghost" onClick={() => handleDelete(e.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>
                    <Building2 size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <p style={{ fontWeight: 600, marginBottom: '4px' }}>No company expenses {period !== 'all' && 'in this period'}</p>
                    <p style={{ fontSize: '0.82rem' }}>Track rent, insurance, software, fuel, and other overhead here.</p>
                    <button className="btn btn-primary btn-sm" onClick={openNew} style={{ marginTop: 'var(--space-md)' }}>
                      <Plus size={14} /> Add Expense
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sidebar: category breakdown + A/R aging */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)' }}>By Category</h4>
            {byCategory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {byCategory.map(({ cat, amount }) => {
                  const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                        <span>{CATEGORY_ICONS[cat]} {OPEX_LABELS[cat]}</span>
                        <strong>{fmtCurrency(amount)}</strong>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--status-warning)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>No expenses to break down.</p>
            )}
          </div>

          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)' }}>A/R Aging</h4>
            {aging.totalAR > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Object.keys(aging.totals).map(key => {
                  const amt = aging.totals[key];
                  const count = aging.buckets[key].length;
                  if (amt === 0) return null;
                  const isOver = key !== 'current';
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isOver ? 'var(--status-danger)' : 'inherit' }}>
                          {AGING_LABELS[key]}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{count} invoice{count !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{fmtCurrency(amt)}</div>
                    </div>
                  );
                })}
                <Link href="/invoices" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-sm)' }}>
                  <FileText size={14} /> View all invoices
                </Link>
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>No outstanding invoices.</p>
            )}
          </div>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2><DollarSign size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> {editingId ? 'Edit' : 'New'} Expense</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category <span className="required">*</span></label>
                  <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {OPEX_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {OPEX_LABELS[c]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date <span className="required">*</span></label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this for?" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount <span className="required">*</span></label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>$</span>
                    <input className="form-input" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ paddingLeft: '28px' }} placeholder="0.00" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input className="form-input" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Shell, Adobe, Geico" />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} />
                  <Repeat size={14} /> This is a recurring bill
                </label>
                {form.recurring && (
                  <select className="form-select" value={form.recurringInterval} onChange={e => setForm(f => ({ ...f, recurringInterval: e.target.value }))} style={{ marginTop: '8px', maxWidth: '200px' }}>
                    {RECURRING_INTERVALS.map(i => <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
                  </select>
                )}
              </div>

              {error && (
                <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving…' : editingId ? 'Update' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function periodLabel(p) {
  return ({ week: 'this week', month: 'this month', quarter: 'this quarter', year: 'this year', all: 'all time' })[p] || p;
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d.includes && d.includes('T') ? d : d + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtRange({ start, end }) {
  const f = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(start)} – ${f(end)}`;
}
