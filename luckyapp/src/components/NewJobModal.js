'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Loader2, Plus, Search, Check, Users, CalendarDays, Clock,
  HardHat, MessageSquare, FileSignature, Shield, DollarSign,
} from 'lucide-react';
import { useData } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { getWcClasses } from '@/lib/finance';
import { customerTypeMeta } from '@/app/(dashboard)/customers/page';
import ReceiptUpload from '@/components/ReceiptUpload';

// Direct-job creation for work that DOESN'T come from a quote and DOESN'T need
// a customer signature — primarily subcontract work (a GC like Jeremiah hires
// us). We still keep an authorization trail (work order on file / typed notes),
// just no signing flow. Mirrors the AddPastJobModal pattern but lands the job
// as 'scheduled' instead of 'completed'.

const WORK_AUTH = [
  { value: 'subcontract', label: 'Subcontract (GC)', icon: HardHat, help: 'A general contractor (e.g. Jeremiah) hired us. No customer signature — keep a work order / PO on file instead. Needed before you can start the job.' },
  { value: 'verbal', label: 'Verbal / informal', icon: MessageSquare, help: 'Trusted repeat customer, small job. No signature — type who authorized it and the agreed scope as your paper trail.' },
  { value: 'contract', label: 'Customer contract', icon: FileSignature, help: 'Standard job that needs a signed contract before starting (you generate/sign it from a quote). Most sub work is NOT this.' },
];

function todayISO() { return new Date().toISOString().split('T')[0]; }

function emptyForm() {
  return {
    customerMode: 'existing',
    customerId: '',
    firstName: '',
    lastName: '',
    customerPhone: '',
    title: '',
    scheduledDate: todayISO(),
    scheduledTime: '',
    workAuthorization: 'subcontract',
    workOrderNotes: '',
    workOrderUrl: null,
    workOrderPath: null,
    siteContactName: '',
    siteContactPhone: '',
    revenue: '',
    wcClass: '',
    assignedTo: [],
    crewNotes: '',
  };
}

export default function NewJobModal({ onClose }) {
  const router = useRouter();
  const { customers, teamMembers, addDirectJob, org } = useData();
  const { user } = useAuth();
  const wcClasses = getWcClasses(org);

  const [form, setForm] = useState(emptyForm());
  const [custSearch, setCustSearch] = useState('');
  const [crewSearch, setCrewSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

  // GCs → business → homeowner, so subcontract clients (Jeremiah) are on top.
  const sortedCustomers = useMemo(() => {
    const rank = { general_contractor: 0, business: 1, homeowner: 2 };
    const q = custSearch.trim().toLowerCase();
    return [...customers]
      .filter(c => {
        if (!q) return true;
        const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        return name.includes(q) || (c.email || '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ra = rank[a.customerType] ?? 3;
        const rb = rank[b.customerType] ?? 3;
        if (ra !== rb) return ra - rb;
        return `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`);
      });
  }, [customers, custSearch]);

  const activeMembers = useMemo(() => teamMembers.filter(m => m.isActive), [teamMembers]);
  const filteredMembers = crewSearch
    ? activeMembers.filter(m => m.fullName?.toLowerCase().includes(crewSearch.toLowerCase()))
    : activeMembers;

  const toggleCrew = (id) => set({
    assignedTo: form.assignedTo.includes(id)
      ? form.assignedTo.filter(m => m !== id)
      : [...form.assignedTo, id],
  });

  const authMeta = WORK_AUTH.find(a => a.value === form.workAuthorization) || WORK_AUTH[0];

  const validate = () => {
    if (form.customerMode === 'existing' && !form.customerId) return 'Pick a customer (or click "Add new").';
    if (form.customerMode === 'new' && !form.firstName.trim()) return 'New customer needs at least a first name.';
    if (!form.title.trim()) return 'Job title is required.';
    if (!form.scheduledDate) return 'Pick a scheduled date.';
    if (form.revenue !== '' && !(Number(form.revenue) >= 0)) return 'Billable amount must be a number ≥ 0 (or blank).';
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const input = {
        title: form.title.trim(),
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime || null,
        workAuthorization: form.workAuthorization,
        workOrderNotes: form.workOrderNotes.trim(),
        workOrderUrl: form.workOrderUrl,
        workOrderPath: form.workOrderPath,
        siteContactName: form.siteContactName.trim(),
        siteContactPhone: form.siteContactPhone.trim(),
        revenue: form.revenue === '' ? 0 : Number(form.revenue),
        wcClass: form.wcClass || null,
        assignedTo: form.assignedTo,
        crewNotes: form.crewNotes.trim(),
      };
      if (form.customerMode === 'existing') {
        input.customerId = form.customerId;
      } else {
        input.firstName = form.firstName.trim();
        input.lastName = form.lastName.trim();
        input.customerPhone = form.customerPhone.trim();
      }
      const res = await addDirectJob(input);
      onClose?.();
      if (res?.job?.id) router.push(`/jobs/${res.job.id}`);
    } catch (e) {
      setError(e.message || 'Failed to create job.');
      setSaving(false);
    }
  };

  const isSub = form.workAuthorization === 'subcontract';
  const isVerbal = form.workAuthorization === 'verbal';

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose?.()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2><HardHat size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} /> New Job</h2>
          <button className="btn btn-icon btn-ghost" onClick={() => !saving && onClose?.()}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
          <p style={{ marginTop: 0, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            Create a job directly — no quote, no signature. Built for subcontract work (Jeremiah, etc.). We still keep an authorization trail; we just skip the signing flow.
          </p>

          {error && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

          {/* Customer */}
          <div className="form-group">
            <label className="form-label">Customer <span className="required">*</span></label>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              <button type="button" className={`btn btn-sm ${form.customerMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set({ customerMode: 'existing' })}>Existing</button>
              <button type="button" className={`btn btn-sm ${form.customerMode === 'new' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set({ customerMode: 'new' })}><Plus size={12} /> Add new</button>
            </div>

            {form.customerMode === 'existing' ? (
              <>
                <div className="search-input-wrap" style={{ marginBottom: 'var(--space-sm)' }}>
                  <Search size={16} />
                  <input className="search-input" placeholder="Search customers (GCs shown first)..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
                </div>
                <div className="quote-picker-list" style={{ maxHeight: 200, overflowY: 'auto' }} data-menu-scroll>
                  {sortedCustomers.slice(0, 50).map(c => {
                    const meta = customerTypeMeta(c.customerType);
                    const isSel = form.customerId === c.id;
                    const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed';
                    return (
                      <button key={c.id} type="button" className={`quote-picker-item ${isSel ? 'active' : ''}`} onClick={() => set({ customerId: c.id })}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem' }}>
                            {name}
                            {c.customerType && c.customerType !== 'homeowner' && (
                              <span className={`tag ${meta.tone || ''}`} style={{ fontSize: '0.65rem' }}>{meta.short}</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{c.email || c.phone || '—'}</div>
                        </div>
                        {isSel && <Check size={16} style={{ color: 'var(--lucky-green-light)' }} />}
                      </button>
                    );
                  })}
                  {sortedCustomers.length === 0 && (
                    <div style={{ padding: 'var(--space-md)', fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>No customers match your search.</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <input className="form-input" placeholder="First name / company" value={form.firstName} onChange={e => set({ firstName: e.target.value })} />
                  <input className="form-input" placeholder="Last name (optional)" value={form.lastName} onChange={e => set({ lastName: e.target.value })} />
                </div>
                <input className="form-input" type="tel" placeholder="Phone (optional)" value={form.customerPhone} onChange={e => set({ customerPhone: e.target.value })} style={{ marginTop: 'var(--space-sm)' }} />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                  {isSub ? 'Saved as a General Contractor (they\'re who you bill).' : 'Saved as a homeowner. Change the type later on the customer page.'}
                </p>
              </>
            )}
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Job title <span className="required">*</span></label>
            <input className="form-input" placeholder="e.g. Retaining wall — 4501 Pine St (for Jeremiah)" value={form.title} onChange={e => set({ title: e.target.value })} />
          </div>

          {/* Date + Time */}
          <div className="form-row" style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label"><CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Date <span className="required">*</span></label>
              <input type="date" className="form-input" value={form.scheduledDate} onChange={e => set({ scheduledDate: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label"><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Start time</label>
              <input type="time" className="form-input" value={form.scheduledTime} onChange={e => set({ scheduledTime: e.target.value })} />
            </div>
          </div>

          {/* Work Authorization */}
          <div className="form-group">
            <label className="form-label"><FileSignature size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Work authorization</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {WORK_AUTH.map(opt => {
                const Icon = opt.icon;
                const isActive = form.workAuthorization === opt.value;
                return (
                  <button key={opt.value} type="button" className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set({ workAuthorization: opt.value })} style={{ flex: 1, minWidth: 150, justifyContent: 'center' }}>
                    <Icon size={14} /> {opt.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>{authMeta.help}</p>
          </div>

          {/* Authorization proof (sub / verbal) */}
          {(isSub || isVerbal) && (
            <>
              {isSub && user?.orgId && (
                <div className="form-group">
                  <label className="form-label">Work order photo (PO, email screenshot, etc.)</label>
                  <ReceiptUpload
                    orgId={user.orgId}
                    scope="work-order"
                    value={{ url: form.workOrderUrl, path: form.workOrderPath }}
                    onChange={({ url, path }) => set({ workOrderUrl: url, workOrderPath: path })}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Authorization details</label>
                <textarea
                  className="form-textarea" rows={3}
                  value={form.workOrderNotes}
                  onChange={e => set({ workOrderNotes: e.target.value })}
                  placeholder={isSub
                    ? 'GC name, scope, agreed price/day rate, contact, PO #. Anything proving the GC asked for this work.'
                    : 'Who authorized this verbally, when, and the agreed scope/price. Your audit trail if it\'s disputed later.'}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                  Optional now, but the job can&apos;t be started until {isSub ? 'a work order or these notes are' : 'this is'} on file.
                </p>
              </div>
            </>
          )}

          {/* Site contact (sub) */}
          {isSub && (
            <div className="form-row" style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Site contact (homeowner)</label>
                <input className="form-input" value={form.siteContactName} onChange={e => set({ siteContactName: e.target.value })} placeholder="Homeowner name" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Site contact phone</label>
                <input className="form-input" type="tel" value={form.siteContactPhone} onChange={e => set({ siteContactPhone: e.target.value })} placeholder="(402) 555-1234" />
              </div>
            </div>
          )}

          {/* Billable + Insurance class */}
          <div className="form-row" style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label"><DollarSign size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Estimated billable</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" className="form-input" placeholder="Optional" value={form.revenue} onChange={e => set({ revenue: e.target.value })} />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>You set the real line items when you invoice.</p>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label"><Shield size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Insurance class</label>
              <select className="form-select" value={form.wcClass} onChange={e => set({ wcClass: e.target.value })}>
                <option value="">Unclassified</option>
                {wcClasses.map(c => (
                  <option key={c.key} value={c.key}>{c.label}{c.code ? ` (${c.code})` : ''}</option>
                ))}
              </select>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Buckets this job on the Insurance report.</p>
            </div>
          </div>

          {/* Crew */}
          {activeMembers.length > 0 && (
            <div className="form-group">
              <label className="form-label"><Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Assign crew ({form.assignedTo.length})</label>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input className="form-input" placeholder="Search crew..." value={crewSearch} onChange={e => setCrewSearch(e.target.value)} style={{ paddingLeft: 32 }} />
              </div>
              <div className="crew-assignment-list">
                {filteredMembers.map(m => {
                  const isSel = form.assignedTo.includes(m.id);
                  return (
                    <button key={m.id} type="button" className={`crew-assignment-item ${isSel ? 'active' : ''}`} onClick={() => toggleCrew(m.id)}>
                      <div className="table-avatar" style={{ width: 30, height: 30, fontSize: '0.6rem', background: isSel ? 'var(--lucky-green)' : 'var(--bg-elevated)', color: isSel ? 'white' : 'var(--text-secondary)' }}>
                        {m.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{m.fullName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{m.role}</div>
                      </div>
                      {isSel && <Check size={16} style={{ color: 'var(--lucky-green-light)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Crew notes */}
          <div className="form-group">
            <label className="form-label">Crew notes</label>
            <textarea className="form-textarea" rows={2} value={form.crewNotes} onChange={e => set({ crewNotes: e.target.value })} placeholder="Access, gate codes, what to bring..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => !saving && onClose?.()} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? <><Loader2 size={16} className="spin" /> Creating…</> : <><Plus size={16} /> Create Job</>}
          </button>
        </div>
      </div>
    </div>
  );
}
