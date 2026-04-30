'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, DollarSign, CheckCircle2, Clock, AlertCircle,
  Receipt, Trash2, X, AlertTriangle, CreditCard, Send,
  Mail, MessageSquare, Loader2, CheckCircle, Copy, Link as LinkIcon, Banknote,
} from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
  partial: { label: 'Partial', color: 'var(--status-info)', bg: 'var(--status-info-bg)' },
  paid: { label: 'Paid', color: 'var(--status-success)', bg: 'var(--status-success-bg)' },
  overdue: { label: 'Overdue', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--text-tertiary)', bg: 'rgba(255,255,255,0.04)' },
};

const METHOD_LABEL = {
  card: 'Credit/Debit Card',
  ach: 'Bank Transfer (ACH)',
  cash: 'Cash',
  check: 'Check',
  venmo: 'Venmo',
  zelle: 'Zelle',
  other: 'Other',
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const {
    getInvoice, updateInvoice, deleteInvoice, getCustomer, getJob, getQuote,
    getInvoicePayments, addPayment, deletePayment, addActivity,
  } = useData();

  const invoice = getInvoice(id);
  const customer = invoice?.customerId ? getCustomer(invoice.customerId) : null;
  const job = invoice?.jobId ? getJob(invoice.jobId) : null;
  const payments = useMemo(() => (invoice ? getInvoicePayments(id) : []), [invoice, id, getInvoicePayments]);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [recording, setRecording] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTab, setSendTab] = useState('email');
  const [sendEmail, setSendEmail] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendState, setSendState] = useState({ loading: false, success: false, error: null });
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);

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
  const payUrl = invoice.publicToken && typeof window !== 'undefined'
    ? `${window.location.origin}/pay/${invoice.publicToken}`
    : null;

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Record manual payment ─────────────────────────────
  const handleRecordPayment = async () => {
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) return;
    setRecording(true);
    try {
      await addPayment({
        invoiceId: id,
        customerId: invoice.customerId || null,
        amount,
        method: payMethod,
        status: 'succeeded',
        notes: payNotes || null,
        paidAt: new Date().toISOString(),
      });

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
      setPayNotes('');
      showToast('success', `Payment of ${formatCurrency(amount)} recorded`);
    } catch (err) {
      console.error(err);
      showToast('error', err.message || 'Failed to record payment');
    } finally {
      setRecording(false);
    }
  };

  const handleDeletePayment = async (payment) => {
    if (!confirm(`Delete payment of ${formatCurrency(payment.amount)}?`)) return;
    try {
      await deletePayment(payment.id);
      const newAmountPaid = Math.max(0, (invoice.amountPaid || 0) - (payment.amount || 0));
      const newStatus = newAmountPaid <= 0 ? 'unpaid' : (newAmountPaid >= (invoice.total || 0) ? 'paid' : 'partial');
      await updateInvoice(id, {
        amountPaid: newAmountPaid,
        status: newStatus,
        ...(newStatus !== 'paid' ? { paidDate: null } : {}),
      });
      showToast('success', 'Payment removed');
    } catch (err) {
      showToast('error', err.message || 'Failed to delete payment');
    }
  };

  const handleMarkPaid = async () => {
    if (invoice.status === 'paid') {
      showToast('error', 'This invoice is already marked paid.');
      return;
    }
    try {
      await updateInvoice(id, {
        amountPaid: invoice.total,
        status: 'paid',
        paidDate: new Date().toISOString().split('T')[0],
      });
      showToast('success', 'Invoice marked paid');
    } catch (err) {
      showToast('error', err?.message || 'Could not mark invoice paid. Try again.');
    }
  };

  const handleMarkOverdue = async () => {
    if (invoice.status === 'overdue') {
      showToast('error', 'This invoice is already marked overdue.');
      return;
    }
    if (invoice.status === 'paid') {
      showToast('error', 'A paid invoice can\'t be marked overdue.');
      return;
    }
    try {
      await updateInvoice(id, { status: 'overdue' });
      showToast('success', 'Invoice marked overdue');
    } catch (err) {
      showToast('error', err?.message || 'Could not mark invoice overdue. Try again.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteInvoice(id);
      router.push('/invoices');
    } catch (err) {
      console.error('Error deleting invoice:', err);
      setDeleteError(err?.message || 'Could not delete invoice. Try again.');
      setDeleting(false);
    }
  };

  const copyPayLink = async () => {
    if (!payUrl) return;
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('error', 'Could not copy to clipboard');
    }
  };

  // ─── Send modal ─────────────────────────────────────────
  const openSendModal = () => {
    setSendEmail(customer?.email || '');
    setSendPhone(customer?.phone || '');
    setSendMessage('');
    setSendState({ loading: false, success: false, error: null });
    setSendTab('email');
    setShowSendModal(true);
  };

  const handleSendEmail = async () => {
    if (!sendEmail) return;
    setSendState({ loading: true, success: false, error: null });
    try {
      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: id,
          to: sendEmail,
          customMessage: sendMessage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invoice');

      await updateInvoice(id, {
        sentAt: new Date().toISOString(),
        sentVia: invoice.sentVia === 'sms' ? 'both' : 'email',
        sentToEmail: sendEmail,
      });
      await addActivity({
        customerId: invoice.customerId,
        type: 'invoice_sent',
        title: `Invoice ${invoice.invoiceNumber} sent`,
        description: `Emailed to ${sendEmail}`,
      });

      setSendState({ loading: false, success: true, error: null });
      setTimeout(() => {
        setShowSendModal(false);
        showToast('success', `Invoice emailed to ${sendEmail}`);
      }, 1500);
    } catch (err) {
      setSendState({ loading: false, success: false, error: err.message });
    }
  };

  // Pre-formatted SMS body — copy/paste into any messaging app
  const smsBody = useMemo(() => {
    if (!invoice) return '';
    const firstName = customer?.firstName || 'there';
    const lines = [
      `Hi ${firstName}! 🍀 Thanks again for your business — your invoice from Lucky Landscapes is ready.`,
      ``,
      `📄 Invoice ${invoice.invoiceNumber}`,
      `💰 Balance Due: ${formatCurrency(balance)}`,
      invoice.dueDate ? `📅 Due: ${formatDate(invoice.dueDate)}` : null,
      ``,
      sendMessage || null,
      sendMessage ? '' : null,
      `Pay securely online (credit/debit card or bank transfer — takes 30 seconds):`,
      payUrl,
      ``,
      `Questions? Just reply or call (402) 405-5475.`,
      ``,
      `Thanks!`,
      `— The Lucky Landscapes Team`,
    ];
    return lines.filter(l => l !== null).join('\n');
  }, [invoice, customer, balance, sendMessage, payUrl]);

  const markInvoiceSent = async () => {
    try {
      await updateInvoice(id, {
        sentAt: new Date().toISOString(),
        sentVia: invoice.sentVia === 'email' ? 'both' : 'sms',
        ...(sendPhone ? { sentToPhone: sendPhone } : {}),
      });
      await addActivity({
        customerId: invoice.customerId,
        type: 'invoice_sent',
        title: `Invoice ${invoice.invoiceNumber} sent`,
        description: sendPhone ? `Texted to ${sendPhone}` : 'Sent via copied SMS',
      });
    } catch (e) { /* best effort */ }
  };

  const handleCopySms = async () => {
    if (!smsBody) return;
    try {
      await navigator.clipboard.writeText(smsBody);
      await markInvoiceSent();
      setSendState({ loading: false, success: true, error: null });
      setTimeout(() => {
        setShowSendModal(false);
        showToast('success', 'Message copied! Paste into Messages, WhatsApp, etc.');
      }, 1200);
    } catch (err) {
      setSendState({ loading: false, success: false, error: 'Could not copy. Select the text and copy manually.' });
    }
  };

  const handleOpenInMessages = async () => {
    const phoneClean = (sendPhone || '').replace(/[^\d+]/g, '');
    const body = encodeURIComponent(smsBody);
    // iOS uses ?&body=, Android uses ?body=  — ?&body= works on both
    const href = phoneClean ? `sms:${phoneClean}?&body=${body}` : `sms:?&body=${body}`;
    await markInvoiceSent();
    window.location.href = href;
    setTimeout(() => {
      setShowSendModal(false);
      showToast('success', 'Opening Messages…');
    }, 400);
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
            {invoice.sentAt && (
              <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 600 }}>
                Sent {formatDate(invoice.sentAt.split('T')[0])}
              </span>
            )}
          </div>
          <p>Created {formatDate(invoice.createdAt)} {invoice.dueDate ? `• Due ${formatDate(invoice.dueDate)}` : ''}</p>
        </div>
        <div className="page-header-actions">
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <>
              <button className="btn btn-primary" onClick={openSendModal}>
                <Send size={16} /> {invoice.sentAt ? 'Resend Invoice' : 'Send Invoice'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setPayAmount(String(balance.toFixed(2))); setShowPayModal(true); }}>
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
          <button className="btn btn-danger" onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {/* Payment Link Bar */}
      {payUrl && invoice.status !== 'cancelled' && (
        <div className="card" style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--status-info-bg)', color: 'var(--status-info)', borderRadius: 'var(--radius-md)', flexShrink: 0 }}>
            <LinkIcon size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Customer Payment Link</div>
            <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payUrl}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={copyPayLink}>
            {copied ? <><CheckCircle size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
          <a href={payUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            Open
          </a>
        </div>
      )}

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
        <div>
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

          {/* Payment History */}
          <div className="table-wrapper" style={{ marginTop: 'var(--space-md)' }}>
            <div className="table-header">
              <h3>Payment History</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
              </span>
            </div>
            {payments.length === 0 ? (
              <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                <Banknote size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <div>No payments recorded yet</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                  Send the invoice to your customer or record a manual payment.
                </div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '0.82rem' }}>{formatDateTime(p.paidAt || p.createdAt)}</td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{METHOD_LABEL[p.method] || p.method}</span>
                        {p.stripePaymentIntentId && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 2 }}>
                            {p.stripePaymentIntentId.slice(0, 24)}…
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--status-success)' }}>{formatCurrency(p.amount)}</td>
                      <td>
                        <span className="badge" style={{
                          background: p.status === 'succeeded' ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                          color: p.status === 'succeeded' ? 'var(--status-success)' : 'var(--status-warning)',
                        }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.notes || '—'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeletePayment(p)} title="Delete payment">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{customer.email}</div>
                </div>
              </Link>
            ) : <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No customer</p>}
          </div>

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

          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Activity</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Sent</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {invoice.sentAt ? formatDateTime(invoice.sentAt) : 'Not sent yet'}
                </div>
                {invoice.sentVia && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>via {invoice.sentVia}</div>
                )}
              </div>
              {invoice.lastViewedAt && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Viewed by Customer</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatDateTime(invoice.lastViewedAt)}</div>
                </div>
              )}
              {invoice.paidDate && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid On</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(invoice.paidDate)}</div>
                </div>
              )}
            </div>
          </div>

          {invoice.notes && (
            <div className="card">
              <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Notes</h4>
              <p style={{ fontSize: '0.85rem' }}>{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ========== SEND INVOICE MODAL ========== */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => !sendState.loading && setShowSendModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2><Send size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Send Invoice</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !sendState.loading && setShowSendModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {sendState.success ? (
                <div className="send-success-state">
                  <div className="send-success-icon"><CheckCircle size={48} /></div>
                  <h3>{sendTab === 'email' ? 'Invoice Sent!' : 'Message Copied!'}</h3>
                  <p>{sendTab === 'email' ? `${invoice.invoiceNumber} has been emailed` : 'Paste it into your favorite messaging app'}</p>
                </div>
              ) : (
                <>
                  <div style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)',
                    marginBottom: 'var(--space-lg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{invoice.invoiceNumber}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        Includes secure online payment link
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--lucky-green-light)' }}>
                      {formatCurrency(balance)}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', gap: '4px', padding: '4px',
                    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-lg)',
                  }}>
                    <button onClick={() => setSendTab('email')} style={tabBtn(sendTab === 'email')}>
                      <Mail size={16} /> Email
                    </button>
                    <button onClick={() => setSendTab('sms')} style={tabBtn(sendTab === 'sms')}>
                      <MessageSquare size={16} /> Text Message
                    </button>
                  </div>

                  {sendTab === 'email' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Recipient Email <span className="required">*</span></label>
                        <input className="form-input" type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="customer@email.com" disabled={sendState.loading} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Personal Message (optional)</label>
                        <textarea className="form-textarea" rows={3} value={sendMessage} onChange={e => setSendMessage(e.target.value)} placeholder="Add a personal note..." disabled={sendState.loading} />
                      </div>
                      <div style={infoBoxStyle}>
                        <Mail size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>A branded email with the invoice and a secure "Pay Online" button will be sent.</span>
                      </div>
                    </>
                  )}

                  {sendTab === 'sms' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Phone Number (optional)</label>
                        <input className="form-input" type="tel" value={sendPhone} onChange={e => setSendPhone(e.target.value)} placeholder="(402) 555-1234" disabled={sendState.loading} />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          Used for the &quot;Open in Messages&quot; option. Skip to copy only.
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Additional Note (optional)</label>
                        <textarea className="form-textarea" rows={2} value={sendMessage} onChange={e => setSendMessage(e.target.value)} disabled={sendState.loading} />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Message Preview</label>
                        <div style={{
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-md)',
                          padding: 'var(--space-md)',
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.5,
                          maxHeight: '220px',
                          overflowY: 'auto',
                          border: '1px solid var(--border-primary)',
                          fontFamily: 'inherit',
                        }}>{smsBody}</div>
                      </div>

                      <div style={infoBoxStyle}>
                        <MessageSquare size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>Copy the message and paste into iMessage, WhatsApp, or any messaging app — free, no SMS service required.</span>
                      </div>
                    </>
                  )}

                  {sendState.error && (
                    <div style={{
                      background: 'var(--status-danger-bg)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-md)',
                      marginTop: 'var(--space-md)',
                      display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start',
                      fontSize: '0.82rem', color: 'var(--status-danger)',
                    }}>
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{sendState.error}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {!sendState.success && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowSendModal(false)} disabled={sendState.loading}>Cancel</button>
                {sendTab === 'email' ? (
                  <button className="btn btn-primary" onClick={handleSendEmail} disabled={!sendEmail || sendState.loading}>
                    {sendState.loading ? <><Loader2 size={16} className="spin" /> Sending...</> : <><Mail size={16} /> Send Email</>}
                  </button>
                ) : (
                  <>
                    {sendPhone && (
                      <button className="btn btn-secondary" onClick={handleOpenInMessages}>
                        <MessageSquare size={16} /> Open in Messages
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={handleCopySms}>
                      <Copy size={16} /> Copy Message
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== RECORD PAYMENT MODAL ========== */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => !recording && setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2><CreditCard size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Record Manual Payment</h2>
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
                  <option value="card">Credit/Debit Card (manual)</option>
                  <option value="ach">Bank Transfer (manual)</option>
                  <option value="venmo">Venmo</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Check #1234, etc." />
              </div>
              <div style={{ ...infoBoxStyle, marginTop: 0 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>For online payments use the customer payment link — those record automatically when the customer pays.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPayModal(false)} disabled={recording}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRecordPayment} disabled={!payAmount || parseFloat(payAmount) <= 0 || recording}>
                {recording ? <><Loader2 size={16} className="spin" /> Saving...</> : <><DollarSign size={16} /> Record Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== DELETE MODAL ========== */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Delete Invoice</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !deleting && setShowDeleteModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>This action cannot be undone</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Invoice {invoice.invoiceNumber} ({formatCurrency(invoice.total)}) will be permanently deleted. Recorded payments will be unlinked but kept.
                  </div>
                </div>
              </div>
              {deleteError && (
                <div style={{ marginTop: 'var(--space-md)', fontSize: '0.82rem', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} /> {deleteError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <><Loader2 size={16} className="spin" /> Deleting...</> : <><Trash2 size={16} /> Delete</>}
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

const infoBoxStyle = {
  background: 'var(--status-info-bg)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-md)',
  marginTop: 'var(--space-md)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-sm)',
  fontSize: '0.82rem',
  color: 'var(--status-info)',
};

function tabBtn(active) {
  return {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    transition: 'all 0.2s',
    background: active ? 'var(--lucky-green)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
  };
}
