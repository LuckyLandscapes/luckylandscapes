'use client';

import { useEffect, useState } from 'react';
import { Calculator as CalcIcon, Ruler, Truck, Check } from 'lucide-react';
import {
  MATERIAL_TYPES,
  DEPTH_PRESETS,
  summarize,
} from '@/lib/materialCalc';

function formatNumber(n, digits = 2) {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
}

// Map a snapshotted material's unit string to the calculator output it
// should fill. Units are free-text in the catalog so we accept the common
// aliases. Returns null if the unit doesn't have a sensible calculator
// quantity (e.g., 'each', 'sqft' for paver-style materials).
function pickQuantityForUnit(unit, result) {
  const u = String(unit || '').toLowerCase().trim();
  if (!u) return null;
  if (u === 'cu yd' || u === 'cuyd' || u === 'yd' || u === 'yard' || u === 'yards' || u === 'cubic yard' || u === 'cubic yards') {
    return result.cubicYardsRounded;
  }
  if (u === 'cu ft' || u === 'cuft' || u === 'cubic foot' || u === 'cubic feet' || u === 'ft3') {
    return result.cubicFeetRounded;
  }
  if (u === 'ton' || u === 'tons') {
    return result.weightTons;
  }
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') {
    return result.weightLbs;
  }
  if ((u === 'bag' || u === 'bags') && result.bagsNeeded != null) {
    return result.bagsNeeded;
  }
  return null;
}

// Reusable material calculator. Used standalone on /calculator and
// embedded as a modal-content widget on the quote builder.
//
// Props:
//   selectedMaterials  Optional array of snapshot rows from the quote.
//                      When provided + onApplyQuantity is set, the widget
//                      renders an "Apply to..." section that lets the
//                      salesperson push the calculated quantity straight
//                      onto a material in the quote.
//   onApplyQuantity    Optional callback ({ materialId, quantity }) — called
//                      when the user clicks Apply. Parent state owns the
//                      update; the widget stays generic.
//   embedded           Skip the page-style outer header when true.
export default function MaterialCalculator({ selectedMaterials = [], onApplyQuantity, embedded = false }) {
  const [sqft, setSqft] = useState('');
  const [depthInches, setDepthInches] = useState(3);
  const [materialId, setMaterialId] = useState('mulch_hardwood');
  const [appliedFor, setAppliedFor] = useState(null); // visual confirmation

  // Pull the most recent measure-tool result if the user came from
  // /measure. Saved to sessionStorage by the measure page (set by a
  // future "Calculate materials" button there).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('lucky_calc_prefill_sqft');
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) setSqft(String(Math.round(n)));
        sessionStorage.removeItem('lucky_calc_prefill_sqft');
      }
    } catch {
      // sessionStorage may be blocked — silent fallback
    }
  }, []);

  const material = MATERIAL_TYPES.find(m => m.id === materialId) || MATERIAL_TYPES[0];
  const result = summarize({ sqft: parseFloat(sqft) || 0, depthInches, materialId });
  const canApply = typeof onApplyQuantity === 'function' && selectedMaterials.length > 0 && result.cubicYards > 0;

  return (
    <div>
      {!embedded && (
        <div className="page-header">
          <div className="page-header-left">
            <h1><CalcIcon size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Material Calculator</h1>
            <p style={{ color: 'var(--text-tertiary)' }}>
              Estimate cubic yards, weight, and bag count for bulk landscaping materials.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-lg)', alignItems: 'start' }} className="calculator-grid">
        {/* Inputs */}
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Inputs</h3>

          <div className="form-group">
            <label className="form-label">
              <Ruler size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Area (sqft)
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="form-input"
              placeholder="e.g. 320"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              min="0"
            />
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
              Tip: get this from the Measure tool, then come back.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Depth (inches)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {DEPTH_PRESETS.map(d => (
                <button
                  key={d}
                  type="button"
                  className={`btn btn-sm ${depthInches === d ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDepthInches(d)}
                >
                  {d}&quot;
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              className="form-input"
              value={depthInches}
              onChange={(e) => setDepthInches(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.5"
            />
            {material.recommendedDepthIn !== depthInches && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                Typical depth for {material.label.toLowerCase()}: {material.recommendedDepthIn}&quot;
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Material</label>
            <select
              className="form-select"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
            >
              {MATERIAL_TYPES.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="card" style={{ background: 'var(--bg-elevated)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>You&apos;ll need</h3>

          {result.cubicYards <= 0 ? (
            <p style={{ color: 'var(--text-tertiary)' }}>
              Enter an area and depth to see results.
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <ResultStat label="Cubic yards" value={formatNumber(result.cubicYardsRounded)} unit="cu yd" emphasized />
                <ResultStat label="Cubic feet" value={formatNumber(result.cubicFeetRounded, 1)} unit="cu ft" />
                <ResultStat label="Weight" value={formatNumber(result.weightLbs, 0)} unit="lbs" />
                <ResultStat label="Tons" value={formatNumber(result.weightTons)} unit="tons" />
              </div>

              {result.bagsNeeded != null && (
                <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-secondary)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    If buying bagged ({result.cuFtPerBag} cu ft per bag)
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    {result.bagsNeeded} bags
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(45, 74, 34, 0.08)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Truck size={14} /> Delivery sizing
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  {result.weightTons < 1
                    ? 'Easily fits in a single pickup bed.'
                    : result.weightTons < 3
                      ? 'One trip in a dump trailer or 1-ton truck.'
                      : result.weightTons < 6
                        ? 'Two trips with a 1-ton — or one bulk delivery from the supplier.'
                        : 'Bulk supplier delivery; multiple loads or a tandem-axle truck.'}
                </div>
              </div>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-md)', fontStyle: 'italic' }}>
                Estimates only. Actual yard weight varies with moisture and material grade.
                Order ~5–10% extra for spread loss and corners.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Apply-to-quote: only shown when called from inside the quote
          builder AND there's a real result to apply. Lets the salesperson
          send the calculated quantity straight onto a selected material
          without manually copy-pasting. Unit-aware: a material sold by
          'ton' gets weightTons; one sold by 'cu yd' gets cubicYardsRounded.
       */}
      {canApply && (
        <div className="card" style={{ marginTop: 'var(--space-lg)', background: 'rgba(45, 74, 34, 0.05)', border: '1px solid var(--lucky-green)' }}>
          <h4 style={{ marginBottom: 'var(--space-sm)' }}>Apply to a selected material on this quote</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
            We&apos;ll set the material&apos;s quantity to the calculated amount, matched to its sales unit.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-sm)' }}>
            {selectedMaterials.map((sm, i) => {
              const qty = pickQuantityForUnit(sm.unit, result);
              const key = `${sm.materialId || 'm'}-${i}`;
              const isApplied = appliedFor === key;
              return (
                <div key={key} style={{
                  padding: 'var(--space-sm)',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{sm.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Sold by: {sm.unit || '—'} · Current qty: {sm.quantity}
                  </div>
                  {qty == null ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                      Unit &quot;{sm.unit}&quot; doesn&apos;t match a calculator output.
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`btn btn-sm ${isApplied ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => {
                        onApplyQuantity({ materialId: sm.materialId, quantity: qty, index: i });
                        setAppliedFor(key);
                      }}
                      disabled={isApplied}
                    >
                      {isApplied
                        ? <><Check size={14} /> Applied {formatNumber(qty)}</>
                        : <>Apply {formatNumber(qty)} {sm.unit}</>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, unit, emphasized }) {
  return (
    <div style={{
      padding: 'var(--space-md)',
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-md)',
      border: emphasized ? '2px solid var(--lucky-green)' : '1px solid var(--border-secondary)',
    }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{
        fontWeight: 800,
        fontSize: emphasized ? '1.6rem' : '1.25rem',
        color: emphasized ? 'var(--lucky-green-light)' : 'var(--text-primary)',
        lineHeight: 1.1,
        marginTop: 4,
      }}>
        {value}
        <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 4 }}>
          {unit}
        </span>
      </div>
    </div>
  );
}
