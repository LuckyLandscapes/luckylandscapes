'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, X, Package, Calculator as CalcIcon } from 'lucide-react';
import QuoteMediaGallery from '@/components/QuoteMediaGallery';
import SelectMaterialsModal from '@/components/SelectMaterialsModal';
import MaterialCalculator from '@/components/MaterialCalculator';
import DepositCard from '@/components/DepositCard';
import { DEPOSIT_TYPES } from '@/lib/deposit';
import { computeSelectedMaterialsCost } from '@/lib/catalog';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export default function EditQuotePage() {
  const { id } = useParams();
  const router = useRouter();
  const { getQuote, getCustomer, customers, services, updateQuote, materials, suppliers } = useData();

  const quote = getQuote(id);
  const customer = quote ? getCustomer(quote.customerId) : null;

  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [showMaterialsPicker, setShowMaterialsPicker] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [notes, setNotes] = useState('');
  const [materialsCost, setMaterialsCost] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [depositType, setDepositType] = useState(DEPOSIT_TYPES.MATERIALS_DELIVERY);
  const [depositPercentage, setDepositPercentage] = useState('');
  const [status, setStatus] = useState('draft');
  const [loaded, setLoaded] = useState(false);

  // Load quote data into form state once
  useEffect(() => {
    if (quote && !loaded) {
      setCustomerId(quote.customerId || '');
      setCategory(quote.category || '');
      setItems((quote.items || []).map((item, i) => ({ ...item, id: item.id || `li${i}` })));
      setSelectedMaterials(quote.selectedMaterials || []);
      setNotes(quote.notes || '');
      setMaterialsCost(quote.materialsCost || 0);
      setDeliveryFee(quote.deliveryFee || 0);
      setDepositType(quote.depositType || DEPOSIT_TYPES.MATERIALS_DELIVERY);
      setDepositPercentage(quote.depositPercentage != null ? String(quote.depositPercentage) : '');
      setStatus(quote.status || 'draft');
      setLoaded(true);
    }
  }, [quote, loaded]);

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

  const categories = [
    { value: 'Lawn Care', icon: '🌿' },
    { value: 'Garden & Beds', icon: '🌺' },
    { value: 'Hardscaping', icon: '🧱' },
    { value: 'Cleanup', icon: '🧹' },
    { value: 'Landscape Design', icon: '🎨' },
    { value: 'Custom', icon: '🔧' },
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

  const updateItem = (itemId, field, value) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitPrice) || 0);
      }
      return updated;
    }));
  };

  const removeItem = (itemId) => setItems(items.filter(i => i.id !== itemId));

  const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
  // Grand total includes delivery so quote.total IS the customer-facing total
  // everywhere (PDF, public quote, percentage-deposit math, invoices).
  const grandTotal = subtotal + (parseFloat(deliveryFee) || 0);

  const handleSave = async () => {
    await updateQuote(id, {
      customerId,
      category,
      items,
      selectedMaterials,
      notes,
      status,
      total: grandTotal,
      materialsCost: parseFloat(materialsCost) || 0,
      deliveryFee: parseFloat(deliveryFee) || 0,
      depositType,
      depositPercentage: depositType === DEPOSIT_TYPES.PERCENTAGE
        ? (parseFloat(depositPercentage) || 0)
        : null,
    });
    router.push(`/quotes/${id}`);
  };

  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href={`/quotes/${id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={16} /> Back to Quote #{quote.quoteNumber}
        </Link>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1>Edit Quote #{quote.quoteNumber}</h1>
          <p>Modify the quote details below.</p>
        </div>
        <div className="page-header-actions">
          <Link href={`/quotes/${id}`} className="btn btn-secondary">
            <X size={16} /> Cancel
          </Link>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      {/* Customer & Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', maxWidth: '700px' }}>
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
        <div className="form-group">
          <label className="form-label">Category</label>
          <select
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Choose...</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.icon} {cat.value}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ maxWidth: '700px', marginBottom: 'var(--space-md)' }}>
        <label className="form-label">Status</label>
        <select
          className="form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ maxWidth: '240px' }}
        >
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {/* Line Items */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <h3>Line Items</h3>
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
                      <option value="bag">bag</option>
                      <option value="roll">roll</option>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-xs)' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Subtotal</span>
                <span style={{ fontSize: '0.9rem' }}>{formatCurrency(subtotal)}</span>
              </div>
              {(parseFloat(deliveryFee) || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-xs)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Delivery</span>
                  <span style={{ fontSize: '0.9rem' }}>{formatCurrency(parseFloat(deliveryFee) || 0)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-sm)', borderTop: '2px solid var(--border-secondary)' }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--lucky-green-light)' }}>
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', marginBottom: 'var(--space-lg)' }}>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
            No line items. Add services or custom items above.
          </p>
          <button className="btn btn-primary btn-sm" onClick={addBlankItem}>
            <Plus size={16} /> Add First Item
          </button>
        </div>
      )}

      {/* Selected materials */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <div>
            <h4 style={{ marginBottom: 4 }}>
              <Package size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Selected Materials
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0 }}>
              Customer sees photos + names + quantities. No prices.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCalculator(true)} title="Cubic yards / weight / bag count calculator">
              <CalcIcon size={14} /> Calculator
            </button>
            <button className="btn btn-secondary" onClick={() => setShowMaterialsPicker(true)}>
              <Plus size={14} /> {selectedMaterials.length === 0 ? 'Pick materials' : `Edit (${selectedMaterials.length})`}
            </button>
          </div>
        </div>
        {selectedMaterials.length > 0 && (
          <>
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
            {(() => {
              const suggested = computeSelectedMaterialsCost(selectedMaterials, materials, suppliers);
              const current = parseFloat(materialsCost) || 0;
              if (suggested <= 0) return null;
              const matches = Math.abs(suggested - current) < 0.01;
              return (
                <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    Cost from selection (incl. tax): <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(suggested)}</strong>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${matches ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => setMaterialsCost(suggested)}
                    disabled={matches}
                  >
                    {matches ? 'Applied' : 'Use as materials cost'}
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {showMaterialsPicker && (
        <SelectMaterialsModal
          initialSelection={selectedMaterials}
          onClose={() => setShowMaterialsPicker(false)}
          onSave={setSelectedMaterials}
        />
      )}

      {/* Material calculator modal — same widget as the standalone
          /calculator page, but pre-fed with the quote's selected materials
          so the result can be applied straight onto a material's quantity. */}
      {showCalculator && (
        <div className="modal-overlay" onClick={() => setShowCalculator(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 980, width: '100%' }}
          >
            <div className="modal-header">
              <h2><CalcIcon size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} /> Material Calculator</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowCalculator(false)} aria-label="Close calculator">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <MaterialCalculator
                embedded
                selectedMaterials={selectedMaterials}
                onApplyQuantity={({ index, quantity }) => {
                  setSelectedMaterials(prev => prev.map((sm, i) =>
                    i === index ? { ...sm, quantity } : sm
                  ));
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Deposit — materials+delivery or percentage of total */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <DepositCard
          depositType={depositType}
          setDepositType={setDepositType}
          depositPercentage={depositPercentage}
          setDepositPercentage={setDepositPercentage}
          materialsCost={materialsCost}
          setMaterialsCost={setMaterialsCost}
          deliveryFee={deliveryFee}
          setDeliveryFee={setDeliveryFee}
          subtotal={grandTotal}
        />
      </div>

      {/* Notes */}
      <div className="form-group" style={{ maxWidth: '600px', marginBottom: 'var(--space-xl)' }}>
        <label className="form-label">Notes</label>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Add any notes about this quote..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Walkthrough media — reference photos / videos / voice memos
          while you build line items, or capture more in the moment.
          The "Apply to Notes" button on the gallery's auto-generated
          summary fills the Notes textarea above without clobbering
          anything the user has already typed. */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <h4 style={{ margin: 0, color: 'var(--text-secondary)' }}>Walkthrough Notes</h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            What the customer asked for · stays with this customer across quotes
          </span>
        </div>
        <QuoteMediaGallery
          quoteId={id}
          onApplySummary={(summary) => {
            setNotes((prev) => {
              const trimmed = (prev || '').trim();
              if (!trimmed) return summary;
              if (trimmed.includes(summary.trim())) return prev; // already there
              return `${trimmed}\n\n${summary}`;
            });
          }}
        />
      </div>

      {/* Bottom Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href={`/quotes/${id}`} className="btn btn-secondary">
          <X size={16} /> Cancel
        </Link>
        <button className="btn btn-primary btn-lg" onClick={handleSave}>
          <Save size={18} /> Save Changes
        </button>
      </div>
    </div>
  );
}
