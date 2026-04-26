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
    <!-- Header -->
    <div style="background:#2D4A22; padding:32px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:24px;">🍀</span>
        <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700; display:inline;">Lucky Landscapes</h1>
      </div>
      <p style="color:rgba(255,255,255,0.75); margin:6px 0 0 32px; font-size:13px;">Creating outdoor spaces you'll feel lucky to have</p>
    </div>

    <div style="padding:32px;">
      <!-- Greeting -->
      <h2 style="color:#1f2937; margin:0 0 12px; font-size:22px; font-weight:700;">Hi ${customerName}, your invoice is ready 👋</h2>
      <p style="color:#4b5563; font-size:15px; line-height:1.65; margin:0 0 20px;">
        ${customMessage || 'Thank you for choosing Lucky Landscapes — we really appreciate your business! Your invoice is ready below, and you can pay online in just a few clicks using the secure button below.'}
      </p>

      <!-- Pay button — primary CTA -->
      <div style="text-align:center; margin:28px 0;">
        <a href="${payUrl}" style="display:inline-block; background:#2d7a3a; color:#fff; text-decoration:none; padding:16px 44px; border-radius:10px; font-weight:700; font-size:16px; box-shadow:0 2px 8px rgba(45,122,58,0.25);">
          Pay ${formatUSD(balance)} Online →
        </a>
        <div style="color:#6b7280; font-size:13px; margin-top:12px; line-height:1.5;">
          💳 Credit/Debit Card &nbsp;•&nbsp; 🏦 Bank Transfer (ACH)<br>
          <span style="color:#9ca3af; font-size:11px;">Secured by Stripe — your payment info never touches our servers</span>
        </div>
      </div>

      <!-- Invoice header bar -->
      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:18px 22px; margin-bottom:20px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Invoice number</td>
              <td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">${invoice.invoice_number}</td></tr>
          <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Issued</td>
              <td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937; font-size:14px;">${formatDate(invoice.created_at?.split('T')[0]) || 'Today'}</td></tr>
          ${dueDate ? `<tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Due</td>
              <td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">${dueDate}</td></tr>` : ''}
        </table>
      </div>

      ${items.length ? `
      <h3 style="color:#1f2937; margin:24px 0 12px; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Work performed</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px; border-radius:8px; overflow:hidden;">
        <thead><tr style="background:#6B8E4E;">
          <th style="padding:11px 14px; text-align:left; color:#fff; font-size:12px; font-weight:600; letter-spacing:0.03em;">Description</th>
          <th style="padding:11px 14px; text-align:center; color:#fff; font-size:12px; font-weight:600;">Qty</th>
          <th style="padding:11px 14px; text-align:right; color:#fff; font-size:12px; font-weight:600;">Total</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>` : ''}

      <!-- Totals -->
      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:18px 22px; margin:16px 0 24px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:5px 0; color:#6b7280; font-size:14px;">Subtotal</td>
              <td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937;">${formatUSD(invoice.subtotal)}</td></tr>
          ${Number(invoice.tax) ? `<tr><td style="padding:5px 0; color:#6b7280; font-size:14px;">Tax</td>
              <td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937;">${formatUSD(invoice.tax)}</td></tr>` : ''}
          ${Number(invoice.amount_paid) ? `<tr><td style="padding:5px 0; color:#2d7a3a; font-size:14px; font-weight:600;">Already paid</td>
              <td style="padding:5px 0; text-align:right; font-weight:600; color:#2d7a3a;">−${formatUSD(invoice.amount_paid)}</td></tr>` : ''}
          <tr><td style="padding:10px 0 0; border-top:2px solid #1f2937; font-size:17px; font-weight:700; color:#1f2937;">Balance due</td>
              <td style="padding:10px 0 0; border-top:2px solid #1f2937; text-align:right; font-size:22px; font-weight:800; color:#2d7a3a;">${formatUSD(balance)}</td></tr>
        </table>
      </div>

      ${invoice.notes ? `<div style="background:#fafaf8; border-left:3px solid #6B8E4E; padding:14px 18px; margin:0 0 22px; font-size:14px; color:#4b5563; line-height:1.6;"><strong style="color:#1f2937;">A note from us:</strong><br>${invoice.notes}</div>` : ''}

      <!-- How to pay -->
      <div style="background:#f0f7f0; border:1px solid #d4e7d4; border-radius:10px; padding:18px 22px; margin:0 0 24px;">
        <div style="font-weight:700; color:#1f6f3a; margin-bottom:8px; font-size:14px;">💡 How payment works</div>
        <p style="color:#4b5563; font-size:13px; line-height:1.6; margin:0;">
          Click the green "Pay Online" button above to open a secure payment page. You can pay by <strong>credit/debit card</strong> (instant) or <strong>bank transfer / ACH</strong> (lower fees, takes 3-5 business days to clear). You'll get an email receipt the moment your payment is received.
        </p>
      </div>

      <!-- Other ways to pay -->
      <div style="font-size:13px; color:#6b7280; line-height:1.7; margin:0 0 20px; text-align:center;">
        <strong style="color:#4b5563;">Prefer to pay another way?</strong><br>
        Cash or check: drop off or mail to <strong>109 South Canopy ST, Lincoln, NE</strong>.<br>
        Questions about this invoice? Just reply to this email or call <a href="tel:+14024055475" style="color:#2d7a3a; text-decoration:none; font-weight:600;">(402) 405-5475</a>.
      </div>

      <div style="text-align:center; margin:28px 0 8px;">
        <p style="color:#1f2937; font-size:14px; margin:0; font-weight:600;">Thanks again for your business!</p>
        <p style="color:#6b7280; font-size:13px; margin:4px 0 0;">— The Lucky Landscapes Team 🍀</p>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #e5e7eb; padding-top:20px; margin-top:28px; text-align:center;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">
          <strong>Lucky Landscapes</strong> • (402) 405-5475 • rileykopf@luckylandscapes.com
        </p>
        <p style="color:#9ca3af; font-size:12px; margin:4px 0 0;">109 South Canopy ST, Lincoln, NE</p>
      </div>
    </div>
  </div>
</body></html>`;

    const text = [
      `Hi ${customerName},`,
      '',
      customMessage || 'Thank you for choosing Lucky Landscapes — we really appreciate your business! Your invoice is ready.',
      '',
      `─── INVOICE ${invoice.invoice_number} ───`,
      `Balance Due: ${formatUSD(balance)}`,
      dueDate ? `Due: ${dueDate}` : null,
      '',
      `💳 Pay online (credit/debit card or bank transfer):`,
      payUrl,
      '',
      `Prefer cash or check? Drop off or mail to:`,
      `109 South Canopy ST, Lincoln, NE`,
      '',
      `Questions? Reply to this email or call (402) 405-5475.`,
      '',
      `Thanks again!`,
      `— The Lucky Landscapes Team 🍀`,
    ].filter(l => l !== null).join('\n');

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';
    const replyTo = process.env.RESEND_REPLY_TO || 'rileykopf@luckylandscapes.com';

    const { data, error: sendErr } = await resend.emails.send({
      from: fromAddress,
      reply_to: replyTo,
      to: [to],
      subject: `Your invoice from Lucky Landscapes — ${formatUSD(balance)} due (${invoice.invoice_number})`,
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
