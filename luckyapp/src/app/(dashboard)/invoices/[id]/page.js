'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, DollarSign, CheckCircle2, Clock, AlertCircle,
  Receipt, Trash2, X, AlertTriangle, CreditCard, Printer, Send,
} from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
  partial: { label: 'Partial', color: 'var(--status-info)', bg: 'var(--status-info-bg)' },
  paid: { label: 'Paid', color: 'var(--status-success)', bg: 'var(--status-success-bg)' },
  overdue: { label: 'Overdue', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--text-tertiary)', bg: 'rgba(255,255,255,0.04)' },
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getInvoice, updateInvoice, deleteInvoice, getCustomer, getJob, getQuote } = useData();

  const invoice = getInvoice(id);
  const customer = invoice?.customerId ? getCustomer(invoice.customerId) : null;
  const job = invoice?.jobId ? getJob(invoice.jobId) : null;
  const quote = invoice?.quoteId ? getQuote(invoice.quoteId) : null;

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (!invoice) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Invoice not found</h3>
          <Link href="/invoices" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-md)' }}>
            <ArrowLeft size={16} /> Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.unpaid;
  const balance = (invoice.total || 0) - (invoice.amountPaid || 0);
  const items = invoice.items || [];

  const handleRecordPayment = async () => {
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) return;

    const newAmountPaid = (invoice.amountPaid || 0) + amount;
    const newStatus = newAmountPaid >= (invoice.total || 0) ? 'paid' : 'partial';

    await updateInvoice(id, {
      amountPaid: newAmountPaid,
      status: newStatus,
      paymentMethod: payMethod,
      ...(newStatus === 'paid' ? { paidDate: new Date().toISOString().split('T')[0] } : {}),
    });
    setShowPayModal(false);
    setPayAmount('');
  };

  const handleMarkPaid = async () => {
    await updateInvoice(id, {
      amountPaid: invoice.total,
      status: 'paid',
      paidDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleMarkOverdue = async () => {
    await updateInvoice(id, { status: 'overdue' });
  };

  const handleDelete = async () => {
    await deleteInvoice(id);
    router.push('/invoices');
  };

  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/invoices" className="btn btn-ghost btn-sm" style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={16} /> Invoices
        </Link>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <h1>{invoice.invoiceNumber}</h1>
            <span style={{ background: cfg.bg, color: cfg.color, padding: '4px 14px', borderRadius: 'var(--radius-pill)', fontSize: '0.82rem', fontWeight: 600 }}>
              {cfg.label}
            </span>
          </div>
          <p>Created {formatDate(invoice.createdAt)} {invoice.dueDate ? `• Due ${formatDate(invoice.dueDate)}` : ''}</p>
        </div>
        <div className="page-header-actions">
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <>
              <button className="btn btn-primary" onClick={() => { setPayAmount(String(balance.toFixed(2))); setShowPayModal(true); }}>
                <CreditCard size={16} /> Record Payment
              </button>
              <button className="btn btn-secondary" onClick={handleMarkPaid} style={{ color: 'var(--status-success)' }}>
                <CheckCircle2 size={16} /> Mark Paid
              </button>
              {invoice.status !== 'overdue' && (
                <button className="btn btn-secondary" onClick={handleMarkOverdue} style={{ color: 'var(--status-danger)' }}>
                  <AlertCircle size={16} /> Mark Overdue
                </button>
              )}
            </>
          )}
          <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {/* Payment Progress Bar */}
      {invoice.status !== 'cancelled' && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Payment Progress</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              {formatCurrency(invoice.amountPaid)} / {formatCurrency(invoice.total)}
            </span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, ((invoice.amountPaid || 0) / (invoice.total || 1)) * 100)}%`,
              background: invoice.status === 'paid' ? 'var(--status-success)' : 'var(--lucky-green)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          {balance > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
              {formatCurrency(balance)} remaining
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-md)' }}>
        {/* Line Items */}
        <div className="table-wrapper">
          <div className="table-header">
            <h3>Line Items</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.description && <div className="table-sub">{item.description}</div>}
                  </td>
                  <td>{item.quantity || 1}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: 'var(--space-lg)', borderTop: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Subtotal</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Tax</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(invoice.tax)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px', paddingTop: 'var(--space-sm)', borderTop: '2px solid var(--border-secondary)' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--lucky-green-light)' }}>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Customer */}
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Customer</h4>
            {customer ? (
              <Link href={`/customers/${customer.id}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div className="table-avatar" style={{ width: 40, height: 40, background: 'var(--lucky-green)', color: 'white' }}>
                  {(customer.firstName?.[0] || '') + (customer.lastName?.[0] || '')}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{customer.firstName} {customer.lastName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{customer.phone}</div>
                </div>
              </Link>
            ) : <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No customer</p>}
          </div>

          {/* Linked Job */}
          {job && (
            <div className="card">
              <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Job</h4>
              <Link href={`/jobs/${job.id}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div className="stat-card-icon" style={{ width: 36, height: 36 }}><Receipt size={18} /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{job.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{job.status?.replace('_', ' ')}</div>
                </div>
              </Link>
            </div>
          )}

          {/* Payment Info */}
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Payment Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>{invoice.paymentMethod || 'Not specified'}</div>
              </div>
              {invoice.paidDate && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid On</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(invoice.paidDate)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="card">
              <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Notes</h4>
              <p style={{ fontSize: '0.85rem' }}>{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2><CreditCard size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Record Payment</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowPayModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Balance Due</span>
                <span style={{ fontWeight: 800, color: 'var(--lucky-green-light)' }}>{formatCurrency(balance)}</span>
              </div>
              <div className="form-group">
                <label className="form-label">Amount <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>$</span>
                  <input className="form-input" type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={{ paddingLeft: '28px' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="venmo">Venmo</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRecordPayment} disabled={!payAmount || parseFloat(payAmount) <= 0}>
                <DollarSign size={16} /> Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Delete Invoice</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowDeleteModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>This action cannot be undone</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Invoice {invoice.invoiceNumber} ({formatCurrency(invoice.total)}) will be permanently deleted.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={16} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
