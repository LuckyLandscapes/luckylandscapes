import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';
import { buildContractPdfBytes } from '@/lib/generateContractPdf';
import { notifyOrg } from '@/lib/notify';
import { isValidTokenShape } from '@/lib/publicToken';

// ─── GET — fetch the contract by public token and mark as viewed ──────────────
export async function GET(_request, { params }) {
  const { token } = await params;
  if (!isValidTokenShape(token)) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { data: contract, error } = await supabase
    .from('contracts')
    .select(`
      id, contract_number, status, title, category,
      total_amount, deposit_amount, start_date, completion_window,
      body, customer_snapshot, public_token,
      sent_at, last_viewed_at, signed_at, declined_at,
      signature_typed_name, pdf_url, created_at,
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
  if (!isValidTokenShape(token)) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const action = (body.action || '').toString();

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  // Pull the full row up front — we need org_id, body, etc. to render the PDF.
  const { data: contract, error: fetchErr } = await supabase
    .from('contracts')
    .select('*, customers ( first_name, last_name, email, phone, address, city, state, zip )')
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

    const signedAt = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: signedAt,
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

    // ─── Post-sign side effects (PDF, email, notification) ────────────────
    // All best-effort. The customer's signature is already saved by this point;
    // we don't want to block the success response on Resend or storage hiccups.
    const enrichedContract = {
      ...contract,
      status: 'signed',
      signed_at: signedAt,
      signature_data_url: sigUrl,
      signature_typed_name: typedName,
      signature_ip: ip,
      signature_user_agent: ua,
    };

    let pdfPublicUrl = null;
    try {
      const pdfBytes = buildContractPdfBytes(enrichedContract);
      const path = `${contract.org_id}/${contract.id}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('contract-pdfs')
        .upload(path, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (uploadErr) {
        console.error('[contract sign] PDF upload failed:', uploadErr);
      } else {
        const { data: urlData } = supabase.storage.from('contract-pdfs').getPublicUrl(path);
        pdfPublicUrl = urlData?.publicUrl || null;
        await supabase
          .from('contracts')
          .update({ pdf_path: path, pdf_url: pdfPublicUrl })
          .eq('id', contract.id);
      }
    } catch (pdfErr) {
      console.error('[contract sign] PDF render failed:', pdfErr);
    }

    // Unified notification — inserts notifications row, sends Web Push to
    // subscribed devices, and emails owners/admins with the signed PDF attached.
    try {
      const customer = contract.customers || {};
      const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim()
        || contract.customer_snapshot?.name
        || 'Customer';

      let attachmentBytes = null;
      try { attachmentBytes = buildContractPdfBytes(enrichedContract); } catch { /* attachment optional */ }

      await notifyOrg({
        orgId: contract.org_id,
        type: 'contract_signed',
        title: `Contract #${contract.contract_number} signed by ${customerName}`,
        body: `${typedName} signed ${contract.title || contract.category || 'the agreement'} for $${Number(contract.total_amount || 0).toFixed(2)}.${pdfPublicUrl ? ` Signed PDF attached.` : ''}`,
        link: `/contracts/${contract.id}`,
        data: { contractId: contract.id, pdfUrl: pdfPublicUrl, total: contract.total_amount },
        attachments: attachmentBytes ? [{
          filename: `Contract-${contract.contract_number}-Signed.pdf`,
          content: attachmentBytes,
        }] : undefined,
      });
    } catch (notifyErr) {
      console.error('[contract sign] notify failed:', notifyErr);
    }

    return NextResponse.json({ success: true, signedAt, pdfUrl: pdfPublicUrl });
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

    try {
      const customer = contract.customers || {};
      const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim()
        || contract.customer_snapshot?.name
        || 'Customer';
      await notifyOrg({
        orgId: contract.org_id,
        type: 'contract_declined',
        title: `Contract #${contract.contract_number} — changes requested by ${customerName}`,
        body: reason.slice(0, 280),
        link: `/contracts/${contract.id}`,
        data: { contractId: contract.id },
      });
    } catch (notifyErr) {
      console.error('[contract decline] notify failed:', notifyErr);
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
