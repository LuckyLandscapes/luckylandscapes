'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, DollarSign, CheckCircle2, Clock, AlertCircle,
  Receipt, Trash2, X, AlertTriangle, CreditCard, Send,
  Mail, MessageSquare, Loader2, CheckCircle, Copy, Link as LinkIcon, Banknote,
  Percent, Pencil, Plus, Save, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  estimateCardFee, estimateAchFee, effectiveCardFeePct,
  computeCashDiscount, getCashDiscountPct,
} from '@/lib/paymentFees';

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
    getInvoicePayments, addPayment, deletePayment, addActivity, org,
  } = useData();
  const cashDiscountPct = getCashDiscountPct(org);

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
  const [showEditItems, setShowEditItems] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [savingItems, setSavingItems] = useState(false);
  const [editItemsError, setEditItemsError] = useState(null);

  // These derived values + the smsBody memo must be computed BEFORE the
  // not-found early return below — a Hook (useMemo) after a conditional return
  // breaks the rules of Hooks. They're written null-safe so they also hold up
  // while the invoice is still loading.
  const balance = (invoice?.total || 0) - (invoice?.amountPaid || 0);
  const payUrl = invoice?.publicToken && typeof window !== 'undefined'
    ? `${window.location.origin}/pay/${invoice.publicToken}`
    : null;
  const isPaid = invoice?.status === 'paid';

  // Pre-formatted SMS body — copy/paste into any messaging app
  const smsBody = useMemo(() => {
    if (!invoice) return '';
    const firstName = customer?.firstName || 'there';
    const smsCashOption = computeCashDiscount(balance, cashDiscountPct);
    const lines = isPaid ? [
      `Hi ${firstName}! 🍀 Here's your paid receipt from Lucky Landscapes.`,
      ``,
      `📄 Invoice ${invoice.invoiceNumber}`,
      `✅ Paid in full: ${formatCurrency(invoice.total)}`,
      invoice.paidDate ? `📅 Paid: ${formatDate(invoice.paidDate)}` : null,
      ``,
      sendMessage || null,
      sendMessage ? '' : null,
      `View your receipt online:`,
      payUrl,
      ``,
      `Questions? Just reply or call (402) 405-5475.`,
      ``,
      `Thanks again!`,
      `— The Lucky Landscapes Team`,
    ] : [
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
      cashDiscountPct > 0 ? `💵 Save ${cashDiscountPct}% (${formatCurrency(smsCashOption.discount)}) by paying cash, check, Venmo, or Zelle — just reply to arrange. New balance would be ${formatCurrency(smsCashOption.cashTotal)}.` : null,
      cashDiscountPct > 0 ? `` : null,
      `Questions? Just reply or call (402) 405-5475.`,
      ``,
      `Thanks!`,
      `— The Lucky Landscapes Team`,
    ];
    return lines.filter(l => l !== null).join('\n');
  }, [invoice, customer, balance, sendMessage, payUrl, isPaid, cashDiscountPct]);

  // While `deleting` is true the row may already be gone from local state
  // (the data layer updates before router.push lands). Don't flash the
  // "not found" page during that brief window — let the navigation finish.
  if (!invoice && deleting) return null;
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
  const items = invoice.items || [];
  const editItemsSubtotal = editItems.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0
  );
  const editItemsTotal = editItemsSubtotal + editItemsSubtotal * (Number(invoice.taxRate) || 0);

  // Stripe fee aggregate — only counts non-duplicate rows. The webhook
  // populates processor_fee + net_amount from the actual Stripe charge,
  // so this is the real "what Stripe took" number, not an estimate.
  const totalFees = payments
    .filter(p => !/DUPLICATE|OVERPAYMENT/i.test(p.notes || ''))
    .reduce((sum, p) => sum + Number(p.processorFee || 0), 0);
  const totalNet = payments
    .filter(p => !/DUPLICATE|OVERPAYMENT/i.test(p.notes || ''))
    .reduce((sum, p) => sum + Number(p.netAmount != null ? p.netAmount : (p.amount - (p.processorFee || 0))), 0);

  // Estimates for the unpaid balance — what the fee WOULD be if the customer
  // paid by card vs ACH vs cash. Helps Riley see "if I push them to pay
  // cash, I save $X". Cash-discount math respects the org setting.
  const estCardFee = estimateCardFee(balance);
  const estAchFee  = estimateAchFee(balance);
  const cashOption = computeCashDiscount(balance, cashDiscountPct);

  // Overpayment detection — when amount_paid exceeds invoice total. Almost
  // always means a duplicate payment (manual Mark Paid + Stripe webhook both
  // fired). The webhook flags its row with "DUPLICATE" or "OVERPAYMENT" in
  // notes; we prefer that one for the "delete the duplicate" CTA since it's
  // the audit-traceable Stripe charge, not the manual entry.
  // (Plain const, not useMemo — cheap to compute and we're past an early
  // return, so a Hook would violate rules-of-hooks.)
  const overpayAmount = Math.max(0, (invoice.amountPaid || 0) - (invoice.total || 0));
  let duplicatePayment = null;
  if (overpayAmount > 0) {
    // Prefer payments flagged by the webhook (have DUPLICATE / OVERPAYMENT in notes)
    duplicatePayment = payments.find(p => /DUPLICATE|OVERPAYMENT/i.test(p.notes || ''))
      // Otherwise, the manually-marked one we set "Marked paid…" on
      || payments.find(p => p.method === 'other' && /^Marked paid/i.test(p.notes || ''))
      // Last resort: a payment whose amount matches the overpay difference
      || payments.find(p => Math.abs((p.amount || 0) - overpayAmount) < 0.01)
      || null;
  }

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

  // ─── Edit line items ────────────────────────────────────
  // The invoice is the document that actually gets sent + paid, so it's the
  // source of truth for what's billed (subcontract scope changes, added days,
  // a job that grew). Editing here recomputes subtotal/tax/total and
  // re-derives the status against whatever's already been paid.
  const openEditItems = () => {
    const seed = (invoice.items || []).map(it => ({
      name: it.name || '',
      description: it.description || '',
      quantity: it.quantity ?? 1,
      unitPrice: it.unitPrice ?? 0,
    }));
    setEditItems(seed.length ? seed : [{ name: '', description: '', quantity: 1, unitPrice: 0 }]);
    setEditItemsError(null);
    setShowEditItems(true);
  };
  const updateEditItem = (idx, patch) =>
    setEditItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addEditItem = (preset = {}) =>
    setEditItems(prev => [...prev, { name: '', description: '', quantity: 1, unitPrice: 0, ...preset }]);
  const removeEditItem = (idx) =>
    setEditItems(prev => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleSaveItems = async () => {
    const cleaned = editItems
      .map(it => ({
        name: (it.name || '').trim(),
        description: (it.description || '').trim(),
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
      }))
      .filter(it => it.name && it.quantity * it.unitPrice > 0)
      .map(it => ({ ...it, total: +(it.quantity * it.unitPrice).toFixed(2) }));

    if (cleaned.length === 0) {
      setEditItemsError('Add at least one line item with a description and an amount.');
      return;
    }

    setSavingItems(true);
    setEditItemsError(null);
    try {
      const subtotal = +cleaned.reduce((s, it) => s + it.total, 0).toFixed(2);
      const taxRate = Number(invoice.taxRate) || 0;
      const tax = +(subtotal * taxRate).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);
      const paid = Number(invoice.amountPaid) || 0;

      // Re-derive status from the new total vs what's already been paid. A
      // shrunk total can flip an invoice to paid; a grown one back to partial.
      let status = invoice.status;
      if (paid >= total && total > 0) status = 'paid';
      else if (paid > 0) status = 'partial';
      else if (status === 'paid' || status === 'partial') status = 'unpaid';

      const patch = { items: cleaned, subtotal, tax, total, status };
      if (status === 'paid' && !invoice.paidDate) patch.paidDate = new Date().toISOString().split('T')[0];
      if (status !== 'paid') patch.paidDate = null;

      await updateInvoice(id, patch);
      setShowEditItems(false);
      showToast('success', 'Line items updated');
    } catch (err) {
      console.error('Error updating line items:', err);
      setEditItemsError(err?.message || 'Could not save line items. Try again.');
    } finally {
      setSavingItems(false);
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
    // Guardrail: if the public payment link is still live, the customer may
    // also be paying via Stripe right now. Marking it paid here AND letting
    // Stripe complete the charge has caused $X paid against $X total →
    // duplicate $2X paid against $X total (real incident 2026-05-12).
    if (invoice.publicToken && invoice.status !== 'cancelled') {
      const ok = confirm(
        `The Stripe payment link for this invoice is still live. If the customer also pays via that link, you'll have a duplicate payment to refund.\n\n` +
        `Only continue if you're 100% sure the customer paid by cash/check/etc. and is NOT going to pay through the link.\n\n` +
        `Continue marking paid?`
      );
      if (!ok) return;
    }
    try {
      const balanceDue = Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0));
      // Create a payment row for the balance so cash-basis revenue (P&L,
      // dashboard, /finance payments-by-method) sees the cash. Without this,
      // "Mark Paid" silently flipped the invoice status but never showed up
      // as revenue collected.
      if (balanceDue > 0) {
        await addPayment({
          invoiceId: id,
          customerId: invoice.customerId || null,
          amount: balanceDue,
          method: invoice.paymentMethod || 'other',
          status: 'succeeded',
          notes: 'Marked paid (no method specified — edit on the payments list to correct)',
          paidAt: new Date().toISOString(),
        });
      }
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

      const wasResend = !!invoice.sentAt;
      const noun = invoice.status === 'paid' ? 'Receipt' : 'Invoice';
      await updateInvoice(id, {
        sentAt: new Date().toISOString(),
        sentVia: invoice.sentVia === 'sms' ? 'both' : 'email',
        sentToEmail: sendEmail,
      });
      await addActivity({
        customerId: invoice.customerId,
        type: 'invoice_sent',
        title: `${noun} ${invoice.invoiceNumber} ${wasResend ? 'resent' : 'sent'}`,
        description: `Emailed to ${sendEmail}`,
      });

      setSendState({ loading: false, success: true, error: null });
      setTimeout(() => {
        setShowSendModal(false);
        showToast('success', `${noun} emailed to ${sendEmail}`);
      }, 1500);
    } catch (err) {
      setSendState({ loading: false, success: false, error: err.message });
    }
  };

  const markInvoiceSent = async () => {
    try {
      const wasResend = !!invoice.sentAt;
      const noun = invoice.status === 'paid' ? 'Receipt' : 'Invoice';
      await updateInvoice(id, {
        sentAt: new Date().toISOString(),
        sentVia: invoice.sentVia === 'email' ? 'both' : 'sms',
        ...(sendPhone ? { sentToPhone: sendPhone } : {}),
      });
      await addActivity({
        customerId: invoice.customerId,
        type: 'invoice_sent',
        title: `${noun} ${invoice.invoiceNumber} ${wasResend ? 'resent' : 'sent'}`,
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
          {invoice.status !== 'cancelled' && (
            <button className="btn btn-primary" onClick={openSendModal}>
              <Send size={16} /> {invoice.status === 'paid'
                ? (invoice.sentAt ? 'Resend Receipt' : 'Send Receipt')
                : (invoice.sentAt ? 'Resend Invoice' : 'Send Invoice')}
            </button>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <>
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

      {/* Overpayment alert — appears when amount_paid exceeds total. Almost
          always means a duplicate payment slipped through (manual + Stripe
          both fired). Shows the over-amount + a one-click "Find duplicate"
          that scrolls to and highlights the dupe row in payment history. */}
      {overpayAmount > 0 && (
        <div className="card" style={{
          marginBottom: 'var(--space-md)',
          borderLeft: '4px solid var(--status-danger)',
          background: 'var(--status-danger-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
            <AlertTriangle size={22} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--status-danger)', marginBottom: 4 }}>
                Overpaid by {formatCurrency(overpayAmount)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                This invoice has {formatCurrency(invoice.amountPaid)} paid against {formatCurrency(invoice.total)} owed.
                Most often this is a duplicate — Riley marked it paid AND the customer also paid through the Stripe link.
                {duplicatePayment && (
                  <> The duplicate is flagged in the payment history below.</>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {duplicatePayment && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeletePayment(duplicatePayment)}
                  >
                    <Trash2 size={14} /> Delete the duplicate ({formatCurrency(duplicatePayment.amount)})
                  </button>
                )}
                <a
                  href="https://dashboard.stripe.com/payments"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  Open Stripe to refund
                </a>
              </div>
            </div>
          </div>
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
              background: overpayAmount > 0 ? 'var(--status-danger)' : invoice.status === 'paid' ? 'var(--status-success)' : 'var(--lucky-green)',
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
              {invoice.status !== 'cancelled' && (
                <button className="btn btn-secondary btn-sm" onClick={openEditItems}>
                  <Pencil size={14} /> Edit Items
                </button>
              )}
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
                  {payments.map(p => {
                    const isDupe = /DUPLICATE|OVERPAYMENT/i.test(p.notes || '');
                    return (
                      <tr key={p.id} style={isDupe ? { background: 'var(--status-danger-bg)' } : undefined}>
                        <td style={{ fontSize: '0.82rem' }}>{formatDateTime(p.paidAt || p.createdAt)}</td>
                        <td>
                          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{METHOD_LABEL[p.method] || p.method}</span>
                          {isDupe && (
                            <span className="badge" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger)', marginLeft: 6, fontSize: '0.65rem' }}>
                              <AlertTriangle size={10} style={{ marginRight: 2 }} /> Duplicate
                            </span>
                          )}
                          {p.stripePaymentIntentId && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 2 }}>
                              {p.stripePaymentIntentId.slice(0, 24)}…
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: isDupe ? 'var(--status-danger)' : 'var(--status-success)' }}>
                          {formatCurrency(p.amount)}
                          {(p.processorFee > 0 || p.netAmount != null) && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>
                              − {formatCurrency(p.processorFee || 0)} fee
                              {p.amount > 0 && p.processorFee > 0 && (
                                <> ({((p.processorFee / p.amount) * 100).toFixed(2)}%)</>
                              )}
                              <br />
                              <span style={{ color: 'var(--text-secondary)' }}>
                                = {formatCurrency(p.netAmount != null ? p.netAmount : (p.amount - (p.processorFee || 0)))} net
                              </span>
                            </div>
                          )}
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Fee summary — totals across all payments on this invoice */}
          {totalFees > 0 && (
            <div className="card" style={{ marginTop: 'var(--space-md)' }}>
              <h4 style={{ margin: 0, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Percent size={16} style={{ color: 'var(--status-warning)' }} />
                Processing Fees on this Invoice
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer Paid</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatCurrency(invoice.amountPaid || 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stripe Took</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--status-warning)' }}>
                    − {formatCurrency(totalFees)}
                    {invoice.amountPaid > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: 4 }}>
                        ({((totalFees / invoice.amountPaid) * 100).toFixed(2)}%)
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net to Bank</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--status-success)' }}>{formatCurrency(totalNet)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Fee preview — what each payment method would cost on the unpaid balance */}
          {balance > 0 && invoice.status !== 'cancelled' && (
            <div className="card" style={{ marginTop: 'var(--space-md)' }}>
              <h4 style={{ margin: 0, marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Percent size={16} style={{ color: 'var(--text-tertiary)' }} />
                What You&apos;d Net on the {formatCurrency(balance)} Balance
              </h4>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                Internal estimate — for picking which payment method to nudge the customer toward. Customer never sees these fees; they pay {formatCurrency(balance)} regardless of method (unless they take the cash discount below).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>💳 Card</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{formatCurrency(balance - estCardFee)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--status-warning)' }}>− {formatCurrency(estCardFee)} fee ({effectiveCardFeePct(balance).toFixed(2)}%)</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>🏦 Bank (ACH)</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{formatCurrency(balance - estAchFee)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--status-warning)' }}>− {formatCurrency(estAchFee)} fee (capped at $5)</div>
                </div>
                <div style={{ background: 'var(--lucky-green-glow)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', border: '1px solid var(--lucky-green)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--lucky-green-light)' }}>💵 Cash/Check ({cashDiscountPct}% off)</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{formatCurrency(cashOption.cashTotal)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--lucky-green-light)' }}>− {formatCurrency(cashOption.discount)} discount (no Stripe fee)</div>
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                Card vs cash math: at {cashDiscountPct}% discount, you net about {((cashOption.cashTotal - (balance - estCardFee)) >= 0 ? '+' : '')}
                {formatCurrency(cashOption.cashTotal - (balance - estCardFee))} extra when they pay cash vs card.
              </div>
            </div>
          )}
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
              <h2><Send size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> {isPaid ? 'Send Receipt' : 'Send Invoice'}</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !sendState.loading && setShowSendModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {sendState.success ? (
                <div className="send-success-state">
                  <div className="send-success-icon"><CheckCircle size={48} /></div>
                  <h3>{sendTab === 'email' ? (isPaid ? 'Receipt Sent!' : 'Invoice Sent!') : 'Message Copied!'}</h3>
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
                        {isPaid ? 'Paid in full — sending a copy as a receipt' : 'Includes secure online payment link'}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--lucky-green-light)' }}>
                      {isPaid ? formatCurrency(invoice.total) : formatCurrency(balance)}
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
                        <span>{isPaid
                          ? 'A branded email with the paid invoice as a receipt — includes a "View Invoice" link to the online copy.'
                          : 'A branded email with the invoice and a secure "Pay Online" button will be sent.'}</span>
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
                    {sendState.loading
                      ? <><Loader2 size={16} className="spin" /> Sending...</>
                      : <><Mail size={16} /> {isPaid ? 'Send Receipt' : 'Send Email'}</>}
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

      {/* ========== EDIT LINE ITEMS MODAL ========== */}
      {showEditItems && (
        <div className="modal-overlay" onClick={() => !savingItems && setShowEditItems(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2><Pencil size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Edit Line Items</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !savingItems && setShowEditItems(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {(invoice.amountPaid > 0 || invoice.sentAt) && (
                <div style={{ ...infoBoxStyle, marginTop: 0, marginBottom: 'var(--space-md)' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    {invoice.amountPaid > 0 && <>This invoice already has {formatCurrency(invoice.amountPaid)} paid — changing the total updates the balance due. </>}
                    {invoice.sentAt && <>It was already sent, so re-send it after editing so the customer has the updated version.</>}
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Line Items <span className="required">*</span></label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '-4px', marginBottom: 'var(--space-sm)' }}>
                  Billing by day? Use Qty = number of days and Rate = day rate (e.g. 5 × $750 = $3,750).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {editItems.map((item, idx) => {
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                    return (
                      <div key={idx} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 70px 110px auto auto',
                        gap: '6px',
                        alignItems: 'start',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <input
                            className="form-input"
                            placeholder="Description (e.g. Subcontract labor — May 11-15)"
                            value={item.name}
                            onChange={e => updateEditItem(idx, { name: e.target.value })}
                          />
                          <input
                            className="form-input"
                            placeholder="Extra detail (optional)"
                            value={item.description}
                            onChange={e => updateEditItem(idx, { description: e.target.value })}
                            style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                          />
                        </div>
                        <input
                          className="form-input" type="number" min="0" step="any" placeholder="Qty"
                          value={item.quantity}
                          onChange={e => updateEditItem(idx, { quantity: e.target.value })}
                          style={{ textAlign: 'right' }}
                        />
                        <input
                          className="form-input" type="number" min="0" step="0.01" placeholder="Rate"
                          value={item.unitPrice}
                          onChange={e => updateEditItem(idx, { unitPrice: e.target.value })}
                          style={{ textAlign: 'right' }}
                        />
                        <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', paddingTop: '8px' }}>
                          {formatCurrency(lineTotal)}
                        </div>
                        <button
                          type="button" className="btn btn-icon btn-ghost"
                          onClick={() => removeEditItem(idx)}
                          disabled={editItems.length === 1}
                          title={editItems.length === 1 ? 'At least one line required' : 'Remove line'}
                          style={{ opacity: editItems.length === 1 ? 0.3 : 1 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addEditItem()}>
                    <Plus size={14} /> Add line
                  </button>
                  <button
                    type="button" className="btn btn-secondary btn-sm"
                    onClick={() => addEditItem({ name: 'Subcontract labor — day rate', quantity: 1, unitPrice: 0 })}
                    title="Pre-fills a day-rate line you just fill in"
                  >
                    <CalendarDays size={14} /> Add day-rate line
                  </button>
                </div>
                <div style={{
                  marginTop: 'var(--space-md)', padding: 'var(--space-md)',
                  background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 700 }}>New Invoice Total</span>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--lucky-green-light)' }}>
                    {formatCurrency(editItemsTotal)}
                  </span>
                </div>
              </div>

              {editItemsError && (
                <div style={{
                  background: 'var(--status-danger-bg)', borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start',
                  fontSize: '0.82rem', color: 'var(--status-danger)',
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{editItemsError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditItems(false)} disabled={savingItems}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveItems} disabled={savingItems || editItemsSubtotal <= 0}>
                {savingItems ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> Save Items</>}
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
