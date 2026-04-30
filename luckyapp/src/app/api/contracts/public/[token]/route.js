import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

// ─── GET — fetch the contract by public token and mark as viewed ──────────────
export async function GET(_request, { params }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { data: contract, error } = await supabase
    .from('contracts')
    .select(`
      id, contract_number, status, title, category,
      total_amount, deposit_amount, start_date, completion_window,
      body, customer_snapshot, public_token,
      sent_at, last_viewed_at, signed_at, declined_at,
      signature_typed_name, created_at,
      customers ( first_name, last_name, email, phone, address, city, state, zip )
    `)
    .eq('public_token', token)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  // Mark as viewed (best-effort) — bump status from sent → viewed
  const updates = { last_viewed_at: new Date().toISOString() };
  if (contract.status === 'sent') updates.status = 'viewed';
  supabase.from('contracts').update(updates).eq('id', contract.id).then(() => {}).catch(() => {});

  return NextResponse.json({ contract });
}

// ─── POST — customer signs OR declines the contract ──────────────────────────
// Body shape:
//   { action: 'sign', signatureDataUrl: 'data:image/png;base64,...', typedName: 'Jane Q. Doe' }
//   { action: 'decline', reason: 'Want to swap pavers for stamped concrete' }
export async function POST(request, { params }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = (body.action || '').toString();

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { data: contract, error: fetchErr } = await supabase
    .from('contracts')
    .select('id, contract_number, status, public_token')
    .eq('public_token', token)
    .single();

  if (fetchErr || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (contract.status === 'signed') {
    return NextResponse.json({ error: 'This contract is already signed.' }, { status: 400 });
  }
  if (contract.status === 'void') {
    return NextResponse.json({ error: 'This contract has been voided. Please contact us.' }, { status: 400 });
  }

  // Best-effort capture of evidentiary metadata
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
  const ua = request.headers.get('user-agent') || null;

  if (action === 'sign') {
    const sigUrl = (body.signatureDataUrl || '').toString();
    const typedName = (body.typedName || '').toString().trim();

    if (!sigUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Please draw your signature before submitting.' }, { status: 400 });
    }
    if (sigUrl.length > 600_000) {
      return NextResponse.json({ error: 'Signature image is too large.' }, { status: 400 });
    }
    if (!typedName || typedName.length < 2) {
      return NextResponse.json({ error: 'Please type your full legal name.' }, { status: 400 });
    }
    if (typedName.length > 200) {
      return NextResponse.json({ error: 'Typed name is too long.' }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data_url: sigUrl,
        signature_typed_name: typedName,
        signature_ip: ip,
        signature_user_agent: ua,
      })
      .eq('id', contract.id);

    if (updateErr) {
      console.error('[contract sign] update failed:', updateErr);
      return NextResponse.json({ error: 'Could not save your signature. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, signedAt: new Date().toISOString() });
  }

  if (action === 'decline') {
    const reason = (body.reason || '').toString().trim();
    if (!reason) {
      return NextResponse.json({ error: 'Please tell us what you\'d like changed.' }, { status: 400 });
    }
    if (reason.length > 4000) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from('contracts')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString(),
        decline_reason: reason,
      })
      .eq('id', contract.id);

    if (updateErr) {
      console.error('[contract decline] update failed:', updateErr);
      return NextResponse.json({ error: 'Could not save your message. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
