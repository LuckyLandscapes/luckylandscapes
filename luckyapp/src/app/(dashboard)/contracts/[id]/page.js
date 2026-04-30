'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, CheckCircle2, XCircle, Trash2, Copy, ExternalLink,
  AlertTriangle, FileSignature, X,
} from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function ContractDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getContract, getCustomer, getQuote, updateContract, deleteContract, addActivity } = useData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const contract = getContract(id);
  const customer = contract ? getCustomer(contract.customerId) : null;
  const quote = contract?.quoteId ? getQuote(contract.quoteId) : null;
  const publicLink = contract?.publicToken && typeof window !== 'undefined'
    ? `${window.location.origin}/sign/${contract.publicToken}`
    : '';

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  if (!contract) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Contract not found</h3>
          <Link href="/contracts" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-md)' }}>
            <ArrowLeft size={16} /> Back to Contracts
          </Link>
        </div>
      </div>
    );
  }

  const handleMarkSent = async () => {
    try {
      await updateContract(id, { status: 'sent', sentAt: new Date().toISOString() });
      await addActivity?.({
        customerId: contract.customerId,
        type: 'contract_sent',
        title: `Contract #${contract.contractNumber} sent`,
        description: `Public sign link shared with customer.`,
      });
      showToast('success', 'Marked as sent');
    } catch (err) {
      showToast('error', err?.message || 'Could not update status');
    }
  };

  const handleVoid = async () => {
    if (!confirm('Void this contract? It will no longer be signable by the customer.')) return;
    try {
      await updateContract(id, { status: 'void' });
      showToast('success', 'Contract voided');
    } catch (err) {
      showToast('error', err?.message || 'Could not void contract');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteContract(id);
      router.push('/contracts');
    } catch (err) {
      showToast('error', err?.message || 'Could not delete contract');
      setDeleting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      showToast('success', 'Sign link copied to clipboard');
    } catch {
      showToast('error', 'Could not copy link');
    }
  };

  const isSigned = contract.status === 'signed';
  const isVoid = contract.status === 'void' || contract.status === 'declined';
  const customerName = customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : (contract.customerSnapshot?.name || 'Customer');

  return (
    <div className="page animate-fade-in">
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ position: 'fixed', top: 20, right: 20, zIndex: 100 }}>
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/contracts" className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}>
          <ArrowLeft size={16} /> Contracts
        </Link>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <h1>Contract #{contract.contractNumber}</h1>
            <span className={`badge badge-${contract.status}`} style={{ fontSize: '0.82rem', padding: '4px 14px' }}>
              <span className="badge-dot" />
              {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
            </span>
          </div>
          <p>{contract.title} • Created {formatDateTime(contract.createdAt)}</p>
        </div>
        <div className="page-header-actions">
          {!isSigned && !isVoid && (
            <>
              <button className="btn btn-secondary" onClick={handleCopyLink}>
                <Copy size={16} /> Copy Link
              </button>
              {publicLink && (
                <a href={publicLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  <ExternalLink size={16} /> Preview
                </a>
              )}
              {contract.status === 'draft' && (
                <button className="btn btn-primary" onClick={handleMarkSent}>
                  <Send size={16} /> Mark Sent
                </button>
              )}
              <button className="btn btn-danger" onClick={handleVoid}>
                <XCircle size={16} /> Void
              </button>
            </>
          )}
          {!isSigned && (
            <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>

      {isSigned && (
        <div style={{
          background: 'rgba(45,122,58,0.1)',
          border: '1px solid rgba(45,122,58,0.3)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
        }}>
          <CheckCircle2 size={24} style={{ color: 'var(--status-success)' }} />
          <div>
            <div style={{ fontWeight: 700 }}>Signed by {contract.signatureTypedName || customerName}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {formatDateTime(contract.signedAt)}{contract.signatureIp ? ` • IP ${contract.signatureIp}` : ''}
            </div>
          </div>
        </div>
      )}

      {contract.status === 'declined' && contract.declineReason && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Customer declined</div>
          <div style={{ fontSize: '0.9rem' }}>{contract.declineReason}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 'var(--space-lg)' }}>
        {/* Body preview */}
        <div className="card" style={{ padding: 'var(--space-lg)' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSignature size={18} /> Agreement
          </h3>
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: '0.88rem',
            lineHeight: 1.55,
            color: 'var(--text-primary)',
            background: 'var(--bg-secondary)',
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-sm)',
            margin: 0,
            maxHeight: 600,
            overflowY: 'auto',
          }}>{contract.body}</pre>

          {contract.signatureDataUrl && (
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>
                Customer Signature
              </div>
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'inline-block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={contract.signatureDataUrl} alt="Signature" style={{ maxWidth: 360, height: 'auto', display: 'block' }} />
              </div>
              {contract.signatureTypedName && (
                <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
                  <strong>Typed name:</strong> {contract.signatureTypedName}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>
              Customer
            </div>
            {customer ? (
              <Link href={`/customers/${customer.id}`} style={{ fontWeight: 600 }}>
                {customer.firstName} {customer.lastName}
              </Link>
            ) : (
              <div style={{ fontWeight: 600 }}>{customerName}</div>
            )}
            {(contract.customerSnapshot?.email || customer?.email) && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {contract.customerSnapshot?.email || customer?.email}
              </div>
            )}
            {(contract.customerSnapshot?.phone || customer?.phone) && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {contract.customerSnapshot?.phone || customer?.phone}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>
              Financials
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total</span>
              <strong>{formatCurrency(contract.totalAmount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Deposit</span>
              <strong>{formatCurrency(contract.depositAmount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Balance</span>
              <strong>{formatCurrency((Number(contract.totalAmount) || 0) - (Number(contract.depositAmount) || 0))}</strong>
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>
              Timeline
            </div>
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>Created: {formatDateTime(contract.createdAt)}</div>
              {contract.sentAt && <div>Sent: {formatDateTime(contract.sentAt)}</div>}
              {contract.lastViewedAt && <div>Last viewed: {formatDateTime(contract.lastViewedAt)}</div>}
              {contract.signedAt && <div style={{ color: 'var(--status-success)', fontWeight: 600 }}>Signed: {formatDateTime(contract.signedAt)}</div>}
              {contract.declinedAt && <div style={{ color: 'var(--status-danger)' }}>Declined: {formatDateTime(contract.declinedAt)}</div>}
            </div>
          </div>

          {quote && (
            <div className="card" style={{ padding: 'var(--space-md)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>
                Source Quote
              </div>
              <Link href={`/quotes/${quote.id}`} className="btn btn-ghost btn-sm">
                Quote #{quote.quoteNumber} →
              </Link>
            </div>
          )}

          {publicLink && !isSigned && !isVoid && (
            <div className="card" style={{ padding: 'var(--space-md)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>
                Public Sign Link
              </div>
              <input
                readOnly
                value={publicLink}
                onClick={(e) => e.target.select()}
                style={{ width: '100%', fontSize: '0.78rem', padding: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleCopyLink} style={{ flex: 1 }}>
                  <Copy size={14} /> Copy
                </button>
                <a href={publicLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  <ExternalLink size={14} /> Open
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-danger)' }} />
                <h3 style={{ margin: 0 }}>Delete Contract?</h3>
              </div>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Permanently delete Contract #{contract.contractNumber}? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
