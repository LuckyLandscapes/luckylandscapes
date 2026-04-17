'use client';

import { useState, Suspense } from 'react';
import { useData } from '@/lib/data';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Plus, Trash2, CheckCircle2 } from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function NewQuoteContent() {
  const { customers, services, addQuote } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomer = searchParams.get('customer') || '';

  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState(preselectedCustomer);
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

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
    const newQuote = await addQuote({
      customerId,
      category,
      items,
      notes,
      total: subtotal,
    });
    if (newQuote?.id) {
      router.push(`/quotes/${newQuote.id}`);
    } else {
      router.push('/quotes');
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
        {['Customer', 'Category', 'Line Items', 'Review'].map((label, i) => {
          const stepNum = i + 1;
          return (
            <div key={label} style={{ display: 'contents' }}>
              <div className={`wizard-step ${step === stepNum ? 'active' : step > stepNum ? 'complete' : ''}`}>
                <div className="wizard-step-number">
                  {step > stepNum ? <CheckCircle2 size={16} /> : stepNum}
                </div>
                <span className="wizard-step-label">{label}</span>
              </div>
              {i < 3 && <div className={`wizard-step-line ${step > stepNum ? 'complete' : ''}`} />}
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

      {/* Step 2: Category */}
      {step === 2 && (
        <div style={{ maxWidth: '700px' }}>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Select Service Category</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
            {categories.map(cat => (
              <button
                key={cat.value}
                className={`card card-clickable`}
                onClick={() => { setCategory(cat.value); setStep(3); }}
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
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Line Items */}
      {step === 3 && (
        <div>
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
            <button className="btn btn-secondary" onClick={() => setStep(2)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary"
              disabled={items.length === 0}
              onClick={() => setStep(4)}
            >
              Review Quote <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
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
                <div style={{ fontWeight: 600 }}>{items.length} line items</div>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="btn btn-primary btn-lg" onClick={handleSubmit}>
              <CheckCircle2 size={18} /> Create Quote
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
