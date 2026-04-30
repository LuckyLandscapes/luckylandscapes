'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import Link from 'next/link';
import { FileSignature, Search, ArrowRight, Plus } from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(Number(n) || 0);
}

export default function ContractsPage() {
  const { contracts, customers, quotes } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statuses = ['all', 'draft', 'sent', 'viewed', 'signed', 'declined', 'void'];

  const filtered = contracts.filter(c => {
    const customer = customers.find(cu => cu.id === c.customerId);
    const haystack = `${c.contractNumber} ${c.title || ''} ${c.category || ''} ${customer?.firstName || ''} ${customer?.lastName || ''}`;
    const matchSearch = haystack.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = {};
  statuses.forEach(s => {
    statusCounts[s] = s === 'all' ? contracts.length : contracts.filter(c => c.status === s).length;
  });

  const acceptedQuotesWithoutContracts = quotes.filter(q =>
    (q.status === 'accepted' || q.status === 'sent') && !contracts.some(c => c.quoteId === q.id)
  );

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Contracts</h1>
          <p>{contracts.length} total agreements • {statusCounts.signed || 0} signed</p>
        </div>
        <div className="page-header-actions">
          <Link href="/quotes" className="btn btn-secondary">
            Generate from Quote
          </Link>
        </div>
      </div>

      {acceptedQuotesWithoutContracts.length > 0 && (
        <div style={{
          background: 'rgba(45,122,58,0.08)',
          border: '1px solid rgba(45,122,58,0.25)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          fontSize: '0.9rem',
        }}>
          <strong>{acceptedQuotesWithoutContracts.length}</strong> accepted/sent quote{acceptedQuotesWithoutContracts.length === 1 ? ' has' : 's have'} no contract yet. Open the quote and click <em>Generate Contract</em> to create one for signature.
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input-wrap" style={{ flex: 1, maxWidth: '400px' }}>
          <Search size={16} />
          <input
            className="search-input"
            placeholder="Search contracts..."
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
                <span style={{ marginLeft: 4, opacity: 0.7 }}>({statusCounts[s]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Title</th>
              <th>Total</th>
              <th>Status</th>
              <th>Signed</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const customer = customers.find(cu => cu.id === c.customerId);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/contracts/${c.id}`} style={{ fontWeight: 700, color: 'var(--lucky-green-light)' }}>
                      #{c.contractNumber}
                    </Link>
                  </td>
                  <td>
                    <div className="table-customer-cell">
                      <div className="table-avatar">
                        {(customer?.firstName?.[0] || '?') + (customer?.lastName?.[0] || '')}
                      </div>
                      <div>
                        <div className="table-name">{customer?.firstName} {customer?.lastName}</div>
                        <div className="table-sub">{customer?.city}{customer?.state ? `, ${customer.state}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>{c.title || c.category || '—'}</td>
                  <td style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formatCurrency(c.totalAmount)}</td>
                  <td>
                    <span className={`badge badge-${c.status}`}>
                      <span className="badge-dot" />
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                    {c.signedAt ? new Date(c.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </td>
                  <td>
                    <Link href={`/contracts/${c.id}`} className="btn btn-ghost btn-sm">
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
                    <div className="empty-state-icon"><FileSignature size={28} /></div>
                    <h3>No contracts yet</h3>
                    <p>Open an accepted quote and click <em>Generate Contract</em> to create one for the customer to sign.</p>
                    <Link href="/quotes" className="btn btn-primary btn-sm">
                      <Plus size={16} /> Browse Quotes
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
