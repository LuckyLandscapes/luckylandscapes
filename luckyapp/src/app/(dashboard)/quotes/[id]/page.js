'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { generateQuotePdf, generateQuotePdfBlob } from '@/lib/generateQuotePdf';
import {
  ArrowLeft, Send, CheckCircle2, XCircle, Printer, Edit3, Trash2, X, AlertTriangle,
  Mail, Loader2, CheckCircle, AlertCircle, MessageSquare, Phone, CalendarDays,
} from 'lucide-react';
import ScheduleJobModal from '@/components/ScheduleJobModal';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export default function QuoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getQuote, getCustomer, updateQuote, deleteQuote, addActivity, jobs } = useData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTab, setSendTab] = useState('email'); // 'email' | 'sms'
  const [sendState, setSendState] = useState({ loading: false, success: false, error: null });
  const [sendEmail, setSendEmail] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const quote = getQuote(id);
  const customer = quote ? getCustomer(quote.customerId) : null;
  const linkedJob = quote ? jobs.find(j => j.quoteId === id) : null;

  if (!quote) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Quote not found</h3>
          <Link href="/quotes" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-md)' }}>
            <ArrowLeft size={16} /> Back to Quotes
          </Link>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (newStatus) => {
    await updateQuote(id, { status: newStatus });
  };

  const handleDelete = async () => {
    await deleteQuote(id);
    router.push('/quotes');
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const openSendModal = () => {
    setSendEmail(customer?.email || '');
    setSendPhone(customer?.phone || '');
    setSendMessage('');
    setSendState({ loading: false, success: false, error: null });
    setSendTab('email');
    setShowSendModal(true);
  };

  // ─── Build SMS text body ──────────────────────────────────
  const buildSmsBody = (pdfUrl) => {
    const lines = [
      `Hi ${customer?.firstName || 'there'}! 🍀 Thanks for considering Lucky Landscapes — we'd love to help bring your project to life!`,
      '',
      `📄 Quote #${quote.quoteNumber}${quote.category ? ` (${quote.category})` : ''}`,
      `💰 Estimated Total: ${formatCurrency(quote.total)}`,
      `📅 Valid for 30 days`,
    ];

    if (sendMessage) {
      lines.push('', sendMessage);
    }

    if (pdfUrl) {
      lines.push('', `View your full estimate (PDF):`, pdfUrl);
    }

    lines.push(
      '',
      `Ready to move forward? Just reply with a "yes" or call us at (402) 405-5475 — we'll get you scheduled!`,
      '',
      `Have questions or want to make changes? We're happy to revise.`,
      '',
      `— The Lucky Landscapes Team`,
    );

    return lines.filter(Boolean).join('\n');
  };

  // ─── Send Email via API ───────────────────────────────────
  const handleSendEmail = async () => {
    if (!sendEmail) return;
    setSendState({ loading: true, success: false, error: null });

    try {
      const res = await fetch('/api/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendEmail,
          customerName: customer ? `${customer.firstName} ${customer.lastName || ''}`.trim() : '',
          quoteNumber: quote.quoteNumber,
          category: quote.category,
          items: quote.items || [],
          total: quote.total,
          message: sendMessage || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      // Update quote status
      await updateQuote(id, { status: 'sent' });
      await addActivity({
        customerId: quote.customerId,
        quoteId: quote.id,
        type: 'quote_sent',
        title: `Quote #${quote.quoteNumber} sent`,
        description: `Emailed to ${sendEmail}`,
      });

      setSendState({ loading: false, success: true, error: null });
      setTimeout(() => {
        setShowSendModal(false);
        showToast('success', `Quote #${quote.quoteNumber} emailed to ${sendEmail}`);
      }, 1500);
    } catch (err) {
      console.error('[browser] Send error:', err);
      setSendState({ loading: false, success: false, error: err.message });
    }
  };

  // ─── Mark quote as sent + log activity ────────────────────
  const markQuoteSent = async (descriptionSuffix = 'via copied SMS') => {
    try {
      await updateQuote(id, { status: 'sent' });
      await addActivity({
        customerId: quote.customerId,
        quoteId: quote.id,
        type: 'quote_sent',
        title: `Quote #${quote.quoteNumber} sent`,
        description: descriptionSuffix,
      });
    } catch { /* best effort */ }
  };

  // ─── Build SMS body, uploading the PDF first ──────────────
  const prepareSmsMessage = async () => {
    const pdfBlob = await generateQuotePdfBlob(quote, customer);
    const formData = new FormData();
    formData.append('file', new File([pdfBlob], `quote-${quote.quoteNumber}.pdf`, { type: 'application/pdf' }));
    formData.append('quoteNumber', quote.quoteNumber);
    const uploadRes = await fetch('/api/upload-quote-pdf', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload PDF');
    return buildSmsBody(uploadData.url);
  };

  const handleCopySms = async () => {
    setSendState({ loading: true, success: false, error: null });
    try {
      const body = await prepareSmsMessage();
      await navigator.clipboard.writeText(body);
      await markQuoteSent(sendPhone ? `Texted to ${sendPhone} with PDF link` : 'Sent via copied SMS');
      setSendState({ loading: false, success: true, error: null });
      setTimeout(() => {
        setShowSendModal(false);
        showToast('success', 'Message copied! Paste into Messages, WhatsApp, etc.');
      }, 1200);
    } catch (err) {
      console.error('[copy SMS] error:', err);
      setSendState({ loading: false, success: false, error: err.message || 'Could not prepare message' });
    }
  };

  const handleOpenInMessages = async () => {
    setSendState({ loading: true, success: false, error: null });
    try {
      const body = await prepareSmsMessage();
      const phoneClean = (sendPhone || '').replace(/[^\d+]/g, '');
      const href = phoneClean
        ? `sms:${phoneClean}?&body=${encodeURIComponent(body)}`
        : `sms:?&body=${encodeURIComponent(body)}`;
      await markQuoteSent(sendPhone ? `Texted to ${sendPhone} with PDF link` : 'Sent via Messages');
      setSendState({ loading: false, success: false, error: null });
      window.location.href = href;
      setTimeout(() => {
        setShowSendModal(false);
        showToast('success', 'Opening Messages…');
      }, 400);
    } catch (err) {
      setSendState({ loading: false, success: false, error: err.message || 'Could not prepare message' });
    }
  };

  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/quotes" className="btn btn-ghost btn-sm" style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={16} /> Quotes
        </Link>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <h1>Quote #{quote.quoteNumber}</h1>
            <span className={`badge badge-${quote.status}`} style={{ fontSize: '0.82rem', padding: '4px 14px' }}>
              <span className="badge-dot" />
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </span>
          </div>
          <p>{quote.category} • Created {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>
        </div>
        <div className="page-header-actions">
          {quote.status === 'draft' && (
            <button className="btn btn-primary" onClick={openSendModal}>
              <Send size={16} /> Send Quote
            </button>
          )}
          {quote.status === 'sent' && (
            <>
              <button className="btn btn-secondary" onClick={openSendModal}>
                <Send size={16} /> Resend Quote
              </button>
              <button className="btn btn-primary" onClick={() => handleStatusChange('accepted')} style={{ background: 'var(--status-success)', borderColor: 'var(--status-success)' }}>
                <CheckCircle2 size={16} /> Mark Accepted
              </button>
              <button className="btn btn-danger" onClick={() => handleStatusChange('declined')}>
                <XCircle size={16} /> Declined
              </button>
            </>
          )}
          {(quote.status === 'accepted' || quote.status === 'sent') && !linkedJob && (
            <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
              <CalendarDays size={16} /> Schedule Job
            </button>
          )}
          {linkedJob && (
            <Link href={`/jobs/${linkedJob.id}`} className="btn btn-primary">
              <CalendarDays size={16} /> View Job →
            </Link>
          )}
          <button className="btn btn-secondary" onClick={async () => await generateQuotePdf(quote, customer)}>
            <Printer size={16} /> PDF
          </button>
          <Link href={`/quotes/${id}/edit`} className="btn btn-secondary">
            <Edit3 size={16} /> Edit
          </Link>
          <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-md)' }}>
        {/* Quote Content */}
        <div>
          {/* Line Items */}
          <div className="table-wrapper">
            <div className="table-header">
              <h3>Line Items</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Service / Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(quote.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.description && <div className="table-sub">{item.description}</div>}
                    </td>
                    <td>{item.quantity}</td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{item.unit}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{
              padding: 'var(--space-lg)',
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 'var(--space-sm)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(quote.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Tax</span>
                <span style={{ fontWeight: 600 }}>$0.00</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', width: '240px',
                paddingTop: 'var(--space-sm)', borderTop: '2px solid var(--border-secondary)',
              }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--lucky-green-light)' }}>
                  {formatCurrency(quote.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="card" style={{ marginTop: 'var(--space-md)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Notes</h4>
              <p style={{ fontSize: '0.85rem' }}>{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Customer Card */}
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
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No customer assigned</p>
            )}
          </div>

          {/* Details Card */}
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{quote.category}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valid For</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>30 days</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{quote.items?.length || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== SEND QUOTE MODAL ========== */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => !sendState.loading && setShowSendModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2><Send size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Send Quote</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !sendState.loading && setShowSendModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {sendState.success ? (
                <div className="send-success-state">
                  <div className="send-success-icon">
                    <CheckCircle size={48} />
                  </div>
                  <h3>Quote Sent!</h3>
                  <p>Quote #{quote.quoteNumber} has been sent successfully</p>
                </div>
              ) : (
                <>
                  {/* Quote summary */}
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
                      <div style={{ fontWeight: 700 }}>Quote #{quote.quoteNumber}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{quote.category}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--lucky-green-light)' }}>
                      {formatCurrency(quote.total)}
                    </div>
                  </div>

                  {/* Tab Switcher */}
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    padding: '4px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-lg)',
                  }}>
                    <button
                      onClick={() => setSendTab('email')}
                      style={{
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
                        background: sendTab === 'email' ? 'var(--lucky-green)' : 'transparent',
                        color: sendTab === 'email' ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      <Mail size={16} /> Email
                    </button>
                    <button
                      onClick={() => setSendTab('sms')}
                      style={{
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
                        background: sendTab === 'sms' ? 'var(--lucky-green)' : 'transparent',
                        color: sendTab === 'sms' ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      <MessageSquare size={16} /> Text Message
                    </button>
                  </div>

                  {/* EMAIL TAB */}
                  {sendTab === 'email' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">
                          Recipient Email <span className="required">*</span>
                        </label>
                        <input
                          className="form-input"
                          type="email"
                          value={sendEmail}
                          onChange={(e) => setSendEmail(e.target.value)}
                          placeholder="customer@email.com"
                          disabled={sendState.loading}
                        />
                        {customer?.firstName && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            Sending to {customer.firstName} {customer.lastName}
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Personal Message (optional)</label>
                        <textarea
                          className="form-textarea"
                          rows={3}
                          value={sendMessage}
                          onChange={(e) => setSendMessage(e.target.value)}
                          placeholder="Add a personal note to include in the email..."
                          disabled={sendState.loading}
                        />
                      </div>

                      <div style={{
                        background: 'var(--status-info-bg)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-sm)',
                        fontSize: '0.82rem',
                        color: 'var(--status-info)',
                      }}>
                        <Mail size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>A branded email with full quote details will be sent to the customer.</span>
                      </div>
                    </>
                  )}

                  {/* SMS TAB */}
                  {sendTab === 'sms' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Phone Number (optional)</label>
                        <input
                          className="form-input"
                          type="tel"
                          value={sendPhone}
                          onChange={(e) => setSendPhone(e.target.value)}
                          placeholder="(402) 555-1234"
                          disabled={sendState.loading}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          Used for the &quot;Open in Messages&quot; button. Skip to copy only.
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Additional Note (optional)</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={sendMessage}
                          onChange={(e) => setSendMessage(e.target.value)}
                          placeholder="Add a personal note..."
                          disabled={sendState.loading}
                        />
                      </div>

                      {/* SMS Preview */}
                      <div style={{
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-primary)',
                      }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          Message Preview
                        </div>
                        {buildSmsBody('https://your-pdf-link.pdf')}
                      </div>

                      <div style={{
                        background: 'var(--status-info-bg)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)',
                        marginTop: 'var(--space-md)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-sm)',
                        fontSize: '0.82rem',
                        color: 'var(--status-info)',
                      }}>
                        <Phone size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>Your PDF is uploaded and a download link is added to the message. Copy it into iMessage, WhatsApp, or any messaging app — free, no SMS service needed.</span>
                      </div>
                    </>
                  )}

                  {sendState.error && (
                    <div style={{
                      background: 'var(--status-danger-bg)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-md)',
                      marginTop: 'var(--space-md)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-sm)',
                      fontSize: '0.82rem',
                      color: 'var(--status-danger)',
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
                <button className="btn btn-secondary" onClick={() => setShowSendModal(false)} disabled={sendState.loading}>
                  Cancel
                </button>

                {sendTab === 'email' ? (
                  <button
                    className="btn btn-primary"
                    onClick={handleSendEmail}
                    disabled={!sendEmail || sendState.loading}
                  >
                    {sendState.loading ? (
                      <><Loader2 size={16} className="spin" /> Sending...</>
                    ) : (
                      <><Mail size={16} /> Send Email</>
                    )}
                  </button>
                ) : (
                  <>
                    {sendPhone && (
                      <button
                        className="btn btn-secondary"
                        onClick={handleOpenInMessages}
                        disabled={sendState.loading}
                      >
                        {sendState.loading ? (
                          <><Loader2 size={16} className="spin" /> Preparing...</>
                        ) : (
                          <><MessageSquare size={16} /> Open in Messages</>
                        )}
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={handleCopySms}
                      disabled={sendState.loading}
                    >
                      {sendState.loading ? (
                        <><Loader2 size={16} className="spin" /> Preparing PDF...</>
                      ) : (
                        <><MessageSquare size={16} /> Copy Message</>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Delete Quote</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>This action cannot be undone</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Quote #{quote.quoteNumber} ({quote.category} — ${quote.total?.toLocaleString()}) will be permanently deleted.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>
                <Trash2 size={16} /> Delete Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Job Modal */}
      {showScheduleModal && (
        <ScheduleJobModal
          quoteId={id}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => {}}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
