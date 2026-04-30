'use client';

// Walkthrough capture gallery for a quote.
// - Photos, videos, and voice memos (with live transcription).
// - Each item gets a Jobber-style caption beneath it for what the
//   customer asked for / context for the crew.
// - Photos compress client-side to ~200–400KB; videos enforce a
//   60s ceiling and 50MB cap; voice memos cap at 5 min.
// - Photos are customer-anchored (see data.js getQuoteMedia) so they
//   travel across quote revisions for the same customer.

import { useRef, useState } from 'react';
import {
  Camera, Image as ImageIcon, Video, Mic, Loader2, X, Trash2,
  ChevronLeft, ChevronRight, Pin, PinOff, Check, Edit3,
  FileText, Copy, ChevronDown, ChevronUp, ArrowDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { compressImage, bytesPretty } from '@/lib/compressImage';
import { buildQuoteMediaSummary } from '@/lib/quoteMediaSummary';
import VoiceMemoRecorder from './VoiceMemoRecorder';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB hard cap to match bucket
const MAX_VIDEO_SECONDS = 60;             // strong nudge to keep videos short

function fmtTime(s) {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

function inferExt(file, fallback = 'bin') {
  const t = file.type || '';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('mp4')) return 'mp4';
  if (t.includes('quicktime') || t.includes('mov')) return 'mov';
  if (t.includes('webm')) return 'webm';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('m4a') || t.includes('aac')) return 'm4a';
  return fallback;
}

// Get the duration of a video/audio file by loading metadata in a hidden element.
function getMediaDuration(file) {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
    el.preload = 'metadata';
    el.src = URL.createObjectURL(file);
    el.onloadedmetadata = () => {
      const d = el.duration;
      URL.revokeObjectURL(el.src);
      resolve(Number.isFinite(d) ? Math.round(d) : null);
    };
    el.onerror = () => { URL.revokeObjectURL(el.src); resolve(null); };
    setTimeout(() => resolve(null), 5000);
  });
}

// Pass either `quoteId` (existing quote) or `customerId` (pre-quote
// walkthrough during the new-quote wizard). When both are absent the
// gallery is empty. When both are given, quoteId wins (used for the
// detail/edit pages where the quote already exists).
export default function QuoteMediaGallery({ quoteId, customerId: customerIdProp, readOnly = false, onApplySummary }) {
  const { user } = useAuth();
  const { getQuoteMedia, getQuoteMediaByCustomer, addQuoteMedia, deleteQuoteMedia, togglePinQuoteMedia, updateQuoteMediaCaption, quotes } = useData();
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ caption: '', transcript: '' });
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);

  // Resolve the customer id we're uploading FOR, regardless of whether a
  // quote exists yet. quoteId path: derive customer from the quote.
  // customerId path: use it directly.
  const resolvedCustomerId = quoteId
    ? quotes.find(q => q.id === quoteId)?.customerId || null
    : customerIdProp || null;

  const items = quoteId
    ? getQuoteMedia(quoteId)
    : (resolvedCustomerId ? getQuoteMediaByCustomer(resolvedCustomerId) : []);

  const orgId = user?.orgId;
  // Storage path uses the quoteId folder when we have one; otherwise the
  // customer id keeps the walkthrough captures grouped before the quote
  // is created.
  const storageFolder = quoteId || resolvedCustomerId || 'orphan';

  const uploadFile = async ({ file, mediaType, durationSeconds = null, transcript = null }) => {
    if (!resolvedCustomerId && !quoteId) {
      throw new Error('Pick a customer first, then capture media.');
    }
    const ext = inferExt(file, mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'webm');
    const key = `${orgId}/${storageFolder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('quote-media')
      .upload(key, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from('quote-media').getPublicUrl(key);
    await addQuoteMedia({
      quoteId,
      customerId: resolvedCustomerId,
      filePath: key,
      fileUrl: pub.publicUrl,
      fileSize: file.size,
      mediaType,
      durationSeconds,
      transcript,
    });
  };

  const handlePhotoFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f && f.type?.startsWith('image/'));
    if (files.length === 0) return;
    if (!orgId) { setError('Not signed in.'); return; }

    setError(null);
    setUploading(true);
    let totalIn = 0, totalOut = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file);
        totalIn += file.size;
        totalOut += compressed.size;
        setProgress({ in: totalIn, out: totalOut, count: i + 1, total: files.length, kind: 'photo' });
        await uploadFile({ file: compressed, mediaType: 'image' });
      }
    } catch (err) {
      console.error('[QuoteMediaGallery] photo upload failed', err);
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 4000);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleVideoFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f && f.type?.startsWith('video/'));
    if (files.length === 0) return;
    if (!orgId) { setError('Not signed in.'); return; }

    setError(null);
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_VIDEO_BYTES) {
          throw new Error(`Video is ${bytesPretty(file.size)} — keep clips under ${bytesPretty(MAX_VIDEO_BYTES)} (about 30–60 seconds at phone defaults).`);
        }
        const dur = await getMediaDuration(file);
        if (dur && dur > MAX_VIDEO_SECONDS + 5) {
          // soft check — just warn; we don't block (the size cap above is the real limit)
          console.warn(`[QuoteMediaGallery] video duration ${dur}s exceeds suggested ${MAX_VIDEO_SECONDS}s`);
        }
        setProgress({ in: file.size, out: file.size, count: i + 1, total: files.length, kind: 'video' });
        await uploadFile({ file, mediaType: 'video', durationSeconds: dur });
      }
    } catch (err) {
      console.error('[QuoteMediaGallery] video upload failed', err);
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 4000);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleVoiceMemoSave = async ({ file, durationSeconds, transcript }) => {
    if (!orgId) { setError('Not signed in.'); setShowVoiceRecorder(false); return; }
    setShowVoiceRecorder(false);
    setError(null);
    setUploading(true);
    try {
      setProgress({ in: file.size, out: file.size, count: 1, total: 1, kind: 'voice' });
      await uploadFile({ file, mediaType: 'audio', durationSeconds, transcript });
    } catch (err) {
      console.error('[QuoteMediaGallery] voice memo upload failed', err);
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 4000);
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

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft({ caption: item.caption || '', transcript: item.transcript || '' });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const fields = { caption: editDraft.caption };
      // Only include transcript if we already had one (audio item) — keeps the
      // payload tidy for image / video items.
      const item = items.find(i => i.id === editingId);
      if (item?.mediaType === 'audio' || item?.transcript != null) {
        fields.transcript = editDraft.transcript;
      }
      await updateQuoteMediaCaption(editingId, fields);
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Could not save note.');
    }
  };

  // Lightbox is image-only — videos and audio play inline in the grid where
  // their controls are already accessible.
  const imageItems = items.filter(i => (i.mediaType || 'image') === 'image');
  const lightboxItem = lightboxIndex !== null ? imageItems[lightboxIndex] : null;
  const openLightbox = (item) => {
    const idx = imageItems.findIndex(i => i.id === item.id);
    if (idx >= 0) setLightboxIndex(idx);
  };
  const closeLightbox = () => setLightboxIndex(null);
  const prev = () => setLightboxIndex(i => (i > 0 ? i - 1 : imageItems.length - 1));
  const next = () => setLightboxIndex(i => (i < imageItems.length - 1 ? i + 1 : 0));

  const renderProgress = () => {
    if (!progress) return null;
    const { in: bin, out, count, total, kind } = progress;
    if (kind === 'photo') {
      return `Uploaded ${count}/${total} photo${count !== 1 ? 's' : ''} — ${bytesPretty(bin)} → ${bytesPretty(out)} (${Math.round((1 - out / Math.max(bin, 1)) * 100)}% smaller)`;
    }
    return `Uploaded ${count}/${total} ${kind} (${bytesPretty(out)})`;
  };

  return (
    <div>
      {/* Capture buttons */}
      {!readOnly && (
        <>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" multiple
                 style={{ display: 'none' }} onChange={(e) => handlePhotoFiles(e.target.files)} />
          <input ref={videoInputRef} type="file" accept="video/*" capture="environment"
                 style={{ display: 'none' }} onChange={(e) => handleVideoFiles(e.target.files)} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: 'var(--space-md)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => photoInputRef.current?.click()} disabled={uploading}
                    style={{ justifyContent: 'center', padding: '12px', borderStyle: 'dashed' }}>
              <Camera size={16} /> <ImageIcon size={16} /> Photo
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => videoInputRef.current?.click()} disabled={uploading}
                    style={{ justifyContent: 'center', padding: '12px', borderStyle: 'dashed' }}>
              <Video size={16} /> Video
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowVoiceRecorder(true)} disabled={uploading}
                    style={{ justifyContent: 'center', padding: '12px', borderStyle: 'dashed' }}>
              <Mic size={16} /> Voice Memo
            </button>
          </div>
          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
              <Loader2 size={14} className="spin" /> Compressing &amp; uploading…
            </div>
          )}
          {error && (
            <div style={{ marginBottom: 'var(--space-sm)', fontSize: '0.78rem', color: 'var(--status-danger)' }}>{error}</div>
          )}
          {progress && !uploading && (
            <div style={{ marginBottom: 'var(--space-sm)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              {renderProgress()}
            </div>
          )}
        </>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div style={{
          padding: 'var(--space-lg)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
          textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem',
        }}>
          <ImageIcon size={28} style={{ opacity: 0.4, marginBottom: '6px' }} />
          <div>{readOnly ? 'No site media for this customer yet.' : 'Capture photos, video, or a voice memo while walking the site with the customer. Each note stays attached to the customer across future quotes.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {items.map((item) => {
            const type = item.mediaType || 'image';
            const isEditing = editingId === item.id;
            return (
              <div key={item.id} style={{
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-sm)',
                border: '1px solid var(--border-subtle)',
              }}>
                {/* Media render */}
                <div style={{ position: 'relative' }}>
                  {type === 'image' && (
                    <img
                      src={item.fileUrl}
                      alt={item.caption || 'Site photo'}
                      loading="lazy"
                      onClick={() => openLightbox(item)}
                      style={{
                        width: '100%', maxHeight: 320, objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'block',
                      }}
                    />
                  )}
                  {type === 'video' && (
                    <video
                      src={item.fileUrl}
                      controls
                      preload="metadata"
                      style={{ width: '100%', maxHeight: 320, borderRadius: 'var(--radius-sm)', display: 'block', background: '#000' }}
                    />
                  )}
                  {type === 'audio' && (
                    <div style={{ padding: 'var(--space-sm)' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                        fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6,
                      }}>
                        <Mic size={14} /> Voice memo {item.durationSeconds ? `· ${fmtTime(item.durationSeconds)}` : ''}
                      </div>
                      <audio src={item.fileUrl} controls style={{ width: '100%' }} />
                    </div>
                  )}

                  {/* Top-right action chips */}
                  {!readOnly && type !== 'audio' && (
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                      <button type="button" className="btn btn-icon"
                              title={item.pinned ? 'Unpin (will be deleted in 30-day cleanup)' : 'Pin (keeps past 30-day cleanup)'}
                              onClick={() => togglePinQuoteMedia(item.id)}
                              style={{ width: 28, height: 28, background: item.pinned ? 'var(--lucky-gold, #d4a437)' : 'rgba(0,0,0,0.55)', color: '#fff', border: 'none' }}>
                        {item.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                      </button>
                      <button type="button" className="btn btn-icon" title="Delete"
                              onClick={() => setConfirmDelete(item.id)}
                              style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {readOnly && item.pinned && (
                    <div title="Pinned" style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--lucky-gold, #d4a437)', color: '#fff', borderRadius: '999px',
                    }}>
                      <Pin size={11} />
                    </div>
                  )}
                </div>

                {/* Audio-row owns its own pin/delete (the absolute-positioned buttons sit awkwardly over the audio control) */}
                {!readOnly && type === 'audio' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                    <button type="button" className="btn btn-icon btn-ghost" title={item.pinned ? 'Unpin' : 'Pin'}
                            onClick={() => togglePinQuoteMedia(item.id)} style={{ width: 28, height: 28, color: item.pinned ? 'var(--lucky-gold, #d4a437)' : undefined }}>
                      {item.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                    </button>
                    <button type="button" className="btn btn-icon btn-ghost" title="Delete"
                            onClick={() => setConfirmDelete(item.id)} style={{ width: 28, height: 28 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                {/* Caption + transcript */}
                <div style={{ marginTop: 'var(--space-sm)' }}>
                  {isEditing ? (
                    <div>
                      <input
                        className="form-input"
                        placeholder="What did the customer say about this?"
                        value={editDraft.caption}
                        onChange={(e) => setEditDraft(d => ({ ...d, caption: e.target.value }))}
                        style={{ marginBottom: 6 }}
                      />
                      {(type === 'audio' || item.transcript != null) && (
                        <textarea
                          className="form-textarea"
                          rows={3}
                          placeholder="Transcript / detailed notes"
                          value={editDraft.transcript}
                          onChange={(e) => setEditDraft(d => ({ ...d, transcript: e.target.value }))}
                          style={{ marginBottom: 6 }}
                        />
                      )}
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}><Check size={14} /> Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {item.caption && (
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: item.transcript ? 4 : 0 }}>
                          {item.caption}
                        </div>
                      )}
                      {item.transcript && (
                        <div style={{
                          fontSize: '0.82rem', color: 'var(--text-secondary)',
                          fontStyle: 'italic', lineHeight: 1.45, whiteSpace: 'pre-wrap',
                          paddingLeft: type === 'audio' ? 0 : 'var(--space-sm)',
                          borderLeft: type === 'audio' ? 'none' : '2px solid var(--border-subtle)',
                          marginTop: item.caption ? 4 : 0,
                        }}>
                          {item.transcript}
                        </div>
                      )}
                      {!readOnly && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}
                                style={{ marginTop: (item.caption || item.transcript) ? 6 : 0, padding: '2px 8px', fontSize: '0.78rem' }}>
                          <Edit3 size={12} /> {item.caption || item.transcript ? 'Edit note' : 'Add note'}
                        </button>
                      )}
                      {!item.caption && !item.transcript && readOnly && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>No note attached.</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-generated summary — concatenates every caption + transcript
          in walk-through order, ready to drop into the quote's Notes. */}
      {(() => {
        const summary = buildQuoteMediaSummary(items);
        if (!summary) return null;
        const handleCopy = async () => {
          try {
            await navigator.clipboard.writeText(summary);
            setSummaryCopied(true);
            setTimeout(() => setSummaryCopied(false), 1800);
          } catch (err) {
            console.warn('[QuoteMediaGallery] clipboard write failed', err);
          }
        };
        return (
          <div style={{
            marginTop: 'var(--space-md)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
          }}>
            <button
              type="button"
              onClick={() => setSummaryOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)',
                textAlign: 'left',
              }}
            >
              <FileText size={14} />
              <span style={{ flex: 1 }}>Generated walkthrough summary</span>
              {summaryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {summaryOpen && (
              <div style={{ padding: '0 12px 12px' }}>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-primary, var(--bg-base))',
                  padding: 'var(--space-sm)',
                  borderRadius: 'var(--radius-sm)',
                  margin: 0,
                  maxHeight: 240,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                }}>{summary}</pre>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
                    {summaryCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                  {onApplySummary && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => onApplySummary(summary)}>
                      <ArrowDown size={14} /> Apply to Notes
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Lightbox (images only) */}
      {lightboxItem && (
        <div className="modal-overlay" onClick={closeLightbox}
             style={{ background: 'rgba(0,0,0,0.92)', zIndex: 1000 }}>
          <button type="button" className="btn btn-icon" onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                  style={{ position: 'absolute', top: 12, right: 12, color: '#fff', background: 'rgba(0,0,0,0.4)', border: 'none' }}>
            <X size={22} />
          </button>
          {imageItems.length > 1 && (
            <>
              <button type="button" className="btn btn-icon" onClick={(e) => { e.stopPropagation(); prev(); }}
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#fff', background: 'rgba(0,0,0,0.4)', border: 'none', width: 44, height: 44 }}>
                <ChevronLeft size={26} />
              </button>
              <button type="button" className="btn btn-icon" onClick={(e) => { e.stopPropagation(); next(); }}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#fff', background: 'rgba(0,0,0,0.4)', border: 'none', width: 44, height: 44 }}>
                <ChevronRight size={26} />
              </button>
            </>
          )}
          <img src={lightboxItem.fileUrl} alt={lightboxItem.caption || ''}
               onClick={(e) => e.stopPropagation()}
               style={{
                 maxWidth: '94vw', maxHeight: '85vh', objectFit: 'contain',
                 boxShadow: '0 8px 40px rgba(0,0,0,0.6)', borderRadius: 'var(--radius-sm)',
               }} />
          {lightboxItem.caption && (
            <div onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
              maxWidth: '80vw', color: '#fff', fontSize: '0.92rem',
              background: 'rgba(0,0,0,0.6)', padding: '8px 14px', borderRadius: 'var(--radius-sm)',
            }}>{lightboxItem.caption}</div>
          )}
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            color: '#fff', fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)',
            padding: '4px 10px', borderRadius: '999px',
          }}>
            {lightboxIndex + 1} / {imageItems.length}
          </div>
        </div>
      )}

      {/* Voice memo recorder */}
      {showVoiceRecorder && (
        <VoiceMemoRecorder
          onSave={handleVoiceMemoSave}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)} style={{ zIndex: 1100 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h2>Delete Item</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setConfirmDelete(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem' }}>This media item and its note will be permanently removed.</p>
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
