import { NextResponse } from 'next/server';
import { getServiceSupabase, getAppOrigin } from '@/lib/stripeServer';
import { sendInvoiceReminder } from '@/lib/invoiceReminder';
import { authenticateRequest } from '@/lib/apiAuth';

export async function POST(request) {
  // Authenticated team members only — otherwise anyone could spam a customer with
  // payment-reminder emails from our domain.
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { invoiceId, sentBy } = body;
    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

    const result = await sendInvoiceReminder({
      supabase,
      invoiceId,
      sentBy: sentBy || null,
      origin: getAppOrigin(request),
    });

    if (!result.ok) {
      const status = result.skip ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      tone: result.tone,
      daysOver: result.daysOver,
      emailId: result.emailId,
      sentTo: result.sentTo,
    });
  } catch (err) {
    console.error('[send-invoice-reminder] error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
