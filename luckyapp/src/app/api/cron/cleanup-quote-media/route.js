// Quote-media cleanup cron: runs daily, removes site photos that are
// no longer needed.
//
// A photo is eligible when:
//   • not pinned
//   • the customer has no quote in (draft / sent / viewed) status
//   • the customer has no accepted quote whose linked job is still
//     scheduled or in_progress
//   • the customer's most recent settle event (declined_at, job
//     completed_at, deposit_paid_at, or quote.created_at) is 30+
//     days old
//
// The SQL function `cleanup_old_quote_media()` (migration 021) does
// the eligibility check and DB deletion atomically; this route then
// removes the corresponding objects from the `quote-media` storage
// bucket. Triggered by Vercel Cron via vercel.json. Authorized with
// CRON_SECRET (Vercel auto-injects matching Authorization header).

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORAGE_DELETE_BATCH = 100; // Supabase storage remove() takes an array

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
  }

  // 1. Run the SQL function — deletes eligible rows and returns the
  //    file_paths so we can clean up the storage objects.
  const { data: deleted, error } = await supabase.rpc('cleanup_old_quote_media');
  if (error) {
    console.error('[cleanup-quote-media] RPC failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const paths = (deleted || []).map(r => r.file_path).filter(Boolean);
  const summary = {
    checkedAt: new Date().toISOString(),
    rowsDeleted: deleted?.length || 0,
    storageRemoved: 0,
    storageErrors: 0,
  };

  // 2. Remove storage objects in batches.
  for (let i = 0; i < paths.length; i += STORAGE_DELETE_BATCH) {
    const batch = paths.slice(i, i + STORAGE_DELETE_BATCH);
    const { data: removed, error: rmErr } = await supabase.storage
      .from('quote-media')
      .remove(batch);
    if (rmErr) {
      console.error('[cleanup-quote-media] storage remove failed', rmErr);
      summary.storageErrors += batch.length;
    } else {
      summary.storageRemoved += removed?.length || 0;
    }
  }

  console.log('[cleanup-quote-media] run complete', summary);
  return NextResponse.json(summary);
}
