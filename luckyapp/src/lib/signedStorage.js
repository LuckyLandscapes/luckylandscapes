// Signed-URL resolver for private Supabase Storage buckets.
//
// Background: several buckets that hold sensitive data (contractor W-9 images
// with full SSNs, customer property photos, signed contract PDFs) were created
// PUBLIC, so anyone with the object URL could read them. Migration
// 047_private_storage_buckets.sql flips them private + adds org-scoped policies.
//
// Once a bucket is private, the stored public URL stops working — reads must go
// through a short-lived SIGNED url. This helper resolves a stored URL to a
// signed url when it points at one of the private buckets, and otherwise returns
// the url unchanged. It is SAFE to call on every stored url because:
//   • createSignedUrl works on public buckets too, so this is correct even
//     BEFORE the migration flips the bucket private (no breakage window);
//   • it falls back to the original url on any error or for public/external
//     urls (materials, marketing-gallery, off-site images).
//
// Authenticated dashboard surfaces call this directly (the org-scoped SELECT
// policy lets a member mint signed urls for their own org's objects). Public
// token pages CANNOT mint client-side once private — their server route (which
// validates the token and uses the service-role client) must mint the signed
// url instead (see the public contract route).

import { supabase } from './supabase';

// Buckets that migration 047 makes private. materials + marketing-gallery stay
// public on purpose (catalog photos + the marketing portfolio are shown to
// anonymous visitors), so they are intentionally NOT in this set.
export const PRIVATE_BUCKETS = new Set([
  'receipts',
  'quote-media',
  'contract-pdfs',
  'quote-pdfs',
  'job-media',
]);

// Pull { bucket, path } out of a Supabase Storage object URL (public OR signed form).
export function parseStorageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/([^?]+)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

// Resolve a stored URL to a signed URL for private buckets; otherwise return it
// unchanged. Never throws — returns the original url on any failure.
export async function resolveStorageUrl(url, expiresIn = 3600) {
  const parsed = parseStorageUrl(url);
  if (!parsed || !supabase) return url;
  if (!PRIVATE_BUCKETS.has(parsed.bucket)) return url;
  try {
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, expiresIn);
    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
}

// Batch variant — resolves many urls at once, preserving order. Falls back to
// the original url per-item on failure.
export async function resolveStorageUrls(urls, expiresIn = 3600) {
  return Promise.all((urls || []).map((u) => resolveStorageUrl(u, expiresIn)));
}
