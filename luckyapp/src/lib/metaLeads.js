// Shared ingest logic for the Meta Instant Form lead-ads bridge
// (docs/meta-ads-campaign-001.md §2.3). Meta sends no native per-lead email,
// so two entry points feed this same pipeline:
//   - src/app/api/meta/leadgen/route.js         (webhook — real-time)
//   - src/app/api/cron/meta-leads-poll/route.js (polling fallback while
//                                                 Meta app review is pending)
//
// Both call ingestMetaLead() below, which is idempotent on Meta's
// `leadgen_id` (globally unique) so a webhook redelivery and a poll landing
// on the same lead never create two customers. Everything downstream
// (customer dedupe by email, tags, notifyOrg) mirrors the conventions in
// src/app/api/leads/public/route.js — keep them in sync if that route's
// lead-intake shape changes.

import crypto from 'crypto';
import { notifyOrg } from './notify';

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ─── Org resolution ───────────────────────────────────────────
// Same convention as /api/leads/public: an explicit env override, else the
// oldest organization row. Lucky Landscapes runs a single org today.
export async function resolveMetaOrgId(supabase) {
  if (process.env.LEADS_DEFAULT_ORG_ID) return process.env.LEADS_DEFAULT_ORG_ID;
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

// ─── Webhook signature verification ────────────────────────────
// Meta signs the RAW request body — the caller must pass request.text(),
// never a re-serialized JSON.stringify(parsed) (whitespace/key-order would
// change the bytes and break the HMAC).
export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  const [algo, signature] = String(signatureHeader).split('=');
  if (algo !== 'sha256' || !signature) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== gotBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, gotBuf);
}

// ─── Graph API helpers ──────────────────────────────────────────
// No pagination handling — fine at this campaign's volume (single-digit
// leads total, see docs/meta-ads-campaign-001.md §0). If Lucky ever runs a
// high-volume Meta campaign, listFormLeadsSince needs to follow `paging.next`.

async function graphGet(path, params) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`${GRAPH_BASE}/${path}?${qs}`);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || `${resp.status} ${resp.statusText}`;
    throw new Error(`Graph API ${path} failed: ${msg}`);
  }
  return data;
}

// Webhook path: the delivery payload only carries `leadgen_id` — the actual
// name/phone/email/answers require this follow-up call with a Page token
// that has the `leads_retrieval` permission.
export async function fetchLeadById(leadgenId, pageAccessToken) {
  return graphGet(leadgenId, {
    fields: 'id,created_time,ad_id,form_id,field_data',
    access_token: pageAccessToken,
  });
}

// Polling path: enumerate the Page's lead forms, then each form's leads.
export async function listPageLeadForms(pageId, pageAccessToken) {
  const data = await graphGet(`${pageId}/leadgen_forms`, {
    fields: 'id,name,status',
    access_token: pageAccessToken,
  });
  return Array.isArray(data?.data) ? data.data : [];
}

export async function listFormLeadsSince(formId, pageAccessToken, sinceUnixSeconds) {
  const filtering = JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: sinceUnixSeconds }]);
  const data = await graphGet(`${formId}/leads`, {
    fields: 'id,created_time,ad_id,form_id,field_data',
    filtering,
    access_token: pageAccessToken,
  });
  return Array.isArray(data?.data) ? data.data : [];
}

// ─── field_data parsing ─────────────────────────────────────────
// Meta generates the `name` key for custom questions from the question text
// at form-build time — we can't hardcode what "What are you planning?" /
// "When do you want it done?" (docs §3) actually key as. Anything that isn't
// a standard identity field is treated as a qualifying answer and its key is
// humanized for display. The raw field_data is also stored on the meta_leads
// row (see migration 048) so a wrong-looking label can be diagnosed later
// without needing a new Meta redelivery.
const STANDARD_FIELD_KEYS = new Set(['full_name', 'first_name', 'last_name', 'email', 'phone_number', 'phone']);

function humanizeFieldName(name) {
  return String(name || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\?$/, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseFieldData(fieldData) {
  const map = {};
  for (const f of fieldData || []) {
    const key = String(f?.name || '').toLowerCase().trim();
    const value = Array.isArray(f?.values) ? f.values.join(', ') : f?.values;
    if (key) map[key] = value;
  }

  let firstName = map.first_name || '';
  let lastName = map.last_name || '';
  const fullNameRaw = map.full_name || '';
  if (!firstName && fullNameRaw) {
    const parts = fullNameRaw.trim().split(/\s+/);
    firstName = parts.shift() || '';
    lastName = parts.join(' ');
  }

  const qualifyingAnswers = [];
  for (const f of fieldData || []) {
    const key = String(f?.name || '').toLowerCase().trim();
    if (!key || STANDARD_FIELD_KEYS.has(key)) continue;
    const value = Array.isArray(f?.values) ? f.values.join(', ') : f?.values;
    if (!value) continue;
    qualifyingAnswers.push({ key: f.name, label: humanizeFieldName(f.name), value });
  }

  return {
    email: (map.email || '').trim().toLowerCase(),
    phone: map.phone_number || map.phone || '',
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' ') || fullNameRaw,
    qualifyingAnswers,
  };
}

// Meta's created_time shows up as a unix-seconds int in webhook payloads but
// as an ISO 8601 string from most Graph API node fetches — accept either.
function normalizeCreatedTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return new Date(value * 1000).toISOString();
  if (/^\d+$/.test(String(value))) return new Date(Number(value) * 1000).toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMetaLeadNotes({ parsed, formId, adId, leadgenId }) {
  const lines = ['Submitted via Meta Instant Form (Lucky Landscapes Meta ads)'];
  if (parsed.qualifyingAnswers.length) {
    lines.push('', 'Qualifying answers:');
    for (const qa of parsed.qualifyingAnswers) lines.push(`${qa.label}: ${qa.value}`);
  }
  lines.push('', `Meta form ID: ${formId || 'unknown'}`);
  if (adId) lines.push(`Meta ad ID: ${adId}`);
  lines.push(`Meta lead ID: ${leadgenId}`);
  return lines.join('\n');
}

function buildMetaLeadEmailHtml({ parsed, customerId, isNew, formId }) {
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.luckylandscapes.com').replace(/\/$/, '');
  const customerUrl = `${appOrigin}/customers/${customerId}`;
  const rowFn = (label, value) => value
    ? `<tr><td style="padding:6px 12px 6px 0;color:#677160;font-size:14px;width:140px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#1f2421;font-size:14px;font-weight:500;">${escapeHtml(value)}</td></tr>`
    : '';
  const sectionHeader = (title) => `<h3 style="margin:24px 0 8px;color:#2d5016;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e6ebe1;padding-bottom:6px;font-family:Georgia,serif;">${escapeHtml(title)}</h3>`;

  const answerRows = parsed.qualifyingAnswers.map((qa) => rowFn(qa.label, qa.value)).join('');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f8f5;padding:24px 12px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);">

        <tr><td style="background:linear-gradient(135deg,#2d5016 0%,#41a100 100%);padding:24px 32px;color:#fff;">
          <div style="font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">🍀 ${isNew ? 'New Meta Ad Lead' : 'Repeat Meta Ad Inquiry'}</div>
          <div style="font-size:24px;font-weight:700;font-family:Georgia,serif;margin-top:4px;">${escapeHtml(parsed.fullName || 'Unknown')}</div>
        </td></tr>

        <tr><td style="padding:24px 32px 32px;">
          ${sectionHeader('Contact Information')}
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${rowFn('Name', parsed.fullName)}
            ${rowFn('Email', parsed.email)}
            ${rowFn('Phone', parsed.phone)}
          </table>

          ${answerRows ? `${sectionHeader('Qualifying Answers')}<table cellpadding="0" cellspacing="0" border="0" width="100%">${answerRows}</table>` : ''}

          <p style="margin:20px 0 0;color:#677160;font-size:13px;">Submitted via Meta Instant Form${formId ? ` (form ${escapeHtml(formId)})` : ''}. Response SOP: call within 15 minutes during work hours, same evening at the latest — open with their own answers.</p>

          <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
            <tr><td style="background:#41a100;border-radius:6px;">
              <a href="${customerUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Open customer in luckyapp →</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:14px 32px;border-top:1px solid #e6ebe1;color:#9aa399;font-size:12px;">
          Meta Instant Form lead · ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })} CT
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Main ingest entry point ────────────────────────────────────
// Called by both the webhook and the polling cron. Idempotent on
// leadgen_id: a redelivery or a poll landing on an already-ingested lead
// short-circuits right after the insert attempt, before any customer/email
// side effects run.
export async function ingestMetaLead({ supabase, orgId, leadgenId, formId, pageId, adId, leadCreatedTime, fieldData, ingestedVia }) {
  if (!leadgenId) throw new Error('ingestMetaLead: leadgenId is required');

  const { data: inserted, error: insertErr } = await supabase
    .from('meta_leads')
    .upsert({
      org_id: orgId,
      leadgen_id: leadgenId,
      form_id: formId || null,
      page_id: pageId || null,
      ad_id: adId || null,
      field_data: fieldData || null,
      lead_created_time: normalizeCreatedTime(leadCreatedTime),
      ingested_via: ingestedVia || 'webhook',
    }, { onConflict: 'leadgen_id', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();

  if (insertErr) throw insertErr;
  if (!inserted) {
    console.log('[meta leads] duplicate leadgen_id, skipping', leadgenId);
    return { ok: true, duplicate: true };
  }

  const parsed = parseFieldData(fieldData);
  const notes = buildMetaLeadNotes({ parsed, formId, adId, leadgenId });

  let customerId = null;
  let isNew = true;

  // Dedupe by email within the org — same convention as /api/leads/public.
  if (parsed.email) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id, notes, tags')
      .eq('org_id', orgId)
      .ilike('email', parsed.email)
      .limit(1)
      .maybeSingle();
    if (existing) {
      customerId = existing.id;
      isNew = false;
      const stamp = new Date().toISOString().slice(0, 10);
      const newNotes = [existing.notes, '', `--- New Meta ad lead ${stamp} ---`, notes].filter(Boolean).join('\n');
      const tags = Array.from(new Set([...(existing.tags || []), 'lead']));
      const { error: updErr } = await supabase.from('customers').update({ notes: newNotes, tags }).eq('id', customerId);
      if (updErr) throw updErr;
    }
  }

  if (!customerId) {
    const { data: ins, error: custErr } = await supabase
      .from('customers')
      .insert({
        org_id: orgId,
        first_name: parsed.firstName || parsed.fullName || 'Meta Lead',
        last_name: parsed.lastName || null,
        email: parsed.email || null,
        phone: parsed.phone || null,
        tags: ['lead'],
        source: 'meta_lead_ads',
        notes,
      })
      .select('id')
      .single();
    if (custErr) throw custErr;
    customerId = ins.id;
  }

  await supabase.from('meta_leads').update({ customer_id: customerId }).eq('id', inserted.id);

  const activityTitle = `${isNew ? 'New' : 'Repeat'} Meta ad lead: ${parsed.fullName || 'Unknown'}`;
  const { error: actErr } = await supabase.from('activity').insert({
    org_id: orgId,
    customer_id: customerId,
    type: 'lead_created',
    title: activityTitle,
    description: parsed.qualifyingAnswers.map((qa) => `${qa.label}: ${qa.value}`).join(' · ') || 'Meta Instant Form submission',
  });
  if (actErr) console.error('[meta leads] activity insert failed', actErr);

  const inAppBody = [
    parsed.phone ? `📞 ${parsed.phone}` : null,
    parsed.email ? `✉️ ${parsed.email}` : null,
    ...parsed.qualifyingAnswers.map((qa) => `${qa.label}: ${qa.value}`),
  ].filter(Boolean).join('\n');

  await notifyOrg({
    orgId,
    type: 'lead_created',
    title: activityTitle,
    body: inAppBody,
    link: `/customers/${customerId}`,
    data: { customer_id: customerId, isNew, source: 'meta_lead_ads', leadgenId },
    email: {
      subject: `🍀 ${isNew ? 'New' : 'Repeat'} Meta Ad Lead — ${parsed.fullName || 'Unknown'}`,
      html: buildMetaLeadEmailHtml({ parsed, customerId, isNew, formId }),
      replyTo: parsed.email || undefined,
    },
  }).catch((err) => console.error('[meta leads] notifyOrg failed', err));

  return { ok: true, duplicate: false, customerId, isNew };
}
