import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';
import { verifyMetaSignature, resolveMetaOrgId, fetchLeadById, ingestMetaLead } from '@/lib/metaLeads';

// Meta leadgen webhook — the real-time half of the lead-ads bridge
// (docs/meta-ads-campaign-001.md §2.3). Intentionally public: Meta calls
// this directly with no session, so it's protected by the hub.verify_token
// handshake (GET) and an X-Hub-Signature-256 HMAC check (POST) instead of
// authenticateRequest/Turnstile. See luckyapp/AGENTS.md's public-routes list
// and the "Meta lead ads bridge" quick map.
//
// Required env: META_VERIFY_TOKEN, META_APP_SECRET, META_PAGE_ACCESS_TOKEN
// (leads_retrieval permission). Optional: META_PAGE_ID (defense-in-depth
// check that the delivering page matches).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — Meta's one-time webhook verification handshake (also re-run any time
// you click "Verify and Save" on the Webhooks product config).
export async function GET(request) {
  const verifyToken = process.env.META_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error('[meta webhook] META_VERIFY_TOKEN not configured; refusing verification');
    return new NextResponse('Not configured', { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// POST — actual lead delivery. The payload only carries `leadgen_id` per
// change; the real field data is fetched from the Graph API with the Page
// token, then handed to the same ingest path the polling cron uses.
export async function POST(request) {
  const appSecret = process.env.META_APP_SECRET;
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  const expectedPageId = process.env.META_PAGE_ID;

  // Read the RAW body first — Meta signs the exact bytes it sent, so
  // verification must happen before (and instead of) any JSON.parse/re-encode.
  const rawBody = await request.text();
  const sig = request.headers.get('x-hub-signature-256');

  if (!appSecret) {
    console.error('[meta webhook] META_APP_SECRET not configured; refusing all events');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  if (!verifyMetaSignature(rawBody, sig, appSecret)) {
    console.error('[meta webhook] signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  if (!pageToken) {
    console.error('[meta webhook] META_PAGE_ACCESS_TOKEN not configured; cannot fetch lead data');
    return NextResponse.json({ error: 'Page token not configured' }, { status: 500 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const orgId = await resolveMetaOrgId(supabase);
  if (!orgId) {
    console.error('[meta webhook] no organization configured');
    return NextResponse.json({ error: 'No organization configured' }, { status: 500 });
  }

  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const results = [];

  for (const entry of entries) {
    if (expectedPageId && entry?.id && entry.id !== expectedPageId) {
      console.warn('[meta webhook] skipping entry for unexpected page id', entry.id);
      continue;
    }
    const leadgenChanges = (entry?.changes || []).filter((c) => c?.field === 'leadgen' && c?.value?.leadgen_id);

    for (const change of leadgenChanges) {
      const { leadgen_id: leadgenId, form_id: formId, page_id: pageId, ad_id: adId, created_time: createdTime } = change.value;
      try {
        const lead = await fetchLeadById(leadgenId, pageToken);
        const result = await ingestMetaLead({
          supabase,
          orgId,
          leadgenId,
          formId: formId || lead.form_id,
          pageId: pageId || entry.id,
          adId: adId || lead.ad_id,
          leadCreatedTime: lead.created_time ?? createdTime,
          fieldData: lead.field_data,
          ingestedVia: 'webhook',
        });
        results.push({ leadgenId, ...result });
      } catch (err) {
        console.error('[meta webhook] failed to ingest lead', leadgenId, err);
        results.push({ leadgenId, ok: false, error: err.message });
      }
    }
  }

  // Always 200 once we've verified the signature — Meta retries the WHOLE
  // payload on a non-2xx, which would re-process leads that already
  // succeeded. Per-lead failures are logged above and self-heal via the next
  // natural redelivery or the polling cron fallback (ingestMetaLead is
  // idempotent either way).
  return NextResponse.json({ ok: true, processed: results.length, results });
}
