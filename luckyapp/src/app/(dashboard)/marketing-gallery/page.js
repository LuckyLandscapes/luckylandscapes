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
  ExternalLink, ImagePlus, Tag, RefreshCw, Globe, Sparkles,
  Star, Crown, Download, GripVertical, FolderOpen, Image as ImageIcon,
} from 'lucide-react';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, closestCenter, pointerWithin, rectIntersection,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove,
  sortableKeyboardCoordinates, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Gemini model options offered in the upload-modal AI picker. Keep in sync
// with the server-side GEMINI_ALLOWED set in /api/marketing/gallery/suggest.
// Order = how they appear in the dropdown. Cheapest first.
const GEMINI_MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-lite',   label: 'Flash Lite (cheapest)',   hint: '$0.25 / $1.50 per MTok · fast, accurate enough for captions' },
  { id: 'gemini-3-flash-preview',  label: 'Flash (smarter)',         hint: '$0.50 / $3.00 per MTok · better writing quality' },
  { id: 'gemini-3.1-pro-preview',  label: 'Pro (SOTA)',              hint: '$2.00 / $12.00 per MTok · best, slowest, ~$0.005/photo' },
];
const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_MODEL_STORAGE_KEY = 'lucky_gallery_ai_model';

function readPreferredModel() {
  if (typeof window === 'undefined') return GEMINI_DEFAULT_MODEL;
  try {
    const v = window.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
    if (v && GEMINI_MODEL_OPTIONS.some(o => o.id === v)) return v;
  } catch { /* SSR / private mode */ }
  return GEMINI_DEFAULT_MODEL;
}

function writePreferredModel(id) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, id); } catch { /* ignore */ }
}

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
// can hide the auto-fill button) or throws for any other failure. Pass the
// user's preferred model so the server runs the right tier (Flash Lite by
// default, Pro / Flash on opt-in).
async function fetchAiSuggestion(file, model) {
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
    body: JSON.stringify({ imageBase64: base64, model: model || undefined }),
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

// Query the current max sort_order for this org so new uploads append to
// the bottom of the manage list (and the public site) instead of getting
// the default 0 and burying themselves above existing entries.
async function fetchMaxSortOrder(orgId) {
  const { data } = await supabase
    .from('marketing_gallery')
    .select('sort_order')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.sort_order ?? -10;  // so first upload lands at 0
}

// Group photos into sections for the manage UI. Each unique project_name
// becomes one section; photos with no project_name go into the final
// 'ungrouped' section so they never disappear. Sections are auto-ordered
// by the lowest sort_order of any item they contain (so dragging an item
// into a section also brings the section to the corresponding position),
// with ungrouped always last.
//
// Within each section, items are sorted by sort_order ASC. This is the
// in-section display order AND the order the public site uses for the
// lightbox carousel.
function groupItemsIntoSections(items) {
  const map = new Map();      // project_name → items[]
  const ungrouped = [];
  for (const it of items) {
    const name = (it.project_name || '').trim();
    if (name) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(it);
    } else {
      ungrouped.push(it);
    }
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }
  ungrouped.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const projectSections = Array.from(map.entries()).map(([name, sectionItems]) => ({
    id: `section:${name}`,
    name,
    isUngrouped: false,
    items: sectionItems,
    minSort: sectionItems.length ? (sectionItems[0].sort_order ?? 0) : Number.MAX_SAFE_INTEGER,
  }));
  projectSections.sort((a, b) => a.minSort - b.minSort);

  // Ungrouped always last, even when empty (renders as a drop zone so
  // dragging a photo out of a project has somewhere to land).
  projectSections.push({
    id: 'ungrouped',
    name: 'Ungrouped Photos',
    isUngrouped: true,
    items: ungrouped,
    minSort: Number.MAX_SAFE_INTEGER,
  });
  return projectSections;
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

  const handleToggleFeatured = async (item) => {
    const next = !item.is_featured;
    const { error } = await supabase
      .from('marketing_gallery')
      .update({ is_featured: next, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) { alert('Update failed: ' + error.message); return; }
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, is_featured: next } : x));
  };

  const [importing, setImporting] = useState(false);
  const handleImportLegacy = async () => {
    const ok = confirm(
      'Import the hardcoded legacy portfolio?\n\n' +
      'This re-uploads all the original gallery photos from luckylandscapes.com into your Marketing Gallery. Multi-photo projects collapse into one card on the public site (via project_name); the first photo of each becomes the cover. ' +
      'Idempotent — safe to run multiple times (existing entries are skipped). ' +
      'No duplicates with the static fallback — the public site now uses remote-replaces-static.'
    );
    if (!ok) return;
    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not signed in.');
      const res = await fetch('/api/marketing/gallery/import-legacy', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Import failed: ' + (data?.error || res.status));
        return;
      }
      const { summary, failed = [] } = data || {};
      let msg = `Imported ${summary?.imported || 0} photos · skipped ${summary?.skipped || 0} (already there) · failed ${summary?.failed || 0}`;
      if (failed.length) {
        msg += '\n\nFailures:\n' + failed.slice(0, 5).map(f => `  • ${f.title}: ${f.error}`).join('\n');
      }
      alert(msg);
      await loadItems();
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Persist a new global photo ordering — figures out which rows actually
  // changed (sort_order or project_name) and updates only those. Optimistic:
  // local state is already updated by the caller; this just syncs the DB.
  // Replaces the old swap-with-neighbor logic that was broken whenever rows
  // shared sort_order (which was every row before migration 042 renumbered).
  const persistReorder = async (newOrderedItems, opts = {}) => {
    if (!newOrderedItems?.length) return;
    const beforeById = new Map(items.map(x => [x.id, x]));
    const updates = [];
    newOrderedItems.forEach((it, idx) => {
      const before = beforeById.get(it.id);
      const desiredSort = idx * 10;
      const desiredProjectName = it.project_name || null;
      const desiredIsCover = !!it.is_cover;
      const changed = !before
        || before.sort_order !== desiredSort
        || (before.project_name || null) !== desiredProjectName
        || !!before.is_cover !== desiredIsCover;
      if (changed) {
        updates.push({
          id: it.id,
          sort_order: desiredSort,
          project_name: desiredProjectName,
          is_cover: desiredIsCover,
        });
      }
    });
    if (updates.length === 0) return;
    // Optimistic local state update so the UI doesn't flicker waiting on the
    // round trip. We trust the renumbering above; if the DB rejects (RLS,
    // unique-index conflict), loadItems() pulls truth back.
    setItems(newOrderedItems.map((it, idx) => ({
      ...it,
      sort_order: idx * 10,
      project_name: it.project_name || null,
      is_cover: !!it.is_cover,
    })));
    // Two-phase persistence to satisfy the partial unique index
    // idx_marketing_gallery_one_cover_per_project. Without ordering, a
    // parallel set of updates could briefly leave two rows matching
    // (org_id, project_name) WHERE is_cover=true and fail one of them.
    // Phase 1 clears covers (and applies any unrelated reorder changes);
    // phase 2 sets covers, by which point no other cover exists for that
    // project. Both phases run in parallel within themselves.
    const stamp = new Date().toISOString();
    const buildUpdate = (u) => supabase
      .from('marketing_gallery')
      .update({
        sort_order: u.sort_order,
        project_name: u.project_name,
        is_cover: u.is_cover,
        updated_at: stamp,
      })
      .eq('id', u.id);
    const phase1 = updates.filter(u => !u.is_cover);
    const phase2 = updates.filter(u => u.is_cover);
    const r1 = await Promise.allSettled(phase1.map(buildUpdate));
    const r2 = await Promise.allSettled(phase2.map(buildUpdate));
    const results = [...r1, ...r2];
    const failed = results.filter(r => r.status === 'rejected' || r.value?.error);
    if (failed.length) {
      console.error('[marketing-gallery] reorder persistence failed', failed);
      if (!opts.silentFailure) alert(`Reorder partially failed (${failed.length} of ${updates.length} updates). Reloading…`);
      await loadItems();
    }
  };

  // Set one photo as the cover for its project. The DB has a partial unique
  // index that allows only one cover per (org_id, project_name), so we
  // explicitly clear the old cover first, then set the new one. Standalone
  // photos (no project_name) ignore this — they're their own card.
  const handleSetCover = async (item) => {
    if (!item.project_name) return;  // no-op for ungrouped photos
    const siblings = items.filter(x =>
      x.project_name === item.project_name && x.id !== item.id && x.is_cover
    );
    // Optimistic local update
    setItems(prev => prev.map(x => {
      if (x.id === item.id) return { ...x, is_cover: true };
      if (x.project_name === item.project_name && x.is_cover) return { ...x, is_cover: false };
      return x;
    }));
    // Clear other covers first (matters when index conflict could fire),
    // then set the new one.
    if (siblings.length) {
      const { error: clearErr } = await supabase
        .from('marketing_gallery')
        .update({ is_cover: false, updated_at: new Date().toISOString() })
        .in('id', siblings.map(s => s.id));
      if (clearErr) { alert('Cover update failed: ' + clearErr.message); await loadItems(); return; }
    }
    const { error } = await supabase
      .from('marketing_gallery')
      .update({ is_cover: true, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) { alert('Cover update failed: ' + error.message); await loadItems(); }
  };

  // Move an entire project section up or down in the global display order.
  // Implementation: swap two adjacent sections' positions in the section list,
  // then renumber every photo's sort_order across the new flat list. Cheap
  // enough at our scale (<100 photos total) and guarantees the order sticks.
  const handleMoveSection = (sectionId, direction) => {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    const newSections = sections.slice();
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    const flat = newSections.flatMap(s => s.items);
    persistReorder(flat);
  };

  const filtered = useMemo(() => {
    if (!filterTag) return items;
    return items.filter(x => Array.isArray(x.tags) && x.tags.includes(filterTag));
  }, [items, filterTag]);

  // Group items into sections for the manage UI. Sections are auto-ordered
  // by the minimum sort_order of their items — so dragging a photo within
  // section A to a lower sort_order also brings A's section up in the list
  // (the inverse of the section-reorder buttons, which directly swap two
  // sections). Ungrouped photos always render in a final section so they
  // don't visually disappear.
  const sections = useMemo(() => groupItemsIntoSections(filtered), [filtered]);
  const itemToSection = useMemo(() => {
    const m = new Map();
    sections.forEach(s => s.items.forEach(it => m.set(it.id, s.id)));
    return m;
  }, [sections]);

  // ============================================================
  // Drag-and-drop wiring (replaces the broken Up/Down arrows).
  // ============================================================
  // Touch sensor with a 200ms delay so taps on buttons aren't misread as
  // drag-starts on Riley's phone. Pointer for mouse, Keyboard for a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeDragId, setActiveDragId] = useState(null);
  // Snapshot of the dragged item's state at drag-start. Needed because
  // handleDragOver mutates items mid-drag (cross-section moves clear
  // is_cover), so by handleDragEnd we've lost the original project_name +
  // cover info needed to auto-promote a replacement cover.
  const [dragStartSnapshot, setDragStartSnapshot] = useState(null);
  const activeDragItem = activeDragId ? items.find(x => x.id === activeDragId) : null;
  // Custom collision detection: prefer photo collisions over section
  // collisions so dragging a photo over another photo doesn't fall through
  // to the section's empty space. Falls back to closest section header
  // when the drag isn't directly over a photo (drop on empty section).
  const collisionDetectionStrategy = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length) {
      const photoHit = pointerCollisions.find(c => !String(c.id).startsWith('section:'));
      if (photoHit) return [photoHit];
      return pointerCollisions;
    }
    // No pointer hit — use bounding-rect intersection as fallback.
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length) return rectCollisions;
    // Last resort — nearest center across sortable items.
    return closestCenter(args);
  };

  const containerIdForOverId = (id) => {
    if (id == null) return null;
    if (typeof id === 'string' && id.startsWith('section:')) return id;
    return itemToSection.get(id) || null;
  };

  // Live cross-section move: as the user drags a photo across into a different
  // section, splice it into that section's items in local state. Sort order
  // and DB persistence wait until drop (handleDragEnd). This keeps the
  // dragged element under the cursor instead of snapping back when it
  // crosses a section boundary.
  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    const activeContainer = containerIdForOverId(active.id);
    const overContainer = containerIdForOverId(over.id);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    setItems(prev => {
      const activeItem = prev.find(x => x.id === active.id);
      if (!activeItem) return prev;
      const targetProjectName = overContainer === 'ungrouped'
        ? null
        : overContainer.slice('section:'.length);
      // Update the item's project_name and (if leaving a project) clear its
      // cover flag. The over-target's existing cover stays put.
      const wasCover = !!activeItem.is_cover && (activeItem.project_name || null) !== targetProjectName;
      return prev.map(x => x.id === active.id
        ? { ...x, project_name: targetProjectName, is_cover: wasCover ? false : x.is_cover }
        : x);
    });
  };

  const handleDragStart = ({ active }) => {
    setActiveDragId(active.id);
    const it = items.find(x => x.id === active.id);
    if (it) {
      setDragStartSnapshot({
        id: it.id,
        projectName: it.project_name || null,
        wasCover: !!it.is_cover,
      });
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setDragStartSnapshot(null);
  };

  const handleDragEnd = async ({ active, over }) => {
    const snapshot = dragStartSnapshot;
    setActiveDragId(null);
    setDragStartSnapshot(null);
    if (!over) return;
    const activeContainer = containerIdForOverId(active.id);
    const overContainer = containerIdForOverId(over.id);
    if (!activeContainer || !overContainer) return;

    // Recompute the full ordered item list given the drop position.
    let newItems = items.slice();
    if (activeContainer === overContainer) {
      // Within-section reorder: drop on another photo in the same section.
      if (active.id === over.id) return;
      const sec = sections.find(s => s.id === activeContainer);
      if (!sec) return;
      const oldIdx = sec.items.findIndex(it => it.id === active.id);
      const newIdx = sec.items.findIndex(it => it.id === over.id);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const newSecItems = arrayMove(sec.items, oldIdx, newIdx);
      // Reassemble global order using the updated section
      const newSections = sections.map(s => s.id === sec.id ? { ...s, items: newSecItems } : s);
      newItems = newSections.flatMap(s => s.items);
    } else {
      // Cross-section drop: handleDragOver already moved the item into the
      // new container in local state. Now we need to position it at the
      // drop point (over a specific photo) or at end (over the section).
      const movedItem = items.find(x => x.id === active.id);
      if (!movedItem) return;
      // Build the new sections from current items state, then place the
      // moved item correctly within the over-section.
      const intermediate = groupItemsIntoSections(items);
      const targetSec = intermediate.find(s => s.id === overContainer);
      if (!targetSec) return;
      // Remove from wherever it currently sits and reinsert at drop position.
      const without = targetSec.items.filter(it => it.id !== active.id);
      let insertAt = without.length;  // default: end
      if (!String(over.id).startsWith('section:')) {
        const overIdx = without.findIndex(it => it.id === over.id);
        if (overIdx >= 0) insertAt = overIdx;
      }
      const newTargetItems = [...without.slice(0, insertAt), movedItem, ...without.slice(insertAt)];
      const newSections = intermediate.map(s => s.id === targetSec.id ? { ...s, items: newTargetItems } : s);
      newItems = newSections.flatMap(s => s.items);
    }

    // If the drop moved a cover photo out of its project, auto-promote the
    // first remaining photo in the source project as the new cover (so we
    // don't leave a project with no cover). Uses the drag-start snapshot
    // because handleDragOver already mutated items.is_cover to false when
    // the drag crossed the section boundary — we'd lose the original cover
    // info otherwise. The partial unique index permits a coverless project
    // (it's a `WHERE is_cover=true` upper bound), but UX-wise every project
    // should have one so the public site has a card thumbnail.
    if (snapshot?.wasCover && snapshot.projectName) {
      const movedItemNow = newItems.find(x => x.id === active.id);
      const nowIn = movedItemNow?.project_name || null;
      if (nowIn !== snapshot.projectName) {
        const orphans = newItems.filter(x => (x.project_name || null) === snapshot.projectName);
        if (orphans.length && !orphans.some(o => o.is_cover)) {
          newItems = newItems.map(x => x.id === orphans[0].id ? { ...x, is_cover: true } : x);
        }
      }
    }

    await persistReorder(newItems);
  };

  const publishedCount = items.filter(x => x.is_published).length;
  const featuredCount = items.filter(x => x.is_featured && x.is_published).length;

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
          <button
            className="btn btn-ghost"
            onClick={handleImportLegacy}
            disabled={importing}
            title="One-time import of the hardcoded legacy portfolio (idempotent — safe to re-run)"
          >
            {importing ? <><Loader2 size={16} className="spin" /> Importing…</> : <><Download size={16} /> Import legacy</>}
          </button>
          <button className="btn btn-ghost" onClick={loadItems} title="Reload">
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
            <Upload size={16} /> Upload Photos
          </button>
        </div>
      </header>

      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '.88rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            <strong>{publishedCount}</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>published</span>
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span>
            <strong>{items.length - publishedCount}</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>drafts</span>
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem' }} title="Featured photos appear in the 'Featured Work' section on the homepage">
            <Star size={13} style={{ color: '#fbbf24', fill: featuredCount > 0 ? '#fbbf24' : 'none' }} />
            <strong>{featuredCount}</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>featured on homepage</span>
          </span>
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
        <>
          <div style={{ fontSize: '.78rem', color: 'var(--text-tertiary)', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <GripVertical size={13} />
            Drag photos to reorder within a project, or drop into another project section to move them. Tap ★ to set a photo as the project cover.
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {sections.map((section, sIdx) => (
              <ProjectSection
                key={section.id}
                section={section}
                sectionIdx={sIdx}
                totalSections={sections.length}
                onMoveSectionUp={() => handleMoveSection(section.id, 'up')}
                onMoveSectionDown={() => handleMoveSection(section.id, 'down')}
                onEdit={(item) => setEditingId(item.id)}
                onDelete={handleDelete}
                onTogglePublish={handleTogglePublish}
                onToggleFeatured={handleToggleFeatured}
                onSetCover={handleSetCover}
              />
            ))}
            <DragOverlay dropAnimation={null}>
              {activeDragItem ? (
                <PhotoCardChrome item={activeDragItem} isDragging />
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
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

// One project section — a header (with move-up/down arrows for the section)
// plus a SortableContext containing the photo cards in that project. Empty
// sections render a "drop here" placeholder so dragging a photo out of a
// project still has a target. The section's container is itself droppable
// so drops on whitespace land in the right section.
function ProjectSection({
  section, sectionIdx, totalSections,
  onMoveSectionUp, onMoveSectionDown,
  onEdit, onDelete, onTogglePublish, onToggleFeatured, onSetCover,
}) {
  const itemIds = section.items.map(it => it.id);
  // The container itself is a droppable so empty sections accept drops and
  // gaps within a section route to the right place.
  const { setNodeRef, isOver } = useDroppable({ id: section.id });
  // 'ungrouped' has no section-reorder arrows; it's always the last group.
  const showSectionArrows = !section.isUngrouped && section.items.length > 0;
  return (
    <div
      className="card"
      style={{
        marginBottom: '1.25rem',
        padding: 0,
        overflow: 'hidden',
        border: section.isUngrouped ? '1px dashed var(--border)' : '1px solid var(--border)',
      }}
    >
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: '.6rem',
          padding: '.7rem 1rem',
          borderBottom: section.items.length ? '1px solid var(--border)' : 'none',
          background: section.isUngrouped ? 'transparent' : 'var(--bg-elevated)',
        }}
      >
        {section.isUngrouped
          ? <ImageIcon size={17} style={{ color: 'var(--text-tertiary)' }} />
          : <FolderOpen size={17} style={{ color: 'var(--accent)' }} />
        }
        <h3 style={{ margin: 0, fontSize: '.98rem', fontWeight: 600 }}>
          {section.name}
        </h3>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '.82rem' }}>
          · {section.items.length} {section.items.length === 1 ? 'photo' : 'photos'}
        </span>
        {showSectionArrows && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '.25rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onMoveSectionUp}
              disabled={sectionIdx === 0}
              title="Move this project up in the website's display order"
              style={{ padding: '.3rem .55rem' }}
            >
              ↑ Move up
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onMoveSectionDown}
              // -2 because the last section is always Ungrouped, which we
              // don't reorder against — moving down past the last project
              // section is a no-op.
              disabled={sectionIdx >= totalSections - 2}
              title="Move this project down in the website's display order"
              style={{ padding: '.3rem .55rem' }}
            >
              ↓ Move down
            </button>
          </div>
        )}
      </header>
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{
            padding: section.items.length ? '1rem' : '0',
            background: isOver ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
            transition: 'background .12s ease',
            display: 'grid',
            gridTemplateColumns: section.items.length
              ? 'repeat(auto-fill, minmax(220px, 1fr))'
              : '1fr',
            gap: '1rem',
            minHeight: section.items.length ? undefined : 0,
          }}
        >
          {section.items.length === 0 ? (
            <div
              style={{
                margin: '1rem',
                padding: '1.5rem',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '.82rem',
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                background: isOver ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-subtle)',
              }}
            >
              {section.isUngrouped
                ? 'Drop a photo here to remove it from its project.'
                : `Drop a photo here to move it into "${section.name}".`}
            </div>
          ) : (
            section.items.map(item => (
              <SortablePhotoCard
                key={item.id}
                item={item}
                isInProject={!section.isUngrouped}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
                onTogglePublish={() => onTogglePublish(item)}
                onToggleFeatured={() => onToggleFeatured(item)}
                onSetCover={() => onSetCover(item)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Sortable wrapper around the visual card. The drag handle is on the
// GripVertical button only, so clicks on Edit/Delete/Cover/etc. don't get
// hijacked as drag-start events. On touch devices the TouchSensor needs a
// long-press anywhere on the card; the visible grip just signals draggability.
function SortablePhotoCard({ item, isInProject, onEdit, onDelete, onTogglePublish, onToggleFeatured, onSetCover }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <PhotoCardChrome
        item={item}
        isInProject={isInProject}
        dragAttributes={attributes}
        dragListeners={listeners}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePublish={onTogglePublish}
        onToggleFeatured={onToggleFeatured}
        onSetCover={onSetCover}
      />
    </div>
  );
}

// Pure visual card — used both inline (wrapped by SortablePhotoCard) and as
// the floating preview in the DragOverlay during a drag. Splitting visuals
// from the dnd-kit wiring keeps the overlay matching the live card exactly.
function PhotoCardChrome({
  item, isInProject, isDragging,
  dragAttributes, dragListeners,
  onEdit, onDelete, onTogglePublish, onToggleFeatured, onSetCover,
}) {
  return (
    <div
      className="card"
      style={{
        overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative',
        border: item.is_cover ? '2px solid #fbbf24'
              : item.is_featured ? '2px solid #fbbf24'
              : undefined,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.25)' : undefined,
        cursor: isDragging ? 'grabbing' : undefined,
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--bg-subtle)' }}>
        <img
          src={item.image_url}
          alt={item.title}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          draggable={false}
        />
        {/* Drag handle pinned to the top-left so it's always reachable.
            Listeners are attached only here so taps on the body don't drag.
            Pointer-events: none on the icon so the button (not the SVG)
            receives the drag-start. */}
        <button
          type="button"
          {...(dragAttributes || {})}
          {...(dragListeners || {})}
          aria-label="Drag to reorder"
          title="Drag to reorder (or drop into another project)"
          style={{
            position: 'absolute', top: '.4rem', left: '.4rem',
            background: 'rgba(0,0,0,.55)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-sm)',
            padding: '.3rem', cursor: 'grab', display: 'inline-flex',
            touchAction: 'none',
          }}
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={14} style={{ pointerEvents: 'none' }} />
        </button>
        {!item.is_published && (
          <div style={{ position: 'absolute', top: '.4rem', left: '2.4rem', background: 'rgba(0,0,0,.7)', color: 'white', padding: '.2rem .55rem', borderRadius: 'var(--radius-sm)', fontSize: '.68rem', fontWeight: 600 }}>
            DRAFT
          </div>
        )}
        {item.is_cover && isInProject && (
          <div style={{ position: 'absolute', top: '.4rem', right: '.4rem', background: '#fbbf24', color: '#3a2a05', padding: '.2rem .55rem', borderRadius: 'var(--radius-sm)', fontSize: '.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '.2rem' }}>
            <Crown size={11} style={{ fill: '#3a2a05' }} /> COVER
          </div>
        )}
        {item.before_image_url && !item.is_cover && (
          <div style={{ position: 'absolute', top: '.4rem', right: '.4rem', background: 'var(--accent)', color: 'white', padding: '.2rem .55rem', borderRadius: 'var(--radius-sm)', fontSize: '.68rem', fontWeight: 600 }}>
            B/A
          </div>
        )}
        {item.is_featured && (
          <div style={{ position: 'absolute', bottom: '.4rem', left: '.4rem', background: '#fbbf24', color: '#3a2a05', padding: '.2rem .5rem', borderRadius: 'var(--radius-sm)', fontSize: '.66rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '.2rem' }}>
            <Star size={10} style={{ fill: '#3a2a05' }} /> Homepage
          </div>
        )}
      </div>
      <div style={{ padding: '.7rem .85rem .85rem', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
        <h4 style={{ margin: 0, fontSize: '.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </h4>
        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.2rem' }}>
            {item.tags.slice(0, 4).map(t => (
              <span key={t} style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', padding: '.1rem .45rem', borderRadius: 'var(--radius-full)', fontSize: '.65rem', fontWeight: 500 }}>
                {t}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '.2rem', marginTop: '.15rem', flexWrap: 'wrap' }}>
          {/* ★ Cover button — only meaningful for grouped projects; for
              ungrouped photos we hide it (each is already its own card). */}
          {isInProject && onSetCover && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={onSetCover}
              disabled={item.is_cover}
              title={item.is_cover ? 'Already the project cover' : 'Make this the project cover on the website'}
              style={{ color: item.is_cover ? '#fbbf24' : undefined, padding: '.35rem .45rem' }}
            >
              <Crown size={13} style={item.is_cover ? { fill: '#fbbf24' } : {}} />
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={onToggleFeatured}
            title={item.is_featured ? 'Remove from homepage Featured Work' : 'Add to homepage Featured Work'}
            style={{ color: item.is_featured ? '#fbbf24' : undefined, padding: '.35rem .45rem' }}
          >
            <Star size={13} style={item.is_featured ? { fill: '#fbbf24' } : {}} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onTogglePublish} title={item.is_published ? 'Hide from site' : 'Publish to site'} style={{ padding: '.35rem .45rem' }}>
            {item.is_published ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit metadata" style={{ padding: '.35rem .45rem' }}>
            <Edit3 size={13} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onDelete} title="Delete" style={{ marginLeft: 'auto', color: 'var(--status-danger)', padding: '.35rem .45rem' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Read the list of project_names already in this org. Powers the autocomplete
// datalist in the upload modal — Riley sees "Maple St Wall" and "Smith Patio"
// as suggestions so he doesn't typo a new name and accidentally create a
// duplicate project. Returns deduped, sorted asc.
function useExistingProjectNames(orgId) {
  const [names, setNames] = useState([]);
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('marketing_gallery')
        .select('project_name')
        .eq('org_id', orgId)
        .not('project_name', 'is', null);
      if (cancelled || error) return;
      const unique = Array.from(new Set((data || []).map(r => r.project_name).filter(Boolean))).sort();
      setNames(unique);
    })();
    return () => { cancelled = true; };
  }, [orgId]);
  return names;
}

function UploadModal({ orgId, onClose, onUploaded }) {
  // Two-step wizard: first the user picks a category (the photo's primary
  // tag), then they drop photos for that category. Forcing the category
  // upfront keeps the per-row form simple — no 12-pill tag picker per file —
  // and guarantees every uploaded photo has at least one meaningful tag.
  const [category, setCategory] = useState(null);
  // Optional shared project name — when set, every photo uploaded in this
  // batch gets the same project_name and they group into ONE card on the
  // public site. Leave empty and each photo is its own card.
  const [projectName, setProjectName] = useState('');
  // Per-file form state. After picking files we generate one "pending"
  // entry per file with editable title/tags/description before uploading.
  const [pending, setPending] = useState([]); // { file, preview, title, description, tags, before, beforeFile, beforePreview, error, uploading, done, aiLoading }
  const fileInputRef = useRef(null);
  // null = not yet checked; true/false = result of last suggest call
  const [aiAvailable, setAiAvailable] = useState(null);
  const [bulkAiLoading, setBulkAiLoading] = useState(false);
  const [aiModel, setAiModel] = useState(() => readPreferredModel());
  const existingProjectNames = useExistingProjectNames(orgId);

  const handleModelChange = (id) => {
    setAiModel(id);
    writePreferredModel(id);
  };

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
      featured: false,
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
      const suggestion = await fetchAiSuggestion(p.file, aiModel);
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
          const suggestion = await fetchAiSuggestion(item.file, aiModel);
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

  // Per-batch counter so each uploaded photo gets a unique, increasing
  // sort_order (max + 10, +20, +30…). The counter is initialized once at
  // uploadAll start; passing 0 for direct single-photo uploads triggers a
  // fresh lookup. After migration 042, existing rows are spaced by 10, so
  // new uploads landing at max+10 always appear at the BOTTOM of the manage
  // grid (and the public site) — Riley then drags them where he wants.
  const uploadOne = async (i, presetSortOrder) => {
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
      const sortOrder = presetSortOrder ?? (await fetchMaxSortOrder(orgId) + 10);
      const main = await uploadGalleryImage(p.file, orgId);
      let before = null;
      if (p.before && p.beforeFile) {
        before = await uploadGalleryImage(p.beforeFile, orgId);
      }
      const trimmedProject = projectName.trim() || null;
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
        is_featured: !!p.featured,
        // First photo of a new multi-photo project becomes its cover.
        // For the first upload in a batch we know it's `i === 0`; for later
        // uploads we let Riley pick via the ★ Cover button after the fact.
        is_cover: !!trimmedProject && i === 0,
        project_name: trimmedProject,
        sort_order: sortOrder,
      });
      if (error) throw error;
      updateAt(i, { uploading: false, done: true });
    } catch (err) {
      console.error('[upload] failed', err);
      updateAt(i, { uploading: false, error: err.message || 'Upload failed.' });
    }
  };

  const uploadAll = async () => {
    // Query the current max once, then increment locally so all photos in
    // this batch get sequential sort_orders. Without this, every parallel
    // upload would query the same max and collide on the same value.
    const baseMax = await fetchMaxSortOrder(orgId);
    let next = baseMax + 10;
    for (let i = 0; i < pending.length; i++) {
      if (pending[i].done) continue;
      await uploadOne(i, next);
      next += 10;
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
              You&apos;ll be able to add more tags per photo after uploading.
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

        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Shared project name — applies to every photo uploaded in this
              batch. Empty = each photo is its own card on the public site.
              Filled = all photos group into one project card. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', background: 'var(--bg-elevated)', padding: '.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label htmlFor="upload-project-name" style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <ImagePlus size={13} style={{ color: 'var(--accent)' }} />
              Project name <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional — groups photos into one card on the website)</span>
            </label>
            <input
              id="upload-project-name"
              type="text"
              placeholder="e.g. Maple St Retaining Wall, Smith Backyard Patio"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              list="upload-project-name-suggestions"
              style={{ padding: '.5rem .7rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '.9rem', fontWeight: 500, background: 'var(--bg-base, var(--bg-subtle))' }}
            />
            <datalist id="upload-project-name-suggestions">
              {existingProjectNames.map(n => <option key={n} value={n} />)}
            </datalist>
            <p style={{ margin: 0, fontSize: '.7rem', color: 'var(--text-tertiary)' }}>
              {projectName.trim()
                ? `All ${pending.length || 'these'} photos will appear together under "${projectName.trim()}".`
                : 'Leave blank to upload each photo as its own card.'}
            </p>
          </div>

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
              {aiAvailable !== false && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', padding: '.6rem .75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.78rem', color: 'var(--text-secondary)', minWidth: 0 }}>
                    <Sparkles size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 600 }}>AI model:</span>
                    <select
                      value={aiModel}
                      onChange={e => handleModelChange(e.target.value)}
                      disabled={bulkAiLoading}
                      title={GEMINI_MODEL_OPTIONS.find(o => o.id === aiModel)?.hint || ''}
                      style={{ padding: '.25rem .4rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-base, var(--bg-subtle))', color: 'var(--text-primary)', fontSize: '.78rem', maxWidth: '220px' }}
                    >
                      {GEMINI_MODEL_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                  {pending.length > 1 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={runAiSuggestAll}
                      disabled={bulkAiLoading || pending.every(p => p.done || p.title)}
                      style={{ gap: '.35rem' }}
                    >
                      {bulkAiLoading ? (
                        <><Loader2 size={13} className="spin" /> Analyzing…</>
                      ) : (
                        <><Sparkles size={13} /> Auto-fill all</>
                      )}
                    </button>
                  )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '.85rem' }}>
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', cursor: 'pointer', color: pending.featured ? '#b45309' : 'inherit' }}
            title="Featured photos appear in the 'Featured Work' section on the homepage. Pick your best work."
          >
            <input
              type="checkbox"
              checked={!!pending.featured}
              onChange={e => onChange({ featured: e.target.checked })}
              disabled={pending.done || pending.uploading}
            />
            <Star size={14} style={pending.featured ? { fill: '#fbbf24', color: '#fbbf24' } : { color: 'var(--text-tertiary)' }} />
            Feature on homepage
          </label>
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
  const [projectName, setProjectName] = useState(item?.project_name || '');
  const [saving, setSaving] = useState(false);
  const existingProjectNames = useExistingProjectNames(item?.org_id);

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
        project_name: projectName.trim() || null,
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
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
            <span style={{ fontSize: '.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              Project <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(groups photos under one card on the website)</span>
            </span>
            <input
              type="text"
              placeholder="e.g. Maple St Retaining Wall — leave blank to keep as standalone photo"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              list="edit-project-name-suggestions"
              style={{ padding: '.6rem .8rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
            />
            <datalist id="edit-project-name-suggestions">
              {existingProjectNames.map(n => <option key={n} value={n} />)}
            </datalist>
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
