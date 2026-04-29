'use client';

// Mobile-first receipt photo capture with client-side compression.
// On phones, opens the camera directly via capture="environment".
// Compresses to a max of 1600px wide JPEG q=0.7 before upload — typical
// 4MB phone photo lands around 200–400KB. Critical for staying inside the
// Supabase free-tier 1GB storage / 5GB bandwidth budget.

import { useRef, useState } from 'react';
import { Camera, Loader2, X, FileImage } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const MAX_DIMENSION = 1600;        // px on the longest edge
const TARGET_QUALITY = 0.7;        // JPEG quality
const SKIP_COMPRESS_BYTES = 200_000; // already small? upload as-is

async function compressImage(file) {
  // PDFs and tiny images go through unchanged
  if (file.type === 'application/pdf') return file;
  if (file.size < SKIP_COMPRESS_BYTES && file.type.startsWith('image/')) return file;
  if (!file.type.startsWith('image/')) return file;

  // Decode via createImageBitmap when available (handles EXIF orientation)
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Browser can't decode this image (e.g. HEIC on non-Safari) — fall back
    return file;
  }

  const ratio = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', TARGET_QUALITY));
  if (!blob) return file;

  // If we somehow made it bigger, keep the original
  if (blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

function bytesPretty(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {object} props
 * @param {string} props.orgId         — for the storage path
 * @param {string} [props.scope]       — 'job' | 'company' (folder in bucket)
 * @param {{ url: string|null, path: string|null }} props.value
 * @param {(v: { url: string|null, path: string|null }) => void} props.onChange
 */
export default function ReceiptUpload({ orgId, scope = 'job', value, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null); // { in, out }
  const [error, setError] = useState(null);

  const url = value?.url || null;
  const path = value?.path || null;

  const handleFile = async (file) => {
    if (!file) return;
    if (!orgId) {
      setError('Not signed in.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      setProgress({ in: file.size, out: compressed.size });

      const ext = compressed.type === 'application/pdf' ? 'pdf'
        : compressed.type === 'image/png' ? 'png' : 'jpg';
      const key = `${orgId}/${scope}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(key, compressed, { contentType: compressed.type, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('receipts').getPublicUrl(key);
      onChange({ url: pub.publicUrl, path: key });
    } catch (err) {
      console.error('[ReceiptUpload] upload failed', err);
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    // Best-effort storage cleanup; leave the row state cleared even if remove fails.
    if (path) {
      try { await supabase.storage.from('receipts').remove([path]); }
      catch (err) { console.warn('[ReceiptUpload] storage remove failed', err); }
    }
    onChange({ url: null, path: null });
    setProgress(null);
    setError(null);
  };

  if (url) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)' }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', flexShrink: 0 }}>
          <img src={url} alt="Receipt" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }} />
        </a>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--status-success)' }}>Receipt attached</div>
          {progress && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
              {bytesPretty(progress.in)} → {bytesPretty(progress.out)} ({Math.round((1 - progress.out / progress.in) * 100)}% smaller)
            </div>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            View full size →
          </a>
        </div>
        <button type="button" className="btn btn-icon btn-ghost" onClick={handleRemove} title="Remove receipt">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ width: '100%', justifyContent: 'center', padding: '12px', borderStyle: 'dashed' }}
      >
        {uploading ? (
          <><Loader2 size={16} className="spin" /> Compressing &amp; uploading…</>
        ) : (
          <><Camera size={16} /> <FileImage size={16} /> Add Receipt Photo</>
        )}
      </button>
      {error && (
        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--status-danger)' }}>{error}</div>
      )}
      {!error && !uploading && (
        <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Photos are auto-compressed before upload (free-tier friendly)
        </div>
      )}
    </div>
  );
}
