'use client';

import { use, useState } from 'react';
import { useData } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarDays, Clock, MapPin, User, Phone, Mail, FileText,
  Flag, Timer, Users, DollarSign, Briefcase, Navigation, Play, CheckCircle2,
  XCircle, ChevronRight, Plus, Trash2, X, Package, Wrench, Fuel, TrendingUp,
  Edit3, Save, Search, Check, AlertTriangle, Receipt, Image as ImageIcon, AlertCircle, CheckCircle,
} from 'lucide-react';
import ReceiptUpload from '@/components/ReceiptUpload';
import QuoteMediaGallery from '@/components/QuoteMediaGallery';

function formatTime12(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', icon: CalendarDays, color: 'var(--status-info)' },
  in_progress: { label: 'In Progress', icon: Play, color: 'var(--status-warning)' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'var(--status-success)' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'var(--status-danger)' },
};

const EXPENSE_CATEGORIES = [
  { value: 'materials', label: 'Materials', icon: '🧱' },
  { value: 'equipment', label: 'Equipment', icon: '🔧' },
  { value: 'fuel', label: 'Fuel', icon: '⛽' },
  { value: 'dump_fees', label: 'Dump Fees', icon: '🚛' },
  { value: 'subcontractor', label: 'Subcontractor', icon: '👷' },
  { value: 'permits', label: 'Permits', icon: '📄' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export default function JobDetailPage({ params }) {
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;
  const router = useRouter();
  const { getJob, getCustomer, getQuote, getTeamMember, updateJob, deleteJob, teamMembers,
    getJobFinancials, addJobExpense, deleteJobExpense, jobExpenses, timeEntries,
    calendarEvents, invoices } = useData();
  const { user, isOwnerOrAdmin, isWorker } = useAuth();

  const job = getJob(jobId);
  const customer = job?.customerId ? getCustomer(job.customerId) : null;
  const quote = job?.quoteId ? getQuote(job.quoteId) : null;
  const financials = job ? getJobFinancials(jobId) : null;
  const [updating, setUpdating] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const todayISO = () => new Date().toISOString().split('T')[0];
  const emptyExpense = () => ({
    category: 'materials',
    description: '',
    amount: '',
    date: todayISO(),
    vendor: '',
    receipt: { url: null, path: null },
  });
  const [expenseForm, setExpenseForm] = useState(emptyExpense());
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [crewSearch, setCrewSearch] = useState('');
  const [editError, setEditError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  if (!job) {
    return (
      <div className="page animate-fade-in" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <Briefcase size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }} />
        <h2>Job Not Found</h2>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
          This job may have been deleted or you don&apos;t have access.
        </p>
        <Link href={isWorker ? '/crew-dashboard' : '/jobs'} className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }}>
          {isWorker ? 'Back to Dashboard' : 'Back to Jobs'}
        </Link>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;
  const assignedMembers = (job.assignedTo || [])
    .map(id => getTeamMember(id) || teamMembers.find(m => m.id === id))
    .filter(Boolean);

  const fullAddress = job.address || (customer?.address
    ? `${customer.address}${customer.city ? `, ${customer.city}` : ''}${customer.state ? ` ${customer.state}` : ''} ${customer.zip || ''}`.trim()
    : '');
  const mapsUrl = fullAddress ? `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}` : '';

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await updateJob(job.id, { status: newStatus });
      const labels = { in_progress: 'started', completed: 'completed', cancelled: 'cancelled', scheduled: 'scheduled' };
      showToast('success', `Job ${labels[newStatus] || newStatus}`);
    } catch (err) {
      console.error('Error updating status:', err);
      showToast('error', err?.message || `Could not update job to ${newStatus}. Try again.`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await deleteJobExpense(expenseId);
      showToast('success', 'Expense deleted');
    } catch (err) {
      console.error('Error deleting expense:', err);
      showToast('error', err?.message || 'Could not delete the expense. Try again.');
    }
  };

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseForm.amount);
    if (!expenseForm.description.trim() || !amount || amount <= 0) {
      setExpenseError('Description and a positive amount are required.');
      return;
    }
    setSavingExpense(true);
    setExpenseError(null);
    try {
      await addJobExpense({
        jobId,
        category: expenseForm.category,
        description: expenseForm.description.trim(),
        amount,
        date: expenseForm.date || todayISO(),
        vendor: expenseForm.vendor.trim() || null,
        receiptUrl: expenseForm.receipt?.url || null,
        receiptPath: expenseForm.receipt?.path || null,
      });
      setExpenseForm(emptyExpense());
      setShowAddExpense(false);
    } catch (err) {
      console.error('Error saving expense:', err);
      setExpenseError(err?.message || 'Failed to save expense.');
    } finally {
      setSavingExpense(false);
    }
  };

  const openEditModal = () => {
    setEditForm({
      scheduledDate: job.scheduledDate || '',
      scheduledTime: job.scheduledTime || '',
      crewNotes: job.crewNotes || '',
      priority: job.priority || 'normal',
      assignedTo: job.assignedTo || [],
    });
    setCrSearch('');
    setEditError(null);
    setShowEditModal(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteJob(job.id);
      router.push(isWorker ? '/crew-dashboard' : '/jobs');
    } catch (err) {
      console.error('Error deleting job:', err);
      setDeleteError(err?.message || 'Failed to delete job. Please try again.');
      setDeleting(false);
    }
  };

  const linkedEventCount = calendarEvents.filter(e => e.jobId === jobId).length;
  const linkedInvoices = invoices.filter(i => i.jobId === jobId);

  const handleEditSave = async () => {
    setUpdating(true);
    setEditError(null);
    try {
      await updateJob(job.id, editForm);
      setShowEditModal(false);
    } catch (err) {
      console.error('Error updating job:', err);
      setEditError(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const setCrSearch = (v) => setCrewSearch(v);
  const toggleEditCrew = (id) => {
    setEditForm(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(id)
        ? prev.assignedTo.filter(m => m !== id)
        : [...prev.assignedTo, id],
    }));
  };
  const activeMembers = teamMembers.filter(m => m.isActive);
  const filteredEditMembers = crewSearch
    ? activeMembers.filter(m => m.fullName?.toLowerCase().includes(crewSearch.toLowerCase()))
    : activeMembers;

  // Get time entries for this job
  const jobTimeEntries = timeEntries.filter(t => t.jobId === jobId && t.clockIn && t.clockOut);

  return (
    <div className="page job-detail-page animate-fade-in">
      <Link href={isWorker ? '/crew-dashboard' : '/jobs'} className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-md)' }}>
        <ArrowLeft size={16} /> {isWorker ? 'Back to Dashboard' : 'Back to Jobs'}
      </Link>

      {/* Header */}
      <div className="job-detail-header">
        <div className="job-detail-title-group">
          <h1 className="job-detail-title">{job.title}</h1>
          <div className="job-detail-meta">
            <span className={`job-detail-status ${job.status}`}>
              <statusConf.icon size={14} />
              {statusConf.label}
            </span>
          </div>
        </div>
        {isOwnerOrAdmin && (
          <div className="job-detail-actions">
            <button className="btn btn-secondary btn-sm" onClick={openEditModal}>
              <Edit3 size={14} /> Edit
            </button>
            {job.status === 'scheduled' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange('in_progress')} disabled={updating}>
                <Play size={14} /> Start Job
              </button>
            )}
            {job.status === 'in_progress' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange('completed')} disabled={updating}>
                <CheckCircle2 size={14} /> Complete
              </button>
            )}
            {job.status !== 'cancelled' && job.status !== 'completed' && (
              <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange('cancelled')} disabled={updating}>
                <XCircle size={14} /> Cancel
              </button>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Profit Summary Banner — owner/admin only (workers don't see margin) */}
      {financials && isOwnerOrAdmin && (
        <div className="job-financials-banner">
          <div className="job-financials-item">
            <span className="job-financials-label">Revenue</span>
            <span className="job-financials-value" style={{ color: 'var(--status-success)' }}>
              {formatCurrency(financials.revenue)}
            </span>
          </div>
          <div className="job-financials-divider">−</div>
          <div className="job-financials-item">
            <span className="job-financials-label">Materials</span>
            <span className="job-financials-value">{formatCurrency(financials.materialCosts)}</span>
          </div>
          <div className="job-financials-divider">−</div>
          <div className="job-financials-item">
            <span className="job-financials-label">Equipment</span>
            <span className="job-financials-value">{formatCurrency(financials.equipmentCosts)}</span>
          </div>
          <div className="job-financials-divider">−</div>
          <div className="job-financials-item">
            <span className="job-financials-label">Labor</span>
            <span className="job-financials-value">{formatCurrency(financials.laborCosts)}</span>
          </div>
          <div className="job-financials-divider">−</div>
          <div className="job-financials-item">
            <span className="job-financials-label">Other</span>
            <span className="job-financials-value">{formatCurrency(financials.otherExpenses)}</span>
          </div>
          <div className="job-financials-divider">=</div>
          <div className="job-financials-item profit">
            <span className="job-financials-label">Profit</span>
            <span className="job-financials-value" style={{ color: financials.profit >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
              {formatCurrency(financials.profit)}
            </span>
          </div>
        </div>
      )}

      {/* Tab Bar — workers can add receipts/expenses; only owners see margin & labor cost */}
      <div className="tabs" style={{ marginBottom: 'var(--space-lg)' }}>
        <button className={`tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
        <button className={`tab ${activeTab === 'financials' ? 'active' : ''}`} onClick={() => setActiveTab('financials')}>
          {isOwnerOrAdmin ? 'Financials' : 'Receipts'} {financials?.expenses?.length ? `(${financials.expenses.length})` : ''}
        </button>
      </div>

      {activeTab === 'details' && (
        <div className="job-detail-grid">
          {/* Customer Info */}
          <div className="job-detail-section">
            <div className="job-detail-section-title"><User size={16} /> Customer</div>
            {customer ? (
              <>
                <div className="job-detail-row">
                  <User size={16} />
                  <div className="job-detail-row-content">
                    <div className="job-detail-row-label">Name</div>
                    <div className="job-detail-row-value" style={{ fontWeight: 700 }}>
                      {customer.firstName} {customer.lastName || ''}
                    </div>
                  </div>
                </div>
                {customer.phone && (
                  <div className="job-detail-row">
                    <Phone size={16} />
                    <div className="job-detail-row-content">
                      <div className="job-detail-row-label">Phone</div>
                      <div className="job-detail-row-value"><a href={`tel:${customer.phone}`}>{customer.phone}</a></div>
                    </div>
                  </div>
                )}
                {customer.email && (
                  <div className="job-detail-row">
                    <Mail size={16} />
                    <div className="job-detail-row-content">
                      <div className="job-detail-row-label">Email</div>
                      <div className="job-detail-row-value"><a href={`mailto:${customer.email}`}>{customer.email}</a></div>
                    </div>
                  </div>
                )}
                {fullAddress && (
                  <div className="job-detail-row">
                    <MapPin size={16} />
                    <div className="job-detail-row-content">
                      <div className="job-detail-row-label">Address</div>
                      <div className="job-detail-row-value">
                        {mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer">{fullAddress}</a> : fullAddress}
                      </div>
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: '6px', padding: '4px 10px', fontSize: '0.75rem', color: 'var(--lucky-green-light)' }}>
                          <Navigation size={12} /> Open in Maps
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                No customer linked
              </div>
            )}
          </div>

          {/* Job Details */}
          <div className="job-detail-section">
            <div className="job-detail-section-title"><Briefcase size={16} /> Job Details</div>
            <div className="job-detail-row">
              <CalendarDays size={16} />
              <div className="job-detail-row-content">
                <div className="job-detail-row-label">Scheduled Date</div>
                <div className="job-detail-row-value">{formatDateLong(job.scheduledDate)}</div>
              </div>
            </div>
            {job.scheduledTime && (
              <div className="job-detail-row">
                <Clock size={16} />
                <div className="job-detail-row-content">
                  <div className="job-detail-row-label">Start Time</div>
                  <div className="job-detail-row-value">{formatTime12(job.scheduledTime)}</div>
                </div>
              </div>
            )}
            {job.description && (
              <div className="job-detail-row">
                <FileText size={16} />
                <div className="job-detail-row-content">
                  <div className="job-detail-row-label">Description</div>
                  <div className="job-detail-notes">{job.description}</div>
                </div>
              </div>
            )}
          </div>

          {/* Crew Notes */}
          {job.crewNotes && (
            <div className="job-detail-section job-detail-full-width">
              <div className="job-detail-section-title"><FileText size={16} /> Crew Notes</div>
              <div className="job-detail-notes" style={{ fontSize: '0.9rem' }}>{job.crewNotes}</div>
            </div>
          )}

          {/* Assigned Crew */}
          <div className="job-detail-section">
            <div className="job-detail-section-title"><Users size={16} /> Assigned Crew ({assignedMembers.length})</div>
            {assignedMembers.length > 0 ? (
              <div className="job-detail-crew-list">
                {assignedMembers.map(m => (
                  <div key={m.id} className="job-detail-crew-item">
                    <div className="job-detail-crew-avatar">
                      {m.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                    </div>
                    <div>
                      <div className="job-detail-crew-name">{m.fullName}</div>
                      <div className="job-detail-crew-role">{m.role}</div>
                      {m.hourlyRate > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>${m.hourlyRate}/hr</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No crew assigned</div>
            )}
          </div>

          {/* Linked Quote */}
          {quote && (
            <div className="job-detail-section">
              <div className="job-detail-section-title"><DollarSign size={16} /> Linked Quote</div>
              <div className="linked-quote-preview">
                <div className="linked-quote-preview-header">
                  <span className="linked-quote-preview-num">Quote #{quote.quoteNumber}</span>
                  <span className="linked-quote-preview-total">${Number(quote.total || 0).toLocaleString()}</span>
                </div>
                {quote.category && <div className="linked-quote-preview-items">Category: {quote.category}</div>}
              </div>
              <Link href={`/quotes/${quote.id}`} className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-sm)' }}>
                View Full Quote <ChevronRight size={14} />
              </Link>
            </div>
          )}

          {/* Quote Site Photos — read-only for the crew */}
          {quote && (
            <div className="job-detail-section job-detail-full-width">
              <div className="job-detail-section-title">
                <ImageIcon size={16} /> Site Photos
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '8px' }}>
                  from Quote #{quote.quoteNumber}
                </span>
              </div>
              <QuoteMediaGallery quoteId={quote.id} readOnly />
            </div>
          )}
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="job-financials-tab">
          {/* Expenses Section */}
          <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h3 style={{ margin: 0 }}>Expenses</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddExpense(!showAddExpense)}>
                <Plus size={14} /> Add Expense
              </button>
            </div>

            {/* Add Expense Form — receipt-first, mobile-friendly */}
            {showAddExpense && (
              <div className="expense-add-form" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <ReceiptUpload
                  orgId={user?.orgId}
                  scope="job"
                  value={expenseForm.receipt}
                  onChange={(receipt) => setExpenseForm(prev => ({ ...prev, receipt }))}
                />
                <div className="form-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    className="form-input"
                    value={expenseForm.category}
                    onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                    style={{ minWidth: '150px', flex: '0 0 auto' }}
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    type="date"
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                    style={{ flex: '0 0 auto', minWidth: '140px' }}
                  />
                </div>
                <input
                  className="form-input"
                  placeholder="What was this for? (e.g. mulch + bagged stone)"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                />
                <div className="form-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    className="form-input"
                    placeholder="Vendor (Outdoor Solutions, Menards…)"
                    value={expenseForm.vendor}
                    onChange={e => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))}
                    style={{ flex: 1, minWidth: '180px' }}
                  />
                  <div style={{ position: 'relative', flex: '0 0 140px' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>$</span>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                      style={{ paddingLeft: '24px' }}
                    />
                  </div>
                </div>
                {expenseError && (
                  <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                    {expenseError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddExpense(false); setExpenseForm(emptyExpense()); setExpenseError(null); }} disabled={savingExpense}>
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleAddExpense} disabled={savingExpense}>
                    <Save size={14} /> {savingExpense ? 'Saving…' : 'Save Expense'}
                  </button>
                </div>
              </div>
            )}

            {/* Expenses List */}
            {financials?.expenses?.length > 0 ? (
              <div className="expenses-list">
                {financials.expenses.map(exp => {
                  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === exp.category) || EXPENSE_CATEGORIES[6];
                  return (
                    <div key={exp.id} className="expense-row">
                      {exp.receiptUrl ? (
                        <a href={exp.receiptUrl} target="_blank" rel="noopener noreferrer" title="View receipt" style={{ flexShrink: 0 }}>
                          <img src={exp.receiptUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }} />
                        </a>
                      ) : (
                        <span className="expense-icon">{catInfo.icon}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{exp.description}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                          {catInfo.label}
                          {exp.vendor && <> · {exp.vendor}</>}
                          {exp.date && <> · {new Date(exp.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>}
                          {exp.receiptUrl && <span style={{ color: 'var(--status-success)', marginLeft: '6px' }}>📎 receipt</span>}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--status-danger)', fontSize: '0.9rem' }}>
                        -{formatCurrency(exp.amount)}
                      </div>
                      <button
                        className="btn btn-icon btn-ghost"
                        style={{ width: 28, height: 28 }}
                        onClick={() => handleDeleteExpense(exp.id)}
                        title="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center' }}>
                <Receipt size={28} style={{ opacity: 0.3, marginBottom: '4px' }} />
                <p style={{ margin: 0 }}>No expenses recorded yet.</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem' }}>Snap a photo of every receipt — it tracks margins and saves on taxes.</p>
              </div>
            )}
          </div>

          {/* Labor Costs — owner/admin only (shows individual hourly rates) */}
          {isOwnerOrAdmin && (
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-md)' }}>Labor Costs (from Time Tracking)</h3>
            {jobTimeEntries.length > 0 ? (
              <div className="expenses-list">
                {jobTimeEntries.map(entry => {
                  const member = teamMembers.find(m => m.id === entry.teamMemberId);
                  const rate = Number(member?.hourlyRate || 0);
                  const totalHours = (new Date(entry.clockOut) - new Date(entry.clockIn)) / (1000 * 60 * 60);
                  const breakMins = Number(entry.breakMinutes || 0);
                  const breakHrs = breakMins / 60;
                  const paidHours = Math.max(0, totalHours - breakHrs);
                  const cost = rate * paidHours;
                  return (
                    <div key={entry.id} className="expense-row">
                      <span className="expense-icon">👷</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{member?.fullName || 'Unknown'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                          {paidHours.toFixed(1)} paid hrs × ${rate.toFixed(2)}/hr
                          {breakMins > 0 && (
                            <span style={{ color: 'var(--lucky-gold)', marginLeft: '6px' }}>
                              ☕ {breakMins} min break deducted
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', opacity: 0.7, marginTop: '1px' }}>
                          Total shift: {totalHours.toFixed(1)} hrs
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--lucky-gold)', fontSize: '0.9rem' }}>
                        -{formatCurrency(cost)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center' }}>
                No time entries linked to this job yet. Workers can clock in to this job from their dashboard.
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => !updating && setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2><Edit3 size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Edit Job</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Date & Time */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label"><CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Date</label>
                  <input className="form-input" type="date" value={editForm.scheduledDate} onChange={e => setEditForm(prev => ({ ...prev, scheduledDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label"><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Time</label>
                  <input className="form-input" type="time" value={editForm.scheduledTime} onChange={e => setEditForm(prev => ({ ...prev, scheduledTime: e.target.value }))} />
                </div>
              </div>

              {/* Priority */}
              <div className="form-group">
                <label className="form-label"><Flag size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Priority</label>
                <select className="form-select" value={editForm.priority} onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Crew Notes */}
              <div className="form-group">
                <label className="form-label"><FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Crew Notes</label>
                <textarea className="form-textarea" rows={3} value={editForm.crewNotes} onChange={e => setEditForm(prev => ({ ...prev, crewNotes: e.target.value }))} placeholder="Access instructions, materials, gate codes..." />
              </div>

              {/* Crew Assignment */}
              {activeMembers.length > 0 && (
                <div className="form-group">
                  <label className="form-label">
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Assign Crew ({editForm.assignedTo?.length || 0})
                  </label>
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input className="form-input" placeholder="Search crew..." value={crewSearch} onChange={e => setCrSearch(e.target.value)} style={{ paddingLeft: '32px' }} />
                  </div>
                  <div className="crew-assignment-list">
                    {filteredEditMembers.map(m => {
                      const isSelected = editForm.assignedTo?.includes(m.id);
                      return (
                        <button key={m.id} className={`crew-assignment-item ${isSelected ? 'active' : ''}`} onClick={() => toggleEditCrew(m.id)}>
                          <div className="table-avatar" style={{ width: 30, height: 30, fontSize: '0.6rem', background: isSelected ? 'var(--lucky-green)' : 'var(--bg-elevated)', color: isSelected ? 'white' : 'var(--text-secondary)' }}>
                            {m.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{m.fullName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{m.role}</div>
                          </div>
                          {isSelected && <Check size={16} style={{ color: 'var(--lucky-green-light)' }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {editError && (
              <div style={{ padding: '0 var(--space-lg) var(--space-md)', fontSize: '0.82rem', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <XCircle size={14} /> {editError}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)} disabled={updating}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={updating}>
                {updating ? 'Saving...' : <><Save size={16} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Job Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Delete Job</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => !deleting && setShowDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>This action cannot be undone</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>{job.title}</strong> will be permanently deleted along with:
                  </div>
                  <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 0', paddingLeft: '20px' }}>
                    <li><strong>{linkedEventCount}</strong> calendar event{linkedEventCount !== 1 ? 's' : ''}</li>
                  </ul>
                  {linkedInvoices.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                      Note: {linkedInvoices.length} invoice{linkedInvoices.length !== 1 ? 's' : ''} linked to this job will be kept (unlinked).
                    </div>
                  )}
                </div>
              </div>
              {deleteError && (
                <div style={{ fontSize: '0.82rem', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <XCircle size={14} /> {deleteError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : <><Trash2 size={16} /> Delete Job</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
