'use client';

import { DEPOSIT_TYPES, DEPOSIT_PERCENTAGE_PRESETS, computeQuoteDeposit } from '@/lib/deposit';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

// Toggle between "Materials + delivery" (covers hard costs Lucky has to
// front) and "Percentage of total" (typical for labor-heavy work). The
// unused side's inputs are preserved on toggle so flipping back doesn't
// lose what the salesperson already typed.
export default function DepositCard({
  depositType, setDepositType,
  depositPercentage, setDepositPercentage,
  materialsCost, setMaterialsCost,
  deliveryFee, setDeliveryFee,
  subtotal,
}) {
  const computed = computeQuoteDeposit({
    depositType,
    depositPercentage: parseFloat(depositPercentage) || 0,
    total: subtotal,
    materialsCost: parseFloat(materialsCost) || 0,
    deliveryFee: parseFloat(deliveryFee) || 0,
  });
  const isPct = depositType === DEPOSIT_TYPES.PERCENTAGE;

  return (
    <div className="card" style={{ marginTop: 'var(--space-lg)', maxWidth: '600px' }}>
      <h4 style={{ marginBottom: 'var(--space-xs)' }}>Deposit to Schedule</h4>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
        When the customer accepts this quote online, they pay this amount to lock in their spot.
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
        marginBottom: 'var(--space-md)',
        background: 'var(--bg-elevated)', padding: 4,
        borderRadius: 'var(--radius-md)',
      }}>
        <button
          type="button"
          onClick={() => setDepositType(DEPOSIT_TYPES.MATERIALS_DELIVERY)}
          style={{
            padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600,
            border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
            background: !isPct ? 'var(--surface-1)' : 'transparent',
            color: !isPct ? 'var(--text-primary)' : 'var(--text-tertiary)',
            boxShadow: !isPct ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          Materials + delivery
        </button>
        <button
          type="button"
          onClick={() => setDepositType(DEPOSIT_TYPES.PERCENTAGE)}
          style={{
            padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600,
            border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
            background: isPct ? 'var(--surface-1)' : 'transparent',
            color: isPct ? 'var(--text-primary)' : 'var(--text-tertiary)',
            boxShadow: isPct ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          Percentage of total
        </button>
      </div>

      {!isPct && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Materials cost</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={materialsCost}
              onChange={(e) => setMaterialsCost(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Delivery fee</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      {isPct && (
        <div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Deposit percentage</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={depositPercentage}
                onChange={(e) => setDepositPercentage(e.target.value)}
                placeholder="25"
                style={{ paddingRight: 28 }}
              />
              <span style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)', fontSize: '0.85rem', pointerEvents: 'none',
              }}>%</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {DEPOSIT_PERCENTAGE_PRESETS.map(pct => (
              <button
                key={pct}
                type="button"
                onClick={() => setDepositPercentage(String(pct))}
                style={{
                  padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600,
                  background: parseFloat(depositPercentage) === pct ? 'var(--lucky-green-light)' : 'var(--bg-elevated)',
                  color: parseFloat(depositPercentage) === pct ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}
              >
                {pct}%
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
            Calculated against the line-item total ({formatCurrency(subtotal || 0)}).
          </p>
        </div>
      )}

      <div style={{
        marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)',
        borderTop: '1px solid var(--border-primary)', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Deposit due to schedule</span>
        <span style={{ fontWeight: 800, color: 'var(--lucky-green-light)' }}>
          {formatCurrency(computed)}
        </span>
      </div>
    </div>
  );
}
