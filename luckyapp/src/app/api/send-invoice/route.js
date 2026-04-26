import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { getServiceSupabase, getAppOrigin } from '@/lib/stripeServer';

function formatUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

function formatDate(d) {
  if (!d) return null;
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { invoiceId, to, customMessage } = body;
    if (!invoiceId || !to) {
      return NextResponse.json({ error: 'Missing invoiceId or to' }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, customers(first_name, last_name)')
      .eq('id', invoiceId)
      .single();
    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const origin = getAppOrigin(request);
    const payUrl = `${origin}/pay/${invoice.public_token}`;
    const customer = invoice.customers || {};
    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'there';
    const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const dueDate = formatDate(invoice.due_date);

    const itemRows = items.map(item => `
      <tr>
        <td style="padding:10px 12px; font-size:14px; color:#1f2937; border-bottom:1px solid #f3f4f6;">${item.name || 'Service'}</td>
        <td style="padding:10px 12px; font-size:14px; color:#6b7280; text-align:center; border-bottom:1px solid #f3f4f6;">${item.quantity || 1}</td>
        <td style="padding:10px 12px; font-size:14px; color:#1f2937; text-align:right; font-weight:600; border-bottom:1px solid #f3f4f6;">${formatUSD(item.total)}</td>
      </tr>`).join('');

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#f5f5f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:#fff;">
    <div style="background:#2D4A22; padding:28px 32px;">
      <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700;">🍀 Lucky Landscapes</h1>
      <p style="color:rgba(255,255,255,0.7); margin:4px 0 0; font-size:13px;">Invoice ${invoice.invoice_number}</p>
    </div>

    <div style="padding:32px;">
      <h2 style="color:#1f2937; margin:0 0 8px; font-size:20px;">Your Invoice is Ready</h2>
      <p style="color:#6b7280; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Hi ${customerName},<br><br>
        ${customMessage || 'Thanks for your business! Your invoice is ready below. You can pay online with credit/debit card or bank transfer using the button below.'}
      </p>

      <!-- Pay button -->
      <div style="text-align:center; margin:24px 0 28px;">
        <a href="${payUrl}" style="display:inline-block; background:#2d7a3a; color:#fff; text-decoration:none; padding:16px 40px; border-radius:10px; font-weight:700; font-size:15px;">
          💳 Pay ${formatUSD(balance)} Online
        </a>
        <div style="color:#9ca3af; font-size:12px; margin-top:10px;">Secure payment via Stripe — card or bank transfer</div>
      </div>

      <!-- Invoice info -->
      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:16px 20px; margin-bottom:20px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:4px 0; color:#6b7280; font-size:12px;">Invoice #</td>
              <td style="padding:4px 0; text-align:right; font-weight:600; color:#1f2937; font-size:13px;">${invoice.invoice_number}</td></tr>
          ${dueDate ? `<tr><td style="padding:4px 0; color:#6b7280; font-size:12px;">Due</td>
              <td style="padding:4px 0; text-align:right; font-weight:600; color:#1f2937; font-size:13px;">${dueDate}</td></tr>` : ''}
        </table>
      </div>

      ${items.length ? `
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
        <thead><tr style="background:#6B8E4E;">
          <th style="padding:10px 12px; text-align:left; color:#fff; font-size:12px; font-weight:600;">Description</th>
          <th style="padding:10px 12px; text-align:center; color:#fff; font-size:12px; font-weight:600;">Qty</th>
          <th style="padding:10px 12px; text-align:right; color:#fff; font-size:12px; font-weight:600;">Total</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>` : ''}

      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:16px 20px; margin:16px 0 24px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Subtotal</td>
              <td style="padding:4px 0; text-align:right; font-weight:600; color:#1f2937;">${formatUSD(invoice.subtotal)}</td></tr>
          ${Number(invoice.tax) ? `<tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Tax</td>
              <td style="padding:4px 0; text-align:right; font-weight:600; color:#1f2937;">${formatUSD(invoice.tax)}</td></tr>` : ''}
          ${Number(invoice.amount_paid) ? `<tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Paid</td>
              <td style="padding:4px 0; text-align:right; font-weight:600; color:#1f2937;">−${formatUSD(invoice.amount_paid)}</td></tr>` : ''}
          <tr><td style="padding:8px 0 0; border-top:1px solid #e5e7eb; font-size:16px; font-weight:700; color:#1f2937;">Balance Due</td>
              <td style="padding:8px 0 0; border-top:1px solid #e5e7eb; text-align:right; font-size:20px; font-weight:800; color:#6B8E4E;">${formatUSD(balance)}</td></tr>
        </table>
      </div>

      ${invoice.notes ? `<div style="background:#fafaf8; border-radius:8px; padding:12px 16px; margin-bottom:20px; font-size:13px; color:#6b7280;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}

      <div style="border-top:1px solid #e5e7eb; padding-top:20px; margin-top:24px; text-align:center;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">Lucky Landscapes • (402) 405-5475 • rileykopf@luckylandscapes.com</p>
        <p style="color:#9ca3af; font-size:12px; margin:4px 0 0;">109 South Canopy ST, Lincoln, NE</p>
      </div>
    </div>
  </div>
</body></html>`;

    const text = [
      `Hi ${customerName},`,
      '',
      customMessage || 'Your invoice is ready.',
      '',
      `Invoice ${invoice.invoice_number}`,
      `Balance Due: ${formatUSD(balance)}`,
      dueDate ? `Due: ${dueDate}` : '',
      '',
      `Pay online (card or bank transfer): ${payUrl}`,
      '',
      'Lucky Landscapes • (402) 405-5475',
    ].filter(Boolean).join('\n');

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';
    const replyTo = process.env.RESEND_REPLY_TO || 'rileykopf@luckylandscapes.com';

    const { data, error: sendErr } = await resend.emails.send({
      from: fromAddress,
      reply_to: replyTo,
      to: [to],
      subject: `Invoice ${invoice.invoice_number} from Lucky Landscapes — ${formatUSD(balance)} due`,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<mailto:rileykopf@luckylandscapes.com?subject=Unsubscribe>`,
      },
    });

    if (sendErr) {
      console.error('[send-invoice] Resend error:', sendErr);
      return NextResponse.json({ error: sendErr.message || 'Resend failed' }, { status: 500 });
    }

    // Mark invoice as sent
    await supabase
      .from('invoices')
      .update({
        sent_at: new Date().toISOString(),
        sent_via: invoice.sent_via === 'sms' ? 'both' : 'email',
        sent_to_email: to,
      })
      .eq('id', invoiceId);

    return NextResponse.json({ success: true, emailId: data?.id, payUrl });
  } catch (err) {
    console.error('[send-invoice] error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
