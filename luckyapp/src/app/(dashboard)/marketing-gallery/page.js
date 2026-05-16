'use client';

// Marketing gallery manager. Riley uploads photos here from his phone in the
// field; the marketing site (luckylandscapes.com/gallery) fetches them via
// /api/marketing/gallery and replaces its bundled fallback list. Updates go
// live in ~60s (Vercel edge cache TTL).
//
// Two surfaces: an upload modal (drag-drop multi-file, per-file metadata)
// and a manage grid (thumbnail, tags, publish toggle, sort, edit, delete).
// Compression happens client-side using the shared compressImage helper —
// keeps phone uploads inside the Supabase free-tier 1GB cap.

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase, isSupabaseConnected } from '@/lib/supabase';
import { compressImage, bytesPretty } from '@/lib/compressImage';
import {
  Plus, X, Save, Upload, Trash2, Edit3, Eye, EyeOff, Camera, Loader2,
  ArrowUp, ArrowDown, ExternalLink, ImagePlus, Tag, RefreshCw, Globe, Sparkles,
} from 'lucide-react';

// Curated tag set. Free-form in the DB so new tags don't need a migration,
// but the UI offers these for consistency. The public site groups photos
// by these (Hardscaping shows alongside Hardscaping, etc.).
const GALLERY_TAGS = [
  'Hardscaping',
  'Landscaping',
  'Lawn Care',
  'Garden Beds',
  'Retaining Walls',
  'Fencing',
  'Outdoor Living',
  'Construction',
  'Seasonal Cleanup',
  'Maintenance',
  'Before & After',
  'Custom Build',
];

// Visual hint per category — drives the icon shown in the wizard tile picker
// AND the published gallery card hover state if/when we ever add it.
// Plain emoji so we don't need to import 12 lucide icons.
const CATEGORY_ICON = {
  'Hardscaping': '🧱',
  'Landscaping': '🌳',
  'Lawn Care': '🌿',
  'Garden Beds': '🌺',
  'Retaining Walls': '⛰️',
  'Fencing': '🪵',
  'Outdoor Living': '🪑',
  'Construction': '🔨',
  'Seasonal Cleanup': '🍂',
  'Maintenance': '✂️',
  'Before & After': '↔️',
  'Custom Build': '🎨',
};

const MARKETING_GALLERY_URL = 'https://luckylandscapes.com/gallery';

// Phone-camera default filenames produce useless titles. When the auto-fill
// would land on something like "IMG 1234" or "Untitled 3", leave the field
// blank and force a real title — keeps the public gallery from being a wall
// of "Untitled" cards.
const GENERIC_TITLE_RE = /^(untitled|img|image|photo|dsc|pxl|screenshot)[\s_-]*\d*$/i;

function looksGenericTitle(t) {
  if (!t) return true;
  const cleaned = String(t).trim();
  if (!cleaned) return true;
  return GENERIC_TITLE_RE.test(cleaned);
}

function smartTitleFromFilename(filename) {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (looksGenericTitle(stem)) return '';
  return stem;
}

// Upload + capture image dimensions in one pass. Re-decodes the compressed
// blob so the dimensions match what's actually stored (compressImage may
// have downscaled). Returns { file, width, height }.
async function compressAndMeasure(file) {
  const compressed = await compressImage(file);
  try {
    const bm = await createImageBitmap(compressed, { imageOrientation: 'from-image' });
    const out = { file: compressed, width: bm.width, height: bm.height };
    bm.close?.();
    return out;
  } catch {
    return { file: compressed, width: null, height: null };
  }
}

// Convert a File / Blob to a base64 string (no data-URL prefix). Used to send
// the compressed image to the AI suggest endpoint.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      // result is "data:image/jpeg;base64,..." — strip the prefix
      const i = String(result).indexOf(',');
      resolve(i >= 0 ? String(result).slice(i + 1) : String(result));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Call the AI suggest endpoint. Returns null if not configured (so the UI
// can hide the auto-fill button) or throws for any other failure.
async function fetchAiSuggestion(file) {
  // Compress first so we send the same ~300KB the eventual upload will use —
  // makes the AI call cheaper and faster.
  const compressed = await compressImage(file);
  const base64 = await fileToBase64(compressed);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in.');
  const res = await fetch('/api/marketing/gallery/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ imageBase64: base64 }),
  });
  if (res.status === 503) {
    // Not configured — caller treats this as "feature disabled".
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `AI failed (${res.status})`);
  }
  return data;
}

async function uploadGalleryImage(file, orgId) {
  const { file: ready, width, height } = await compressAndMeasure(file);
  const ext = ready.type === 'image/png' ? 'png' : 'jpg';
  const key = `${orgId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabase.storage.from('marketing-gallery').upload(key, ready, {
    contentType: ready.type,
    upsert: false,
    cacheControl: '31536000',  // 1 year — images are versioned by UUID, never re-uploaded
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('marketing-gallery').getPublicUrl(key);
  return {
    url: pub.publicUrl,
    path: key,
    width,
    height,
    bytes: ready.size,
  };
}

export default function MarketingGalleryPage() {
  const { user, loading: authLoading } = useAuth();
  const orgId = user?.orgId;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterTag, setFilterTag] = useState('');

  const loadItems = async () => {
    if (!isSupabaseConnected() || !orgId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('marketing_gallery')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) console.error('[marketing-gallery] load failed', error);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    loadItems();
  }, [authLoading, orgId]);

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.title}"? This removes it from the website immediately.`)) return;
    const { error } = await supabase.from('marketing_gallery').delete().eq('id', item.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    // Best-effort storage cleanup
    const paths = [item.image_path, item.before_image_path].filter(Boolean);
    if (paths.length) {
      supabase.storage.from('marketing-gallery').remove(paths).catch(err =>
        console.warn('[marketing-gallery] storage cleanup failed', err));
    }
    setItems(prev => prev.filter(x => x.id !== item.id));
  };

  const handleTogglePublish = async (item) => {
    const next = !item.is_published;
    const { error } = await supabase
      .from('marketing_gallery')
      .update({ is_published: next, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) { alert('Update failed: ' + error.message); return; }
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, is_published: next } : x));
  };

  const handleMoveSortOrder = async (item, direction) => {
    const idx = items.findIndex(x => x.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const other = items[swapIdx];
    const a = item.sort_order, b = other.sort_order;
    // If sort orders are equal, manufacture distinct values
    const newA = a === b ? swapIdx : b;
    const newB = a === b ? idx : a;
    await Promise.all([
      supabase.from('marketing_gallery').update({ sort_order: newA }).eq('id', item.id),
      supabase.from('marketing_gallery').update({ sort_order: newB }).eq('id', other.id),
    ]);
    await loadItems();
  };

  const filtered = useMemo(() => {
    if (!filterTag) return items;
    return items.filter(x => Array.isArray(x.tags) && x.tags.includes(filterTag));
  }, [items, filterTag]);

  const publishedCount = items.filter(x => x.is_published).length;

  if (!isSupabaseConnected()) {
    return (
      <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
        <h1>Marketing Gallery</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
          The marketing gallery requires Supabase. Set <code>NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable it.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1280, margin: '0 auto' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <Globe size={28} /> Marketing Gallery
          </h1>
          <p style={{ margin: '.25rem 0 0', color: 'var(--text-secondary)', fontSize: '.9rem' }}>
            Photos here appear at{' '}
            <a href={MARKETING_GALLERY_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
              luckylandscapes.com/gallery <ExternalLink size={12} style={{ verticalAlign: 'baseline' }} />
            </a>{' '}
            within ~60 seconds.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={loadItems} title="Reload">
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
            <Upload size={16} /> Upload Photos
          </button>
        </div>
      </header>

      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '.88rem' }}>
        <div>
          <strong>{publishedCount}</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>published · </span>
          <strong>{items.length - publishedCount}</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>drafts</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginLeft: 'auto' }}>
          <Tag size={14} style={{ color: 'var(--text-tertiary)' }} />
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            style={{ padding: '.35rem .6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
          >
            <option value="">All tags</option>
            {GALLERY_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
          <Loader2 size={32} className="spin" />
          <p>Loading gallery…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onUpload={() => setUploadOpen(true)} hasItems={items.length > 0} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {filtered.map((item, idx) => (
            <GalleryItemCard
              key={item.id}
              item={item}
              onEdit={() => setEditingId(item.id)}
              onDelete={() => handleDelete(item)}
              onTogglePublish={() => handleTogglePublish(item)}
              onMoveUp={idx > 0 ? () => handleMoveSortOrder(item, 'up') : null}
              onMoveDown={idx < filtered.length - 1 ? () => handleMoveSortOrder(item, 'down') : null}
            />
          ))}
        </div>
      )}

      {uploadOpen && (
        <UploadModal
          orgId={orgId}
          onClose={() => setUploadOpen(false)}
          onUploaded={async () => { await loadItems(); }}
        />
      )}

      {editingId && (
        <EditModal
          item={items.find(x => x.id === editingId)}
          onClose={() => setEditingId(null)}
          onSaved={async () => { setEditingId(null); await loadItems(); }}
        />
      )}
    </div>
  );
}

function EmptyState({ onUpload, hasItems }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '2px dashed var(--border)' }}>
      <ImagePlus size={48} style={{ color: 'var(--text-tertiary)' }} />
      <h3 style={{ marginTop: '1rem' }}>{hasItems ? 'No photos match that filter' : 'No photos yet'}</h3>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '.5rem auto 1.5rem' }}>
        {hasItems
          ? 'Try a different tag or clear the filter.'
          : 'Upload your best project photos and they\'ll show up on luckylandscapes.com/gallery within a minute.'}
      </p>
      <button className="btn btn-primary" onClick={onUpload}>
        <Upload size={16} /> Upload Photos
      </button>
    </div>
  );
}

function GalleryItemCard({ item, onEdit, onDelete, onTogglePublish, onMoveUp, onMoveDown }) {
  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--bg-subtle)' }}>
        <img
          src={item.image_url}
          alt={item.title}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {!item.is_published && (
          <div style={{ position: 'absolute', top: '.5rem', left: '.5rem', background: 'rgba(0,0,0,.7)', color: 'white', padding: '.25rem .6rem', borderRadius: 'var(--radius-sm)', fontSize: '.7rem', fontWeight: 600 }}>
            DRAFT
          </div>
        )}
        {item.before_image_url && (
          <div style={{ position: 'absolute', top: '.5rem', right: '.5rem', background: 'var(--accent)', color: 'white', padding: '.25rem .6rem', borderRadius: 'var(--radius-sm)', fontSize: '.7rem', fontWeight: 600 }}>
            BEFORE/AFTER
          </div>
        )}
      </div>
      <div style={{ padding: '.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h4>
        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem' }}>
            {item.tags.slice(0, 4).map(t => (
              <span key={t} style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', padding: '.15rem .5rem', borderRadius: 'var(--radius-full)', fontSize: '.7rem', fontWeight: 500 }}>
                {t}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '.25rem', marginTop: '.25rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={onTogglePublish} title={item.is_published ? 'Hide from site' : 'Publish to site'}>
            {item.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit">
            <Edit3 size={14} />
          </button>
          {onMoveUp && (
            <button className="btn btn-ghost btn-sm" onClick={onMoveUp} title="Move up">
              <ArrowUp size={14} />
            </button>
          )}
          {onMoveDown && (
            <button className="btn btn-ghost btn-sm" onClick={onMoveDown} title="Move down">
              <ArrowDown size={14} />
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onDelete} title="Delete" style={{ marginLeft: 'auto', color: 'var(--status-danger)' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ orgId, onClose, onUploaded }) {
  // Two-step wizard: first the user picks a category (the photo's primary
  // tag), then they drop photos for that category. Forcing the category
  // upfront keeps the per-row form simple — no 12-pill tag picker per file —
  // and guarantees every uploaded photo has at least one meaningful tag.
  const [category, setCategory] = useState(null);
  // Per-file form state. After picking files we generate one "pending"
  // entry per file with editable title/tags/description before uploading.
  const [pending, setPending] = useState([]); // { file, preview, title, description, tags, before, beforeFile, beforePreview, error, uploading, done, aiLoading }
  const fileInputRef = useRef(null);
  // null = not yet checked; true/false = result of last suggest call
  const [aiAvailable, setAiAvailable] = useState(null);
  const [bulkAiLoading, setBulkAiLoading] = useState(false);

  const addFiles = (files) => {
    const arr = Array.from(files || []);
    const next = arr.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      title: smartTitleFromFilename(file.name),  // blank for IMG_1234 / Untitled N
      description: '',
      // Pre-seed the picked category as the primary tag. AI auto-fill later
      // unions in additional tags; user can still add more via "+ more tags".
      tags: category ? [category] : [],
      before: false,
      beforeFile: null,
      beforePreview: null,
      uploading: false,
      done: false,
      error: null,
    }));
    setPending(prev => [...prev, ...next]);
  };

  const handleChangeCategory = () => {
    // Only allow swapping category if nothing has been uploaded yet.
    if (pending.some(p => p.done)) {
      alert('Some photos in this batch are already uploaded. Close this dialog and start a new batch to pick a different category.');
      return;
    }
    setCategory(null);
    setPending([]);
  };

  const updateAt = (i, patch) => {
    setPending(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  };

  const removeAt = (i) => {
    setPending(prev => prev.filter((_, idx) => idx !== i));
  };

  const toggleTagAt = (i, tag) => {
    setPending(prev => prev.map((p, idx) => {
      if (idx !== i) return p;
      const has = p.tags.includes(tag);
      return { ...p, tags: has ? p.tags.filter(t => t !== tag) : [...p.tags, tag] };
    }));
  };

  const handleBeforeFileAt = (i, file) => {
    updateAt(i, {
      beforeFile: file,
      beforePreview: file ? URL.createObjectURL(file) : null,
    });
  };

  const runAiSuggest = async (i) => {
    const p = pending[i];
    if (!p || p.done || p.uploading || p.aiLoading) return;
    updateAt(i, { aiLoading: true, error: null });
    try {
      const suggestion = await fetchAiSuggestion(p.file);
      if (suggestion === null) {
        setAiAvailable(false);
        updateAt(i, { aiLoading: false, error: 'AI auto-fill is not configured (set ANTHROPIC_API_KEY in Vercel).' });
        return;
      }
      setAiAvailable(true);
      // Merge tags: prefer AI's suggestions, dedupe against any the user already picked.
      const mergedTags = Array.from(new Set([...(p.tags || []), ...(suggestion.tags || [])]));
      updateAt(i, {
        aiLoading: false,
        title: suggestion.title || p.title,
        description: suggestion.description || p.description,
        tags: mergedTags,
      });
    } catch (err) {
      console.error('[ai-suggest] failed', err);
      updateAt(i, { aiLoading: false, error: 'Auto-fill failed: ' + (err.message || 'unknown error') });
    }
  };

  const runAiSuggestAll = async () => {
    setBulkAiLoading(true);
    // Snapshot the items we'll process — pending closes over render-time
    // state, so we use this to decide what to skip without React state
    // updates interfering mid-loop.
    const snapshot = pending.map((p, idx) => ({ idx, file: p.file, hasTitle: !!p.title, done: p.done, tags: p.tags || [] }));
    let stillAvailable = true;
    try {
      for (const item of snapshot) {
        if (!stillAvailable) break;
        if (item.done || item.hasTitle) continue;
        updateAt(item.idx, { aiLoading: true, error: null });
        try {
          const suggestion = await fetchAiSuggestion(item.file);
          if (suggestion === null) {
            stillAvailable = false;
            setAiAvailable(false);
            updateAt(item.idx, { aiLoading: false, error: 'AI auto-fill is not configured (set ANTHROPIC_API_KEY in Vercel).' });
            break;
          }
          const mergedTags = Array.from(new Set([...item.tags, ...(suggestion.tags || [])]));
          updateAt(item.idx, {
            aiLoading: false,
            title: suggestion.title || '',
            description: suggestion.description || '',
            tags: mergedTags,
          });
        } catch (err) {
          updateAt(item.idx, { aiLoading: false, error: 'Auto-fill failed: ' + (err.message || 'unknown error') });
        }
      }
    } finally {
      setBulkAiLoading(false);
    }
  };

  const uploadOne = async (i) => {
    const p = pending[i];
    if (!p || p.done || p.uploading) return;
    if (!p.title.trim()) {
      updateAt(i, { error: 'Add a real title — this shows on the public website.' });
      return;
    }
    if (looksGenericTitle(p.title)) {
      updateAt(i, { error: 'Title looks generic (e.g. "Untitled 3"). Use something descriptive — your customers will see this.' });
      return;
    }
    updateAt(i, { uploading: true, error: null });
    try {
      const main = await uploadGalleryImage(p.file, orgId);
      let before = null;
      if (p.before && p.beforeFile) {
        before = await uploadGalleryImage(p.beforeFile, orgId);
      }
      const { error } = await supabase.from('marketing_gallery').insert({
        org_id: orgId,
        title: p.title.trim(),
        description: p.description.trim() || null,
        tags: p.tags,
        image_url: main.url,
        image_path: main.path,
        image_width: main.width,
        image_height: main.height,
        image_bytes: main.bytes,
        before_image_url: before?.url || null,
        before_image_path: before?.path || null,
        is_published: true,
        sort_order: 0,
      });
      if (error) throw error;
      updateAt(i, { uploading: false, done: true });
    } catch (err) {
      console.error('[upload] failed', err);
      updateAt(i, { uploading: false, error: err.message || 'Upload failed.' });
    }
  };

  const uploadAll = async () => {
    for (let i = 0; i < pending.length; i++) {
      if (pending[i].done) continue;
      await uploadOne(i);
    }
    await onUploaded();
  };

  const allDone = pending.length > 0 && pending.every(p => p.done);

  // STEP 1 — Category picker. No photos chosen yet. We show a visual
  // tile grid; clicking a tile advances the wizard.
  if (!category) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <Upload size={22} /> Upload to Gallery
            </h2>
            <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
          </header>
          <div style={{ padding: '1.5rem 1.5rem 2rem', overflow: 'auto', flex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 .35rem', fontSize: '1.15rem' }}>What kind of project is this?</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '.85rem' }}>
                Pick a category — your photos will be tagged automatically.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '.75rem' }}>
              {GALLERY_TAGS.filter(t => t !== 'Before & After').map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setCategory(tag)}
                  className="category-tile"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '.6rem',
                    padding: '1.25rem .75rem',
                    background: 'var(--bg-elevated)',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                >
                  <span style={{ fontSize: '2rem', lineHeight: 1 }} aria-hidden="true">{CATEGORY_ICON[tag] || '📷'}</span>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, textAlign: 'center' }}>{tag}</span>
                </button>
              ))}
            </div>
            <p style={{ marginTop: '1.5rem', fontSize: '.78rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              You'll be able to add more tags per photo after uploading.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2 — File picker + per-file metadata. Category is locked in;
  // shown as a header chip with a "Change" link.
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <Upload size={22} /> Upload to Gallery
            </h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', padding: '.3rem .65rem', background: 'var(--accent)', color: 'white', borderRadius: 'var(--radius-full)', fontSize: '.78rem', fontWeight: 600 }}>
              <span aria-hidden="true">{CATEGORY_ICON[category] || '📷'}</span>
              <span>{category}</span>
            </div>
            <button type="button" onClick={handleChangeCategory} className="btn btn-ghost btn-sm" style={{ fontSize: '.75rem', padding: '.25rem .5rem' }}>
              Change
            </button>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </header>

        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
          {pending.length === 0 ? (
            <div
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: '3rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg-subtle)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={40} style={{ color: 'var(--text-tertiary)' }} />
              <h3 style={{ marginTop: '1rem' }}>Drop {category.toLowerCase()} photos here</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', marginTop: '.25rem' }}>
                JPG, PNG, or HEIC. Auto-compressed to ~300KB before upload.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => addFiles(e.target.files)}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {aiAvailable !== false && pending.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={runAiSuggestAll}
                    disabled={bulkAiLoading || pending.every(p => p.done || p.title)}
                    style={{ gap: '.4rem' }}
                  >
                    {bulkAiLoading ? (
                      <><Loader2 size={14} className="spin" /> Analyzing photos…</>
                    ) : (
                      <><Sparkles size={14} /> Auto-fill all with AI</>
                    )}
                  </button>
                </div>
              )}
              {pending.map((p, i) => (
                <PendingUploadRow
                  key={i}
                  pending={p}
                  aiAvailable={aiAvailable}
                  primaryCategory={category}
                  onChange={patch => updateAt(i, patch)}
                  onRemove={() => removeAt(i)}
                  onToggleTag={tag => toggleTagAt(i, tag)}
                  onBeforeFile={file => handleBeforeFileAt(i, file)}
                  onAiSuggest={() => runAiSuggest(i)}
                />
              ))}
              <button
                className="btn btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                style={{ borderStyle: 'dashed', padding: '1rem' }}
              >
                <Plus size={16} /> Add more {category.toLowerCase()} photos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => addFiles(e.target.files)}
              />
            </div>
          )}
        </div>

        {pending.length > 0 && (
          <footer style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem' }}>
            <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
              {pending.filter(p => p.done).length} / {pending.length} uploaded
            </span>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-ghost" onClick={onClose}>
                {allDone ? 'Done' : 'Cancel'}
              </button>
              {!allDone && (
                <button className="btn btn-primary" onClick={uploadAll}>
                  <Save size={16} /> Upload All
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function PendingUploadRow({ pending, aiAvailable, primaryCategory, onChange, onRemove, onToggleTag, onBeforeFile, onAiSuggest }) {
  const showAiButton = aiAvailable !== false && !pending.done;
  const [showMoreTags, setShowMoreTags] = useState(false);
  // Extra tags = anything beyond the wizard-picked category. Used to drive
  // the "+ N more" chip count without re-expanding the picker every time.
  const extraTags = (pending.tags || []).filter(t => t !== primaryCategory);
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', gap: '1rem', position: 'relative', opacity: pending.done ? 0.6 : 1 }}>
      <div style={{ flexShrink: 0, width: 120, height: 90, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
        <img src={pending.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.5rem', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Title (e.g. Maple St Retaining Wall, Backyard Fire Pit)"
            value={pending.title}
            onChange={e => onChange({ title: e.target.value, error: null })}
            disabled={pending.done || pending.uploading}
            style={{
              flex: 1,
              padding: '.5rem .7rem',
              border: '1px solid ' + (pending.title && looksGenericTitle(pending.title) ? 'var(--status-warning, #d97706)' : 'var(--border)'),
              borderRadius: 'var(--radius-md)',
              fontSize: '.9rem',
              fontWeight: 600,
            }}
          />
          {showAiButton && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onAiSuggest}
              disabled={pending.aiLoading || pending.uploading}
              title="Use AI to suggest a title, description, and tags from the photo"
              style={{ flexShrink: 0, padding: '.45rem .7rem', fontSize: '.78rem', gap: '.3rem' }}
            >
              {pending.aiLoading ? (
                <><Loader2 size={13} className="spin" /> Thinking…</>
              ) : (
                <><Sparkles size={13} /> Auto-fill</>
              )}
            </button>
          )}
        </div>
        {pending.title && looksGenericTitle(pending.title) && (
          <div style={{ fontSize: '.72rem', color: 'var(--status-warning, #d97706)', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
            ⚠ This shows on luckylandscapes.com — pick something descriptive your customers will recognize.
          </div>
        )}
        <textarea
          placeholder="Short description (optional)"
          value={pending.description}
          onChange={e => onChange({ description: e.target.value })}
          disabled={pending.done || pending.uploading}
          rows={2}
          style={{ padding: '.5rem .7rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '.85rem', resize: 'vertical' }}
        />
        {/* Compact tag row — shows the picked category as a chip, plus
            optional extra tags. "+ more tags" expands the full picker. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.35rem' }}>
          {primaryCategory && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '.3rem',
              padding: '.2rem .6rem', borderRadius: 'var(--radius-full)',
              background: 'var(--accent)', color: 'white',
              fontSize: '.7rem', fontWeight: 600,
            }}>
              <span aria-hidden="true">{CATEGORY_ICON[primaryCategory] || '🏷️'}</span>
              {primaryCategory}
            </span>
          )}
          {extraTags.map(tag => (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: '.25rem',
              padding: '.2rem .55rem', borderRadius: 'var(--radius-full)',
              background: 'var(--bg-subtle)', color: 'var(--text-secondary)',
              fontSize: '.7rem', fontWeight: 500,
            }}>
              {tag}
              {!pending.done && !pending.uploading && (
                <button
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                  aria-label={`Remove ${tag}`}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {!pending.done && !pending.uploading && (
            <button
              type="button"
              onClick={() => setShowMoreTags(s => !s)}
              style={{
                padding: '.2rem .55rem', borderRadius: 'var(--radius-full)',
                border: '1px dashed var(--border)', background: 'transparent',
                color: 'var(--text-tertiary)', fontSize: '.7rem', fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {showMoreTags ? '− hide tags' : '+ more tags'}
            </button>
          )}
        </div>
        {showMoreTags && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem', paddingTop: '.25rem', borderTop: '1px dashed var(--border)' }}>
            {GALLERY_TAGS.filter(t => t !== primaryCategory).map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                disabled={pending.done || pending.uploading}
                style={{
                  padding: '.2rem .55rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid ' + (pending.tags.includes(tag) ? 'var(--accent)' : 'var(--border)'),
                  background: pending.tags.includes(tag) ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: pending.tags.includes(tag) ? 'white' : 'var(--text-secondary)',
                  fontSize: '.7rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={pending.before}
              onChange={e => onChange({ before: e.target.checked, beforeFile: null, beforePreview: null })}
              disabled={pending.done || pending.uploading}
            />
            Before / after pair
          </label>
          {pending.before && (
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
              <Camera size={14} /> {pending.beforeFile ? 'Change "before" photo' : 'Add "before" photo'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => onBeforeFile(e.target.files?.[0])}
              />
            </label>
          )}
          {pending.beforePreview && (
            <img src={pending.beforePreview} alt="before" style={{ height: 32, width: 32, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
          )}
        </div>
        {pending.error && (
          <div style={{ fontSize: '.78rem', color: 'var(--status-danger)' }}>{pending.error}</div>
        )}
        {pending.done && (
          <div style={{ fontSize: '.78rem', color: 'var(--status-success)', fontWeight: 600 }}>✓ Uploaded — live on website</div>
        )}
        {pending.uploading && (
          <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
            <Loader2 size={14} className="spin" /> Compressing &amp; uploading…
          </div>
        )}
      </div>
      {!pending.done && !pending.uploading && (
        <button
          className="btn btn-icon btn-ghost"
          onClick={onRemove}
          style={{ position: 'absolute', top: '.5rem', right: '.5rem' }}
          title="Remove"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function EditModal({ item, onClose, onSaved }) {
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [tags, setTags] = useState(Array.isArray(item?.tags) ? item.tags : []);
  const [saving, setSaving] = useState(false);

  if (!item) return null;

  const toggleTag = (t) => {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSave = async () => {
    if (!title.trim()) { alert('Title required.'); return; }
    if (looksGenericTitle(title) && !confirm('That title looks generic ("Untitled 3" etc.) — your customers will see it on luckylandscapes.com. Save anyway?')) {
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('marketing_gallery')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    setSaving(false);
    if (error) { alert('Save failed: ' + error.message); return; }
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0 }}>Edit Photo</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </header>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <img src={item.image_url} alt={item.title} style={{ width: '100%', borderRadius: 'var(--radius-lg)', maxHeight: 320, objectFit: 'cover' }} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
            <span style={{ fontSize: '.8rem', fontWeight: 600 }}>Title</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ padding: '.6rem .8rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
            <span style={{ fontSize: '.8rem', fontWeight: 600 }}>Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ padding: '.6rem .8rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', resize: 'vertical' }} />
          </label>
          <div>
            <span style={{ fontSize: '.8rem', fontWeight: 600, display: 'block', marginBottom: '.4rem' }}>Tags</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem' }}>
              {GALLERY_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: '.25rem .6rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid ' + (tags.includes(tag) ? 'var(--accent)' : 'var(--border)'),
                    background: tags.includes(tag) ? 'var(--accent)' : 'var(--bg-subtle)',
                    color: tags.includes(tag) ? 'white' : 'var(--text-secondary)',
                    fontSize: '.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
        <footer style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '.5rem' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={16} className="spin" /> Saving…</> : <><Save size={16} /> Save</>}
          </button>
        </footer>
      </div>
    </div>
  );
}
