'use client';

import { useState, useEffect, use } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './pay.css';

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

export default function PayPage({ params }) {
  const { token } = use(params);
  const [invoice, setInvoice] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const invRes = await fetch(`/api/invoices/public/${token}`);
        const invData = await invRes.json();
        if (!invRes.ok) throw new Error(invData.error || 'Invoice not found');
        if (cancelled) return;
        setInvoice(invData.invoice);

        const balance = Math.max(0, Number(invData.invoice.total || 0) - Number(invData.invoice.amount_paid || 0));
        if (invData.invoice.status !== 'paid' && invData.invoice.status !== 'cancelled' && balance > 0) {
          const piRes = await fetch('/api/stripe/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const piData = await piRes.json();
          if (!piRes.ok) throw new Error(piData.error || 'Failed to set up payment');
          if (cancelled) return;
          setClientSecret(piData.clientSecret);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={{ color: '#666', marginTop: 16 }}>Loading invoice…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h2 style={{ margin: 0, color: '#c33' }}>Unable to load invoice</h2>
          <p style={{ color: '#666' }}>{loadError}</p>
          <p style={{ color: '#999', fontSize: 13 }}>If you believe this is an error, please contact (402) 405-5475.</p>
        </div>
      </div>
    );
  }

  const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const customer = invoice.customers || {};
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  const isPaid = invoice.status === 'paid' || balance <= 0;
  const isCancelled = invoice.status === 'cancelled';

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brand}>
            <span style={styles.brandIcon}>🍀</span>
            <span style={styles.brandName}>Lucky Landscapes</span>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.invoiceLabel}>INVOICE</div>
            <div style={styles.invoiceNumber}>{invoice.invoice_number}</div>
          </div>
        </header>

        {/* Status banner */}
        {isPaid && (
          <div style={{ ...styles.banner, background: '#e6f7e6', color: '#1f6f3a', borderColor: '#a5d8a5' }}>
            ✓ This invoice has been paid in full. Thank you!
          </div>
        )}
        {isCancelled && (
          <div style={{ ...styles.banner, background: '#fff3cd', color: '#85651b', borderColor: '#ffe69c' }}>
            This invoice has been cancelled.
          </div>
        )}

        <div style={styles.grid} className="pay-grid">
          {/* Left: Invoice details */}
          <div style={styles.detailsCard}>
            <div style={styles.metaRow}>
              <div>
                <div style={styles.metaLabel}>Bill To</div>
                <div style={styles.metaValue}>{customerName || '—'}</div>
                {customer.email && <div style={styles.metaSub}>{customer.email}</div>}
                {customer.address && (
                  <div style={styles.metaSub}>
                    {customer.address}{customer.city ? `, ${customer.city}` : ''}{customer.state ? ` ${customer.state}` : ''}{customer.zip ? ` ${customer.zip}` : ''}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={styles.metaLabel}>Issued</div>
                <div style={styles.metaValue}>{formatDate(invoice.created_at?.split('T')[0])}</div>
                {invoice.due_date && (<>
                  <div style={{ ...styles.metaLabel, marginTop: 8 }}>Due</div>
                  <div style={styles.metaValue}>{formatDate(invoice.due_date)}</div>
                </>)}
              </div>
            </div>

            <table style={styles.itemsTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Description</th>
                  <th style={{ ...styles.th, textAlign: 'center', width: 60 }}>Qty</th>
                  <th style={{ ...styles.th, textAlign: 'right', width: 100 }}>Price</th>
                  <th style={{ ...styles.th, textAlign: 'right', width: 110 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.description && <div style={styles.tdSub}>{item.description}</div>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{item.quantity || 1}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{formatUSD(item.unitPrice || item.unit_price)}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{formatUSD(item.total)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={4} style={{ ...styles.td, textAlign: 'center', color: '#999' }}>No line items</td></tr>
                )}
              </tbody>
            </table>

            <div style={styles.totals}>
              <div style={styles.totalRow}><span>Subtotal</span><span>{formatUSD(invoice.subtotal)}</span></div>
              {Number(invoice.tax) > 0 && <div style={styles.totalRow}><span>Tax</span><span>{formatUSD(invoice.tax)}</span></div>}
              <div style={styles.totalRow}><span>Total</span><span>{formatUSD(invoice.total)}</span></div>
              {Number(invoice.amount_paid) > 0 && <div style={{ ...styles.totalRow, color: '#2d7a3a' }}><span>Paid</span><span>−{formatUSD(invoice.amount_paid)}</span></div>}
              <div style={styles.balanceRow}><span>Balance Due</span><span>{formatUSD(balance)}</span></div>
            </div>

            {invoice.notes && (
              <div style={styles.notes}>
                <div style={styles.notesLabel}>Notes</div>
                <div>{invoice.notes}</div>
              </div>
            )}
          </div>

          {/* Right: Payment form */}
          <div style={styles.payCard} className="pay-card-sticky">
            {isPaid || isCancelled ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 48 }}>{isPaid ? '✓' : '—'}</div>
                <h3 style={{ margin: '12px 0 4px' }}>
                  {isPaid ? 'Paid in Full' : 'Not Payable'}
                </h3>
                <p style={{ color: '#666', fontSize: 14 }}>
                  {isPaid ? 'Thank you for your business.' : 'This invoice is not currently payable.'}
                </p>
              </div>
            ) : !stripePromise ? (
              <div style={{ padding: 20 }}>
                <h3 style={{ margin: 0 }}>Online payments unavailable</h3>
                <p style={{ color: '#666', fontSize: 14 }}>
                  Online payments aren't configured for this invoice. Please contact Lucky Landscapes at (402) 405-5475 to pay by other means.
                </p>
              </div>
            ) : !clientSecret ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={styles.spinner} />
                <p style={{ color: '#666', marginTop: 12 }}>Setting up payment…</p>
              </div>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                <PaymentForm balance={balance} invoiceNumber={invoice.invoice_number} customerEmail={customer.email} />
              </Elements>
            )}
          </div>
        </div>

        <footer style={styles.footer}>
          <div>Lucky Landscapes • (402) 405-5475 • rileykopf@luckylandscapes.com</div>
          <div style={{ marginTop: 4 }}>109 South Canopy ST, Lincoln, NE</div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#aaa' }}>Secured by Stripe</div>
        </footer>
      </div>
    </div>
  );
}

function PaymentForm({ balance, invoiceNumber, customerEmail }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [succeeded, setSucceeded] = useState(false);

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

    if (paymentIntent?.status === 'succeeded') {
      setSucceeded(true);
    } else if (paymentIntent?.status === 'processing') {
      setSucceeded(true);
      setErrorMessage(null);
    }
    setSubmitting(false);
  };

  if (succeeded) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ fontSize: 56 }}>✓</div>
        <h3 style={{ margin: '12px 0 6px', color: '#1f6f3a' }}>Payment Received!</h3>
        <p style={{ color: '#666', fontSize: 14, lineHeight: 1.5 }}>
          Your payment for invoice {invoiceNumber} ({formatUSD(balance)}) has been received.
          A receipt has been sent to your email.
        </p>
        <p style={{ color: '#999', fontSize: 12, marginTop: 16 }}>
          (Bank transfers may take 3-5 business days to fully clear.)
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Amount Due
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#1f6f3a' }}>{formatUSD(balance)}</div>
      </div>

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
          marginTop: 20,
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
        {submitting ? 'Processing…' : `Pay ${formatUSD(balance)}`}
      </button>
      <p style={{ marginTop: 12, fontSize: 11, color: '#999', textAlign: 'center' }}>
        Pay by credit card, debit card, or US bank transfer (ACH).
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
  payCard: {
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
    padding: '6px 0',
    fontSize: 14,
    color: '#666',
  },
  balanceRow: {
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
  footer: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
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
