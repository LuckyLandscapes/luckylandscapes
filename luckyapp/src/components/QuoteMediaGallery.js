'use client';

// Photo gallery for a quote.
// - The person taking the quote uploads from their phone (camera direct).
// - Workers viewing the linked job see the same photos in read-only mode.
// - Photos are compressed client-side (~200–400KB) before hitting Supabase
//   so we stay inside the free-tier 1GB storage / 5GB bandwidth budget.

import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, X, Trash2, ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { compressImage, bytesPretty } from '@/lib/compressImage';

export default function QuoteMediaGallery({ quoteId, readOnly = false }) {
  const { user } = useAuth();
  const { getQuoteMedia, addQuoteMedia, deleteQuoteMedia, togglePinQuoteMedia } = useData();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null); // { in, out, count, total }
  const [error, setError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // media id

  const photos = getQuoteMedia(quoteId);
  const orgId = user?.orgId;

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f && f.type?.startsWith('image/'));
    if (files.length === 0) return;
    if (!orgId) {
      setError('Not signed in.');
      return;
    }

    setError(null);
    setUploading(true);
    let totalIn = 0, totalOut = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file);
        totalIn += file.size;
        totalOut += compressed.size;
        setProgress({ in: totalIn, out: totalOut, count: i + 1, total: files.length });

        const ext = compressed.type === 'image/png' ? 'png' : 'jpg';
        const key = `${orgId}/${quoteId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('quote-media')
          .upload(key, compressed, { contentType: compressed.type, upsert: false });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from('quote-media').getPublicUrl(key);
        await addQuoteMedia({
          quoteId,
          filePath: key,
          fileUrl: pub.publicUrl,
          fileSize: compressed.size,
        });
      }
    } catch (err) {
      console.error('[QuoteMediaGallery] upload failed', err);
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 4000);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (id) => {
    try { await deleteQuoteMedia(id); }
    catch (err) {
      console.error('[QuoteMediaGallery] delete failed', err);
      setError(err.message || 'Delete failed.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const openLightbox = (i) => setLightboxIndex(i);
  const closeLightbox = () => setLightboxIndex(null);
  const prev = () => setLightboxIndex(i => (i > 0 ? i - 1 : photos.length - 1));
  const next = () => setLightboxIndex(i => (i < photos.length - 1 ? i + 1 : 0));

  return (
    <div>
      {/* Upload row */}
      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{ flex: 1, justifyContent: 'center', padding: '12px', borderStyle: 'dashed' }}
            >
              {uploading ? (
                <><Loader2 size={16} className="spin" /> Compressing &amp; uploading{progress ? ` (${progress.count}/${progress.total})` : '…'}</>
              ) : (
                <><Camera size={16} /> <ImageIcon size={16} /> Add Photos</>
              )}
            </button>
          </div>
          {error && (
            <div style={{ marginBottom: 'var(--space-sm)', fontSize: '0.78rem', color: 'var(--status-danger)' }}>
              {error}
            </div>
          )}
          {progress && !uploading && (
            <div style={{ marginBottom: 'var(--space-sm)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              Uploaded {progress.count} photo{progress.count !== 1 ? 's' : ''} — {bytesPretty(progress.in)} → {bytesPretty(progress.out)} ({Math.round((1 - progress.out / Math.max(progress.in, 1)) * 100)}% smaller)
            </div>
          )}
        </>
      )}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div style={{
          padding: 'var(--space-lg)',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: '0.85rem',
        }}>
          <ImageIcon size={28} style={{ opacity: 0.4, marginBottom: '6px' }} />
          <div>{readOnly ? 'No site photos for this customer yet.' : 'No photos yet — snap a few shots of the area for the crew. Photos stay with this customer across future quotes.'}</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: '8px',
        }}>
          {photos.map((p, i) => (
            <div
              key={p.id}
              style={{
                position: 'relative',
                paddingTop: '100%',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => openLightbox(i)}
            >
              <img
                src={p.fileUrl}
                alt={p.caption || `Quote photo ${i + 1}`}
                loading="lazy"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              {!readOnly && (
                <>
                  <button
                    type="button"
                    className="btn btn-icon"
                    title={p.pinned ? 'Unpin (will be deleted in 30-day cleanup)' : 'Pin photo (keeps it past 30-day cleanup)'}
                    onClick={(e) => { e.stopPropagation(); togglePinQuoteMedia(p.id); }}
                    style={{
                      position: 'absolute',
                      top: 4, left: 4,
                      width: 26, height: 26,
                      background: p.pinned ? 'var(--lucky-gold, #d4a437)' : 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    {p.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon"
                    title="Delete photo"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.id); }}
                    style={{
                      position: 'absolute',
                      top: 4, right: 4,
                      width: 26, height: 26,
                      background: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              {readOnly && p.pinned && (
                <div
                  title="Pinned"
                  style={{
                    position: 'absolute',
                    top: 4, left: 4,
                    width: 22, height: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--lucky-gold, #d4a437)',
                    color: '#fff',
                    borderRadius: '999px',
                  }}
                >
                  <Pin size={11} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="modal-overlay"
          onClick={closeLightbox}
          style={{ background: 'rgba(0,0,0,0.92)', zIndex: 1000 }}
        >
          <button
            type="button"
            className="btn btn-icon"
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            style={{ position: 'absolute', top: 12, right: 12, color: '#fff', background: 'rgba(0,0,0,0.4)', border: 'none' }}
          >
            <X size={22} />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="btn btn-icon"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#fff', background: 'rgba(0,0,0,0.4)', border: 'none', width: 44, height: 44 }}
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                className="btn btn-icon"
                onClick={(e) => { e.stopPropagation(); next(); }}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#fff', background: 'rgba(0,0,0,0.4)', border: 'none', width: 44, height: 44 }}
              >
                <ChevronRight size={26} />
              </button>
            </>
          )}
          <img
            src={photos[lightboxIndex].fileUrl}
            alt={photos[lightboxIndex].caption || ''}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '94vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            color: '#fff', fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)',
            padding: '4px 10px', borderRadius: '999px',
          }}>
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)} style={{ zIndex: 1100 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h2>Delete Photo</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setConfirmDelete(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem' }}>This photo will be permanently removed from the quote.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
