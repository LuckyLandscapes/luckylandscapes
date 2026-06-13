#!/usr/bin/env node
// Downloads every file from every Supabase Storage bucket in the project.
// Zero deps — uses Node 20+ native fetch.
//
// Usage: node backup-storage.mjs <output-dir>
// Env:   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (anon key won't see all files due to RLS)

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!outDir || !baseUrl || !key) {
  console.error('Usage: backup-storage.mjs <output-dir>');
  console.error('Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function api(path, init = {}) {
  const res = await fetch(`${baseUrl}/storage/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${res.statusText}${body ? ` :: ${body.slice(0, 200)}` : ''}`);
  }
  return res;
}

async function listBuckets() {
  const res = await api('/bucket');
  return res.json();
}

async function listObjectsRecursive(bucket, prefix = '') {
  const all = [];
  const limit = 1000;
  let offset = 0;
  for (;;) {
    const res = await api(`/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders return id === null with no metadata; recurse into them.
      if (item.id === null || item.id === undefined) {
        const nested = await listObjectsRecursive(bucket, path);
        all.push(...nested);
      } else {
        all.push(path);
      }
    }

    if (items.length < limit) break;
    offset += limit;
  }t
  return all;
}

async function downloadObject(bucket, path, dest) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const res = await api(`/object/${encodeURIComponent(bucket)}/${encodedPath}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

const buckets = await listBuckets();
console.log(`Found ${buckets.length} bucket(s)`);

let totalFiles = 0;
let totalBytes = 0;
const failed = [];

for (const bucket of buckets) {
  console.log(`\nBucket: ${bucket.name} (public=${bucket.public})`);
  const paths = await listObjectsRecursive(bucket.name);
  console.log(`  ${paths.length} file(s)`);

  for (const path of paths) {
    const dest = join(outDir, bucket.name, path);
    try {
      const size = await downloadObject(bucket.name, path, dest);
      totalBytes += size;
      totalFiles += 1;
    } catch (e) {
      failed.push(`${bucket.name}/${path}: ${e.message}`);
    }
  }
}

console.log(`\nTotal: ${totalFiles} file(s), ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

if (failed.length > 0) {
  console.warn(`\nFailed downloads: ${failed.length}`);
  for (const line of failed.slice(0, 20)) console.warn(`  ${line}`);
  if (failed.length > 20) console.warn(`  ... and ${failed.length - 20} more`);
  process.exit(2);
}
