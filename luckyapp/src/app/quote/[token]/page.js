'use client';

import { useState, useEffect, use } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './quote.css';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function formatUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function QuotePage({ params }) {
  const { token } = use(params);
  const [quote, setQuote] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  // 'review' | 'accept' | 'changes' | 'changes-sent' | 'accepted'
  const [view, setView] = useState('review');
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Decline form
  const [declineReason, setDeclineReason] = useState('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [declineError, setDeclineError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/quotes/public/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Quote not found');
        if (cancelled) return;
        setQuote(data.quote);
        if (data.quote.deposit_paid_at) setView('accepted');
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  // Kick off the Stripe PaymentIntent when the customer clicks "Looks good"
  const startAcceptFlow = async () => {
    setView('accept');
    setPaymentError(null);
    if (clientSecret) return; // already prepared

    setPaymentLoading(true);
    try {
      const res = await fetch('/api/stripe/quote-deposit-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not set up payment');
      setClientSecret(data.clientSecret);
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const submitDecline = async () => {
    const reason = declineReason.trim();
    if (!reason) {
      setDeclineError('Please tell us what you\'d like changed.');
      return;
    }
    setDeclineError(null);
    setDeclineSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send your message');
      setView('changes-sent');
    } catch (err) {
      setDeclineError(err.message);
    } finally {
      setDeclineSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={{ color: '#666', marginTop: 16 }}>Loading your estimate…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h2 style={{ margin: 0, color: '#c33' }}>Unable to load this estimate</h2>
          <p style={{ color: '#666' }}>{loadError}</p>
          <p style={{ color: '#999', fontSize: 13 }}>If you believe this is an error, please call (402) 405-5475.</p>
        </div>
      </div>
    );
  }

  const items = Array.isArray(quote.items) ? quote.items : [];
  const customer = quote.customers || {};
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  const materials = Number(quote.materials_cost || 0);
  const delivery = Number(quote.delivery_fee || 0);
  const deposit = materials + delivery;
  const isAccepted = view === 'accepted' || quote.deposit_paid_at;

  return (
    <div style={styles.page} className="quote-page-root">
      <div style={styles.container}>
        <header style={styles.header} className="quote-header">
          <div style={styles.brand}>
            <span style={styles.brandIcon} className="quote-brand-icon">🍀</span>
            <span style={styles.brandName} className="quote-brand-name">Lucky Landscapes</span>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.invoiceLabel} className="quote-invoice-label">ESTIMATE</div>
            <div style={styles.invoiceNumber} className="quote-invoice-number">#{quote.quote_number}</div>
          </div>
        </header>

        {/* Status banners */}
        {isAccepted && (
          <div style={{ ...styles.banner, background: '#e6f7e6', color: '#1f6f3a', borderColor: '#a5d8a5' }}>
            ✓ Thanks! Your deposit is paid and we&rsquo;ll be in touch shortly to lock in your date.
          </div>
        )}

        <div style={styles.grid} className="quote-grid">
          {/* Left: Estimate details */}
          <div style={styles.detailsCard} className="quote-details-card">
            <div style={styles.metaRow} className="quote-meta-row">
              <div>
                <div style={styles.metaLabel}>Prepared For</div>
                <div style={styles.metaValue}>{customerName || '—'}</div>
                {customer.email && <div style={styles.metaSub}>{customer.email}</div>}
                {customer.address && (
                  <div style={styles.metaSub}>
                    {customer.address}{customer.city ? `, ${customer.city}` : ''}{customer.state ? ` ${customer.state}` : ''}{customer.zip ? ` ${customer.zip}` : ''}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={styles.metaLabel}>Date</div>
                <div style={styles.metaValue}>{formatDate(quote.created_at?.split('T')[0])}</div>
                <div style={{ ...styles.metaLabel, marginTop: 8 }}>Valid for</div>
                <div style={styles.metaValue}>30 days</div>
              </div>
            </div>

            {quote.category && (
              <div style={{ marginBottom: 16 }}>
                <span style={styles.categoryPill}>{quote.category}</span>
              </div>
            )}

            <table style={styles.itemsTable} className="quote-items-table">
              <thead>
                <tr>
                  <th style={styles.th}>Service / Item</th>
                  <th style={{ ...styles.th, textAlign: 'center', width: 60 }}>Qty</th>
                  <th style={{ ...styles.th, textAlign: 'right', width: 100 }}>Price</th>
                  <th style={{ ...styles.th, textAlign: 'right', width: 110 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={styles.td} className="quote-td-name">
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.description && <div style={styles.tdSub}>{item.description}</div>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }} className="quote-td-num">
                      <span className="quote-td-label">Qty</span>
                      <span className="quote-td-value">{item.quantity || 1}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }} className="quote-td-num">
                      <span className="quote-td-label">Price</span>
                      <span className="quote-td-value">{formatUSD(item.unitPrice ?? item.unit_price)}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }} className="quote-td-num">
                      <span className="quote-td-label">Total</span>
                      <span className="quote-td-value">{formatUSD(item.total)}</span>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={4} style={{ ...styles.td, textAlign: 'center', color: '#999' }}>No line items</td></tr>
                )}
              </tbody>
            </table>

            {/* Selected materials gallery — visual confirmation of the
                specific products the team will install. No prices here. */}
            {Array.isArray(quote.selected_materials) && quote.selected_materials.length > 0 && (
              <div style={{ marginTop: 28, marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#2D4A22' }}>Materials we&apos;ll be using</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>These are the specific products we&apos;ve selected for your project.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                  {quote.selected_materials.map((sm, i) => (
                    <div key={`${sm.materialId || 'm'}-${i}`} style={{ background: '#F7F5F0', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                      <div style={{ aspectRatio: '4 / 3', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sm.imageUrl ? <img src={sm.imageUrl} alt={sm.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28 }}>📦</span>}
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#222', lineHeight: 1.3 }}>{sm.name}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{sm.quantity} {sm.unit}</div>
                        {(sm.color || sm.texture) && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                            {[sm.color, sm.texture].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {sm.notes && (
                          <div style={{ fontSize: 11, color: '#444', marginTop: 4, fontStyle: 'italic' }}>{sm.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.totals}>
              <div style={styles.totalRow} className="quote-total-row"><span>Estimated Total</span><span>{formatUSD(quote.total)}</span></div>
            </div>

            {quote.notes && (
              <div style={styles.notes}>
                <div style={styles.notesLabel}>Notes</div>
                <div>{quote.notes}</div>
              </div>
            )}
          </div>

          {/* Right: Action panel */}
          <div style={styles.actionCard} className="quote-card-sticky quote-action-card">
            {view === 'review' && (
              <ReviewPanel
                deposit={deposit}
                materials={materials}
                delivery={delivery}
                onAccept={startAcceptFlow}
                onRequestChanges={() => setView('changes')}
              />
            )}

            {view === 'accept' && (
              <AcceptPanel
                deposit={deposit}
                materials={materials}
                delivery={delivery}
                clientSecret={clientSecret}
                paymentError={paymentError}
                paymentLoading={paymentLoading}
                customerEmail={customer.email}
                quoteNumber={quote.quote_number}
                onBack={() => setView('review')}
                onPaid={() => setView('accepted')}
              />
            )}

            {view === 'changes' && (
              <ChangesPanel
                value={declineReason}
                onChange={setDeclineReason}
                submitting={declineSubmitting}
                error={declineError}
                onBack={() => { setView('review'); setDeclineError(null); }}
                onSubmit={submitDecline}
              />
            )}

            {view === 'changes-sent' && (
              <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ fontSize: 56 }}>✉️</div>
                <h3 style={{ margin: '12px 0 6px', color: '#1f6f3a', fontSize: 18 }}>Got it — we&rsquo;ll be in touch</h3>
                <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.5 }}>
                  We received your notes and will follow up with a revised estimate or a quick call to walk through the changes.
                </p>
              </div>
            )}

            {view === 'accepted' && (
              <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ fontSize: 56 }}>✓</div>
                <h3 style={{ margin: '12px 0 6px', color: '#1f6f3a', fontSize: 18 }}>Deposit Received!</h3>
                <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.5 }}>
                  Your deposit for Quote #{quote.quote_number} has been received.
                  We&rsquo;ll reach out within one business day to lock in your scheduled date.
                </p>
                <p style={{ color: '#6b7280', fontSize: 12, marginTop: 16 }}>
                  Bank transfers may take 3-5 business days to fully clear, but your spot is reserved.
                </p>
              </div>
            )}
          </div>
        </div>

        <footer style={styles.footer} className="quote-footer">
          <div>Lucky Landscapes • (402) 405-5475 • rileykopf@luckylandscapes.com</div>
          <div style={{ marginTop: 4 }}>109 South Canopy ST, Lincoln, NE</div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
            Prefer to pay cash or check? Call us and we&rsquo;ll arrange pickup or mailing.
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function ReviewPanel({ deposit, materials, delivery, onAccept, onRequestChanges }) {
  return (
    <div>
      <h3 style={styles.panelHeading} className="quote-panel-heading">How does it look? 🌿</h3>
      <p style={styles.panelBody}>
        Have a look through the line items below. When you&rsquo;re ready, accept to lock in your spot — or let us know what you&rsquo;d like adjusted and we&rsquo;ll send a revised estimate.
      </p>

      {deposit > 0 && (
        <div style={styles.depositBox} className="quote-deposit-box">
          <div style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>
            Deposit to Schedule
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', padding: '4px 0' }}>
            <span>Materials</span><span style={{ fontWeight: 600 }}>{formatUSD(materials)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', padding: '4px 0' }}>
            <span>Delivery</span><span style={{ fontWeight: 600 }}>{formatUSD(delivery)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            paddingTop: 8, borderTop: '1px solid #e5e7eb',
            fontSize: 16, fontWeight: 800, color: '#1f6f3a',
          }}>
            <span>Due now</span><span>{formatUSD(deposit)}</span>
          </div>
          <p style={{ fontSize: 12, color: '#4b5563', marginTop: 8, lineHeight: 1.4 }}>
            The remainder is invoiced after the work is done.
          </p>
        </div>
      )}

      {deposit === 0 && (
        <div style={styles.depositBox} className="quote-deposit-box">
          <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
            No deposit needed — just hit accept and we&rsquo;ll reach out to schedule.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        <button onClick={onAccept} style={styles.primaryBtn} className="quote-primary-btn">
          {deposit > 0 ? `Looks good — pay ${formatUSD(deposit)}` : 'Looks good — accept estimate'}
        </button>
        <button onClick={onRequestChanges} style={styles.secondaryBtn} className="quote-secondary-btn">
          Request changes
        </button>
      </div>

      <p style={styles.helperText}>
        Prefer to pay by cash or check?{' '}
        <a href="tel:+14024055475" style={styles.helperLink}>Call (402) 405-5475</a>
        {' '}and we&rsquo;ll arrange pickup or mailing.
      </p>
    </div>
  );
}

function AcceptPanel({ deposit, materials, delivery, clientSecret, paymentError, paymentLoading, customerEmail, quoteNumber, onBack, onPaid }) {
  return (
    <div>
      <button onClick={onBack} style={styles.backLink}>← Back</button>

      <h3 style={styles.panelHeading} className="quote-panel-heading">Pay deposit to schedule</h3>
      <p style={styles.panelBody}>
        Once payment clears, your estimate is auto-accepted and we&rsquo;ll reach out to set your date.
      </p>

      <div style={styles.depositBox} className="quote-deposit-box">
        {materials > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', padding: '4px 0' }}>
            <span>Materials</span><span style={{ fontWeight: 600 }}>{formatUSD(materials)}</span>
          </div>
        )}
        {delivery > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', padding: '4px 0' }}>
            <span>Delivery</span><span style={{ fontWeight: 600 }}>{formatUSD(delivery)}</span>
          </div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          paddingTop: 8, borderTop: '1px solid #e5e7eb',
          fontSize: 18, fontWeight: 800, color: '#1f6f3a',
        }}>
          <span>Total due</span><span>{formatUSD(deposit)}</span>
        </div>
      </div>

      {paymentError && (
        <div style={{ marginTop: 12, padding: 10, background: '#fde8e8', color: '#c33', borderRadius: 6, fontSize: 13 }}>
          {paymentError}
        </div>
      )}

      {paymentLoading && (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={styles.spinner} />
          <p style={{ color: '#374151', marginTop: 12, fontSize: 13 }}>Setting up secure payment…</p>
        </div>
      )}

      {!paymentLoading && !paymentError && !stripePromise && (
        <p style={{ color: '#374151', fontSize: 13, marginTop: 14 }}>
          Online payments aren&rsquo;t configured. Please call (402) 405-5475 to schedule.
        </p>
      )}

      {!paymentLoading && clientSecret && stripePromise && (
        <div style={{ marginTop: 16 }}>
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <PaymentForm
              deposit={deposit}
              quoteNumber={quoteNumber}
              customerEmail={customerEmail}
              onSucceeded={onPaid}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}

function ChangesPanel({ value, onChange, submitting, error, onBack, onSubmit }) {
  return (
    <div>
      <button onClick={onBack} style={styles.backLink} disabled={submitting}>← Back</button>

      <h3 style={styles.panelHeading} className="quote-panel-heading">What would you like changed?</h3>
      <p style={styles.panelBody}>
        Tell us what you&rsquo;d like adjusted, removed, or have questions about. We&rsquo;ll send a revised estimate.
      </p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        disabled={submitting}
        placeholder="e.g. Remove the mulch line, drop the patio size to 12x14, can you swap the river rock for pea gravel…"
        style={styles.textarea}
      />

      {error && (
        <div style={{ marginTop: 10, padding: 10, background: '#fde8e8', color: '#c33', borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={submitting || !value.trim()}
        style={{ ...styles.primaryBtn, marginTop: 14, opacity: submitting || !value.trim() ? 0.6 : 1 }}
      >
        {submitting ? 'Sending…' : 'Send to Lucky Landscapes'}
      </button>

      <p style={styles.helperText}>
        Want to talk it through?{' '}
        <a href="tel:+14024055475" style={styles.helperLink}>Call (402) 405-5475</a>.
      </p>
    </div>
  );
}

function PaymentForm({ deposit, quoteNumber, customerEmail, onSucceeded }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: typeof window !== 'undefined' ? window.location.href : undefined,
        receipt_email: customerEmail || undefined,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'Payment failed');
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      onSucceeded();
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: 'tabs' }} />

      {errorMessage && (
        <div style={{ marginTop: 12, padding: 10, background: '#fde8e8', color: '#c33', borderRadius: 6, fontSize: 13 }}>
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe}
        style={{
          marginTop: 18,
          width: '100%',
          padding: '14px',
          background: submitting ? '#999' : '#2d7a3a',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 700,
          cursor: submitting ? 'wait' : 'pointer',
        }}
      >
        {submitting ? 'Processing…' : `Pay ${formatUSD(deposit)} & accept estimate`}
      </button>
      <p style={{ marginTop: 10, fontSize: 11, color: '#999', textAlign: 'center' }}>
        Quote #{quoteNumber} • Pay by credit card, debit, or US bank transfer (ACH).
      </p>
    </form>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f5f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px 16px',
  },
  container: { maxWidth: 1024, margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    padding: '20px 24px',
    background: '#2D4A22',
    borderRadius: 12,
    color: '#fff',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandIcon: { fontSize: 24 },
  brandName: { fontSize: 18, fontWeight: 700 },
  headerRight: { textAlign: 'right' },
  invoiceLabel: { fontSize: 11, opacity: 0.7, letterSpacing: '0.1em' },
  invoiceNumber: { fontSize: 18, fontWeight: 700 },
  banner: {
    padding: '14px 18px',
    borderRadius: 10,
    border: '1px solid',
    marginBottom: 20,
    fontSize: 14,
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)',
    gap: 20,
  },
  detailsCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  actionCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    height: 'fit-content',
    position: 'sticky',
    top: 20,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: 20,
    marginBottom: 20,
    borderBottom: '1px solid #eee',
  },
  metaLabel: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  metaValue: { fontSize: 15, fontWeight: 600, color: '#1f2937' },
  metaSub: { fontSize: 13, color: '#666', marginTop: 2 },
  categoryPill: {
    display: 'inline-block',
    padding: '4px 12px',
    background: '#e9efe1',
    color: '#2d7a3a',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  itemsTable: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #eee',
  },
  td: {
    padding: '12px 8px',
    fontSize: 14,
    color: '#1f2937',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'top',
  },
  tdSub: { fontSize: 12, color: '#999', marginTop: 2 },
  totals: { marginTop: 20, paddingTop: 8 },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0 0',
    marginTop: 6,
    borderTop: '2px solid #1f2937',
    fontSize: 18,
    fontWeight: 800,
    color: '#1f2937',
  },
  notes: {
    marginTop: 20,
    padding: 14,
    background: '#fafaf8',
    borderRadius: 8,
    fontSize: 13,
    color: '#666',
    lineHeight: 1.5,
  },
  notesLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#999', marginBottom: 4, letterSpacing: '0.05em' },
  panelHeading: {
    margin: '0 0 8px',
    fontSize: 18,
    fontWeight: 700,
    color: '#1f2937',
  },
  panelBody: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 1.55,
    margin: '0 0 18px',
  },
  helperText: {
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 1.5,
  },
  helperLink: {
    color: '#1f6f3a',
    fontWeight: 600,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  depositBox: {
    background: '#f7f5f0',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '14px 16px',
  },
  primaryBtn: {
    padding: '14px 20px',
    background: '#2d7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  secondaryBtn: {
    padding: '14px 20px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#2d7a3a',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    marginBottom: 12,
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 120,
    boxSizing: 'border-box',
  },
  footer: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 32,
    maxWidth: 400,
    textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  center: {
    minHeight: '100vh',
    background: '#f5f5f0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #ddd',
    borderTopColor: '#2d7a3a',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
};
