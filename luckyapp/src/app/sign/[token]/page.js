'use client';

import { useState, useEffect, useRef, use } from 'react';

function formatUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d.includes?.('T') ? d : d + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function SignPage({ params }) {
  const { token } = use(params);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('review'); // 'review' | 'sign' | 'decline'

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/contracts/public/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Contract not found');
        if (cancelled) return;
        setContract(data.contract);
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
        <p style={{ color: '#666', marginTop: 16 }}>Loading agreement…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h2 style={{ margin: 0, color: '#c33' }}>Unable to load agreement</h2>
          <p style={{ color: '#666' }}>{loadError}</p>
          <p style={{ color: '#999', fontSize: 13 }}>If you believe this is an error, please contact (402) 405-5475.</p>
        </div>
      </div>
    );
  }

  const customer = contract.customers || contract.customer_snapshot || {};
  const customerName = [customer.first_name || customer.name, customer.last_name].filter(Boolean).join(' ').trim()
    || contract.customer_snapshot?.name
    || 'Customer';
  const isSigned = contract.status === 'signed';
  const isDeclined = contract.status === 'declined';
  const isVoid = contract.status === 'void';
  const balance = Math.max(0, Number(contract.total_amount || 0) - Number(contract.deposit_amount || 0));

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brand}>
            <span style={styles.brandIcon}>🍀</span>
            <span style={styles.brandName}>Lucky Landscapes</span>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.label}>SERVICE AGREEMENT</div>
            <div style={styles.contractNumber}>#{contract.contract_number}</div>
          </div>
        </header>

        {isSigned && (
          <div style={{ ...styles.banner, background: '#e6f7e6', color: '#1f6f3a', borderColor: '#a5d8a5' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>
                ✓ This agreement was signed{contract.signed_at ? ` on ${new Date(contract.signed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}. Thank you!
              </span>
              {contract.pdf_url && (
                <a
                  href={contract.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: '#2d7a3a', color: '#fff', padding: '8px 16px', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 13 }}
                >
                  Download Signed PDF →
                </a>
              )}
            </div>
          </div>
        )}
        {isDeclined && (
          <div style={{ ...styles.banner, background: '#fff3cd', color: '#85651b', borderColor: '#ffe69c' }}>
            You requested changes to this agreement. We&apos;ll be in touch shortly.
          </div>
        )}
        {isVoid && (
          <div style={{ ...styles.banner, background: '#fde8e8', color: '#c33', borderColor: '#f5b5b5' }}>
            This agreement has been voided.
          </div>
        )}

        {/* Summary */}
        <div style={styles.summaryGrid}>
          <SummaryCard label="Customer" value={customerName} />
          <SummaryCard label="Project" value={contract.title || contract.category || 'Landscape services'} />
          <SummaryCard label="Total" value={formatUSD(contract.total_amount)} highlight />
          <SummaryCard
            label="Deposit on signing"
            value={Number(contract.deposit_amount) > 0 ? formatUSD(contract.deposit_amount) : '—'}
            sub={Number(contract.deposit_amount) > 0 ? `Balance ${formatUSD(balance)} due on completion` : 'Full amount due on completion'}
          />
          <SummaryCard label="Estimated start" value={formatDate(contract.start_date)} />
          <SummaryCard label="Completion window" value={contract.completion_window || 'TBD'} />
        </div>

        {/* Agreement body */}
        <div style={styles.detailsCard}>
          <h2 style={{ margin: '0 0 16px', fontSize: 20, color: '#1f2937' }}>Full Agreement</h2>
          <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
            Please read every section carefully. By signing below, you confirm you understand and agree to all terms.
          </p>
          <pre style={styles.body}>{contract.body}</pre>
        </div>

        {/* Action area */}
        {!isSigned && !isVoid && (
          <div style={styles.actionCard}>
            {view === 'review' && (
              <>
                <h3 style={{ margin: '0 0 8px' }}>Ready to move forward?</h3>
                <p style={{ color: '#666', fontSize: 14 }}>
                  Sign the agreement to lock in your scope and start date. If something needs to change first, request changes and we&apos;ll revise it.
                </p>
                <div style={styles.actionRow}>
                  <button style={styles.primaryBtn} onClick={() => setView('sign')}>
                    Sign &amp; Accept
                  </button>
                  <button style={styles.secondaryBtn} onClick={() => setView('decline')}>
                    Request Changes
                  </button>
                </div>
              </>
            )}
            {view === 'sign' && (
              <SignForm
                token={token}
                defaultName={customerName}
                onCancel={() => setView('review')}
                onSigned={(signedAt, pdfUrl) => setContract(prev => ({ ...prev, status: 'signed', signed_at: signedAt, pdf_url: pdfUrl || prev?.pdf_url }))}
              />
            )}
            {view === 'decline' && (
              <DeclineForm
                token={token}
                onCancel={() => setView('review')}
                onDeclined={() => setContract(prev => ({ ...prev, status: 'declined' }))}
              />
            )}
          </div>
        )}

        <footer style={styles.footer}>
          <div>Lucky Landscapes • (402) 405-5475 • rileykopf@luckylandscapes.com</div>
          <div style={{ marginTop: 4 }}>109 South Canopy ST, Lincoln, NE</div>
        </footer>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, highlight }) {
  return (
    <div style={{ ...styles.summaryCard, ...(highlight ? styles.summaryCardHighlight : null) }}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={{ ...styles.summaryValue, ...(highlight ? { color: '#2d7a3a', fontSize: 22 } : null) }}>{value}</div>
      {sub && <div style={styles.summarySub}>{sub}</div>}
    </div>
  );
}

// ─── Signature canvas ────────────────────────────────────────────────────────
function SignForm({ token, defaultName, onCancel, onSigned }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  const [typedName, setTypedName] = useState(defaultName || '');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // High-DPI canvas sizing
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
    ctxRef.current = ctx;
  }, []);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches?.[0] || e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPos(e);
  }

  function draw(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastRef.current = { x, y };
    if (!hasInk) setHasInk(true);
  }

  function stopDraw() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  async function submit() {
    if (!hasInk) { setError('Please draw your signature in the box above.'); return; }
    if (!typedName.trim() || typedName.trim().length < 2) { setError('Please type your full legal name.'); return; }
    if (!agree) { setError('Please confirm you have read and agree to the terms.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const res = await fetch(`/api/contracts/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign',
          signatureDataUrl: dataUrl,
          typedName: typedName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit signature');
      onSigned?.(data.signedAt || new Date().toISOString(), data.pdfUrl || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h3 style={{ margin: '0 0 12px' }}>Sign the agreement</h3>
      <div style={{ marginBottom: 14 }}>
        <label style={styles.fieldLabel}>Typed full legal name</label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="e.g. Jane Q. Doe"
          style={styles.textInput}
          maxLength={200}
        />
      </div>

      <div style={{ marginBottom: 6 }}>
        <label style={styles.fieldLabel}>Draw your signature</label>
        <div style={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            style={styles.canvas}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999', marginTop: 4 }}>
          <span>Use your mouse or finger to sign</span>
          <button type="button" onClick={clearCanvas} style={styles.clearBtn}>Clear</button>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, fontSize: 13, color: '#444', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          style={{ marginTop: 3, transform: 'scale(1.15)' }}
        />
        <span>
          I have read the entire agreement above and agree to be bound by all of its terms. I am at least 18 years of age and am authorized to sign on behalf of the property listed.
        </span>
      </label>

      {error && (
        <div style={{ marginTop: 12, padding: 10, background: '#fde8e8', color: '#c33', borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ ...styles.actionRow, marginTop: 16 }}>
        <button style={styles.primaryBtn} onClick={submit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Signature'}
        </button>
        <button style={styles.secondaryBtn} onClick={onCancel} disabled={submitting}>
          Back
        </button>
      </div>
    </>
  );
}

function DeclineForm({ token, onCancel, onDeclined }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!reason.trim()) { setError('Please tell us what you\'d like changed.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit response');
      onDeclined?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h3 style={{ margin: '0 0 8px' }}>Request changes</h3>
      <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
        Tell us what you&apos;d like changed in this agreement (scope, timing, materials, price). We&apos;ll revise and resend.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={5}
        maxLength={4000}
        placeholder="What would you like adjusted?"
        style={{ ...styles.textInput, resize: 'vertical', minHeight: 100, fontFamily: 'inherit' }}
      />
      {error && (
        <div style={{ marginTop: 12, padding: 10, background: '#fde8e8', color: '#c33', borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}
      <div style={{ ...styles.actionRow, marginTop: 14 }}>
        <button style={styles.primaryBtn} onClick={submit} disabled={submitting}>
          {submitting ? 'Sending…' : 'Send Request'}
        </button>
        <button style={styles.secondaryBtn} onClick={onCancel} disabled={submitting}>
          Back
        </button>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f5f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px 16px',
    color: '#1f2937',
  },
  container: { maxWidth: 880, margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: '20px 24px',
    background: '#2D4A22',
    borderRadius: 12,
    color: '#fff',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandIcon: { fontSize: 24 },
  brandName: { fontSize: 18, fontWeight: 700 },
  headerRight: { textAlign: 'right' },
  label: { fontSize: 11, opacity: 0.7, letterSpacing: '0.1em' },
  contractNumber: { fontSize: 18, fontWeight: 700 },
  banner: {
    padding: '14px 18px',
    borderRadius: 10,
    border: '1px solid',
    marginBottom: 20,
    fontSize: 14,
    fontWeight: 600,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    background: '#fff',
    borderRadius: 10,
    padding: 14,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  summaryCardHighlight: {
    borderLeft: '4px solid #2d7a3a',
  },
  summaryLabel: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  summaryValue: { fontSize: 16, fontWeight: 700, color: '#1f2937' },
  summarySub: { fontSize: 12, color: '#666', marginTop: 4 },
  detailsCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 28,
    marginBottom: 20,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  body: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 13,
    lineHeight: 1.65,
    color: '#374151',
    background: '#fafaf8',
    padding: 18,
    borderRadius: 8,
    margin: 0,
    maxHeight: 520,
    overflowY: 'auto',
  },
  actionCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 },
  primaryBtn: {
    padding: '14px 20px',
    background: '#2d7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    flex: '1 1 200px',
  },
  secondaryBtn: {
    padding: '14px 20px',
    background: '#fff',
    color: '#1f2937',
    border: '1.5px solid #d1d5db',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    flex: '1 1 160px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#666',
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  textInput: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 15,
    border: '1.5px solid #d1d5db',
    borderRadius: 8,
    boxSizing: 'border-box',
    background: '#fff',
    color: '#1f2937',
  },
  canvasWrap: {
    border: '2px dashed #c7d2c0',
    borderRadius: 10,
    background: '#fafaf8',
    padding: 4,
  },
  canvas: {
    width: '100%',
    height: 180,
    display: 'block',
    background: '#fff',
    borderRadius: 6,
    touchAction: 'none',
    cursor: 'crosshair',
  },
  clearBtn: {
    background: 'transparent',
    border: 'none',
    color: '#2d7a3a',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
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
