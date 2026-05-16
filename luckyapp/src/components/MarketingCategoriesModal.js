'use client';

// Manage Categories modal for the marketing gallery. Lets Riley:
//   • Add a custom category (any name, not limited to the legacy GALLERY_TAGS)
//   • Toggle visibility (hidden categories don't appear on the public landing
//     but their photos are still filterable via /gallery#tag=Name)
//   • Set a display name override (e.g. "Pool Patios" shown but tag is "Patios")
//   • Set a custom icon (single emoji)
//   • Pick the cover image from the photos tagged with this category
//   • Drag to reorder how categories appear on the public landing
//   • Delete a category (only when no photos use the tag)
//
// Sort + cover updates are persisted to the marketing_categories table; cover
// changes apply within ~60s once Vercel's edge cache rolls.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  X, Plus, Trash2, Eye, EyeOff, Image as Img, Loader2,
  GripVertical, Crown, Check, Edit3,
} from 'lucide-react';
import {
  DndContext, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove,
  sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Quick-pick palette so Riley doesn't have to type emoji codes. Surfaces a
// few visually distinct ones in the icon picker; Riley can still paste any
// emoji into the text input below for full flexibility.
const ICON_QUICKPICK = ['🧱', '🌳', '🌿', '🌺', '⛰️', '🪵', '🪑', '🔨', '🍂', '✂️', '↔️', '🎨', '💡', '🏡', '🪴', '🔥', '🪟', '🚪', '🏊', '📷'];

export default function MarketingCategoriesModal({ orgId, items, onClose, onChanged }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpenFor, setPickerOpenFor] = useState(null);  // { id, name } when cover picker is up
  const [editingId, setEditingId] = useState(null);          // category being renamed inline
  const [adding, setAdding] = useState(false);               // "+ Add category" form visible
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [saving, setSaving] = useState(false);

  // Refreshable loader — used after mutations to pull fresh state. Does NOT
  // flip loading true; the modal already started in loading state and post-
  // mutation refresh should be silent (no spinner flash).
  const loadCategories = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from('marketing_categories')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true });
    if (error) console.error('[marketing-categories] load failed', error);
    setCategories(data || []);
    setLoading(false);
  }, [orgId]);

  // Initial mount fetch — wrapped in an async IIFE so the setState calls
  // happen on a microtask (not synchronously inside the effect). Required
  // by Next 16's react-hooks/set-state-in-effect rule, which flags direct
  // calls to useCallback-wrapped fetchers from effects even when they're
  // async. Duplicates the query body but keeps loadCategories reusable for
  // post-mutation refresh elsewhere in the modal.
  useEffect(() => {
    if (!orgId) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('marketing_categories')
        .select('*')
        .eq('org_id', orgId)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) console.error('[marketing-categories] load failed', error);
      setCategories(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  // Photo counts per category (from items prop — already in memory on the
  // page that opens this modal). Lets us show "12 photos" per row and disable
  // delete when count > 0.
  const photoCountByName = useMemo(() => {
    const m = new Map();
    items.forEach(it => {
      if (Array.isArray(it.tags)) {
        it.tags.forEach(t => m.set(t, (m.get(t) || 0) + 1));
      }
    });
    return m;
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex(c => c.id === active.id);
    const newIdx = categories.findIndex(c => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(categories, oldIdx, newIdx);
    // Optimistic local update — every row gets a fresh sort_order spaced by 10
    // (same approach as the photo reorder; gives room for future drops).
    const stamped = reordered.map((c, i) => ({ ...c, sort_order: i * 10 }));
    setCategories(stamped);
    // Persist the diff
    const updates = stamped
      .filter((c, i) => categories.find(x => x.id === c.id)?.sort_order !== c.sort_order)
      .map(c => supabase
        .from('marketing_categories')
        .update({ sort_order: c.sort_order, updated_at: new Date().toISOString() })
        .eq('id', c.id));
    const results = await Promise.allSettled(updates);
    const failed = results.filter(r => r.status === 'rejected' || r.value?.error);
    if (failed.length) {
      alert(`Reorder partially failed (${failed.length}). Reloading…`);
      await loadCategories();
    }
    onChanged?.();
  };

  const handleToggleVisible = async (cat) => {
    const next = !cat.is_visible;
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_visible: next } : c));
    const { error } = await supabase
      .from('marketing_categories')
      .update({ is_visible: next, updated_at: new Date().toISOString() })
      .eq('id', cat.id);
    if (error) { alert('Update failed: ' + error.message); await loadCategories(); return; }
    onChanged?.();
  };

  const handleSaveMeta = async (cat, patch) => {
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, ...patch } : c));
    const { error } = await supabase
      .from('marketing_categories')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', cat.id);
    if (error) { alert('Update failed: ' + error.message); await loadCategories(); return; }
    onChanged?.();
  };

  const handlePickCover = async (cat, photo) => {
    await handleSaveMeta(cat, {
      cover_image_url: photo.image_url,
      cover_image_path: photo.image_path || null,
    });
    setPickerOpenFor(null);
  };

  const handleClearCover = async (cat) => {
    await handleSaveMeta(cat, { cover_image_url: null, cover_image_path: null });
  };

  const handleDelete = async (cat) => {
    const photoCount = photoCountByName.get(cat.name) || 0;
    if (photoCount > 0) {
      alert(`Cannot delete "${cat.name}" — ${photoCount} photo${photoCount === 1 ? '' : 's'} still use this tag. Remove the tag from those photos first (edit each photo and uncheck this tag).`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    const { error } = await supabase.from('marketing_categories').delete().eq('id', cat.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    setCategories(prev => prev.filter(c => c.id !== cat.id));
    onChanged?.();
  };

  const handleAdd = async () => {
    const cleaned = newName.trim();
    if (!cleaned) return;
    if (categories.some(c => c.name.toLowerCase() === cleaned.toLowerCase())) {
      alert(`"${cleaned}" already exists.`);
      return;
    }
    setSaving(true);
    // New categories default to visible — Riley is explicitly creating it,
    // he wants to see it. Sort_order = max + 10 so it lands at the bottom of
    // the manage list (Riley can drag it where he wants).
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order || 0), -10);
    const { data, error } = await supabase
      .from('marketing_categories')
      .insert({
        org_id: orgId,
        name: cleaned,
        icon: newIcon.trim() || null,
        is_visible: true,
        sort_order: maxOrder + 10,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { alert('Create failed: ' + error.message); return; }
    setCategories(prev => [...prev, data]);
    setNewName('');
    setNewIcon('');
    setAdding(false);
    onChanged?.();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              Manage Categories
            </h2>
            <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', color: 'var(--text-secondary)' }}>
              Only visible categories appear on luckylandscapes.com/gallery. Drag to reorder.
            </p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </header>

        <div style={{ padding: '1rem 1.5rem', overflow: 'auto', flex: 1 }}>
          {/* Add new category */}
          {adding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', padding: '.85rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Category name (e.g. Lighting, Pool Patios, Walkways)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  style={{ flex: 1, padding: '.5rem .7rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '.9rem' }}
                />
                <input
                  type="text"
                  placeholder="Icon"
                  value={newIcon}
                  onChange={e => setNewIcon(e.target.value)}
                  maxLength={4}
                  style={{ width: 60, padding: '.5rem .5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '1.1rem', textAlign: 'center' }}
                />
                <button className="btn btn-primary" onClick={handleAdd} disabled={!newName.trim() || saving}>
                  {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Create
                </button>
                <button className="btn btn-ghost" onClick={() => { setAdding(false); setNewName(''); setNewIcon(''); }}>Cancel</button>
              </div>
              <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
                {ICON_QUICKPICK.map(emo => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => setNewIcon(emo)}
                    title={`Use ${emo} as the icon`}
                    style={{
                      padding: '.25rem .5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid ' + (newIcon === emo ? 'var(--accent)' : 'var(--border)'),
                      background: newIcon === emo ? 'var(--bg-elevated)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '1.1rem',
                    }}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              className="btn btn-ghost"
              onClick={() => setAdding(true)}
              style={{ marginBottom: '1rem', borderStyle: 'dashed', padding: '.75rem 1rem', width: '100%', justifyContent: 'flex-start' }}
            >
              <Plus size={14} /> Add a new category
            </button>
          )}

          {/* Categories list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
              <Loader2 size={24} className="spin" /> Loading…
            </div>
          ) : categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
              <p style={{ margin: 0 }}>No categories yet. Create one above to get started.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                  {categories.map(cat => (
                    <SortableCategoryRow
                      key={cat.id}
                      cat={cat}
                      photoCount={photoCountByName.get(cat.name) || 0}
                      isEditing={editingId === cat.id}
                      onStartEdit={() => setEditingId(cat.id)}
                      onStopEdit={() => setEditingId(null)}
                      onSaveMeta={(patch) => handleSaveMeta(cat, patch)}
                      onToggleVisible={() => handleToggleVisible(cat)}
                      onPickCover={() => setPickerOpenFor({ id: cat.id, name: cat.name })}
                      onClearCover={() => handleClearCover(cat)}
                      onDelete={() => handleDelete(cat)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {pickerOpenFor && (
        <CoverPickerModal
          categoryName={pickerOpenFor.name}
          photos={items.filter(it => Array.isArray(it.tags) && it.tags.includes(pickerOpenFor.name))}
          currentCoverUrl={categories.find(c => c.id === pickerOpenFor.id)?.cover_image_url}
          onClose={() => setPickerOpenFor(null)}
          onPick={(photo) => handlePickCover(categories.find(c => c.id === pickerOpenFor.id), photo)}
        />
      )}
    </div>
  );
}

function SortableCategoryRow({ cat, photoCount, isEditing, onStartEdit, onStopEdit, onSaveMeta, onToggleVisible, onPickCover, onClearCover, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const [displayName, setDisplayName] = useState(cat.display_name || '');
  const [icon, setIcon] = useState(cat.icon || '');
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const save = async () => {
    const patch = {};
    if ((displayName || null) !== (cat.display_name || null)) patch.display_name = displayName.trim() || null;
    if ((icon || null) !== (cat.icon || null)) patch.icon = icon.trim() || null;
    if (Object.keys(patch).length) await onSaveMeta(patch);
    onStopEdit();
  };
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex', alignItems: 'center', gap: '.6rem',
        padding: '.65rem .85rem',
        background: cat.is_visible ? 'var(--bg-elevated)' : 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        opacity: cat.is_visible ? 1 : 0.7,
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{
          background: 'transparent', border: 'none', cursor: 'grab',
          color: 'var(--text-tertiary)', padding: '.25rem', display: 'inline-flex',
          touchAction: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        <GripVertical size={16} style={{ pointerEvents: 'none' }} />
      </button>

      {/* Cover thumbnail */}
      <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-subtle)', border: '1px solid var(--border)', flexShrink: 0, position: 'relative' }}>
        {cat.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cat.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            <Img size={18} />
          </div>
        )}
      </div>

      {/* Name / metadata */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '.15rem' }}>
        {isEditing ? (
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <input
              type="text"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              placeholder="🌳"
              maxLength={4}
              style={{ width: 44, padding: '.3rem .25rem', textAlign: 'center', fontSize: '1.05rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            />
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={`Display name (default: "${cat.name}")`}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onStopEdit(); }}
              style={{ flex: 1, padding: '.3rem .5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '.85rem' }}
            />
            <button className="btn btn-primary btn-sm" onClick={save} title="Save"><Check size={12} /></button>
            <button className="btn btn-ghost btn-sm" onClick={onStopEdit} title="Cancel"><X size={12} /></button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              {cat.icon && <span style={{ fontSize: '1rem' }}>{cat.icon}</span>}
              <strong style={{ fontSize: '.92rem' }}>{cat.display_name || cat.name}</strong>
              {cat.display_name && cat.display_name !== cat.name && (
                <span style={{ fontSize: '.7rem', color: 'var(--text-tertiary)' }}>(tag: {cat.name})</span>
              )}
            </div>
            <span style={{ fontSize: '.72rem', color: 'var(--text-tertiary)' }}>
              {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
              {!cat.is_visible && ' · hidden'}
              {!cat.cover_image_url && ' · auto-cover'}
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <>
          <button className="btn btn-ghost btn-sm" onClick={onPickCover} disabled={photoCount === 0} title={photoCount === 0 ? 'Add photos to this category first' : 'Pick a cover photo'} style={{ padding: '.3rem .5rem', gap: '.25rem' }}>
            <Crown size={13} /> Cover
          </button>
          {cat.cover_image_url && (
            <button className="btn btn-ghost btn-sm" onClick={onClearCover} title="Reset to auto-derived cover" style={{ padding: '.3rem', color: 'var(--text-tertiary)' }}>
              <X size={12} />
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onStartEdit} title="Rename / set icon" style={{ padding: '.3rem' }}>
            <Edit3 size={13} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onToggleVisible}
            title={cat.is_visible ? 'Hide from public gallery landing' : 'Show on public gallery landing'}
            style={{ padding: '.3rem', color: cat.is_visible ? 'var(--accent)' : 'var(--text-tertiary)' }}
          >
            {cat.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onDelete}
            disabled={photoCount > 0}
            title={photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'} use this category — remove tag from those photos first` : 'Delete category'}
            style={{ padding: '.3rem', color: photoCount > 0 ? 'var(--text-tertiary)' : 'var(--status-danger)' }}
          >
            <Trash2 size={13} />
          </button>
        </>
      )}
    </div>
  );
}

// Cover picker — shows all photos tagged with this category in a grid,
// click to set as cover. Restricted to in-category photos so the cover
// always represents work that's actually filed under that category.
function CoverPickerModal({ categoryName, photos, currentCoverUrl, onClose, onPick }) {
  if (!photos) photos = [];
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ margin: 0 }}>Pick cover for &quot;{categoryName}&quot;</h3>
            <p style={{ margin: '.2rem 0 0', fontSize: '.78rem', color: 'var(--text-secondary)' }}>
              Choose any photo tagged with this category.
            </p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </header>
        <div style={{ padding: '1rem 1.5rem', overflow: 'auto', flex: 1 }}>
          {photos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
              <p>No photos have this category yet. Tag some photos and come back.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '.6rem' }}>
              {photos.map(p => {
                const isCurrent = p.image_url === currentCoverUrl;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPick(p)}
                    title={p.title}
                    style={{
                      position: 'relative',
                      padding: 0,
                      cursor: 'pointer',
                      border: '3px solid ' + (isCurrent ? '#fbbf24' : 'transparent'),
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--bg-subtle)',
                      aspectRatio: '4/3',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image_url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {isCurrent && (
                      <span style={{ position: 'absolute', top: '.3rem', right: '.3rem', background: '#fbbf24', color: '#3a2a05', padding: '.15rem .4rem', borderRadius: 'var(--radius-sm)', fontSize: '.65rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '.2rem' }}>
                        <Crown size={10} style={{ fill: '#3a2a05' }} /> COVER
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
