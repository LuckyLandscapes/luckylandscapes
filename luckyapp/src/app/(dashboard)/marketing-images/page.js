'use client';

// Website Images — lets the owner swap fixed image "slots" on the public
// marketing site (luckylandscapes.com) without editing code or redeploying.
// Each slot maps to an <img data-ll-img="<key>"> on the site. Uploading here
// stores the image in the public marketing-gallery bucket and upserts a
// marketing_images row; the marketing site fetches /api/marketing/images on
// load and swaps the src/alt, falling back to the bundled image otherwise.
//
// To add a new editable image: tag the <img> on the marketing site with
// data-ll-img="<key>" and add a SLOT_REGISTRY entry below. Nothing else.

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase, isSupabaseConnected } from '@/lib/supabase';
import { compressImage, bytesPretty } from '@/lib/compressImage';
import {
  Globe, Upload, RotateCcw, Loader2, ExternalLink, Check, Image as ImageIcon,
} from 'lucide-react';

// Where the marketing site lives — used to render the current/default image
// preview (the bundled file) and the "view on site" links.
const MARKETING_ORIGIN = 'https://luckylandscapes.com';

// The fixed set of editable image slots. Each `key` must match a
// data-ll-img="<key>" attribute in the marketing HTML. `defaultSrc` is the
// image the site ships with — shown as the preview until an override exists,
// and what "Reset to default" returns to.
const SLOT_REGISTRY = [
  { key: 'service-garden-beds-feature',     label: 'Garden Beds — feature image',     page: '/services/garden-beds',     defaultSrc: '/images/gardenbed/2.webp',        recommended: 'Landscape, ~1200×900' },
  { key: 'service-landscape-design-feature', label: 'Landscape Design — feature image', page: '/services/landscape-design', defaultSrc: '/images/landscapedesign/3.webp',   recommended: 'Landscape, ~1200×900' },
  { key: 'service-lawn-care-feature',        label: 'Lawn Care — feature image',        page: '/services/lawn-care',        defaultSrc: '/images/lawncare/1.webp',         recommended: 'Landscape, ~1200×900' },
  { key: 'service-property-cleanup-feature', label: 'Property Cleanup — feature image', page: '/services/property-cleanup', defaultSrc: '/images/LawnRestore/after.webp',  recommended: 'Landscape, ~1200×900' },
  { key: 'service-fencing-feature',          label: 'Fencing — feature image',          page: '/services/fencing',          defaultSrc: '/images/fencing/1.jpg',           recommended: 'Landscape, ~1200×900' },
  { key: 'service-hardscaping-feature',      label: 'Hardscaping — feature image',      page: '/services/hardscaping',      defaultSrc: '/images/retainingwall/3.webp',    recommended: 'Landscape, ~1200×900' },
];

// Compress + capture dimensions in one pass (re-decodes the compressed blob so
// dims match what's actually stored).
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

async function uploadSlotImage(file, orgId, slotKey) {
  const { file: ready, width, height } = await compressAndMeasure(file);
  const ext = ready.type === 'image/png' ? 'png' : 'jpg';
  // First path segment MUST be the org_id to satisfy the marketing-gallery
  // bucket's write policy. Timestamp keeps versions unique (no upsert clobber).
  const key = `${orgId}/slots/${slotKey}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('marketing-gallery').upload(key, ready, {
    contentType: ready.type,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('marketing-gallery').getPublicUrl(key);
  return { url: pub.publicUrl, path: key, width, height, bytes: ready.size };
}

export default function MarketingImagesPage() {
  const { user, loading: authLoading } = useAuth();
  const orgId = user?.orgId;
  const [overrides, setOverrides] = useState({}); // slot_key -> row
  const [loading, setLoading] = useState(true);

  // Plain async function (not useCallback) so the mount effect can call it
  // without tripping react-hooks/set-state-in-effect — same pattern as the
  // gallery page's loadItems. Also passed to SlotCard as the refresh callback.
  const loadOverrides = async () => {
    if (!isSupabaseConnected() || !orgId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('marketing_images')
      .select('*')
      .eq('org_id', orgId);
    if (error) console.error('[marketing-images] load failed', error);
    const map = {};
    (data || []).forEach(row => { map[row.slot_key] = row; });
    setOverrides(map);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    loadOverrides();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, orgId]);

  if (!isSupabaseConnected()) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Website Images</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Connect Supabase to manage website images.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <ImageIcon size={24} /> Website Images
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '.5rem', maxWidth: 640 }}>
          Swap the feature images on your service pages. Upload a new photo and it goes live on
          luckylandscapes.com within about a minute — no code, no app store. Your portfolio photos
          live under <strong>Website Gallery</strong>; this page is for the fixed graphics built into each page.
        </p>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
          <Loader2 size={28} className="spin" />
          <p>Loading…</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {SLOT_REGISTRY.map(slot => (
            <SlotCard
              key={slot.key}
              slot={slot}
              override={overrides[slot.key] || null}
              orgId={orgId}
              onChanged={loadOverrides}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({ slot, override, orgId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [alt, setAlt] = useState(override?.alt || '');
  const [altSaved, setAltSaved] = useState(false);
  const fileRef = useRef(null);

  const hasOverride = !!override;
  // Preview: the override if set, else the bundled image off the live site.
  const previewUrl = hasOverride ? override.image_url : `${MARKETING_ORIGIN}${slot.defaultSrc}`;

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const up = await uploadSlotImage(file, orgId, slot.key);
      // Best-effort cleanup of the previous override's storage object.
      if (override?.image_path) {
        supabase.storage.from('marketing-gallery').remove([override.image_path]).catch(() => {});
      }
      const { error: upsertErr } = await supabase
        .from('marketing_images')
        .upsert({
          org_id: orgId,
          slot_key: slot.key,
          image_url: up.url,
          image_path: up.path,
          alt: (alt || '').trim() || null,
          image_width: up.width,
          image_height: up.height,
          image_bytes: up.bytes,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,slot_key' });
      if (upsertErr) throw upsertErr;
      await onChanged();
    } catch (err) {
      console.error('[marketing-images] replace failed', err);
      setError(err.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!hasOverride) return;
    if (!confirm(`Reset "${slot.label}" back to the original built-in image?`)) return;
    setBusy(true);
    setError(null);
    try {
      if (override.image_path) {
        supabase.storage.from('marketing-gallery').remove([override.image_path]).catch(() => {});
      }
      const { error: delErr } = await supabase
        .from('marketing_images')
        .delete()
        .eq('org_id', orgId)
        .eq('slot_key', slot.key);
      if (delErr) throw delErr;
      setAlt('');
      await onChanged();
    } catch (err) {
      console.error('[marketing-images] reset failed', err);
      setError(err.message || 'Reset failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAltSave = async () => {
    if (!hasOverride) return;
    setBusy(true);
    setError(null);
    try {
      const { error: updErr } = await supabase
        .from('marketing_images')
        .update({ alt: alt.trim() || null, updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .eq('slot_key', slot.key);
      if (updErr) throw updErr;
      setAltSaved(true);
      setTimeout(() => setAltSaved(false), 1800);
      await onChanged();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', gap: '1rem', padding: '1rem', alignItems: 'flex-start' }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 160, height: 120, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={slot.label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: busy ? 0.5 : 1 }}
          onError={(e) => { e.currentTarget.style.opacity = 0.25; }}
        />
        <span style={{
          position: 'absolute', top: 6, left: 6,
          padding: '.15rem .45rem', borderRadius: 'var(--radius-full)',
          fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em',
          background: hasOverride ? 'var(--accent)' : 'rgba(0,0,0,.55)', color: 'white',
        }}>
          {hasOverride ? 'Custom' : 'Default'}
        </span>
        {busy && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Loader2 size={24} className="spin" />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '.95rem' }}>{slot.label}</strong>
          <a
            href={`${MARKETING_ORIGIN}${slot.page}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.2rem', fontSize: '.75rem', color: 'var(--text-tertiary)' }}
          >
            {slot.page} <ExternalLink size={11} />
          </a>
        </div>
        <span style={{ fontSize: '.75rem', color: 'var(--text-tertiary)' }}>
          Recommended: {slot.recommended}
          {hasOverride && override.image_bytes ? ` · ${bytesPretty(override.image_bytes)}` : ''}
        </span>

        {hasOverride && (
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', marginTop: '.15rem' }}>
            <input
              type="text"
              value={alt}
              onChange={e => { setAlt(e.target.value); setAltSaved(false); }}
              placeholder="Alt text (describe the image for accessibility / SEO)"
              style={{ flex: 1, padding: '.35rem .55rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '.78rem' }}
            />
            <button className="btn btn-ghost btn-sm" onClick={handleAltSave} disabled={busy} style={{ padding: '.3rem .5rem' }}>
              {altSaved ? <><Check size={13} /> Saved</> : 'Save alt'}
            </button>
          </div>
        )}

        {error && <span style={{ fontSize: '.75rem', color: 'var(--status-danger, #dc2626)' }}>{error}</span>}

        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.35rem' }}>
          <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy} style={{ gap: '.35rem' }}>
            <Upload size={14} /> {hasOverride ? 'Replace' : 'Upload'}
          </button>
          {hasOverride && (
            <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={busy} style={{ gap: '.35rem' }}>
              <RotateCcw size={14} /> Reset to default
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
      </div>
    </div>
  );
}
