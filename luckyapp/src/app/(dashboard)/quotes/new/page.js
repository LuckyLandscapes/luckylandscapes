'use client';

import { useState, Suspense } from 'react';
import { useData } from '@/lib/data';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Plus, Trash2, CheckCircle2, Camera, SkipForward, Package } from 'lucide-react';
import QuoteMediaGallery from '@/components/QuoteMediaGallery';
import SelectMaterialsModal from '@/components/SelectMaterialsModal';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function NewQuoteContent() {
  const { customers, services, addQuote, getQuoteMediaByCustomer } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomer = searchParams.get('customer') || '';

  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState(preselectedCustomer);
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [showMaterialsPicker, setShowMaterialsPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [materialsCost, setMaterialsCost] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    { value: 'Lawn Care', icon: '🌿', description: 'Mowing, cleanups, maintenance' },
    { value: 'Garden & Beds', icon: '🌺', description: 'Mulch, edging, planting' },
    { value: 'Hardscaping', icon: '🧱', description: 'Pavers, walls, outdoor living' },
    { value: 'Cleanup', icon: '🧹', description: 'Junk removal, debris, restoration' },
    { value: 'Landscape Design', icon: '🎨', description: 'Full design & build' },
    { value: 'Custom', icon: '🔧', description: 'Mix of services' },
  ];

  const categoryServices = services.filter(s => {
    if (!category) return false;
    if (category === 'Custom') return true;
    return s.category === category || s.category === category.split(' ')[0];
  });

  const addLineItem = (service) => {
    setItems([...items, {
      id: `li${Date.now()}`,
      name: service?.name || '',
      description: '',
      quantity: 1,
      unit: service?.unit || 'each',
      unitPrice: service?.defaultPrice || 0,
      total: service?.defaultPrice || 0,
    }]);
  };

  const addBlankItem = () => {
    setItems([...items, {
      id: `li${Date.now()}`,
      name: '',
      description: '',
      quantity: 1,
      unit: 'each',
      unitPrice: 0,
      total: 0,
    }]);
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitPrice) || 0);
      }
      return updated;
    }));
  };

  const removeItem = (id) => setItems(items.filter(i => i.id !== id));

  const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const newQuote = await addQuote({
        customerId,
        category,
        items,
        selectedMaterials,
        notes,
        total: subtotal,
        materialsCost: parseFloat(materialsCost) || 0,
        deliveryFee: parseFloat(deliveryFee) || 0,
        status: 'draft',
      });
      if (newQuote?.id) {
        router.push(`/quotes/${newQuote.id}`);
      } else {
        router.push('/quotes');
      }
    } catch (err) {
      console.error('Failed to create quote:', err);
      setError(err?.message || 'Failed to create quote. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/quotes" className="btn btn-ghost btn-sm" style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={16} /> Quotes
        </Link>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1>Create New Quote</h1>
          <p>Build a detailed quote for your customer.</p>
        </div>
      </div>

      {/* Progress */}
      <div className="wizard-progress">
        {['Customer', 'Walkthrough', 'Category', 'Line Items', 'Review'].map((label, i) => {
          const stepNum = i + 1;
          return (
            <div key={label} style={{ display: 'contents' }}>
              <div className={`wizard-step ${step === stepNum ? 'active' : step > stepNum ? 'complete' : ''}`}>
                <div className="wizard-step-number">
                  {step > stepNum ? <CheckCircle2 size={16} /> : stepNum}
                </div>
                <span className="wizard-step-label">{label}</span>
              </div>
              {i < 4 && <div className={`wizard-step-line ${step > stepNum ? 'complete' : ''}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Customer */}
      {step === 1 && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Select Customer</h3>
          <div className="form-group">
            <label className="form-label">Customer <span className="required">*</span></label>
            <select
              className="form-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Choose a customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} — {c.address || c.email || c.phone}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-lg)' }}>
            <button
              className="btn btn-primary"
              disabled={!customerId}
              onClick={() => setStep(2)}
            >
              Next <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Walkthrough — capture photos / video / voice memos
          before building line items. Skippable for desk quotes. */}
      {step === 2 && (
        <div style={{ maxWidth: '720px' }}>
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>
            <Camera size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Walkthrough Capture
          </h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 'var(--space-lg)' }}>
            Walk the site with the customer. Snap photos, record video, or use a voice memo
            to capture what they&apos;re asking for. Each item gets a note for context — you&apos;ll
            see all of this on the next steps while you build the quote. Skip if you&apos;re
            quoting from the desk.
          </p>
          <QuoteMediaGallery customerId={customerId} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              {(getQuoteMediaByCustomer?.(customerId) || []).length === 0
                ? <><SkipForward size={16} /> Skip Walkthrough</>
                : <>Continue <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Category */}
      {step === 3 && (
        <div style={{ maxWidth: '700px' }}>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Select Service Category</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
            {categories.map(cat => (
              <button
                key={cat.value}
                className={`card card-clickable`}
                onClick={() => { setCategory(cat.value); setStep(4); }}
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-xl)',
                  border: category === cat.value ? '2px solid var(--lucky-green)' : undefined,
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>{cat.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{cat.value}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{cat.description}</div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Line Items */}
      {step === 4 && (
        <div>
          {/* Walkthrough reference — collapsible, read-only view of
              what was captured in step 2 (gallery shows its own summary
              panel with an Apply-to-Notes button). */}
          {(() => {
            const walkItems = getQuoteMediaByCustomer?.(customerId) || [];
            if (walkItems.length === 0) return null;
            return (
              <details className="card" style={{ marginBottom: 'var(--space-lg)' }} open>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Camera size={16} />
                  Walkthrough reference ({walkItems.length} item{walkItems.length !== 1 ? 's' : ''})
                </summary>
                <div style={{ marginTop: 'var(--space-md)' }}>
                  <QuoteMediaGallery
                    customerId={customerId}
                    readOnly
                    onApplySummary={(s) => setNotes(prev => {
                      const trimmed = (prev || '').trim();
                      if (!trimmed) return s;
                      if (trimmed.includes(s.trim())) return prev;
                      return `${trimmed}\n\n${s}`;
                    })}
                  />
                </div>
              </details>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <h3>Build Your Line Items</h3>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary btn-sm" onClick={addBlankItem}>
                <Plus size={14} /> Custom Item
              </button>
            </div>
          </div>

          {/* Quick-add from services */}
          {categoryServices.length > 0 && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quick Add Services
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                {categoryServices.map(s => (
                  <button key={s.id} className="btn btn-secondary btn-sm" onClick={() => addLineItem(s)}>
                    <Plus size={14} /> {s.name} (${s.defaultPrice}/{s.unit})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Items Table */}
          {items.length > 0 && (
            <div className="table-wrapper" style={{ marginBottom: 'var(--space-lg)' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Service / Item</th>
                    <th style={{ width: '12%' }}>Qty</th>
                    <th style={{ width: '12%' }}>Unit</th>
                    <th style={{ width: '15%' }}>Unit Price</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>Total</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <input
                          className="form-input"
                          value={item.name}
                          onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                          placeholder="Service name"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                        />
                      </td>
                      <td>
                        <input
                          className="form-input"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                        >
                          <option value="each">each</option>
                          <option value="sqft">sqft</option>
                          <option value="ft">ft</option>
                          <option value="cu yd">cu yd</option>
                          <option value="ton">ton</option>
                          <option value="hour">hour</option>
                          <option value="visit">visit</option>
                          <option value="season">season</option>
                          <option value="load">load</option>
                          <option value="project">project</option>
                          <option value="face ft">face ft</option>
                          <option value="lot">lot</option>
                        </select>
                      </td>
                      <td>
                        <input
                          className="form-input"
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(item.total)}
                      </td>
                      <td>
                        <button className="btn btn-icon btn-ghost" onClick={() => removeItem(item.id)}>
                          <Trash2 size={16} style={{ color: 'var(--status-danger)' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{
                padding: 'var(--space-lg)',
                borderTop: '1px solid var(--border-primary)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <div style={{ width: '240px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-sm)', borderTop: '2px solid var(--border-secondary)' }}>
                    <span style={{ fontWeight: 700 }}>Total</span>
                    <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--lucky-green-light)' }}>
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
              <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                No line items yet. Use the quick-add buttons above or add a custom item.
              </p>
              <button className="btn btn-primary btn-sm" onClick={addBlankItem}>
                <Plus size={16} /> Add First Item
              </button>
            </div>
          )}

          {/* Selected materials — visual gallery the customer sees on their
              quote and contract. No prices. Lets them approve specific
              products by photo before the job starts. */}
          <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>
                  <Package size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Selected Materials
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0 }}>
                  Customer sees photos + names + quantities (never prices) — both on the quote and on the contract they sign.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowMaterialsPicker(true)}>
                <Plus size={14} /> {selectedMaterials.length === 0 ? 'Pick materials' : 'Edit selection'}
              </button>
            </div>
            {selectedMaterials.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                {selectedMaterials.map((sm, i) => (
                  <div key={`${sm.materialId}-${i}`} style={{ display: 'flex', gap: 8, padding: 8, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', background: 'var(--surface-1)', overflow: 'hidden', flexShrink: 0 }}>
                      {sm.imageUrl ? <img src={sm.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sm.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{sm.quantity} {sm.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deposit (Materials + Delivery) — what customer pays online to lock in the job */}
          <div className="card" style={{ marginTop: 'var(--space-lg)', maxWidth: '600px' }}>
            <h4 style={{ marginBottom: 'var(--space-xs)' }}>Deposit to Schedule</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
              When the customer accepts this quote online, they pay this amount to lock in their spot.
              Set delivery to $0 if pickup or no delivery is needed.
            </p>
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
            <div style={{
              marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)',
              borderTop: '1px solid var(--border-primary)', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Deposit due to schedule</span>
              <span style={{ fontWeight: 800, color: 'var(--lucky-green-light)' }}>
                {formatCurrency((parseFloat(materialsCost) || 0) + (parseFloat(deliveryFee) || 0))}
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 'var(--space-lg)', maxWidth: '600px' }}>
            <label className="form-label">Notes (internal or for customer)</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Add any notes about this quote..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary"
              disabled={items.length === 0}
              onClick={() => setStep(5)}
            >
              Review Quote <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Materials picker modal — opens from step 4 */}
      {showMaterialsPicker && (
        <SelectMaterialsModal
          initialSelection={selectedMaterials}
          onClose={() => setShowMaterialsPicker(false)}
          onSave={setSelectedMaterials}
        />
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div style={{ maxWidth: '700px' }}>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Review & Create Quote</h3>

          <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Customer</div>
                <div style={{ fontWeight: 600 }}>
                  {(() => { const c = customers.find(c => c.id === customerId); return c ? `${c.firstName} ${c.lastName}` : '—'; })()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Category</div>
                <div style={{ fontWeight: 600 }}>{category}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Items</div>
                <div style={{ fontWeight: 600 }}>{items.length} line items · {selectedMaterials.length} materials</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Total</div>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--lucky-green-light)' }}>
                  {formatCurrency(subtotal)}
                </div>
              </div>
            </div>
          </div>

          {notes && (
            <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
              <p style={{ fontSize: '0.85rem' }}>{notes}</p>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '10px',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-md)',
              color: '#dc2626',
              fontSize: '0.85rem',
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(4)} disabled={saving}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <><span className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} /> Creating...</>
              ) : (
                <><CheckCircle2 size={18} /> Create Quote</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="page"><p>Loading...</p></div>}>
      <NewQuoteContent />
    </Suspense>
  );
}
