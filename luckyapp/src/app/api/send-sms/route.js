import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getServiceSupabase, getAppOrigin } from '@/lib/stripeServer';

function isTwilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function formatUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

export async function POST(request) {
  try {
    if (!isTwilioConfigured()) {
      return NextResponse.json({
        error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env.local.',
      }, { status: 500 });
    }

    const body = await request.json();
    const { kind, phone, customMessage } = body;
    const to = normalizePhone(phone);
    if (!to) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    if (!kind || (kind !== 'quote' && kind !== 'invoice')) {
      return NextResponse.json({ error: 'kind must be "quote" or "invoice"' }, { status: 400 });
    }

    const origin = getAppOrigin(request);
    const supabase = getServiceSupabase();
    let smsBody;
    let invoiceId = null;

    if (kind === 'invoice') {
      if (!body.invoiceId) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
      invoiceId = body.invoiceId;

      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('invoice_number, total, amount_paid, public_token, customers(first_name)')
        .eq('id', invoiceId)
        .single();
      if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
      const firstName = invoice.customers?.first_name || 'there';
      const payUrl = `${origin}/pay/${invoice.public_token}`;
      smsBody = [
        `Hi ${firstName}! Your invoice from Lucky Landscapes is ready.`,
        ``,
        `Invoice ${invoice.invoice_number}`,
        `Balance Due: ${formatUSD(balance)}`,
        ``,
        customMessage || '',
        customMessage ? '' : null,
        `Pay online (card or bank transfer):`,
        payUrl,
        ``,
        `Questions? (402) 405-5475`,
        `— Lucky Landscapes 🍀`,
      ].filter(l => l !== null).join('\n');
    } else {
      // kind === 'quote'
      // The PDF link is generated client-side and uploaded — caller passes pdfUrl + quote details
      const { quoteNumber, customerFirstName, total, category, pdfUrl } = body;
      if (!quoteNumber) return NextResponse.json({ error: 'Missing quoteNumber' }, { status: 400 });
      const firstName = customerFirstName || 'there';
      smsBody = [
        `Hi ${firstName}! Here's your estimate from Lucky Landscapes:`,
        ``,
        `Quote #${quoteNumber}`,
        category ? `Category: ${category}` : null,
        `Total: ${formatUSD(total)}`,
        ``,
        customMessage || null,
        customMessage ? '' : null,
        pdfUrl ? `View your full estimate:` : null,
        pdfUrl || null,
        pdfUrl ? '' : null,
        `Valid for 30 days. Reply or call (402) 405-5475 with any questions!`,
        `— Lucky Landscapes 🍀`,
      ].filter(l => l !== null).join('\n');
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({
      body: smsBody,
      from: process.env.TWILIO_FROM_NUMBER,
      to,
    });

    // Mark invoice as sent (best effort)
    if (kind === 'invoice' && invoiceId && supabase) {
      const { data: existing } = await supabase
        .from('invoices')
        .select('sent_via')
        .eq('id', invoiceId)
        .single();
      const newSentVia = existing?.sent_via === 'email' ? 'both' : 'sms';
      await supabase
        .from('invoices')
        .update({
          sent_at: new Date().toISOString(),
          sent_via: newSentVia,
          sent_to_phone: to,
        })
        .eq('id', invoiceId);
    }

    return NextResponse.json({ success: true, sid: msg.sid });
  } catch (err) {
    console.error('[send-sms] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send SMS' }, { status: 500 });
  }
}
