'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  Repeat, Plus, X, Pause, Play, SkipForward, Ban, Copy, CheckCircle,
  CreditCard, Mail, Trash2, Loader2, AlertCircle,
} from 'lucide-react';
import { RECURRING_INTERVALS, describeCadence, addInterval, intervalLabel } from '@/lib/recurring';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d + (String(d).includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS = {
  active: { label: 'Active', color: 'var(--status-success)', bg: 'var(--status-success-bg)' },
  paused: { label: 'Paused', color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--text-tertiary)', bg: 'rgba(255,255,255,0.04)' },
};

export default function RecurringPage() {
  const { recurringPlans, customers, addRecurringPlan, updateRecurringPlan, deleteRecurringPlan, getCustomer } = useData();
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const showToast = (type, message) => { setToast({ type, message }); setTimeout(() => setToast(null), 4000); };

  const plans = [...(recurringPlans || [])].sort((a, b) => {
    const rank = s => (s === 'active' ? 0 : s === 'paused' ? 1 : 2);
    return rank(a.status) - rank(b.status) || String(a.nextRunDate).localeCompare(String(b.nextRunDate));
  });

  const autopayLink = (plan) => (typeof window !== 'undefined' ? `${window.location.origin}/autopay/${plan.publicToken}` : '');

  const copyLink = async (plan) => {
    try {
      await navigator.clipboard.writeText(autopayLink(plan));
      setCopiedId(plan.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { showToast('error', 'Could not copy link'); }
  };

  const pauseResume = async (plan) => {
    await updateRecurringPlan(plan.id, { status: plan.status === 'active' ? 'paused' : 'active' });
    showToast('success', plan.status === 'active' ? 'Plan paused' : 'Plan resumed');
  };
  const skipNext = async (plan) => {
    const next = addInterval(plan.nextRunDate, plan.interval);
    await updateRecurringPlan(plan.id, { nextRunDate: next });
    showToast('success', `Skipped — next bill ${formatDate(next)}`);
  };
  const cancelPlan = async (plan) => {
    if (!confirm(`Cancel "${plan.title}"? No further invoices will be created.`)) return;
    await updateRecurringPlan(plan.id, { status: 'cancelled' });
    showToast('success', 'Plan cancelled');
  };
  const removePlan = async (plan) => {
    if (!confirm(`Delete "${plan.title}" permanently? This removes it from the list.`)) return;
    await deleteRecurringPlan(plan.id);
    showToast('success', 'Plan deleted');
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1><Repeat size={24} style={{ verticalAlign: '-4px', marginRight: 8 }} />Recurring Billing</h1>
          <p>Auto-bill customers on a schedule — mowing, maintenance, anything repeating. Each period we create the invoice and either charge their saved card or send the pay link.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Recurring Plan
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <Repeat size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
            No recurring plans yet. Set one up for a weekly mowing or monthly maintenance customer.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Recurring Plan
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {plans.map(plan => {
            const cust = getCustomer(plan.customerId);
            const cfg = STATUS[plan.status] || STATUS.active;
            const autopay = !!(plan.authorizedAt || plan.stripePaymentMethodId);
            return (
              <div key={plan.id} className="card" style={{ opacity: plan.status === 'cancelled' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem' }}>{plan.title}</strong>
                      <span style={{ background: cfg.bg, color: cfg.color, padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 600 }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                      {cust ? (
                        <Link href={`/customers/${cust.id}`} style={{ fontWeight: 600 }}>{cust.firstName} {cust.lastName}</Link>
                      ) : 'Unknown customer'}
                      {' · '}{describeCadence(plan.amount, plan.interval)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Next: <strong style={{ color: 'var(--text-secondary)' }}>{plan.status === 'active' ? formatDate(plan.nextRunDate) : '—'}</strong></span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {autopay
                          ? <><CreditCard size={13} style={{ color: 'var(--status-success)' }} /> Card on file — autopay</>
                          : <><Mail size={13} /> No card — sends pay link</>}
                      </span>
                    </div>
                  </div>

                  {plan.status !== 'cancelled' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {!autopay && (
                        <button className="btn btn-secondary btn-sm" onClick={() => copyLink(plan)} title="Copy the link the customer uses to save a card for autopay">
                          {copiedId === plan.id ? <><CheckCircle size={14} /> Copied</> : <><Copy size={14} /> Autopay link</>}
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => pauseResume(plan)}>
                        {plan.status === 'active' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
                      </button>
                      {plan.status === 'active' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => skipNext(plan)} title="Skip this period (e.g. rained out) — advances to the next date without billing">
                          <SkipForward size={14} /> Skip
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => cancelPlan(plan)} style={{ color: 'var(--status-danger)' }}>
                        <Ban size={14} /> Cancel
                      </button>
                    </div>
                  )}
                  {plan.status === 'cancelled' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => removePlan(plan)} title="Delete permanently">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewPlanModal
          customers={customers}
          onClose={() => setShowModal(false)}
          onCreate={async (input) => {
            const plan = await addRecurringPlan(input);
            setShowModal(false);
            showToast('success', `Recurring plan created — first bill ${formatDate(input.nextRunDate)}`);
            return plan;
          }}
        />
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

function NewPlanModal({ customers, onClose, onCreate }) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState('weekly');
  const [startDate, setStartDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const amt = parseFloat(amount) || 0;

  const submit = async () => {
    if (!customerId) { setError('Pick a customer.'); return; }
    if (!title.trim()) { setError('Give the plan a name (e.g. Weekly mowing).'); return; }
    if (amt <= 0) { setError('Enter the amount to charge each period.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        customerId,
        title: title.trim(),
        amount: amt,
        interval,
        nextRunDate: startDate,
        paymentMode: 'invoice', // upgrades to 'autopay' when the customer saves a card
        status: 'active',
      });
    } catch (err) {
      setError(err?.message || 'Could not create the plan.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2><Repeat size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} /> New Recurring Plan</h2>
          <button className="btn btn-icon btn-ghost" onClick={() => !saving && onClose()}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Customer <span className="required">*</span></label>
            <select className="form-select" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Choose a customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.address || c.email || c.phone}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Plan name <span className="required">*</span></label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly mowing" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Amount each period <span className="required">*</span></label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>$</span>
                <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={{ paddingLeft: 24 }} placeholder="55.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Frequency</label>
              <select className="form-select" value={interval} onChange={e => setInterval(e.target.value)}>
                {RECURRING_INTERVALS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">First bill date</label>
            <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
              We&rsquo;ll bill {amt > 0 ? formatCurrency(amt) : 'the amount'} on this date, then every {interval === 'biweekly' ? '2 weeks' : interval === 'monthly' ? 'month' : 'week'}.
            </div>
          </div>

          <div style={{ background: 'var(--status-info-bg)', color: 'var(--status-info)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', fontSize: '0.82rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <CreditCard size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>After you create the plan, copy its <strong>Autopay link</strong> and send it to the customer so they can save a card. Until they do, each invoice is emailed with a pay-online link.</span>
          </div>

          {error && (
            <div style={{ marginTop: 'var(--space-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', fontSize: '0.82rem', display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? <><Loader2 size={16} className="spin" /> Creating…</> : <><Plus size={16} /> Create Plan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
