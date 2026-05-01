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
// migration 023). Returns the count successfully uploaded.
async function uploadLeadPhotos({ supabase, photos, orgId, customerId }) {
  if (!Array.isArray(photos) || photos.length === 0) return 0;
  let saved = 0;
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
      const filePath = `leads/${orgId}/${customerId}/${Date.now()}-${saved}.${ext}`;

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
      saved++;
    } catch (err) {
      console.error('[lead intake] photo upload exception', err);
    }
  }
  return saved;
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

  if (!firstName || !email || !phone) {
    return NextResponse.json(
      { error: 'firstName, email, and phone are required' },
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
        phone,
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
  const photoCount = await uploadLeadPhotos({
    supabase,
    photos: body.photos,
    orgId,
    customerId,
  });

  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const title = isNew
    ? `New website lead: ${fullName}`
    : `Repeat website inquiry: ${fullName}`;
  const description = body.categoryLabel
    ? `${body.categoryLabel}${body.projectType ? ` — ${body.projectType}` : ''}`
    : 'Quote request submitted';

  const { error: actErr } = await supabase.from('activity').insert({
    org_id: orgId,
    customer_id: customerId,
    type: 'lead_created',
    title,
    description,
  });
  if (actErr) console.error('[lead intake] activity insert failed', actErr);

  // In-app notification + Resend email + web push to owners/admins.
  const notifBodyLines = [
    description,
    address ? `📍 ${address}` : null,
    phone ? `📞 ${phone}` : null,
    email ? `✉️ ${email}` : null,
    body.project_size ? `Size: ${pretty('project_size', body.project_size)}` : null,
    body.project_timeline ? `Timeline: ${pretty('project_timeline', body.project_timeline)}` : null,
    body.contactMethod && body.contactMethod !== 'any'
      ? `Prefers: ${pretty('contactMethod', body.contactMethod)}${body.bestTime && body.bestTime !== 'anytime' ? `, ${pretty('bestTime', body.bestTime)}` : ''}`
      : null,
    photoCount ? `📸 ${photoCount} photo${photoCount > 1 ? 's' : ''} attached` : null,
    body.project_description ? `\n"${String(body.project_description).slice(0, 240)}${body.project_description.length > 240 ? '…' : ''}"` : null,
  ].filter(Boolean);

  await notifyOrg({
    orgId,
    type: 'lead_created',
    title,
    body: notifBodyLines.join('\n'),
    link: `/customers/${customerId}`,
    data: { customer_id: customerId, isNew, source: 'website', photoCount },
  }).catch(err => console.error('[lead intake] notifyOrg failed', err));

  return NextResponse.json({ ok: true, customerId, isNew, photoCount }, { headers: CORS_HEADERS });
}
