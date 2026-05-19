'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import {
  Receipt, Plus, Search, Filter, DollarSign, Clock, CheckCircle2,
  AlertCircle, FileText, ChevronRight, X, CalendarDays, Loader2, CheckCircle,
  Briefcase, Trash2,
} from 'lucide-react';
import { computeQuoteDeposit } from '@/lib/deposit';
import { customerTypeMeta } from '@/app/(dashboard)/customers/page';

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
  const [mode, setMode] = useState('job'); // 'job' = from completed job, 'blank' = standalone
  const [selectedJobId, setSelectedJobId] = useState('');
  const [blankCustomerId, setBlankCustomerId] = useState('');
  const [blankCustomerSearch, setBlankCustomerSearch] = useState('');
  const [blankItems, setBlankItems] = useState([
    { name: '', quantity: 1, unitPrice: 0 },
  ]);
  const [blankDueDate, setBlankDueDate] = useState(() =>
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [blankNotes, setBlankNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [toast, setToast] = useState(null);

  const resetBlankForm = () => {
    setBlankCustomerId('');
    setBlankCustomerSearch('');
    setBlankItems([{ name: '', quantity: 1, unitPrice: 0 }]);
    setBlankDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setBlankNotes('');
  };

  // Sort customers GC → business → homeowner so subcontract clients (e.g. Jeremiah)
  // are at the top of the picker for the most common use case.
  const sortedCustomers = useMemo(() => {
    const rank = { general_contractor: 0, business: 1, homeowner: 2 };
    const q = blankCustomerSearch.trim().toLowerCase();
    return [...customers]
      .filter(c => {
        if (!q) return true;
        const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        return name.includes(q) || (c.email || '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ra = rank[a.customerType] ?? 3;
        const rb = rank[b.customerType] ?? 3;
        if (ra !== rb) return ra - rb;
        return `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`);
      });
  }, [customers, blankCustomerSearch]);

  const blankSubtotal = useMemo(() => {
    return blankItems.reduce((s, item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.unitPrice) || 0;
      return s + qty * rate;
    }, 0);
  }, [blankItems]);

  const updateBlankItem = (idx, patch) => {
    setBlankItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addBlankItem = (preset = {}) => {
    setBlankItems(prev => [...prev, { name: '', quantity: 1, unitPrice: 0, ...preset }]);
  };
  const removeBlankItem = (idx) => {
    setBlankItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

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

  const handleOpenCreateModal = () => {
    setCreateError(null);
    // Default to 'job' mode when there's a completed job to bill; otherwise 'blank'
    // so the modal opens directly into the usable flow.
    setMode(invoiceableJobs.length > 0 ? 'job' : 'blank');
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    if (creating) return;
    setShowCreateModal(false);
    setSelectedJobId('');
    resetBlankForm();
    setCreateError(null);
  };

  const nextInvoiceNumber = () => {
    const maxNum = invoices.reduce((max, inv) => {
      const m = String(inv.invoiceNumber || '').match(/(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 1000);
    return `INV-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const handleCreateInvoice = async () => {
    if (!selectedJobId) {
      setCreateError('Pick a job before creating the invoice.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const job = getJob(selectedJobId);
      const quote = job?.quoteId ? getQuote(job.quoteId) : null;
      // Job revenue is the canonical billable amount; quote total is the fallback.
      const billable = Number(job?.revenue || job?.total || quote?.total || 0);

      const invoiceNumber = nextInvoiceNumber();

      const items = quote?.items?.length
        ? quote.items
        : [{ name: job?.title || 'Service', quantity: 1, unitPrice: billable, total: billable }];
      const subtotal = items.reduce((s, i) => s + (i.total || 0), 0) || billable;

      // Credit any deposit the customer already paid via the public quote page.
      // If they paid $2000 of a $3000 quote upfront, the new invoice opens with
      // amountPaid = $2000 and status = 'partial' so the balance due is $1000.
      const depositPaid = quote?.depositPaidAt
        ? computeQuoteDeposit(quote)
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
      showToast('success', `Invoice ${invoiceNumber} created`);
    } catch (err) {
      console.error('Error creating invoice:', err);
      setCreateError(err?.message || 'Could not create the invoice. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateBlankInvoice = async () => {
    if (!blankCustomerId) {
      setCreateError('Pick a customer before creating the invoice.');
      return;
    }
    const cleanedItems = blankItems
      .map(it => ({
        name: (it.name || '').trim(),
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
      }))
      .filter(it => it.name && (it.quantity * it.unitPrice) > 0)
      .map(it => ({ ...it, total: +(it.quantity * it.unitPrice).toFixed(2) }));

    if (cleanedItems.length === 0) {
      setCreateError('Add at least one line item with a description and an amount.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const subtotal = cleanedItems.reduce((s, it) => s + it.total, 0);
      const invoiceNumber = nextInvoiceNumber();

      const newInvoice = await addInvoice({
        jobId: null,
        quoteId: null,
        customerId: blankCustomerId,
        invoiceNumber,
        status: 'unpaid',
        subtotal,
        taxRate: 0,
        tax: 0,
        total: subtotal,
        amountPaid: 0,
        items: cleanedItems,
        dueDate: blankDueDate,
        paidDate: null,
        notes: blankNotes.trim() || '',
      });

      handleCloseCreateModal();
      showToast('success', `Invoice ${newInvoice?.invoiceNumber || invoiceNumber} created`);
    } catch (err) {
      console.error('Error creating blank invoice:', err);
      setCreateError(err?.message || 'Could not create the invoice. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Invoices</h1>
          <p>Bill completed jobs or send a blank invoice to anyone (subcontract days, ad-hoc charges, etc.).</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
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
                      <p style={{ fontSize: '0.82rem' }}>Click <strong>Create Invoice</strong> above — bill a completed job or send a blank invoice to anyone.</p>
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
        <div className="modal-overlay" onClick={handleCloseCreateModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2><Receipt size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Create Invoice</h2>
              <button className="btn btn-icon btn-ghost" onClick={handleCloseCreateModal}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {/* Mode switcher */}
              <div className="tabs" style={{ marginBottom: 'var(--space-lg)' }}>
                <button
                  type="button"
                  className={`tab ${mode === 'job' ? 'active' : ''}`}
                  onClick={() => { setMode('job'); setCreateError(null); }}
                  disabled={creating}
                >
                  <Briefcase size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  From a completed job
                </button>
                <button
                  type="button"
                  className={`tab ${mode === 'blank' ? 'active' : ''}`}
                  onClick={() => { setMode('blank'); setCreateError(null); }}
                  disabled={creating}
                >
                  <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Blank invoice
                </button>
              </div>

              {mode === 'job' && (
                <div className="form-group">
                  <label className="form-label">Select Completed Job <span className="required">*</span></label>
                  {invoiceableJobs.length === 0 ? (
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                      No completed jobs without invoices. Switch to <strong>Blank invoice</strong> above to bill anyone directly (subcontract days, ad-hoc charges, etc.).
                    </div>
                  ) : (
                    <div className="quote-picker-list">
                      {invoiceableJobs.map(job => {
                        const customer = job.customerId ? getCustomer(job.customerId) : null;
                        const quote = job.quoteId ? getQuote(job.quoteId) : null;
                        const billable = Number(job.revenue || job.total || quote?.total || 0);
                        const depositPaid = quote?.depositPaidAt
                          ? computeQuoteDeposit(quote)
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
              )}

              {mode === 'blank' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Customer <span className="required">*</span></label>
                    {customers.length === 0 ? (
                      <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        No customers yet. Add one from the <Link href="/customers" style={{ color: 'var(--lucky-green-light)', fontWeight: 700 }}>Customers</Link> page first.
                      </div>
                    ) : (
                      <>
                        <div className="search-input-wrap" style={{ marginBottom: 'var(--space-sm)' }}>
                          <Search size={16} />
                          <input
                            className="search-input"
                            placeholder="Search customers (GCs shown first)..."
                            value={blankCustomerSearch}
                            onChange={e => setBlankCustomerSearch(e.target.value)}
                          />
                        </div>
                        <div className="quote-picker-list" style={{ maxHeight: '220px', overflowY: 'auto' }} data-menu-scroll>
                          {sortedCustomers.slice(0, 50).map(c => {
                            const meta = customerTypeMeta(c.customerType);
                            const isSelected = blankCustomerId === c.id;
                            const displayName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed';
                            return (
                              <button
                                key={c.id}
                                className={`quote-picker-item ${isSelected ? 'active' : ''}`}
                                onClick={() => setBlankCustomerId(c.id)}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem' }}>
                                    {displayName}
                                    {c.customerType && c.customerType !== 'homeowner' && (
                                      <span className={`tag ${meta.tone || ''}`} style={{ fontSize: '0.65rem' }}>{meta.short}</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                    {c.email || c.phone || '—'}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                          {sortedCustomers.length === 0 && (
                            <div style={{ padding: 'var(--space-md)', fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                              No customers match your search.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Line Items <span className="required">*</span></label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '-4px', marginBottom: 'var(--space-sm)' }}>
                      Billing by day? Use Qty = number of days and Rate = day rate (e.g. 5 × $750 = $3,750).
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                      {blankItems.map((item, idx) => {
                        const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 70px 110px auto auto',
                              gap: '6px',
                              alignItems: 'center',
                            }}
                          >
                            <input
                              className="form-input"
                              placeholder="Description (e.g. Subcontract labor — May 11-15)"
                              value={item.name}
                              onChange={e => updateBlankItem(idx, { name: e.target.value })}
                            />
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={e => updateBlankItem(idx, { quantity: e.target.value })}
                              style={{ textAlign: 'right' }}
                            />
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Rate"
                              value={item.unitPrice}
                              onChange={e => updateBlankItem(idx, { unitPrice: e.target.value })}
                              style={{ textAlign: 'right' }}
                            />
                            <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                              {formatCurrency(lineTotal)}
                            </div>
                            <button
                              type="button"
                              className="btn btn-icon btn-ghost"
                              onClick={() => removeBlankItem(idx)}
                              disabled={blankItems.length === 1}
                              title={blankItems.length === 1 ? 'At least one line required' : 'Remove line'}
                              style={{ opacity: blankItems.length === 1 ? 0.3 : 1 }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addBlankItem()}>
                        <Plus size={14} /> Add line
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => addBlankItem({ name: 'Subcontract labor — day rate', quantity: 1, unitPrice: 0 })}
                        title="Pre-fills a day-rate line you just fill in"
                      >
                        <CalendarDays size={14} /> Add day-rate line
                      </button>
                    </div>
                    <div style={{
                      marginTop: 'var(--space-md)',
                      padding: 'var(--space-md)',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 700 }}>Invoice Total</span>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--lucky-green-light)' }}>
                        {formatCurrency(blankSubtotal)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    <div className="form-group">
                      <label className="form-label">Due Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={blankDueDate}
                        onChange={e => setBlankDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes (shown on the invoice & pay page)</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder="Optional. e.g. Payable Net 30 — Venmo @luckylandscapes or call to arrange."
                      value={blankNotes}
                      onChange={e => setBlankNotes(e.target.value)}
                    />
                  </div>
                </>
              )}

              {createError && (
                <div style={{
                  marginTop: 'var(--space-md)',
                  background: 'var(--status-danger-bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start',
                  fontSize: '0.82rem', color: 'var(--status-danger)',
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{createError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseCreateModal} disabled={creating}>Cancel</button>
              {mode === 'job' ? (
                <button className="btn btn-primary" onClick={handleCreateInvoice} disabled={!selectedJobId || creating}>
                  {creating ? <><Loader2 size={16} className="spin" /> Creating...</> : <><Receipt size={16} /> Create Invoice</>}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleCreateBlankInvoice}
                  disabled={!blankCustomerId || blankSubtotal <= 0 || creating}
                >
                  {creating ? <><Loader2 size={16} className="spin" /> Creating...</> : <><Receipt size={16} /> Create Invoice ({formatCurrency(blankSubtotal)})</>}
                </button>
              )}
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
