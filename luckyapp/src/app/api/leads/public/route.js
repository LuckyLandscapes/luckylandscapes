import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';
import { notifyOrg } from '@/lib/notify';

// Public, unauthenticated lead intake from the marketing site quote form.
// Inserts a new customer (tagged "lead", source "website") + activity row,
// uploads any submitted photos to Supabase Storage tied to that customer,
// and dispatches an in-app + email + web-push notification to owners/admins.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Maps questionnaire field names → human-readable labels for the notes blob.
const SERVICE_LABELS = {
  // lawn
  lawn_mowing: 'Mowing',
  lawn_cleanup: 'Spring/Fall cleanup',
  lawn_leaf: 'Leaf removal',
  lawn_complete: 'Complete lawn install',
  lawn_edging: 'Edging',
  lawn_trimming: 'Trimming',
  lawn_hedges: 'Hedge trimming',
  lawn_blowing: 'Blowing',
  // garden
  garden_beds: 'Mulch / new beds',
  garden_edging: 'Bed edging',
  garden_planting: 'Planting',
  garden_plant_shrubs: 'Shrubs',
  garden_plant_trees: 'Trees',
  garden_plant_perennials: 'Perennials',
  garden_plant_annuals: 'Annuals',
  garden_plant_grasses: 'Grasses',
  garden_plant_other: 'Other plants',
  // hardscape
  hard_pavers: 'Pavers',
  hard_retaining: 'Retaining wall',
  hard_outdoor: 'Outdoor living',
  hard_paver_patio: 'Paver patio',
  hard_paver_driveway: 'Paver driveway',
  hard_paver_walkway: 'Paver walkway',
  hard_paver_pool: 'Paver pool deck',
};

const DETAIL_LABELS = {
  project_size: 'Project size',
  project_timeline: 'Timeline',
  lawn_frequency: 'Lawn frequency',
  lawn_size: 'Lawn size',
  lawn_condition: 'Lawn condition',
  garden_scope: 'Garden scope',
  garden_beds_count: 'Bed count',
  garden_material: 'Material',
  garden_mulch_color: 'Mulch color',
  garden_mulch_depth: 'Mulch depth',
  garden_plant_count: 'Plant count',
  garden_plant_size: 'Plant size',
  garden_plant_source: 'Plant source',
  garden_edging_material: 'Edging material',
  hard_paver_material: 'Paver material',
  hard_paver_surface: 'Surface',
  hard_paver_removal: 'Removal needed',
  hard_paver_drainage: 'Drainage',
  hard_paver_pattern: 'Pattern',
  hard_wall_height: 'Wall height',
  hard_wall_length: 'Wall length',
  contactMethod: 'Preferred contact',
  bestTime: 'Best time',
};

// Friendlier display values for select-style fields.
const VALUE_LABELS = {
  project_size: {
    'under500sqft':   'Small — under 500 sq ft',
    '500-2000sqft':   'Medium — 500–2,000 sq ft',
    '2000-5000sqft':  'Large — 2,000–5,000 sq ft',
    '5000sqft+':      'Whole property — 5,000+ sq ft',
  },
  project_timeline: {
    asap:       'ASAP',
    '2weeks':   'Within 2 weeks',
    month:      'This month',
    summer:     'This summer / fall',
    exploring:  'Just getting estimates',
  },
  contactMethod: {
    any:   'No preference',
    text:  'Text message',
    call:  'Phone call',
    email: 'Email',
  },
  bestTime: {
    anytime:   'Anytime',
    morning:   'Morning (8am–12pm)',
    afternoon: 'Afternoon (12pm–5pm)',
    evening:   'Evening (5pm–8pm)',
  },
};

function pretty(field, value) {
  if (!value) return value;
  return VALUE_LABELS[field]?.[value] || value;
}

function buildNotes(body) {
  const lines = ['Submitted via luckylandscapes.com quote form'];
  if (body.categoryLabel) lines.push(`Category: ${body.categoryLabel}`);
  if (body.projectType) lines.push(`Project type: ${body.projectType}`);

  const services = Object.entries(body)
    .filter(([k, v]) => v === 'yes' && SERVICE_LABELS[k])
    .map(([k]) => SERVICE_LABELS[k]);
  if (services.length) lines.push(`Services requested: ${services.join(', ')}`);

  for (const [k, label] of Object.entries(DETAIL_LABELS)) {
    if (body[k]) lines.push(`${label}: ${pretty(k, body[k])}`);
  }
  if (body.project_description) {
    lines.push('', 'Project description:', String(body.project_description));
  }
  if (body.notes) {
    lines.push('', 'Customer notes:', String(body.notes));
  }
  const photoCount = Array.isArray(body.photos) ? body.photos.length : Number(body.photoCount) || 0;
  if (photoCount) {
    lines.push('', `Photos attached: ${photoCount} (see customer media gallery)`);
  }
  return lines.join('\n');
}

// Decode the base64-payload photos coming from the marketing form, upload
// them to the existing `quote-media` Storage bucket, and write `quote_media`
// rows tied to the customer (with `quote_id = NULL` — allowed since
// migration 023). Returns the per-photo metadata (incl. raw buffer) so
// the caller can also attach them to the notification email.
async function uploadLeadPhotos({ supabase, photos, orgId, customerId }) {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  const saved = [];
  for (const photo of photos.slice(0, 5)) {
    try {
      const b64 = String(photo?.data || '');
      if (!b64) continue;
      const buffer = Buffer.from(b64, 'base64');
      // Reject anything > 5MB after decode (matches bucket file_size_limit).
      if (buffer.byteLength > 5 * 1024 * 1024) {
        console.warn('[lead intake] skipping oversized photo', photo?.name);
        continue;
      }
      const contentType = photo?.type && /^image\//.test(photo.type) ? photo.type : 'image/jpeg';
      const ext = (contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
      const baseName = (photo?.name || `photo-${saved.length + 1}`).replace(/[^a-z0-9._-]/gi, '_').slice(0, 80);
      const filePath = `leads/${orgId}/${customerId}/${Date.now()}-${saved.length}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('quote-media')
        .upload(filePath, buffer, { contentType, upsert: false });
      if (upErr) {
        console.error('[lead intake] storage upload failed', upErr);
        continue;
      }

      const { data: pub } = supabase.storage.from('quote-media').getPublicUrl(filePath);
      const fileUrl = pub?.publicUrl || '';

      const { error: rowErr } = await supabase.from('quote_media').insert({
        org_id: orgId,
        quote_id: null,
        customer_id: customerId,
        uploaded_by: null,
        file_path: filePath,
        file_url: fileUrl,
        file_size: buffer.byteLength,
        media_type: 'image',
        caption: photo?.name ? String(photo.name).slice(0, 200) : '',
      });
      if (rowErr) {
        console.error('[lead intake] quote_media insert failed', rowErr);
        // best effort cleanup
        await supabase.storage.from('quote-media').remove([filePath]).catch(() => {});
        continue;
      }
      saved.push({ filename: baseName, fileUrl, contentType, buffer, size: buffer.byteLength });
    } catch (err) {
      console.error('[lead intake] photo upload exception', err);
    }
  }
  return saved;
}

// Builds the styled HTML body for the team-alert email. Mirrors the layout
// of the legacy Apps Script template (CLIENT INFORMATION / PROJECT OVERVIEW /
// SERVICES / DESCRIPTION) so the format Riley is used to scanning carries over.
function buildEmailHtml({ body, customerId, photos, fullName, isNew }) {
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.luckylandscapes.com').replace(/\/$/, '');
  const customerUrl = `${appOrigin}/customers/${customerId}`;

  const rowFn = (label, value) => value
    ? `<tr><td style="padding:6px 12px 6px 0;color:#677160;font-size:14px;width:140px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#1f2421;font-size:14px;font-weight:500;">${escapeHtml(value)}</td></tr>`
    : '';

  const sectionHeader = (title) => `<h3 style="margin:24px 0 8px;color:#2d5016;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e6ebe1;padding-bottom:6px;font-family:Georgia,serif;">${escapeHtml(title)}</h3>`;

  const services = body.categoryLabel
    ? `${body.categoryLabel}${body.projectType ? ` — ${body.projectType}` : ''}`
    : 'Quote request submitted';
  const checkedServices = Object.entries(body)
    .filter(([k, v]) => v === 'yes' && SERVICE_LABELS[k])
    .map(([k]) => SERVICE_LABELS[k])
    .join(', ');
  const detailRows = Object.entries(DETAIL_LABELS)
    .filter(([k]) => body[k])
    .map(([k, label]) => rowFn(label, pretty(k, body[k])))
    .join('');

  const photoBlock = photos.length
    ? `${sectionHeader(`Photos (${photos.length} attached)`)}
       <p style="color:#677160;font-size:13px;margin:0 0 12px;">Photos are attached to this email and also live in the customer's media gallery in luckyapp.</p>
       <table cellpadding="0" cellspacing="0" border="0" style="margin:0;"><tr>
         ${photos.map(p => `<td style="padding:0 8px 8px 0;"><a href="${escapeHtml(p.fileUrl)}"><img src="${escapeHtml(p.fileUrl)}" alt="lead photo" width="120" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e6ebe1;display:block;" /></a></td>`).join('')}
       </tr></table>`
    : `${sectionHeader('Photos')}<p style="color:#677160;font-size:14px;margin:0;">No photos attached.</p>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f8f5;padding:24px 12px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);">

        <!-- Header bar -->
        <tr><td style="background:linear-gradient(135deg,#2d5016 0%,#41a100 100%);padding:24px 32px;color:#fff;">
          <div style="font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">🍀 ${isNew ? 'New Quote Request' : 'Repeat Inquiry'}</div>
          <div style="font-size:24px;font-weight:700;font-family:Georgia,serif;margin-top:4px;">${escapeHtml(services)} — ${escapeHtml(fullName || 'Unknown')}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 32px 32px;">

          ${sectionHeader('Client Information')}
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${rowFn('Name',        fullName)}
            ${rowFn('Email',       body.email)}
            ${rowFn('Phone',       body.phone)}
            ${rowFn('Address',     body.address)}
            ${rowFn('Best contact', body.contactMethod && body.contactMethod !== 'any' ? pretty('contactMethod', body.contactMethod) : null)}
            ${rowFn('Best time',   body.bestTime && body.bestTime !== 'anytime' ? pretty('bestTime', body.bestTime) : null)}
          </table>

          ${sectionHeader('Project Overview')}
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${rowFn('Category',  body.categoryLabel)}
            ${rowFn('Type',      body.projectType)}
            ${rowFn('Size',      body.project_size ? pretty('project_size', body.project_size) : null)}
            ${rowFn('Timeline',  body.project_timeline ? pretty('project_timeline', body.project_timeline) : null)}
          </table>

          ${checkedServices ? `${sectionHeader('Services Requested')}<p style="margin:0;color:#1f2421;font-size:14px;">${escapeHtml(checkedServices)}</p>` : ''}

          ${detailRows ? `${sectionHeader('Details')}<table cellpadding="0" cellspacing="0" border="0" width="100%">${detailRows}</table>` : ''}

          ${body.project_description ? `${sectionHeader('Project Description')}<p style="margin:0;color:#1f2421;font-size:14px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(String(body.project_description))}</p>` : ''}

          ${photoBlock}

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr><td style="background:#41a100;border-radius:6px;">
              <a href="${customerUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Open customer in luckyapp →</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:14px 32px;border-top:1px solid #e6ebe1;color:#9aa399;font-size:12px;">
          Submitted via luckylandscapes.com quote form · ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })} CT
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveOrgId(supabase) {
  if (process.env.LEADS_DEFAULT_ORG_ID) return process.env.LEADS_DEFAULT_ORG_ID;
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS });
  }

  const firstName = String(body.firstName || '').trim();
  const lastName  = String(body.lastName  || '').trim();
  const email     = String(body.email     || '').trim().toLowerCase();
  const phone     = String(body.phone     || '').trim();
  const address   = String(body.address   || '').trim();

  if (!firstName || !email) {
    return NextResponse.json(
      { error: 'firstName and email are required' },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  // Basic honeypot — silently accept bots without writing a lead.
  if (body.website || body.honeypot) {
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 500, headers: CORS_HEADERS });
  }

  const orgId = await resolveOrgId(supabase);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization configured' }, { status: 500, headers: CORS_HEADERS });
  }

  const notes = buildNotes(body);
  let customerId = null;
  let isNew = true;

  // Dedupe by email within the org — append rather than create a duplicate lead.
  const { data: existing } = await supabase
    .from('customers')
    .select('id, notes, tags')
    .eq('org_id', orgId)
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (existing) {
    customerId = existing.id;
    isNew = false;
    const stamp = new Date().toISOString().slice(0, 10);
    const newNotes = [existing.notes, '', `--- New website submission ${stamp} ---`, notes]
      .filter(Boolean)
      .join('\n');
    const tags = Array.from(new Set([...(existing.tags || []), 'lead']));
    const { error: updErr } = await supabase
      .from('customers')
      .update({ notes: newNotes, tags })
      .eq('id', customerId);
    if (updErr) {
      console.error('[lead intake] update failed', updErr);
      return NextResponse.json({ error: 'Could not save lead' }, { status: 500, headers: CORS_HEADERS });
    }
  } else {
    const { data: ins, error } = await supabase
      .from('customers')
      .insert({
        org_id: orgId,
        first_name: firstName,
        last_name: lastName || null,
        email,
        phone: phone || null,
        address: address || null,
        tags: ['lead'],
        source: 'website',
        notes,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[lead intake] insert failed', error);
      return NextResponse.json({ error: 'Could not save lead' }, { status: 500, headers: CORS_HEADERS });
    }
    customerId = ins.id;
  }

  // Upload any photos to Supabase Storage tied to this customer.
  // Also retains the raw buffers so we can attach them to the email.
  const uploadedPhotos = await uploadLeadPhotos({
    supabase,
    photos: body.photos,
    orgId,
    customerId,
  });
  const photoCount = uploadedPhotos.length;

  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const inAppTitle = isNew
    ? `New website lead: ${fullName}`
    : `Repeat website inquiry: ${fullName}`;
  const description = body.categoryLabel
    ? `${body.categoryLabel}${body.projectType ? ` — ${body.projectType}` : ''}`
    : 'Quote request submitted';

  const { error: actErr } = await supabase.from('activity').insert({
    org_id: orgId,
    customer_id: customerId,
    type: 'lead_created',
    title: inAppTitle,
    description,
  });
  if (actErr) console.error('[lead intake] activity insert failed', actErr);

  // Short body — used for the in-app feed item and the web-push card. The
  // *email* gets a much richer styled template (see buildEmailHtml).
  const inAppBody = [
    description,
    address ? `📍 ${address}` : null,
    phone ? `📞 ${phone}` : null,
    body.project_size ? `Size: ${pretty('project_size', body.project_size)}` : null,
    photoCount ? `📸 ${photoCount} photo${photoCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join('\n');

  // Email-specific overrides: legacy-style subject, full HTML template,
  // photos as attachments, reply-to set to the lead so Riley can hit Reply.
  const emailSubject = `🍀 ${isNew ? 'New Quote Request' : 'Repeat Inquiry'} — ${body.categoryLabel || 'General'} — ${fullName || 'Unknown'}`;
  const emailHtml = buildEmailHtml({
    body: { ...body, email, phone, address },
    customerId,
    photos: uploadedPhotos,
    fullName,
    isNew,
  });
  const attachments = uploadedPhotos.map(p => ({
    filename: p.filename,
    content: p.buffer,
  }));

  await notifyOrg({
    orgId,
    type: 'lead_created',
    title: inAppTitle,
    body: inAppBody,
    link: `/customers/${customerId}`,
    data: { customer_id: customerId, isNew, source: 'website', photoCount },
    attachments,
    email: {
      subject: emailSubject,
      html: emailHtml,
      replyTo: email || undefined,
    },
  }).catch(err => console.error('[lead intake] notifyOrg failed', err));

  return NextResponse.json({ ok: true, customerId, isNew, photoCount }, { headers: CORS_HEADERS });
}
