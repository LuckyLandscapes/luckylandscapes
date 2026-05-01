'use client';

// 1099 contractor directory. Captures W-9 info and the photo of the signed
// W-9 itself (lives in `receipts` bucket under contractors/). Annual payments
// are NOT tracked on this page — they roll up from job_expenses and
// company_expenses tagged with contractor_id. See /reports for the 1099-NEC
// year-end totals view.
//
// PII note: this page reads/writes contractors.tax_id (full SSN/EIN). Only
// owner/admin should see this page, and the tax_id input is type="password"
// by default to avoid shoulder-surfing on a shared screen.

import { useState, useMemo } from 'react';
import { useData } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { fmtCurrency } from '@/lib/finance';
import {
  Plus, X, Save, Search, Trash2, Edit3, FileSignature, AlertTriangle,
  Eye, EyeOff, ShieldCheck, FileText, Archive, ArchiveRestore,
} from 'lucide-react';
import ReceiptUpload from '@/components/ReceiptUpload';

const CLASSIFICATIONS = [
  { v: 'individual', l: 'Individual / Sole Proprietor' },
  { v: 'sole_prop',  l: 'Sole Proprietor (DBA)' },
  { v: 'llc',        l: 'LLC' },
  { v: 'partnership',l: 'Partnership' },
  { v: 'c_corp',     l: 'C Corporation' },
  { v: 's_corp',     l: 'S Corporation' },
  { v: 'other',      l: 'Other' },
];

const taxYearNow = () => new Date().getFullYear();

function emptyForm() {
  return {
    contactName: '',
    businessName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    taxClassification: 'individual',
    llcTaxTreatment: '',
    taxIdType: 'ssn',
    taxId: '',
    w9ReceivedAt: '',
    backupWithholding: false,
    exemptFrom1099: false,
    notes: '',
    w9: { url: null, path: null },
  };
}

export default function ContractorsPage() {
  const { contractors, addContractor, updateContractor, deleteContractor, getContractorPaymentsForYear } = useData();
  const { user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [revealTaxId, setRevealTaxId] = useState(false);
  const [year] = useState(taxYearNow());

  const filtered = useMemo(() => {
    return contractors
      .filter(c => showArchived ? c.archived : !c.archived)
      .filter(c => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (c.contactName || '').toLowerCase().includes(q)
          || (c.businessName || '').toLowerCase().includes(q)
          || (c.email || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (a.contactName || '').localeCompare(b.contactName || ''));
  }, [contractors, search, showArchived]);

  // Annual totals per contractor — used to flag the $600 1099-NEC threshold.
  const annualTotals = useMemo(() => {
    const map = {};
    for (const c of contractors) {
      const { total } = getContractorPaymentsForYear(c.id, year);
      map[c.id] = total;
    }
    return map;
  }, [contractors, year, getContractorPaymentsForYear]);

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({
      contactName: c.contactName || '',
      businessName: c.businessName || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      zip: c.zip || '',
      taxClassification: c.taxClassification || 'individual',
      llcTaxTreatment: c.llcTaxTreatment || '',
      taxIdType: c.taxIdType || 'ssn',
      taxId: c.taxId || '',
      w9ReceivedAt: c.w9ReceivedAt || '',
      backupWithholding: !!c.backupWithholding,
      exemptFrom1099: !!c.exemptFrom1099,
      notes: c.notes || '',
      w9: { url: c.w9Url || null, path: c.w9Path || null },
    });
    setRevealTaxId(false);
    setShowForm(true);
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setRevealTaxId(false);
  };

  const save = async () => {
    if (!form.contactName.trim()) { setError('Contact name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const cleanTaxId = form.taxId.replace(/\D/g, '');
      const payload = {
        contactName: form.contactName.trim(),
        businessName: form.businessName.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        taxClassification: form.taxClassification || null,
        llcTaxTreatment: form.taxClassification === 'llc' ? (form.llcTaxTreatment || null) : null,
        taxIdType: form.taxIdType || null,
        taxId: cleanTaxId || null,
        w9ReceivedAt: form.w9ReceivedAt || null,
        backupWithholding: !!form.backupWithholding,
        exemptFrom1099: !!form.exemptFrom1099,
        notes: form.notes.trim() || null,
        w9Url: form.w9?.url || null,
        w9Path: form.w9?.path || null,
      };
      if (editingId) {
        await updateContractor(editingId, payload);
      } else {
        await addContractor(payload);
      }
      cancel();
    } catch (err) {
      console.error('[ContractorsPage] save failed', err);
      setError(err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    const c = contractors.find(x => x.id === id);
    if (!confirm(`Delete contractor "${c?.contactName}"? This is permanent. Tagged expense rows keep their amounts but lose the contractor link, so 1099 totals won't include them.`)) return;
    try { await deleteContractor(id); }
    catch (err) { alert(err?.message || 'Delete failed.'); }
  };

  const toggleArchive = async (c) => {
    try { await updateContractor(c.id, { archived: !c.archived }); }
    catch (err) { alert(err?.message || 'Update failed.'); }
  };

  const flagged1099 = filtered.filter(c => !c.exemptFrom1099 && (annualTotals[c.id] || 0) >= 600).length;

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1><FileSignature size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Contractors</h1>
          <p>{filtered.length} active • {flagged1099} owe a 1099-NEC for {year}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}>
            <Plus size={16} /> Add Contractor
          </button>
        </div>
      </div>

      {/* PII reminder */}
      <div style={{ background: 'rgba(45,122,58,0.08)', border: '1px solid rgba(45,122,58,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-lg)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <ShieldCheck size={16} style={{ flexShrink: 0, color: 'var(--accent-primary)', marginTop: 2 }} />
        <div>
          Tax IDs are stored full so you can file 1099-NECs at year-end. They&apos;re row-level-secured per org and never exposed in public links. Tag expense rows with a contractor (in the receipt or expense form) so totals roll up here.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input-wrap" style={{ flex: 1, maxWidth: '400px' }}>
          <Search size={16} />
          <input
            className="search-input"
            placeholder="Search by name, business, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', color: 'var(--text-tertiary)' }}>
          {showArchived ? 'No archived contractors.' : 'No contractors yet. Add one before paying anyone.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {filtered.map(c => {
            const ytd = annualTotals[c.id] || 0;
            const owes1099 = !c.exemptFrom1099 && ytd >= 600;
            return (
              <div key={c.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{c.contactName}</strong>
                    {c.businessName && <span style={{ color: 'var(--text-tertiary)' }}>· {c.businessName}</span>}
                    {c.taxClassification && <span className="tag">{CLASSIFICATIONS.find(x => x.v === c.taxClassification)?.l || c.taxClassification}</span>}
                    {c.exemptFrom1099 && <span className="tag" style={{ background: 'var(--bg-secondary)' }}>1099 exempt</span>}
                    {c.backupWithholding && <span className="tag" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Backup withholding</span>}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span> · {c.phone}</span>}
                    {(c.taxIdType && c.taxIdLast4) && <span> · {c.taxIdType.toUpperCase()} ••••{c.taxIdLast4}</span>}
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <span style={{ color: owes1099 ? '#f59e0b' : 'var(--text-tertiary)', fontWeight: owes1099 ? 600 : 400 }}>
                      {year} paid: {fmtCurrency(ytd)}
                    </span>
                    {owes1099 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                        <AlertTriangle size={12} /> ≥ $600 → 1099-NEC required
                      </span>
                    )}
                    {c.w9Url ? (
                      <a href={c.w9Url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={12} /> W-9 on file
                      </a>
                    ) : (
                      <span style={{ color: 'var(--status-danger)' }}>⚠ No W-9 — request before paying</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-icon btn-ghost" onClick={() => startEdit(c)} title="Edit"><Edit3 size={16} /></button>
                  <button className="btn btn-icon btn-ghost" onClick={() => toggleArchive(c)} title={c.archived ? 'Unarchive' : 'Archive'}>
                    {c.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                  <button className="btn btn-icon btn-ghost" onClick={() => remove(c.id)} title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => !saving && cancel()}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h2><FileSignature size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {editingId ? 'Edit Contractor' : 'Add Contractor'}</h2>
              <button className="btn btn-icon btn-ghost" onClick={cancel} disabled={saving}><X size={20} /></button>
            </div>
            <div className="modal-body">

              <div className="form-row" style={{ gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Contact name <span style={{ color: 'var(--status-danger)' }}>*</span></label>
                  <input className="form-input" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Legal name from line 1 of W-9" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Business name (DBA)</label>
                  <input className="form-input" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="If different from contact" />
                </div>
              </div>

              <div className="form-row" style={{ gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address (1099-NEC payee box)</label>
                <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street" />
              </div>
              <div className="form-row" style={{ gap: '8px' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">City</label>
                  <input className="form-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: '0 0 80px' }}>
                  <label className="form-label">State</label>
                  <input className="form-input" maxLength={2} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} />
                </div>
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                  <label className="form-label">ZIP</label>
                  <input className="form-input" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} />
                </div>
              </div>

              <div className="form-row" style={{ gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Tax classification (W-9 box 3)</label>
                  <select className="form-select" value={form.taxClassification} onChange={e => setForm(f => ({ ...f, taxClassification: e.target.value }))}>
                    {CLASSIFICATIONS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                </div>
                {form.taxClassification === 'llc' && (
                  <div className="form-group" style={{ flex: '0 0 120px' }}>
                    <label className="form-label">LLC taxed as</label>
                    <select className="form-select" value={form.llcTaxTreatment} onChange={e => setForm(f => ({ ...f, llcTaxTreatment: e.target.value }))}>
                      <option value="">—</option>
                      <option value="C">C-corp</option>
                      <option value="S">S-corp</option>
                      <option value="P">Partnership</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-row" style={{ gap: '8px' }}>
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                  <label className="form-label">ID type</label>
                  <select className="form-select" value={form.taxIdType} onChange={e => setForm(f => ({ ...f, taxIdType: e.target.value }))}>
                    <option value="ssn">SSN</option>
                    <option value="ein">EIN</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{form.taxIdType === 'ein' ? 'EIN' : 'SSN'}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={revealTaxId ? 'text' : 'password'}
                      value={form.taxId}
                      onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))}
                      placeholder={form.taxIdType === 'ein' ? '12-3456789' : '123-45-6789'}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setRevealTaxId(v => !v)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-tertiary)' }}
                      title={revealTaxId ? 'Hide' : 'Show'}
                    >
                      {revealTaxId ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ flex: '0 0 160px' }}>
                  <label className="form-label">W-9 received</label>
                  <input className="form-input" type="date" value={form.w9ReceivedAt} onChange={e => setForm(f => ({ ...f, w9ReceivedAt: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">W-9 photo / scan</label>
                <ReceiptUpload
                  orgId={user?.orgId}
                  scope="contractors"
                  value={form.w9}
                  onChange={(v) => setForm(f => ({ ...f, w9: v }))}
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.backupWithholding} onChange={e => setForm(f => ({ ...f, backupWithholding: e.target.checked }))} />
                  Subject to backup withholding (W-9 Part II item 2 NOT crossed out)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.exemptFrom1099} onChange={e => setForm(f => ({ ...f, exemptFrom1099: e.target.checked }))} />
                  Exempt from 1099-NEC (e.g. C-corp / S-corp payee)
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Specialty, rate, terms, etc."
                />
              </div>

              {error && (
                <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancel} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving…' : (editingId ? 'Update' : 'Save Contractor')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
