// Auto-dunning cron: runs daily, sends a reminder for any invoice that is
//   - unpaid (status: unpaid / overdue / partial) with a positive balance
//   - 14+ days past due
//   - has not been reminded in the last 7 days (or never)
//
// Triggered by Vercel Cron via vercel.json. Secured with CRON_SECRET when set
// (Vercel auto-injects an Authorization header that matches).

import { NextResponse } from 'next/server';
import { getServiceSupabase, getAppOrigin } from '@/lib/stripeServer';
import { sendInvoiceReminder, computeDaysOver } from '@/lib/invoiceReminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_DAYS_OVERDUE = 14;          // first reminder threshold
const MIN_DAYS_BETWEEN_REMINDERS = 7; // don't spam

export async function GET(request) {
  // Auth — Vercel sends `Authorization: Bearer <CRON_SECRET>` if set in env.
  // If the env var isn't set we accept unauthenticated requests so dev / manual
  // smoke-testing still works.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const origin = getAppOrigin(request);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - MIN_DAYS_BETWEEN_REMINDERS * 24 * 60 * 60 * 1000).toISOString();

  // Pull all candidates. RLS-bypassed via service role; org boundary is preserved
  // because each invoice carries its own org_id and we never cross-mutate.
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, status, total, amount_paid, due_date, created_at, last_reminder_at, reminder_count')
    .in('status', ['unpaid', 'overdue', 'partial']);
  if (error) {
    console.error('[auto-dunning] query failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = {
    checkedAt: now.toISOString(),
    candidates: invoices?.length || 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const inv of invoices || []) {
    const balance = Math.max(0, Number(inv.total || 0) - Number(inv.amount_paid || 0));
    if (balance <= 0) {
      summary.skipped++;
      continue;
    }
    const daysOver = computeDaysOver(inv, now);
    if (daysOver < MIN_DAYS_OVERDUE) {
      summary.skipped++;
      continue;
    }
    if (inv.last_reminder_at && inv.last_reminder_at > sevenDaysAgo) {
      summary.skipped++;
      summary.details.push({ id: inv.id, action: 'skip-recent-reminder', daysOver });
      continue;
    }

    const result = await sendInvoiceReminder({
      supabase,
      invoiceId: inv.id,
      sentBy: null, // null = sent by automation, not a person
      origin,
    });

    if (result.ok) {
      summary.sent++;
      summary.details.push({ id: inv.id, action: 'sent', tone: result.tone, daysOver: result.daysOver });
    } else if (result.skip) {
      summary.skipped++;
      summary.details.push({ id: inv.id, action: 'skip', reason: result.error });
    } else {
      summary.failed++;
      summary.details.push({ id: inv.id, action: 'fail', error: result.error });
    }
  }

  console.log('[auto-dunning] run complete', summary);
  return NextResponse.json(summary);
}
