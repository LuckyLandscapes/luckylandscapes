'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, X } from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export default function EditQuotePage() {
  const { id } = useParams();
  const router = useRouter();
  const { getQuote, getCustomer, customers, services, updateQuote } = useData();

  const quote = getQuote(id);
  const customer = quote ? getCustomer(quote.customerId) : null;

  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('draft');
  const [loaded, setLoaded] = useState(false);

  // Load quote data into form state once
  useEffect(() => {
    if (quote && !loaded) {
      setCustomerId(quote.customerId || '');
      setCategory(quote.category || '');
      setItems((quote.items || []).map((item, i) => ({ ...item, id: item.id || `li${i}` })));
      setNotes(quote.notes || '');
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

  const handleSave = async () => {
    await updateQuote(id, {
      customerId,
      category,
      items,
      notes,
      status,
      total: subtotal,
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
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', marginBottom: 'var(--space-lg)' }}>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
            No line items. Add services or custom items above.
          </p>
          <button className="btn btn-primary btn-sm" onClick={addBlankItem}>
            <Plus size={16} /> Add First Item
          </button>
        </div>
      )}

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
