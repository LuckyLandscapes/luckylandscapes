import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';
import { resolveMetaOrgId, listPageLeadForms, listFormLeadsSince, ingestMetaLead } from '@/lib/metaLeads';

// Polling fallback for the Meta lead-ads bridge (docs/meta-ads-campaign-001.md
// §2.3) — covers lead intake while the leadgen webhook is unconfigured or
// Meta app review for `leads_retrieval` is pending. Safe to leave running
// forever alongside the webhook: ingestMetaLead() is idempotent on
// leadgen_id, so whichever entry point sees a lead first wins and the other
// no-ops.
//
// Triggered by Vercel Cron via vercel.json. Secured with CRON_SECRET when
// set, same fail-closed pattern as auto-dunning (see that route's header
// comment for the rationale — don't reintroduce an `if (cronSecret)` wrapper
// that skips the check when the env var is missing).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Generous first-run backfill window. Harmless — re-scanned leads just hit
// the idempotency check in ingestMetaLead and no-op.
const DEFAULT_LOOKBACK_SECONDS = 3 * 24 * 60 * 60;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron');
  const authed = isVercelCron || (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`);
  if (!authed && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pageId = process.env.META_PAGE_ID;
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageId || !pageToken) {
    return NextResponse.json({ error: 'META_PAGE_ID / META_PAGE_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const orgId = await resolveMetaOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: 'No organization configured' }, { status: 500 });

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });

  const settings = org?.settings || {};
  const nowUnix = Math.floor(Date.now() / 1000);
  const lastPolledAt = settings?.metaLeadsPoll?.lastPolledAtUnix;
  const sinceUnix = Number.isFinite(lastPolledAt) ? lastPolledAt : nowUnix - DEFAULT_LOOKBACK_SECONDS;

  const summary = { checkedAt: new Date().toISOString(), sinceUnix, forms: 0, leadsFound: 0, ingested: 0, duplicates: 0, failed: 0 };

  try {
    const forms = await listPageLeadForms(pageId, pageToken);
    summary.forms = forms.length;

    for (const form of forms) {
      const leads = await listFormLeadsSince(form.id, pageToken, sinceUnix);
      summary.leadsFound += leads.length;
      for (const lead of leads) {
        try {
          const result = await ingestMetaLead({
            supabase,
            orgId,
            leadgenId: lead.id,
            formId: lead.form_id || form.id,
            pageId,
            adId: lead.ad_id,
            leadCreatedTime: lead.created_time,
            fieldData: lead.field_data,
            ingestedVia: 'poll',
          });
          if (result.duplicate) summary.duplicates++;
          else summary.ingested++;
        } catch (err) {
          console.error('[meta leads poll] ingest failed', lead.id, err);
          summary.failed++;
        }
      }
    }

    await supabase
      .from('organizations')
      .update({ settings: { ...settings, metaLeadsPoll: { lastPolledAtUnix: nowUnix } } })
      .eq('id', orgId);
  } catch (err) {
    console.error('[meta leads poll] run failed', err);
    return NextResponse.json({ error: err.message, ...summary }, { status: 500 });
  }

  console.log('[meta leads poll] run complete', summary);
  return NextResponse.json(summary);
}
