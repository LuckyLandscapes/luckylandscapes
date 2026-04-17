'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  CalendarDays,
  CheckCircle2,
  Play,
  XCircle,
  Briefcase,
  DollarSign,
  Navigation,
  Edit3,
  Save,
  Users,
  Clipboard,
} from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

function formatTime12(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'var(--status-info)', bg: 'var(--status-info-bg)', icon: CalendarDays },
  in_progress: { label: 'In Progress', color: 'var(--status-warning)', bg: 'var(--status-warning-bg)', icon: Play },
  completed: { label: 'Completed', color: 'var(--status-success)', bg: 'var(--status-success-bg)', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)', icon: XCircle },
};

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getJob, getCustomer, getQuote, updateJob, teamMembers } = useData();
  const [editingNotes, setEditingNotes] = useState(false);
  const [crewNotes, setCrewNotes] = useState('');

  const job = getJob(id);
  const customer = job ? getCustomer(job.customerId) : null;
  const quote = job?.quoteId ? getQuote(job.quoteId) : null;

  if (!job) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Job not found</h3>
          <Link href="/calendar" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-md)' }}>
            <ArrowLeft size={16} /> Back to Calendar
          </Link>
        </div>
      </div>
    );
  }

  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = status.icon;
  const assignedMembers = teamMembers.filter(t => (job.assignedTo || []).includes(t.id));

  const handleStatusChange = async (newStatus) => {
    await updateJob(id, { status: newStatus });
  };

  const handleSaveNotes = async () => {
    await updateJob(id, { crewNotes });
    setEditingNotes(false);
  };

  const startEditNotes = () => {
    setCrewNotes(job.crewNotes || '');
    setEditingNotes(true);
  };

  const openInMaps = () => {
    if (!job.address) return;
    const encoded = encodeURIComponent(job.address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/calendar" className="btn btn-ghost btn-sm" style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={16} /> Calendar
        </Link>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <h1>{job.title}</h1>
            <span className="badge" style={{ background: status.bg, color: status.color, fontSize: '0.82rem', padding: '4px 14px' }}>
              <StatusIcon size={14} style={{ marginRight: '4px' }} />
              {status.label}
            </span>
          </div>
          <p>
            <CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            {formatDateLong(job.scheduledDate)}
            {job.scheduledTime && <> at {formatTime12(job.scheduledTime)}</>}
          </p>
        </div>
        <div className="page-header-actions">
          {job.status === 'scheduled' && (
            <button className="btn btn-primary" onClick={() => handleStatusChange('in_progress')} style={{ background: 'var(--status-warning)', borderColor: 'var(--status-warning)', color: '#000' }}>
              <Play size={16} /> Start Job
            </button>
          )}
          {job.status === 'in_progress' && (
            <button className="btn btn-primary" onClick={() => handleStatusChange('completed')} style={{ background: 'var(--status-success)', borderColor: 'var(--status-success)' }}>
              <CheckCircle2 size={16} /> Mark Complete
            </button>
          )}
          {(job.status === 'scheduled' || job.status === 'in_progress') && (
            <button className="btn btn-danger" onClick={() => handleStatusChange('cancelled')}>
              <XCircle size={16} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="job-layout">
        {/* Main Content */}
        <div className="job-main">
          {/* Job Scope */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
              <Clipboard size={18} style={{ color: 'var(--lucky-green-light)' }} />
              <h3>Job Scope</h3>
            </div>
            {job.description ? (
              <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {job.description}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No description provided</p>
            )}
          </div>

          {/* Quote Line Items */}
          {quote && quote.items && quote.items.length > 0 && (
            <div className="table-wrapper" style={{ marginTop: 'var(--space-md)' }}>
              <div className="table-header">
                <h3>Quote #{quote.quoteNumber} — Line Items</h3>
                <Link href={`/quotes/${quote.id}`} className="btn btn-ghost btn-sm">
                  View Quote →
                </Link>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Service / Item</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        {item.description && <div className="table-sub">{item.description}</div>}
                      </td>
                      <td>{item.quantity}</td>
                      <td style={{ color: 'var(--text-tertiary)' }}>{item.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total || item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{
                padding: 'var(--space-md) var(--space-lg)',
                borderTop: '1px solid var(--border-primary)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-lg)',
              }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--lucky-green-light)' }}>{formatCurrency(job.total)}</span>
              </div>
            </div>
          )}

          {/* Crew Notes */}
          <div className="card" style={{ marginTop: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <FileText size={18} style={{ color: 'var(--lucky-gold)' }} />
                <h3>Crew Notes</h3>
              </div>
              {!editingNotes ? (
                <button className="btn btn-ghost btn-sm" onClick={startEditNotes}>
                  <Edit3 size={14} /> Edit
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={handleSaveNotes}>
                  <Save size={14} /> Save
                </button>
              )}
            </div>
            {editingNotes ? (
              <textarea
                className="form-textarea"
                rows={4}
                value={crewNotes}
                onChange={e => setCrewNotes(e.target.value)}
                placeholder="Add notes for the crew (access instructions, special requirements, etc.)"
                autoFocus
              />
            ) : (
              <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: job.crewNotes ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {job.crewNotes || 'No crew notes yet. Click Edit to add instructions for the crew.'}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="job-sidebar">
          {/* Customer Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <User size={18} style={{ color: 'var(--status-info)' }} />
              <h4 style={{ color: 'var(--text-secondary)' }}>Customer</h4>
            </div>
            {customer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div className="table-avatar" style={{ width: 42, height: 42, background: 'var(--lucky-green)', color: 'white', fontSize: '0.85rem' }}>
                    {(customer.firstName?.[0] || '') + (customer.lastName?.[0] || '')}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{customer.firstName} {customer.lastName || ''}</div>
                  </div>
                </div>
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="job-contact-link">
                    <Phone size={15} /> {customer.phone}
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="job-contact-link">
                    <Mail size={15} /> {customer.email}
                  </a>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No customer assigned</p>
            )}
          </div>

          {/* Location Card */}
          {job.address && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <MapPin size={18} style={{ color: 'var(--status-danger)' }} />
                <h4 style={{ color: 'var(--text-secondary)' }}>Job Location</h4>
              </div>
              <p style={{ fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>{job.address}</p>
              <button className="btn btn-primary btn-sm" onClick={openInMaps} style={{ width: '100%' }}>
                <Navigation size={14} /> Open in Google Maps
              </button>
            </div>
          )}

          {/* Schedule Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <Clock size={18} style={{ color: 'var(--lucky-gold)' }} />
              <h4 style={{ color: 'var(--text-secondary)' }}>Schedule</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <div className="job-detail-label">Date</div>
                <div className="job-detail-value">{formatDateLong(job.scheduledDate)}</div>
              </div>
              {job.scheduledTime && (
                <div>
                  <div className="job-detail-label">Start Time</div>
                  <div className="job-detail-value">{formatTime12(job.scheduledTime)}</div>
                </div>
              )}
              {job.estimatedDuration && (
                <div>
                  <div className="job-detail-label">Est. Duration</div>
                  <div className="job-detail-value">{job.estimatedDuration}</div>
                </div>
              )}
            </div>
          </div>

          {/* Job Value Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <DollarSign size={18} style={{ color: 'var(--status-success)' }} />
              <h4 style={{ color: 'var(--text-secondary)' }}>Job Value</h4>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--lucky-green-light)' }}>
              {formatCurrency(job.total)}
            </div>
          </div>

          {/* Assigned Crew */}
          {assignedMembers.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <Users size={18} style={{ color: 'var(--status-info)' }} />
                <h4 style={{ color: 'var(--text-secondary)' }}>Assigned Crew</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {assignedMembers.map(m => (
                  <div key={m.id} className="job-crew-chip">
                    <div className="table-avatar" style={{ width: 28, height: 28, fontSize: '0.65rem', background: 'var(--lucky-green)', color: 'white' }}>
                      {m.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{m.fullName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{m.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
