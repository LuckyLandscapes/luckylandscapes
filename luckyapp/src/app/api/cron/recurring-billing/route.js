import { NextResponse } from 'next/server';
import { getStripe, getServiceSupabase, getAppOrigin } from '@/lib/stripeServer';
import { runRecurringBilling } from '@/lib/recurringBillingRun';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual / on-demand trigger for the recurring-billing run.
//
// NOT on a Vercel schedule: the Hobby plan allows only 2 cron jobs and
// vercel.json already spends both (auto-dunning, cleanup-quote-media). Adding a
// third makes the whole DEPLOYMENT fail. The daily execution is folded into
// /api/cron/auto-dunning instead — see src/lib/recurringBillingRun.js.
//
// Trigger by hand with:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        https://app.luckylandscapes.com/api/cron/recurring-billing
export async function GET(request) {
  // Fail closed — Vercel's un-forgeable header OR the shared secret. In prod,
  // neither present → 401. Dev is allowed through for smoke-testing. (Do NOT
  // wrap this in `if (cronSecret)` — that would skip auth if the env var is unset.)
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron');
  const authed = isVercelCron || (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`);
  if (!authed && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const result = await runRecurringBilling({
    supabase,
    stripe: getStripe(), // may be null if Stripe isn't configured
    origin: getAppOrigin(request),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
