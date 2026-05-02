import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getServiceSupabase } from '@/lib/stripeServer';
import { isValidTokenShape } from '@/lib/publicToken';

// ─── GET — fetch the quote by token and mark as viewed ────────────────────────
export async function GET(_request, { params }) {
  const { token } = await params;
  if (!isValidTokenShape(token)) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, status, category, items, total,
      materials_cost, delivery_fee, deposit_paid_at,
      decline_reason, declined_at, notes, created_at, public_token,
      selected_materials,
      customers ( first_name, last_name, email, phone, address, city, state, zip )
    `)
    .eq('public_token', token)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  // Mark as viewed (best-effort, fire-and-forget) and bump status from sent → viewed
  const updates = { last_viewed_at: new Date().toISOString() };
  if (quote.status === 'sent') updates.status = 'viewed';
  supabase.from('quotes').update(updates).eq('id', quote.id).then(() => {}).catch(() => {});

  return NextResponse.json({ quote });
}

// ─── POST — customer requests changes / declines the quote ────────────────────
export async function POST(request, { params }) {
  const { token } = await params;
  if (!isValidTokenShape(token)) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = (body.reason || '').toString().trim();
  if (!reason) {
    return NextResponse.json({ error: 'Please tell us what you’d like changed.' }, { status: 400 });
  }
  if (reason.length > 4000) {
    return NextResponse.json({ error: 'Message is too long.' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { data: quote, error: fetchErr } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, status, total, deposit_paid_at, public_token,
      customers ( first_name, last_name, email, phone )
    `)
    .eq('public_token', token)
    .single();

  if (fetchErr || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  if (quote.deposit_paid_at) {
    return NextResponse.json(
      { error: 'This quote has already been accepted and the deposit paid. Please contact us to make changes.' },
      { status: 400 }
    );
  }

  const { error: updateErr } = await supabase
    .from('quotes')
    .update({
      status: 'declined',
      decline_reason: reason,
      declined_at: new Date().toISOString(),
    })
    .eq('id', quote.id);

  if (updateErr) {
    console.error('[quote decline] update failed:', updateErr);
    return NextResponse.json({ error: 'Could not save your message. Please try again.' }, { status: 500 });
  }

  // Notify Lucky Landscapes (best-effort — never block the customer's response on email)
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const customer = quote.customers || {};
      const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'a customer';
      const notifyTo = process.env.RESEND_REPLY_TO || 'rileykopf@luckylandscapes.com';
      const fromAddress = process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';

      await resend.emails.send({
        from: fromAddress,
        to: [notifyTo],
        reply_to: customer.email || undefined,
        subject: `Quote #${quote.quote_number} — change request from ${customerName}`,
        text: [
          `${customerName} responded to Quote #${quote.quote_number} and asked for changes.`,
          '',
          `Customer: ${customerName}`,
          customer.email ? `Email: ${customer.email}` : null,
          customer.phone ? `Phone: ${customer.phone}` : null,
          '',
          'What they said:',
          '─────────────────────',
          reason,
          '─────────────────────',
          '',
          'The quote has been auto-marked declined in luckyapp.',
        ].filter(Boolean).join('\n'),
      });
    }
  } catch (notifyErr) {
    console.error('[quote decline] notification email failed:', notifyErr);
  }

  return NextResponse.json({ success: true });
}
