'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import { Plus, Search, FileText, ArrowRight } from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

export default function QuotesPage() {
  const { quotes, customers } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statuses = ['all', 'draft', 'sent', 'viewed', 'accepted', 'declined'];

  const filtered = quotes.filter(q => {
    const customer = customers.find(c => c.id === q.customerId);
    const matchSearch = `${q.quoteNumber} ${q.category} ${customer?.firstName || ''} ${customer?.lastName || ''}`
      .toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = {};
  statuses.forEach(s => {
    statusCounts[s] = s === 'all' ? quotes.length : quotes.filter(q => q.status === s).length;
  });

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Quotes</h1>
          <p>{quotes.length} total quotes</p>
        </div>
        <div className="page-header-actions">
          <Link href="/quotes/new" className="btn btn-primary">
            <Plus size={18} /> New Quote
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input-wrap" style={{ flex: 1, maxWidth: '400px' }}>
          <Search size={16} />
          <input
            className="search-input"
            placeholder="Search quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tabs">
          {statuses.map(s => (
            <button
              key={s}
              className={`tab ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {statusCounts[s] > 0 && s !== 'all' && (
                <span style={{ marginLeft: '4px', opacity: 0.7 }}>({statusCounts[s]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Quote #</th>
              <th>Customer</th>
              <th>Category</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(q => {
              const customer = customers.find(c => c.id === q.customerId);
              return (
                <tr key={q.id}>
                  <td>
                    <Link href={`/quotes/${q.id}`} style={{ fontWeight: 700, color: 'var(--lucky-green-light)' }}>
                      #{q.quoteNumber}
                    </Link>
                  </td>
                  <td>
                    <div className="table-customer-cell">
                      <div className="table-avatar">
                        {(customer?.firstName?.[0] || '?') + (customer?.lastName?.[0] || '')}
                      </div>
                      <div>
                        <div className="table-name">{customer?.firstName} {customer?.lastName}</div>
                        <div className="table-sub">{customer?.city}, {customer?.state}</div>
                      </div>
                    </div>
                  </td>
                  <td>{q.category}</td>
                  <td>{q.items?.length || 0} items</td>
                  <td style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formatCurrency(q.total)}</td>
                  <td>
                    <span className={`badge badge-${q.status}`}>
                      <span className="badge-dot" />
                      {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</td>
                  <td>
                    <Link href={`/quotes/${q.id}`} className="btn btn-ghost btn-sm">
                      View <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FileText size={28} /></div>
                    <h3>No quotes found</h3>
                    <p>Create your first quote to start tracking proposals.</p>
                    <Link href="/quotes/new" className="btn btn-primary btn-sm">
                      <Plus size={16} /> Create Quote
                    </Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
