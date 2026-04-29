'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  Receipt, Plus, Search, Filter, DollarSign, Clock, CheckCircle2,
  AlertCircle, FileText, ChevronRight, X, CalendarDays, Loader2,
} from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'var(--status-warning)', bg: 'var(--status-warning-bg)', icon: Clock },
  partial: { label: 'Partial', color: 'var(--status-info)', bg: 'var(--status-info-bg)', icon: DollarSign },
  paid: { label: 'Paid', color: 'var(--status-success)', bg: 'var(--status-success-bg)', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'var(--text-tertiary)', bg: 'rgba(255,255,255,0.04)', icon: X },
};

export default function InvoicesPage() {
  const { invoices, jobs, customers, quotes, payments, getCustomer, getJob, getQuote, addInvoice, updatePayment } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [creating, setCreating] = useState(false);

  // Jobs that don't already have an invoice
  const invoiceableJobs = useMemo(() => {
    const invoicedJobIds = new Set(invoices.filter(i => i.jobId).map(i => i.jobId));
    return jobs.filter(j => j.status === 'completed' && !invoicedJobIds.has(j.id));
  }, [jobs, invoices]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const customer = inv.customerId ? getCustomer(inv.customerId) : null;
      const matchSearch = !search || [
        inv.invoiceNumber,
        customer?.firstName, customer?.lastName,
      ].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter, getCustomer]);

  // Stats
  const totalOutstanding = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue')
    .reduce((s, i) => s + ((i.total || 0) - (i.amountPaid || 0)), 0);
  const totalCollected = invoices.filter(i => i.status === 'paid')
    .reduce((s, i) => s + (i.total || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const handleCreateInvoice = async () => {
    if (!selectedJobId) return;
    setCreating(true);
    try {
      const job = getJob(selectedJobId);
      const quote = job?.quoteId ? getQuote(job.quoteId) : null;
      // Job revenue is the canonical billable amount; quote total is the fallback.
      const billable = Number(job?.revenue || job?.total || quote?.total || 0);

      // Robust invoice number: parse trailing digits off existing INV-#### numbers.
      const maxNum = invoices.reduce((max, inv) => {
        const m = String(inv.invoiceNumber || '').match(/(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 1000);
      const invoiceNumber = `INV-${String(maxNum + 1).padStart(4, '0')}`;

      const items = quote?.items?.length
        ? quote.items
        : [{ name: job?.title || 'Service', quantity: 1, unitPrice: billable, total: billable }];
      const subtotal = items.reduce((s, i) => s + (i.total || 0), 0) || billable;

      // Credit any deposit the customer already paid via the public quote page.
      // If they paid $2000 of a $3000 quote upfront, the new invoice opens with
      // amountPaid = $2000 and status = 'partial' so the balance due is $1000.
      const depositPaid = quote?.depositPaidAt
        ? Math.max(0, Number(quote.materialsCost || 0) + Number(quote.deliveryFee || 0))
        : 0;
      const amountPaid = Math.min(depositPaid, subtotal);
      let status = 'unpaid';
      if (amountPaid >= subtotal && subtotal > 0) status = 'paid';
      else if (amountPaid > 0) status = 'partial';

      const depositNote = depositPaid > 0
        ? `Deposit of ${formatCurrency(depositPaid)} paid ${formatDate((quote.depositPaidAt || '').split('T')[0])} via the quote acceptance page has been credited. Balance due: ${formatCurrency(Math.max(0, subtotal - amountPaid))}.`
        : '';

      const newInvoice = await addInvoice({
        jobId: selectedJobId,
        quoteId: job?.quoteId || null,
        customerId: job?.customerId || null,
        invoiceNumber,
        status,
        subtotal,
        taxRate: 0,
        tax: 0,
        total: subtotal,
        amountPaid,
        items,
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : null,
        notes: depositNote,
      });

      // Back-link the deposit payment row to the new invoice so the audit trail
      // (payments list, AR aging, P&L) can tie the cash to the right invoice.
      if (depositPaid > 0 && newInvoice?.id && quote?.depositPaymentIntentId) {
        const depositPayment = payments.find(p => p.stripePaymentIntentId === quote.depositPaymentIntentId);
        if (depositPayment && !depositPayment.invoiceId) {
          try {
            await updatePayment(depositPayment.id, { invoiceId: newInvoice.id });
          } catch (err) {
            console.warn('Could not link deposit payment to invoice:', err);
          }
        }
      }

      setShowCreateModal(false);
      setSelectedJobId('');
    } catch (err) {
      console.error('Error creating invoice:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Invoices</h1>
          <p>Track payments and billing for completed jobs.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} disabled={invoiceableJobs.length === 0}>
            <Plus size={18} /> Create Invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card" style={{ '--accent': 'var(--status-warning)', '--accent-bg': 'var(--status-warning-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><DollarSign /></div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalOutstanding)}</div>
          <div className="stat-card-label">Outstanding</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--status-success)', '--accent-bg': 'var(--status-success-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><CheckCircle2 /></div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalCollected)}</div>
          <div className="stat-card-label">Collected</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--status-danger)', '--accent-bg': 'var(--status-danger-bg)' }}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><AlertCircle /></div>
          </div>
          <div className="stat-card-value">{overdueCount}</div>
          <div className="stat-card-label">Overdue</div>
        </div>
      </div>

      {/* Filters */}
      <div className="table-wrapper">
        <div className="table-header">
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ flex: 1, maxWidth: '300px' }}>
              <Search size={16} />
              <input className="search-input" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="tabs">
              {['all', 'unpaid', 'partial', 'paid', 'overdue'].map(s => (
                <button key={s} className={`tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                  {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Job</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Due Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => {
              const customer = inv.customerId ? getCustomer(inv.customerId) : null;
              const job = inv.jobId ? getJob(inv.jobId) : null;
              const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.unpaid;
              const StatusIcon = cfg.icon;

              return (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`} style={{ fontWeight: 700, color: 'var(--lucky-green-light)' }}>
                      {inv.invoiceNumber}
                    </Link>
                    <div className="table-sub">{formatDate(inv.createdAt)}</div>
                  </td>
                  <td>
                    {customer ? (
                      <div className="table-customer-cell">
                        <div className="table-avatar" style={{ background: 'var(--lucky-green)', color: 'white' }}>
                          {(customer.firstName?.[0] || '') + (customer.lastName?.[0] || '')}
                        </div>
                        <div className="table-name">{customer.firstName} {customer.lastName || ''}</div>
                      </div>
                    ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{job?.title || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(inv.total)}</td>
                  <td style={{ fontWeight: 600, color: inv.amountPaid > 0 ? 'var(--status-success)' : 'var(--text-tertiary)' }}>
                    {formatCurrency(inv.amountPaid)}
                  </td>
                  <td>
                    <span className={`badge`} style={{ background: cfg.bg, color: cfg.color }}>
                      <StatusIcon size={12} style={{ marginRight: '4px' }} />
                      {cfg.label}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{formatDate(inv.dueDate)}</td>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="btn btn-ghost btn-sm">
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '3rem' }}>
                  {invoices.length === 0 ? (
                    <div>
                      <Receipt size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                      <p style={{ fontWeight: 600, marginBottom: '4px' }}>No invoices yet</p>
                      <p style={{ fontSize: '0.82rem' }}>Complete a job and create your first invoice.</p>
                    </div>
                  ) : 'No invoices match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2><Receipt size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Create Invoice</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select Completed Job <span className="required">*</span></label>
                {invoiceableJobs.length === 0 ? (
                  <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                    No completed jobs without invoices.
                  </div>
                ) : (
                  <div className="quote-picker-list">
                    {invoiceableJobs.map(job => {
                      const customer = job.customerId ? getCustomer(job.customerId) : null;
                      const quote = job.quoteId ? getQuote(job.quoteId) : null;
                      const billable = Number(job.revenue || job.total || quote?.total || 0);
                      const depositPaid = quote?.depositPaidAt
                        ? Math.max(0, Number(quote.materialsCost || 0) + Number(quote.deliveryFee || 0))
                        : 0;
                      const isSelected = selectedJobId === job.id;
                      return (
                        <button
                          key={job.id}
                          className={`quote-picker-item ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedJobId(job.id)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{job.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                              {customer ? `${customer.firstName} ${customer.lastName || ''}` : 'No customer'}
                              {quote ? ` • Quote #${quote.quoteNumber}` : ''}
                            </div>
                            {depositPaid > 0 && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--status-success)', marginTop: '2px', fontWeight: 600 }}>
                                ✓ Deposit credit: {formatCurrency(depositPaid)} → balance {formatCurrency(Math.max(0, billable - depositPaid))}
                              </div>
                            )}
                          </div>
                          <div style={{ fontWeight: 800, color: 'var(--lucky-green-light)', fontSize: '0.95rem' }}>
                            {formatCurrency(billable)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateInvoice} disabled={!selectedJobId || creating}>
                {creating ? <><Loader2 size={16} className="spin" /> Creating...</> : <><Receipt size={16} /> Create Invoice</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
