'use client';

import { useState, useEffect, use } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { describeCadence, intervalAdverb } from '@/lib/recurring';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function formatUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

export default function AutopayPage({ params }) {
  const { token } = use(params);
  const [plan, setPlan] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [consent, setConsent] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recurring/public/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'This link is no longer valid.');
        if (cancelled) return;
        setPlan(data.plan);
        if (data.plan.authorized) setDone(true);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Once the customer agrees, fetch the SetupIntent so the card form can mount.
  const armCardForm = async () => {
    if (clientSecret || preparing) return;
    setPreparing(true);
    setSetupError(null);
    try {
      const res = await fetch(`/api/recurring/public/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not set up the card.');
      setClientSecret(data.clientSecret);
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setPreparing(false);
    }
  };

  const onConsentChange = (checked) => {
    setConsent(checked);
    if (checked) armCardForm();
  };

  if (loading) {
    return (
      <div style={S.center}>
        <div style={S.spinner} />
        <p style={{ color: '#666', marginTop: 16 }}>Loading…</p>
        <Keyframes />
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={S.center}>
        <div style={S.card}>
          <h2 style={{ margin: 0, color: '#c33' }}>Can&rsquo;t open this link</h2>
          <p style={{ color: '#666' }}>{loadError}</p>
          <p style={{ color: '#999', fontSize: 13 }}>Please call (402) 405-5475 and we&rsquo;ll help.</p>
        </div>
      </div>
    );
  }

  const fixedTerm = Number(plan.totalPeriods) > 0 && Number(plan.contractAmount) > 0;
  const cadence = fixedTerm
    ? `${formatUSD(plan.amount)} ${intervalAdverb(plan.interval)} for ${plan.totalPeriods} payments (${formatUSD(plan.contractAmount)} total)`
    : describeCadence(plan.amount, plan.interval);
  const everyLabel = plan.interval === 'biweekly' ? '2 weeks' : plan.interval === 'monthly' ? 'month' : 'week';

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <div style={S.brand}><span style={{ fontSize: 24 }}>🍀</span><span style={S.brandName}>Lucky Landscapes</span></div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.1em' }}>AUTOPAY SETUP</div>
          </div>
        </header>

        <div style={S.cardBig}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div style={{ fontSize: 56 }}>✓</div>
              <h2 style={{ margin: '10px 0 6px', color: '#1f6f3a' }}>You&rsquo;re all set!</h2>
              <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.6 }}>
                Automatic payments are on for <strong>{plan.title}</strong>. We&rsquo;ll charge your saved card {cadence} and email you a receipt each time.
                {fixedTerm
                  ? ' Charges stop automatically after the final payment.'
                  : ' Cancel anytime by calling (402) 405-5475.'}
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ margin: '0 0 6px', color: '#1f2937', fontSize: 22 }}>
                Set up automatic payments{plan.customerFirstName ? `, ${plan.customerFirstName}` : ''}
              </h2>
              <p style={{ color: '#4b5563', fontSize: 15, lineHeight: 1.6, margin: '0 0 20px' }}>
                Save a card once and we&rsquo;ll handle billing for you — no more one-off payments.
              </p>

              <div style={S.planBox}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>{plan.title}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                    {fixedTerm
                      ? `${plan.totalPeriods} payments · ${formatUSD(plan.contractAmount)} total`
                      : 'Billed automatically'}
                  </div>
                  {fixedTerm && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      Charges stop automatically after the final payment.
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#2d7a3a', textAlign: 'right' }}>
                  {formatUSD(plan.amount)}
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>every {everyLabel}</div>
                </div>
              </div>

              {/* The explicit authorization — customer must check this to proceed. */}
              <label style={S.consent}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => onConsentChange(e.target.checked)}
                  style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55 }}>{plan.authorizationText}</span>
              </label>

              {consent && (
                <div style={{ marginTop: 20 }}>
                  {preparing && <p style={{ color: '#666', fontSize: 14 }}>Setting up secure card entry…</p>}
                  {setupError && <div style={S.err}>{setupError}</div>}
                  {!stripePromise && !preparing && (
                    <p style={{ color: '#374151', fontSize: 14 }}>Card setup isn&rsquo;t available right now — please call (402) 405-5475.</p>
                  )}
                  {clientSecret && stripePromise && (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                      <SaveCardForm cadence={cadence} onDone={() => setDone(true)} />
                    </Elements>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 20 }}>
          Secured by Stripe · Lucky Landscapes · (402) 405-5475
        </p>
      </div>
      <Keyframes />
    </div>
  );
}

function SaveCardForm({ cadence, onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: err, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: typeof window !== 'undefined' ? window.location.href : undefined },
      redirect: 'if_required',
    });
    if (err) { setError(err.message || 'Could not save the card.'); setSubmitting(false); return; }
    if (setupIntent?.status === 'succeeded') { onDone(); }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <div style={S.err}>{error}</div>}
      <button type="submit" disabled={submitting || !stripe} style={{ ...S.primaryBtn, opacity: submitting ? 0.7 : 1 }}>
        {submitting ? 'Saving…' : 'Authorize & save card'}
      </button>
      <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 10 }}>
        You&rsquo;ll be charged {cadence}. Cancel anytime — call (402) 405-5475.
      </p>
    </form>
  );
}

function Keyframes() {
  return <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>;
}

const S = {
  page: { minHeight: '100vh', background: '#f5f5f0', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', padding: '24px 16px' },
  container: { maxWidth: 560, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '18px 22px', background: '#2D4A22', borderRadius: 12, color: '#fff' },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 18, fontWeight: 700 },
  cardBig: { background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  planBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: '#f7f5f0', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', marginBottom: 18 },
  consent: { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f0f7f0', border: '1px solid #d4e7d4', borderRadius: 10, padding: '14px 16px', cursor: 'pointer' },
  primaryBtn: { marginTop: 18, width: '100%', padding: '14px', background: '#2d7a3a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  err: { marginTop: 12, padding: 10, background: '#fde8e8', color: '#c33', borderRadius: 6, fontSize: 13 },
  card: { background: '#fff', borderRadius: 12, padding: 32, maxWidth: 400, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  center: { minHeight: '100vh', background: '#f5f5f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' },
  spinner: { width: 32, height: 32, border: '3px solid #ddd', borderTopColor: '#2d7a3a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
};
