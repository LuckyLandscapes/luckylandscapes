'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import {
  OPEX_CATEGORIES, OPEX_LABELS, RECURRING_INTERVALS,
  buildARAging, AGING_LABELS, fmtCurrency, getPeriodRange, isInPeriod,
} from '@/lib/finance';
import {
  Plus, X, Trash2, Edit3, Save, DollarSign, Calendar, Repeat,
  Receipt, AlertTriangle, BarChart3, TrendingDown, FileText, Building2,
  Send, Mail, Loader2, CheckCircle2, Eye, AlertCircle, CheckCircle, Upload,
  Landmark, ArrowDownToLine, RefreshCw,
} from 'lucide-react';
import ReceiptUpload from '@/components/ReceiptUpload';
import ImportHistoricalExpensesModal from '@/components/ImportHistoricalExpensesModal';

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
    receipt: { url: null, path: null },
  };
}

const METHOD_META = {
  card:   { label: 'Card',          icon: '💳' },
  ach:    { label: 'Bank (ACH)',    icon: '🏦' },
  cash:   { label: 'Cash',          icon: '💵' },
  check:  { label: 'Check',         icon: '🏷️' },
  venmo:  { label: 'Venmo',         icon: '📲' },
  zelle:  { label: 'Zelle',         icon: '⚡' },
  other:  { label: 'Other',         icon: '📦' },
};

export default function FinancePage() {
  const {
    companyExpenses, addCompanyExpense, updateCompanyExpense, deleteCompanyExpense,
    invoices, customers, getCustomer, updateInvoice, getPnL,
  } = useData();
  const { user } = useAuth();

  const [period, setPeriod] = useState('month');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

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

  // Pull cash-basis P&L for the period — gives us paymentsByMethod and the
  // total processor fee for the same window the user is looking at.
  const pnl = useMemo(() => getPnL(period, 'paid'), [getPnL, period]);
  const paymentMethodRows = useMemo(() => {
    const entries = Object.entries(pnl.paymentsByMethod || {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    return entries;
  }, [pnl.paymentsByMethod]);

  // ─── Cash Flow: Stripe payouts (upcoming + recent) ─────────
  const [payoutsData, setPayoutsData] = useState({ loading: true, error: null, configured: false, balance: null, payouts: [] });

  useEffect(() => {
    let cancelled = false;
    async function fetchPayouts() {
      try {
        const res = await fetch('/api/stripe/payouts');
        const data = await res.json();
        if (!cancelled) {
          setPayoutsData({
            loading: false,
            error: res.ok ? null : (data.error || 'Failed to load'),
            configured: !!data.configured,
            balance: data.balance,
            payouts: data.payouts || [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setPayoutsData({ loading: false, error: err.message, configured: false, balance: null, payouts: [] });
        }
      }
    }
    fetchPayouts();
    return () => { cancelled = true; };
  }, []);

  const refreshPayouts = async () => {
    setPayoutsData(p => ({ ...p, loading: true }));
    try {
      const res = await fetch('/api/stripe/payouts');
      const data = await res.json();
      setPayoutsData({
        loading: false,
        error: res.ok ? null : (data.error || 'Failed to load'),
        configured: !!data.configured,
        balance: data.balance,
        payouts: data.payouts || [],
      });
    } catch (err) {
      setPayoutsData(p => ({ ...p, loading: false, error: err.message }));
    }
  };

  // Group Stripe payouts: in-transit / pending = future bank deposits;
  // paid = already landed
  const upcomingPayouts = useMemo(() =>
    payoutsData.payouts.filter(p => p.status === 'pending' || p.status === 'in_transit'),
    [payoutsData.payouts]
  );
  const paidOutPayouts = useMemo(() =>
    payoutsData.payouts.filter(p => p.status === 'paid').slice(0, 5),
    [payoutsData.payouts]
  );

  // ─── Expected income from unpaid invoices, bucketed by due date ─
  // Mirrors A/R aging but forward-looking: groups by week so Riley can see
  // "next week: $X expected" at a glance.
  const expectedIncome = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = {
      thisWeek: { label: 'This week', total: 0, count: 0, end: addDays(today, 7) },
      nextWeek: { label: 'Next week', total: 0, count: 0, end: addDays(today, 14) },
      twoToFour: { label: '2–4 weeks', total: 0, count: 0, end: addDays(today, 30) },
      later: { label: '30+ days out', total: 0, count: 0, end: null },
      overdue: { label: 'Past due (chase)', total: 0, count: 0, end: null },
    };
    for (const inv of invoices) {
      if (inv.status === 'paid' || inv.status === 'cancelled') continue;
      const due = inv.dueDate ? new Date(inv.dueDate + 'T12:00:00') : null;
      const balance = (inv.total || 0) - (inv.amountPaid || 0);
      if (balance <= 0) continue;
      let key;
      if (!due) {
        key = 'later';
      } else if (due < today) {
        key = 'overdue';
      } else if (due <= buckets.thisWeek.end) {
        key = 'thisWeek';
      } else if (due <= buckets.nextWeek.end) {
        key = 'nextWeek';
      } else if (due <= buckets.twoToFour.end) {
        key = 'twoToFour';
      } else {
        key = 'later';
      }
      buckets[key].total += balance;
      buckets[key].count += 1;
    }
    const next30 = buckets.thisWeek.total + buckets.nextWeek.total + buckets.twoToFour.total;
    return { buckets, next30 };
  }, [invoices]);

  // All unpaid invoices (current + overdue), sorted worst-offender first.
  // The card stays visible whenever there's anything outstanding so the Preview
  // button is reachable even before anything goes past due.
  const outstandingInvoices = useMemo(() => {
    const arr = [
      ...aging.buckets.days90plus,
      ...aging.buckets.days90,
      ...aging.buckets.days60,
      ...aging.buckets.days30,
      ...aging.buckets.current,
    ];
    arr.sort((a, b) => b.daysOver - a.daysOver);
    return arr;
  }, [aging]);

  // Track in-flight + per-invoice feedback for the reminder action
  const [sendingId, setSendingId] = useState(null);
  const [reminderResult, setReminderResult] = useState({}); // { [invoiceId]: { ok, msg } }

  const handleSendReminder = async (invoice) => {
    const customer = invoice.customerId ? getCustomer(invoice.customerId) : null;
    if (!customer?.email) {
      setReminderResult(prev => ({ ...prev, [invoice.id]: { ok: false, msg: 'No email on file' } }));
      return;
    }
    setSendingId(invoice.id);
    setReminderResult(prev => ({ ...prev, [invoice.id]: null }));
    try {
      const res = await fetch('/api/send-invoice-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, sentBy: user?.id || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');
      setReminderResult(prev => ({ ...prev, [invoice.id]: { ok: true, msg: `Sent (${json.tone})` } }));
      // Optimistically bump local state — realtime will reconcile within a second
      await updateInvoice(invoice.id, {
        lastReminderAt: new Date().toISOString(),
        reminderCount: (invoice.reminderCount || 0) + 1,
      });
    } catch (err) {
      setReminderResult(prev => ({ ...prev, [invoice.id]: { ok: false, msg: err.message || 'Failed' } }));
    } finally {
      setSendingId(null);
    }
  };

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
      receipt: { url: expense.receiptUrl || null, path: expense.receiptPath || null },
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
        receiptUrl: form.receipt?.url || null,
        receiptPath: form.receipt?.path || null,
      };
      if (editingId) await updateCompanyExpense(editingId, payload);
      else await addCompanyExpense(payload);
      setShowForm(false);
      setForm(emptyForm());
      setEditingId(null);
      showToast('success', editingId ? 'Expense updated' : 'Expense saved');
    } catch (err) {
      setError(err.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    try {
      await deleteCompanyExpense(id);
      showToast('success', 'Expense deleted');
    } catch (err) {
      console.error('Error deleting expense:', err);
      showToast('error', err?.message || 'Could not delete the expense. Try again.');
    }
  };

  const range = getPeriodRange(period);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Finance</h1>
          <p>Track company overhead, recurring bills, and outstanding invoices. <strong>New Expense</strong> works for any date — pick a past date to log historical expenses.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={16} /> Import History
          </button>
          <Link href="/reports" className="btn btn-secondary">
            <BarChart3 size={16} /> P&amp;L Report
          </Link>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> New Expense
          </button>
        </div>
      </div>

      {showImport && <ImportHistoricalExpensesModal onClose={() => setShowImport(false)} />}

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

      {/* Cash Flow — Stripe payouts + expected income from unpaid invoices */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Landmark size={18} style={{ color: 'var(--status-success)' }} />
            Cash Flow
            <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: '0.7rem', fontWeight: 600 }}>
              Money coming in
            </span>
          </h3>
          {payoutsData.configured && (
            <button className="btn btn-ghost btn-sm" onClick={refreshPayouts} disabled={payoutsData.loading} title="Refresh from Stripe">
              {payoutsData.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {payoutsData.loading ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          {/* Left: Stripe payouts */}
          <div>
            <h4 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
              From Stripe → Your Bank
            </h4>
            {payoutsData.loading && !payoutsData.balance && (
              <div style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                <Loader2 size={16} className="animate-spin" /> Loading Stripe data…
              </div>
            )}
            {!payoutsData.loading && !payoutsData.configured && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                Stripe isn&apos;t configured for this environment. Set <code>STRIPE_SECRET_KEY</code> to see live payouts.
              </p>
            )}
            {!payoutsData.loading && payoutsData.configured && payoutsData.error && (
              <p style={{ fontSize: '0.82rem', color: 'var(--status-danger)' }}>
                Couldn&apos;t reach Stripe: {payoutsData.error}
              </p>
            )}
            {payoutsData.configured && payoutsData.balance && (
              <>
                {/* Balance summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: 'var(--space-md)' }}>
                  <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--status-success)' }}>
                      {fmtCurrency(payoutsData.balance.available, 2)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>ready to pay out</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--status-info)' }}>
                      {fmtCurrency(payoutsData.balance.pending, 2)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>still clearing</div>
                  </div>
                </div>

                {/* Upcoming payouts */}
                {upcomingPayouts.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-md)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Arriving in your bank</div>
                    {upcomingPayouts.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <ArrowDownToLine size={14} style={{ color: 'var(--status-info)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{fmtArrival(p.arrivalDate)}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                            {p.status === 'in_transit' ? 'In transit' : 'Scheduled'} · {p.method === 'instant' ? 'Instant' : 'Standard ACH'}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--status-info)' }}>
                          {fmtCurrency(p.amount, 2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recently paid out */}
                {paidOutPayouts.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Recently deposited</div>
                    {paidOutPayouts.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '0.78rem' }}>
                        <CheckCircle2 size={12} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{fmtArrival(p.arrivalDate)}</span>
                        <span style={{ fontWeight: 600 }}>{fmtCurrency(p.amount, 2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {upcomingPayouts.length === 0 && paidOutPayouts.length === 0 && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                    No payouts yet. As customers pay through Stripe, deposits will appear here with arrival dates.
                  </p>
                )}
                <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                  <a href="https://dashboard.stripe.com/payouts" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lucky-green-light)' }}>
                    Full payout history on Stripe →
                  </a>
                </div>
              </>
            )}
          </div>

          {/* Right: Expected income from unpaid invoices */}
          <div>
            <h4 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
              Expected from Unpaid Invoices
            </h4>
            <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next 30 days</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-success)' }}>
                {fmtCurrency(expectedIncome.next30, 2)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                from invoices due in the window — assumes customers pay on time
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Object.entries(expectedIncome.buckets).map(([key, b]) => {
                if (b.total <= 0) return null;
                const isOverdue = key === 'overdue';
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <Calendar size={12} style={{ color: isOverdue ? 'var(--status-danger)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: isOverdue ? 'var(--status-danger)' : undefined }}>
                      {b.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                      {b.count} {b.count === 1 ? 'inv' : 'invs'}
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isOverdue ? 'var(--status-danger)' : 'var(--status-success)', minWidth: 80, textAlign: 'right' }}>
                      {fmtCurrency(b.total, 2)}
                    </span>
                  </div>
                );
              })}
              {expectedIncome.next30 === 0 && expectedIncome.buckets.overdue.total === 0 && expectedIncome.buckets.later.total === 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-md)' }}>
                  No unpaid invoices on file. 🎉
                </p>
              )}
            </div>
            <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              <Link href="/invoices" style={{ color: 'var(--lucky-green-light)' }}>
                View all invoices →
              </Link>
            </div>
          </div>
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
                  <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {e.receiptUrl && (
                        <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" title="View receipt" style={{ flexShrink: 0 }}>
                          <img src={e.receiptUrl} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }} />
                        </a>
                      )}
                      <span>{e.description || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</span>
                    </div>
                  </td>
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

        {/* Sidebar: payments collected + category breakdown + A/R aging */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="card">
            <h4 style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={16} style={{ color: 'var(--status-success)' }} /> Payments Collected
            </h4>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
              Money in for {periodLabel(period).toLowerCase()} — by payment method.
            </div>
            {paymentMethodRows.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {paymentMethodRows.map(([method, amount]) => {
                    const meta = METHOD_META[method] || METHOD_META.other;
                    const pct = pnl.paymentsTotal > 0 ? (amount / pnl.paymentsTotal) * 100 : 0;
                    return (
                      <div key={method}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                          <span>{meta.icon} {meta.label}</span>
                          <strong>{fmtCurrency(amount, 2)}</strong>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--status-success)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span>Total collected</span>
                    <span style={{ color: 'var(--status-success)' }}>{fmtCurrency(pnl.paymentsTotal, 2)}</span>
                  </div>
                  {pnl.processorFees > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--status-warning)' }}>
                        <span>− Stripe / processor fees</span>
                        <span>{fmtCurrency(pnl.processorFees, 2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginTop: 2 }}>
                        <span>Net to your bank</span>
                        <span>{fmtCurrency(pnl.paymentsTotal - pnl.processorFees, 2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>No payments collected in this period.</p>
            )}
          </div>

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

          {/* Dunning — outstanding invoice nudges */}
          {outstandingInvoices.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h4 style={{ margin: 0 }}>Send Payment Reminders</h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{outstandingInvoices.length} outstanding</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0 0 var(--space-md)' }}>
                Email goes friendly &lt;30d, firm 31–60d, urgent 60+d. Auto-sends starting 3 days overdue (max once a week per invoice). Preview shows what the customer sees.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {outstandingInvoices.map(inv => {
                  const customer = inv.customerId ? getCustomer(inv.customerId) : null;
                  const customerName = customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : (inv.customerName || 'Unknown');
                  const hasEmail = !!customer?.email;
                  const isOverdue = inv.daysOver > 0;
                  const tone = inv.daysOver > 60 ? 'urgent' : inv.daysOver > 30 ? 'firm' : 'friendly';
                  const toneColor = isOverdue
                    ? (tone === 'urgent' ? 'var(--status-danger)' : tone === 'firm' ? 'var(--lucky-gold)' : 'var(--status-info)')
                    : 'var(--text-tertiary)';
                  const result = reminderResult[inv.id];
                  const sending = sendingId === inv.id;
                  return (
                    <div key={inv.id} style={{ padding: '8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {customerName}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                            {inv.invoiceNumber || inv.invoice_number} · <span style={{ color: toneColor, fontWeight: 600 }}>
                              {isOverdue ? `${inv.daysOver}d over` : 'Not yet due'}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--status-danger)', whiteSpace: 'nowrap' }}>
                          {fmtCurrency(inv.balance, 2)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', flex: '1 1 100%', minWidth: 0 }}>
                          {inv.reminderCount > 0
                            ? `${inv.reminderCount} reminder${inv.reminderCount !== 1 ? 's' : ''} sent · last ${fmtRelative(inv.lastReminderAt)}`
                            : 'No reminders sent yet'}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flex: '1 1 100%', justifyContent: 'flex-end' }}>
                          <a
                            href={`/api/preview-invoice-reminder?invoiceId=${inv.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.72rem', textDecoration: 'none' }}
                            title="Preview the email the customer would see (opens in new tab)"
                          >
                            <Eye size={12} /> Preview
                          </a>
                          <button
                            className="btn btn-sm"
                            style={{
                              background: tone === 'urgent' ? 'var(--status-danger)' : tone === 'firm' ? 'var(--lucky-gold)' : 'var(--status-info)',
                              color: '#fff', padding: '5px 10px', fontSize: '0.72rem',
                              opacity: hasEmail ? 1 : 0.5, cursor: hasEmail ? 'pointer' : 'not-allowed',
                            }}
                            onClick={() => handleSendReminder(inv)}
                            disabled={!hasEmail || sending}
                            title={hasEmail ? `Send ${tone} reminder now` : 'No email on file'}
                          >
                            {sending ? <><Loader2 size={12} className="spin" /> Sending</> : <><Send size={12} /> Remind</>}
                          </button>
                        </div>
                      </div>
                      {result && (
                        <div style={{ marginTop: '6px', fontSize: '0.7rem', color: result.ok ? 'var(--status-success)' : 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {result.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {result.msg}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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

              <div className="form-group">
                <label className="form-label"><Receipt size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Receipt</label>
                <ReceiptUpload
                  orgId={user?.orgId}
                  scope="company"
                  value={form.receipt}
                  onChange={(receipt) => setForm(f => ({ ...f, receipt }))}
                />
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

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

function periodLabel(p) {
  return ({ week: 'this week', month: 'this month', quarter: 'this quarter', year: 'this year', all: 'all time' })[p] || p;
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  out.setHours(23, 59, 59, 999);
  return out;
}

function fmtArrival(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tom = new Date(today); tom.setDate(tom.getDate() + 1);
  const daysOut = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tom.toDateString()) return 'Tomorrow';
  if (daysOut > 0 && daysOut < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

function fmtRelative(ts) {
  if (!ts) return '';
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
