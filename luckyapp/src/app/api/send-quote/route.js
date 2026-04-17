import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { to, customerName, quoteNumber, category, items, total, message } = body;

    // ── Validate ──────────────────────────────────────────────
    if (!to || !quoteNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: to, quoteNumber' },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not set in .env.local' },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // ── Format values ─────────────────────────────────────────
    const formattedTotal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(total || 0);

    // Build line-items HTML rows
    const itemRows = (items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px 12px; font-size: 14px; color: #1f2937; border-bottom: 1px solid #f3f4f6;">${item.name}</td>
          <td style="padding: 10px 12px; font-size: 14px; color: #6b7280; text-align: center; border-bottom: 1px solid #f3f4f6;">${item.quantity} ${item.unit || ''}</td>
          <td style="padding: 10px 12px; font-size: 14px; color: #1f2937; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${formatUSD(item.total)}</td>
        </tr>`
      )
      .join('');

    // ── Build HTML email ──────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#f5f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:#ffffff;">

    <!-- Header -->
    <div style="background:#2D4A22; padding:28px 32px;">
      <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700;">🍀 Lucky Landscapes</h1>
      <p style="color:rgba(255,255,255,0.65); margin:4px 0 0; font-size:13px;">Creating Outdoor Spaces You'll Feel Lucky to Have!</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h2 style="color:#1f2937; margin:0 0 8px; font-size:20px;">Your Estimate is Ready</h2>
      <p style="color:#6b7280; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Hi ${customerName || 'there'},<br><br>
        ${message || "Thank you for your interest in our services! We've prepared a detailed estimate for you."}
      </p>

      <!-- Quote Info Bar -->
      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:16px 20px; margin-bottom:20px; display:flex;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0; color:#6b7280; font-size:12px;">Quote #</td>
            <td style="padding:4px 0; text-align:right; font-weight:600; color:#1f2937; font-size:13px;">${quoteNumber}</td>
          </tr>
          ${category ? `<tr><td style="padding:4px 0; color:#6b7280; font-size:12px;">Category</td><td style="padding:4px 0; text-align:right; font-weight:600; color:#1f2937; font-size:13px;">${category}</td></tr>` : ''}
        </table>
      </div>

      <!-- Line Items Table -->
      ${items && items.length > 0 ? `
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
        <thead>
          <tr style="background:#6B8E4E;">
            <th style="padding:10px 12px; text-align:left; color:#fff; font-size:12px; font-weight:600;">Service / Item</th>
            <th style="padding:10px 12px; text-align:center; color:#fff; font-size:12px; font-weight:600;">Qty</th>
            <th style="padding:10px 12px; text-align:right; color:#fff; font-size:12px; font-weight:600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      ` : ''}

      <!-- Total -->
      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:16px 20px; margin-bottom:24px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0; font-size:16px; font-weight:700; color:#1f2937;">Total</td>
            <td style="padding:8px 0; text-align:right; font-size:20px; font-weight:800; color:#6B8E4E;">${formattedTotal}</td>
          </tr>
        </table>
      </div>

      <p style="color:#6b7280; font-size:13px; line-height:1.6; margin:0 0 24px;">
        This estimate is valid for 30 days. If you have any questions or would like to move forward, don't hesitate to reach out!
      </p>

      <!-- Call CTA -->
      <div style="text-align:center; margin:28px 0;">
        <a href="tel:+14024055475" style="display:inline-block; background:#2d7a3a; color:#fff; text-decoration:none; padding:14px 32px; border-radius:10px; font-weight:600; font-size:14px;">
          📞 Call Us: (402) 405-5475
        </a>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #e5e7eb; padding-top:20px; margin-top:24px; text-align:center;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">Lucky Landscapes • (402) 405-5475 • rileykopf@luckylandscapes.com</p>
        <p style="color:#9ca3af; font-size:12px; margin:4px 0 0;">109 South Canopy ST, Lincoln, NE</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    // ── Send via Resend (NO attachment — just clean HTML) ─────
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';

    console.log('[send-quote] Sending email...');
    console.log('[send-quote] From:', fromAddress);
    console.log('[send-quote] To:', to);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: `Estimate #${quoteNumber} from Lucky Landscapes — ${formattedTotal}`,
      html,
    });

    if (error) {
      console.error('[send-quote] Resend error:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: error.message || 'Resend failed to send' }, { status: 500 });
    }

    console.log('[send-quote] ✓ Sent! ID:', data?.id);
    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (err) {
    console.error('[send-quote] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

function formatUSD(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n || 0);
}
