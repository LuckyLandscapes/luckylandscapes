'use client';

import { useData } from '@/lib/data';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { generateQuotePdf } from '@/lib/generateQuotePdf';
import {
  ArrowLeft, Send, CheckCircle2, XCircle, Printer, Edit3, Trash2,
} from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export default function QuoteDetailPage() {
  const { id } = useParams();
  const { getQuote, getCustomer, updateQuote } = useData();

  const quote = getQuote(id);
  const customer = quote ? getCustomer(quote.customerId) : null;

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

  const handleStatusChange = (newStatus) => {
    updateQuote(id, { status: newStatus });
  };

  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/quotes" className="btn btn-ghost btn-sm" style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={16} /> Quotes
        </Link>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <h1>Quote #{quote.quoteNumber}</h1>
            <span className={`badge badge-${quote.status}`} style={{ fontSize: '0.82rem', padding: '4px 14px' }}>
              <span className="badge-dot" />
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </span>
          </div>
          <p>{quote.category} • Created {quote.createdAt}</p>
        </div>
        <div className="page-header-actions">
          {quote.status === 'draft' && (
            <button className="btn btn-primary" onClick={() => handleStatusChange('sent')}>
              <Send size={16} /> Send Quote
            </button>
          )}
          {quote.status === 'sent' && (
            <>
              <button className="btn btn-primary" onClick={() => handleStatusChange('accepted')} style={{ background: 'var(--status-success)', borderColor: 'var(--status-success)' }}>
                <CheckCircle2 size={16} /> Mark Accepted
              </button>
              <button className="btn btn-danger" onClick={() => handleStatusChange('declined')}>
                <XCircle size={16} /> Declined
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={async () => await generateQuotePdf(quote, customer)}>
            <Printer size={16} /> PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-md)' }}>
        {/* Quote Content */}
        <div>
          {/* Line Items */}
          <div className="table-wrapper">
            <div className="table-header">
              <h3>Line Items</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Service / Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(quote.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.description && <div className="table-sub">{item.description}</div>}
                    </td>
                    <td>{item.quantity}</td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{item.unit}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{
              padding: 'var(--space-lg)',
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 'var(--space-sm)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(quote.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Tax</span>
                <span style={{ fontWeight: 600 }}>$0.00</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', width: '240px',
                paddingTop: 'var(--space-sm)', borderTop: '2px solid var(--border-secondary)',
              }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--lucky-green-light)' }}>
                  {formatCurrency(quote.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="card" style={{ marginTop: 'var(--space-md)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>Notes</h4>
              <p style={{ fontSize: '0.85rem' }}>{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Customer Card */}
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Customer</h4>
            {customer ? (
              <Link href={`/customers/${customer.id}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div className="table-avatar" style={{ width: 40, height: 40, background: 'var(--lucky-green)', color: 'white' }}>
                  {(customer.firstName?.[0] || '') + (customer.lastName?.[0] || '')}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{customer.firstName} {customer.lastName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{customer.phone}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{customer.email}</div>
                </div>
              </Link>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No customer assigned</p>
            )}
          </div>

          {/* Details Card */}
          <div className="card">
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{quote.category}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{quote.createdAt}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valid For</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>30 days</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{quote.items?.length || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
