import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

// Public, unauthenticated lead intake from the marketing site quote form.
// Inserts a new customer (tagged "lead", source "website") and an activity row.

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

function buildNotes(body) {
  const lines = ['Submitted via luckylandscapes.com quote form'];
  if (body.categoryLabel) lines.push(`Category: ${body.categoryLabel}`);
  if (body.projectType) lines.push(`Project type: ${body.projectType}`);

  const services = Object.entries(body)
    .filter(([k, v]) => v === 'yes' && SERVICE_LABELS[k])
    .map(([k]) => SERVICE_LABELS[k]);
  if (services.length) lines.push(`Services requested: ${services.join(', ')}`);

  for (const [k, label] of Object.entries(DETAIL_LABELS)) {
    if (body[k]) lines.push(`${label}: ${body[k]}`);
  }
  if (body.project_description) {
    lines.push('', 'Project description:', String(body.project_description));
  }
  if (body.notes) {
    lines.push('', 'Customer notes:', String(body.notes));
  }
  if (body.photoCount) {
    lines.push('', `Photos uploaded: ${body.photoCount} (see Drive folder via Sheets/Gmail notification)`);
  }
  return lines.join('\n');
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

  return NextResponse.json({ ok: true, customerId, isNew }, { headers: CORS_HEADERS });
}
