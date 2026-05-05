'use client';

import { useEffect, useState } from 'react';
import { Calculator as CalcIcon, Ruler, Truck } from 'lucide-react';
import {
  MATERIAL_TYPES,
  DEPTH_PRESETS,
  summarize,
} from '@/lib/materialCalc';

function formatNumber(n, digits = 2) {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
}

export default function CalculatorPage() {
  const [sqft, setSqft] = useState('');
  const [depthInches, setDepthInches] = useState(3);
  const [materialId, setMaterialId] = useState('mulch_hardwood');

  // Pull the most recent measure-tool result if the user came here from
  // /measure. Saved to sessionStorage by the measure page in a follow-up
  // ticket; for now any value placed there will be picked up.
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

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1><CalcIcon size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Material Calculator</h1>
          <p style={{ color: 'var(--text-tertiary)' }}>
            Estimate cubic yards, weight, and bag count for bulk landscaping materials.
          </p>
        </div>
      </div>

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
                  {d}"
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
                Typical depth for {material.label.toLowerCase()}: {material.recommendedDepthIn}"
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
          <h3 style={{ marginBottom: 'var(--space-md)' }}>You'll need</h3>

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
