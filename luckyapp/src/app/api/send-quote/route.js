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
    <div style="background:#2D4A22; padding:32px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:24px;">🍀</span>
        <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700; display:inline;">Lucky Landscapes</h1>
      </div>
      <p style="color:rgba(255,255,255,0.75); margin:6px 0 0 32px; font-size:13px;">Creating outdoor spaces you'll feel lucky to have</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h2 style="color:#1f2937; margin:0 0 12px; font-size:22px; font-weight:700;">Hi ${customerName || 'there'}, your estimate is ready 🌿</h2>
      <p style="color:#4b5563; font-size:15px; line-height:1.65; margin:0 0 22px;">
        ${message || "Thanks so much for considering Lucky Landscapes — we'd love to bring your outdoor vision to life! Below is the detailed estimate we've put together for you. Take a look and let us know if you have any questions, want to make changes, or are ready to schedule the work."}
      </p>

      <!-- Quote Info Bar -->
      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:18px 22px; margin-bottom:20px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0; color:#6b7280; font-size:13px;">Quote number</td>
            <td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">#${quoteNumber}</td>
          </tr>
          ${category ? `<tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Project type</td><td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937; font-size:14px;">${category}</td></tr>` : ''}
          <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Valid for</td><td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937; font-size:14px;">30 days</td></tr>
        </table>
      </div>

      <!-- Line Items Table -->
      ${items && items.length > 0 ? `
      <h3 style="color:#1f2937; margin:24px 0 12px; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">What's included</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px; border-radius:8px; overflow:hidden;">
        <thead>
          <tr style="background:#6B8E4E;">
            <th style="padding:11px 14px; text-align:left; color:#fff; font-size:12px; font-weight:600; letter-spacing:0.03em;">Service / Item</th>
            <th style="padding:11px 14px; text-align:center; color:#fff; font-size:12px; font-weight:600;">Qty</th>
            <th style="padding:11px 14px; text-align:right; color:#fff; font-size:12px; font-weight:600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      ` : ''}

      <!-- Total -->
      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:18px 22px; margin-bottom:24px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0; font-size:17px; font-weight:700; color:#1f2937;">Estimated total</td>
            <td style="padding:8px 0; text-align:right; font-size:22px; font-weight:800; color:#2d7a3a;">${formattedTotal}</td>
          </tr>
        </table>
      </div>

      <!-- Next steps -->
      <div style="background:#f0f7f0; border:1px solid #d4e7d4; border-radius:10px; padding:18px 22px; margin:0 0 24px;">
        <div style="font-weight:700; color:#1f6f3a; margin-bottom:10px; font-size:14px;">✓ Ready to move forward?</div>
        <p style="color:#4b5563; font-size:13px; line-height:1.7; margin:0 0 6px;">
          1. <strong>Reply to this email</strong> with a "yes" — we'll reach out to schedule.<br>
          2. <strong>Call us at (402) 405-5475</strong> — we'll lock in dates and answer questions.<br>
          3. <strong>Have changes?</strong> Just reply with what you'd like adjusted; we'll send a revised estimate.
        </p>
      </div>

      <!-- CTAs -->
      <div style="text-align:center; margin:24px 0;">
        <a href="tel:+14024055475" style="display:inline-block; background:#2d7a3a; color:#fff; text-decoration:none; padding:14px 36px; border-radius:10px; font-weight:700; font-size:15px; box-shadow:0 2px 8px rgba(45,122,58,0.25);">
          📞 Call (402) 405-5475
        </a>
      </div>

      <p style="color:#6b7280; font-size:13px; line-height:1.65; margin:24px 0 0; text-align:center;">
        This estimate is valid for <strong>30 days</strong>. After that, prices may change due to seasonality and material costs — but we'll always work with you.
      </p>

      <div style="text-align:center; margin:28px 0 8px;">
        <p style="color:#1f2937; font-size:14px; margin:0; font-weight:600;">Looking forward to working with you!</p>
        <p style="color:#6b7280; font-size:13px; margin:4px 0 0;">— The Lucky Landscapes Team 🍀</p>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #e5e7eb; padding-top:20px; margin-top:28px; text-align:center;">
        <p style="color:#9ca3af; font-size:12px; margin:0;"><strong>Lucky Landscapes</strong> • (402) 405-5475 • rileykopf@luckylandscapes.com</p>
        <p style="color:#9ca3af; font-size:12px; margin:4px 0 0;">109 South Canopy ST, Lincoln, NE</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    // ── Send via Resend ────────────────────────────────────────
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';
    const replyTo = process.env.RESEND_REPLY_TO || 'rileykopf@luckylandscapes.com';

    // Build a plain-text fallback (spam filters penalize HTML-only emails)
    const plainItems = (items || [])
      .map((item) => `  • ${item.name} — Qty: ${item.quantity} ${item.unit || ''} — ${formatUSD(item.total)}`)
      .join('\n');

    const text = [
      `Hi ${customerName || 'there'},`,
      '',
      message || "Thanks so much for considering Lucky Landscapes — we'd love to bring your outdoor vision to life! Below is the detailed estimate we've put together for you.",
      '',
      `─── QUOTE #${quoteNumber}${category ? ` (${category})` : ''} ───`,
      plainItems || '(see attached details)',
      '─────────────────────────────',
      `Estimated total: ${formattedTotal}`,
      `Valid for: 30 days`,
      '',
      'READY TO MOVE FORWARD?',
      '  • Reply with a "yes" — we\'ll reach out to schedule',
      '  • Call us at (402) 405-5475',
      '  • Need changes? Just reply with what you\'d like adjusted',
      '',
      'Looking forward to working with you!',
      '— The Lucky Landscapes Team 🍀',
      '',
      'Lucky Landscapes • (402) 405-5475 • 109 South Canopy ST, Lincoln, NE',
    ].join('\n');

    console.log('[send-quote] Sending email...');
    console.log('[send-quote] From:', fromAddress);
    console.log('[send-quote] To:', to);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      reply_to: replyTo,
      to: [to],
      subject: `Your estimate from Lucky Landscapes — ${formattedTotal} (Quote #${quoteNumber})`,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<mailto:rileykopf@luckylandscapes.com?subject=Unsubscribe>`,
      },
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
