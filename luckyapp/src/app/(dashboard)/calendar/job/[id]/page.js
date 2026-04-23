'use client';

import { use, useState } from 'react';
import { useData } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  Flag,
  Timer,
  Users,
  DollarSign,
  Briefcase,
  Navigation,
  Play,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';

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

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', icon: CalendarDays, color: 'var(--status-info)' },
  in_progress: { label: 'In Progress', icon: Play, color: 'var(--status-warning)' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'var(--status-success)' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'var(--status-danger)' },
};

export default function JobDetailPage({ params }) {
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;
  const { getJob, getCustomer, getQuote, getTeamMember, updateJob, teamMembers } = useData();
  const { isOwnerOrAdmin } = useAuth();

  const job = getJob(jobId);
  const customer = job?.customerId ? getCustomer(job.customerId) : null;
  const quote = job?.quoteId ? getQuote(job.quoteId) : null;
  const [updating, setUpdating] = useState(false);

  if (!job) {
    return (
      <div className="page animate-fade-in" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <Briefcase size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }} />
        <h2>Job Not Found</h2>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
          This job may have been deleted or you don&apos;t have access.
        </p>
        <Link href="/calendar" className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }}>
          Back to Calendar
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

  const mapsUrl = fullAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`
    : '';

  const quoteItems = quote?.items || [];

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await updateJob(job.id, { status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="page job-detail-page animate-fade-in">
      {/* Back nav */}
      <Link href="/calendar" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-md)' }}>
        <ArrowLeft size={16} /> Back to Calendar
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
            {job.priority && job.priority !== 'normal' && (
              <span className={`crew-job-card-priority ${job.priority}`}>
                {job.priority}
              </span>
            )}
          </div>
        </div>

        {/* Status Actions */}
        {isOwnerOrAdmin && (
          <div className="job-detail-actions">
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
          </div>
        )}
      </div>

      <div className="job-detail-grid">
        {/* ─── Customer Info ──────────────────────────────── */}
        <div className="job-detail-section">
          <div className="job-detail-section-title">
            <User size={16} /> Customer Information
          </div>
          {customer ? (
            <>
              <div className="job-detail-row">
                <User size={16} />
                <div className="job-detail-row-content">
                  <div className="job-detail-row-label">Name</div>
                  <div className="job-detail-row-value" style={{ fontWeight: 700, fontSize: '1rem' }}>
                    {customer.firstName} {customer.lastName || ''}
                  </div>
                </div>
              </div>

              {customer.phone && (
                <div className="job-detail-row">
                  <Phone size={16} />
                  <div className="job-detail-row-content">
                    <div className="job-detail-row-label">Phone</div>
                    <div className="job-detail-row-value">
                      <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                    </div>
                  </div>
                </div>
              )}

              {customer.email && (
                <div className="job-detail-row">
                  <Mail size={16} />
                  <div className="job-detail-row-content">
                    <div className="job-detail-row-label">Email</div>
                    <div className="job-detail-row-value">
                      <a href={`mailto:${customer.email}`}>{customer.email}</a>
                    </div>
                  </div>
                </div>
              )}

              {fullAddress && (
                <div className="job-detail-row">
                  <MapPin size={16} />
                  <div className="job-detail-row-content">
                    <div className="job-detail-row-label">Address</div>
                    <div className="job-detail-row-value">
                      {mapsUrl ? (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                          {fullAddress}
                        </a>
                      ) : fullAddress}
                    </div>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: '6px', padding: '4px 10px', fontSize: '0.75rem', color: 'var(--lucky-green-light)' }}
                      >
                        <Navigation size={12} /> Open in Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              {customer.notes && (
                <div className="job-detail-row">
                  <FileText size={16} />
                  <div className="job-detail-row-content">
                    <div className="job-detail-row-label">Customer Notes</div>
                    <div className="job-detail-notes">{customer.notes}</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No customer linked to this job
            </div>
          )}
        </div>

        {/* ─── Job Details ────────────────────────────────── */}
        <div className="job-detail-section">
          <div className="job-detail-section-title">
            <Briefcase size={16} /> Job Details
          </div>

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

          {job.estimatedDuration && (
            <div className="job-detail-row">
              <Timer size={16} />
              <div className="job-detail-row-content">
                <div className="job-detail-row-label">Estimated Duration</div>
                <div className="job-detail-row-value">{job.estimatedDuration}</div>
              </div>
            </div>
          )}

          {job.priority && (
            <div className="job-detail-row">
              <Flag size={16} />
              <div className="job-detail-row-content">
                <div className="job-detail-row-label">Priority</div>
                <div className="job-detail-row-value">
                  <span className={`crew-job-card-priority ${job.priority}`} style={{ display: 'inline-flex' }}>
                    {job.priority}
                  </span>
                </div>
              </div>
            </div>
          )}

          {job.total > 0 && (
            <div className="job-detail-row">
              <DollarSign size={16} />
              <div className="job-detail-row-content">
                <div className="job-detail-row-label">Job Total</div>
                <div className="job-detail-row-value" style={{ fontWeight: 800, color: 'var(--lucky-green-light)', fontSize: '1.1rem' }}>
                  ${Number(job.total).toLocaleString()}
                </div>
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

        {/* ─── Crew Notes ─────────────────────────────────── */}
        {job.crewNotes && (
          <div className="job-detail-section job-detail-full-width">
            <div className="job-detail-section-title">
              <FileText size={16} /> Crew Notes &amp; Instructions
            </div>
            <div className="job-detail-notes" style={{ fontSize: '0.9rem' }}>
              {job.crewNotes}
            </div>
          </div>
        )}

        {/* ─── Assigned Crew ─────────────────────────────── */}
        <div className="job-detail-section">
          <div className="job-detail-section-title">
            <Users size={16} /> Assigned Crew ({assignedMembers.length})
          </div>

          {assignedMembers.length > 0 ? (
            <div className="job-detail-crew-list">
              {assignedMembers.map(m => {
                const initials = m.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
                return (
                  <div key={m.id} className="job-detail-crew-item">
                    <div className="job-detail-crew-avatar">{initials}</div>
                    <div>
                      <div className="job-detail-crew-name">{m.fullName}</div>
                      <div className="job-detail-crew-role">{m.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No crew members assigned yet
            </div>
          )}
        </div>

        {/* ─── Linked Quote ──────────────────────────────── */}
        {quote && (
          <div className="job-detail-section">
            <div className="job-detail-section-title">
              <DollarSign size={16} /> Linked Quote
            </div>

            <div className="linked-quote-preview">
              <div className="linked-quote-preview-header">
                <span className="linked-quote-preview-num">Quote #{quote.quoteNumber}</span>
                <span className="linked-quote-preview-total">${Number(quote.total || 0).toLocaleString()}</span>
              </div>
              {quote.category && (
                <div className="linked-quote-preview-items">
                  Category: {quote.category}
                </div>
              )}
              {Array.isArray(quoteItems) && quoteItems.length > 0 && (
                <div style={{ marginTop: 'var(--space-sm)' }}>
                  {quoteItems.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.78rem', padding: '4px 0',
                      borderTop: i > 0 ? '1px solid var(--border-primary)' : 'none',
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.name || item.description || `Item ${i + 1}`}
                        {item.quantity ? ` × ${item.quantity}` : ''}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        ${Number(item.total || item.price || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              href={`/quotes/${quote.id}`}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 'var(--space-sm)' }}
            >
              View Full Quote <ChevronRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
