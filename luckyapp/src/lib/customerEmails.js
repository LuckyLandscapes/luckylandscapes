// Customer-facing transactional emails — sent to the customer (not the team)
// when key payment events succeed. Both are best-effort: they never throw,
// they just log + return so the webhook keeps processing the rest of its work.

import { Resend } from 'resend';

function fmtUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

function fmtDate(d) {
  if (!d) return null;
  const date = typeof d === 'string'
    ? new Date(d.includes('T') ? d : d + 'T12:00:00')
    : d;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function methodLabel(method) {
  return method === 'ach' ? 'bank transfer (ACH)' : 'credit/debit card';
}

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function getFrom() {
  return process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';
}

function getReplyTo() {
  return process.env.RESEND_REPLY_TO || 'rileykopf@luckylandscapes.com';
}

function emailShell(innerHtml) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#f5f5f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:#fff;">
    <div style="background:#2D4A22; padding:32px;">
      <div>
        <span style="font-size:24px;">🍀</span>
        <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700; display:inline; vertical-align:middle;">Lucky Landscapes</h1>
      </div>
      <p style="color:rgba(255,255,255,0.75); margin:6px 0 0; font-size:13px;">Creating outdoor spaces you'll feel lucky to have</p>
    </div>
    <div style="padding:32px;">
      ${innerHtml}
      <div style="border-top:1px solid #e5e7eb; padding-top:20px; margin-top:32px; text-align:center;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">
          <strong>Lucky Landscapes</strong> • (402) 405-5475 • rileykopf@luckylandscapes.com
        </p>
        <p style="color:#9ca3af; font-size:12px; margin:4px 0 0;">109 South Canopy ST, Lincoln, NE</p>
      </div>
    </div>
  </div>
</body></html>`;
}

// ─── Deposit-paid confirmation ──────────────────────────────────────────
//
// Sent right after a customer pays the deposit on a quote (which simultaneously
// accepts the quote). They've just trusted us with money — this confirms it
// landed and tells them what happens next.

export function buildDepositReceiptHtml({ customer, quote, amount, method }) {
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'there';
  const qNum = quote?.quote_number || quote?.id?.slice(0, 8) || '';
  return emailShell(`
    <h2 style="color:#1f2937; margin:0 0 12px; font-size:22px; font-weight:700;">Thanks ${customerName} — your deposit is in! 🎉</h2>
    <p style="color:#4b5563; font-size:15px; line-height:1.65; margin:0 0 20px;">
      We received your deposit on Quote #${qNum} and your project is officially on the books. We're already lining up materials and scheduling.
    </p>

    <div style="background:#f0f7f0; border:1px solid #d4e7d4; border-radius:10px; padding:18px 22px; margin-bottom:24px;">
      <div style="font-weight:700; color:#1f6f3a; margin-bottom:10px; font-size:14px; text-transform:uppercase; letter-spacing:0.04em;">Deposit Receipt</div>
      <table style="width:100%; border-collapse:collapse;">
        <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Quote</td>
            <td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">#${qNum}</td></tr>
        <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Paid via</td>
            <td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937; font-size:14px;">${methodLabel(method)}</td></tr>
        <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Date</td>
            <td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937; font-size:14px;">${fmtDate(new Date())}</td></tr>
        <tr><td style="padding:10px 0 0; border-top:2px solid #1f2937; font-size:15px; font-weight:700; color:#1f2937;">Deposit paid</td>
            <td style="padding:10px 0 0; border-top:2px solid #1f2937; text-align:right; font-size:20px; font-weight:800; color:#2d7a3a;">${fmtUSD(amount)}</td></tr>
      </table>
    </div>

    <h3 style="color:#1f2937; margin:24px 0 8px; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">What happens next</h3>
    <ol style="color:#4b5563; font-size:14px; line-height:1.7; padding-left:20px; margin:0 0 24px;">
      <li><strong>Scheduling:</strong> we'll reach out within 1–2 business days with a confirmed work date.</li>
      <li><strong>Materials:</strong> we'll order what's needed and stage it for delivery.</li>
      <li><strong>Day of work:</strong> our crew will arrive on time and walk you through what we're doing.</li>
      <li><strong>Final invoice:</strong> the remaining balance is invoiced when work is complete.</li>
    </ol>

    <div style="font-size:13px; color:#6b7280; line-height:1.7; margin:0 0 8px; text-align:center;">
      Questions? Reply to this email or call <a href="tel:+14024055475" style="color:#2d7a3a; text-decoration:none; font-weight:600;">(402) 405-5475</a>.
    </div>

    <div style="text-align:center; margin:28px 0 8px;">
      <p style="color:#1f2937; font-size:14px; margin:0; font-weight:600;">Thanks again for choosing Lucky Landscapes!</p>
      <p style="color:#6b7280; font-size:13px; margin:4px 0 0;">— Riley &amp; the Lucky Landscapes Team 🍀</p>
    </div>
  `);
}

export async function sendDepositReceipt({ to, customer, quote, amount, method }) {
  const resend = getResend();
  if (!resend || !to) return { ok: false, skip: true };
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'there';
  const qNum = quote?.quote_number || '';
  try {
    const result = await resend.emails.send({
      from: getFrom(),
      reply_to: getReplyTo(),
      to: [to],
      subject: `Deposit received — thanks ${customerName}! (Quote #${qNum})`,
      html: buildDepositReceiptHtml({ customer, quote, amount, method }),
      text: [
        `Hi ${customerName},`,
        '',
        `We received your deposit on Quote #${qNum} — thank you! Your project is officially scheduled.`,
        '',
        `─── DEPOSIT RECEIPT ───`,
        `Quote: #${qNum}`,
        `Amount: ${fmtUSD(amount)}`,
        `Paid via: ${methodLabel(method)}`,
        `Date: ${fmtDate(new Date())}`,
        '',
        `What happens next:`,
        `1. We'll reach out within 1-2 business days with a confirmed work date.`,
        `2. We order materials and stage them for delivery.`,
        `3. Our crew arrives on time and walks you through the work.`,
        `4. Final balance is invoiced when work is complete.`,
        '',
        `Questions? Reply to this email or call (402) 405-5475.`,
        '',
        `— Riley & the Lucky Landscapes Team 🍀`,
      ].join('\n'),
    });
    if (result.error) {
      console.error('[customerEmails] deposit receipt failed:', result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, emailId: result.data?.id };
  } catch (err) {
    console.error('[customerEmails] deposit receipt threw:', err);
    return { ok: false, error: err.message };
  }
}

// ─── Invoice-paid confirmation ──────────────────────────────────────────
//
// Sent when an invoice flips to fully `paid` (final invoice, after-job invoice,
// etc). Functions as the customer's receipt for tax / their records.

export function buildInvoicePaidHtml({ customer, invoice, amount, method }) {
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'there';
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const itemRows = items.map(item => `
      <tr>
        <td style="padding:10px 12px; font-size:14px; color:#1f2937; border-bottom:1px solid #f3f4f6;">${item.name || 'Service'}</td>
        <td style="padding:10px 12px; font-size:14px; color:#6b7280; text-align:center; border-bottom:1px solid #f3f4f6;">${item.quantity || 1}</td>
        <td style="padding:10px 12px; font-size:14px; color:#1f2937; text-align:right; font-weight:600; border-bottom:1px solid #f3f4f6;">${fmtUSD(item.total)}</td>
      </tr>`).join('');

  return emailShell(`
    <h2 style="color:#1f2937; margin:0 0 12px; font-size:22px; font-weight:700;">Thanks ${customerName} — payment received! ✅</h2>
    <p style="color:#4b5563; font-size:15px; line-height:1.65; margin:0 0 24px;">
      Your payment for invoice ${invoice.invoice_number || ''} has cleared and your account is paid in full. Keep this email as your receipt.
    </p>

    <div style="background:#f0f7f0; border:1px solid #d4e7d4; border-radius:10px; padding:18px 22px; margin-bottom:24px;">
      <div style="font-weight:700; color:#1f6f3a; margin-bottom:10px; font-size:14px; text-transform:uppercase; letter-spacing:0.04em;">Payment Receipt</div>
      <table style="width:100%; border-collapse:collapse;">
        <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Invoice</td>
            <td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">${invoice.invoice_number || ''}</td></tr>
        <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Paid via</td>
            <td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937; font-size:14px;">${methodLabel(method)}</td></tr>
        <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Payment date</td>
            <td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937; font-size:14px;">${fmtDate(new Date())}</td></tr>
        <tr><td style="padding:10px 0 0; border-top:2px solid #1f2937; font-size:15px; font-weight:700; color:#1f2937;">Amount paid</td>
            <td style="padding:10px 0 0; border-top:2px solid #1f2937; text-align:right; font-size:20px; font-weight:800; color:#2d7a3a;">${fmtUSD(amount)}</td></tr>
      </table>
    </div>

    ${items.length ? `
    <h3 style="color:#1f2937; margin:24px 0 12px; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Work performed</h3>
    <table style="width:100%; border-collapse:collapse; margin-bottom:8px; border-radius:8px; overflow:hidden;">
      <thead><tr style="background:#6B8E4E;">
        <th style="padding:11px 14px; text-align:left; color:#fff; font-size:12px; font-weight:600;">Description</th>
        <th style="padding:11px 14px; text-align:center; color:#fff; font-size:12px; font-weight:600;">Qty</th>
        <th style="padding:11px 14px; text-align:right; color:#fff; font-size:12px; font-weight:600;">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>` : ''}

    <div style="font-size:13px; color:#6b7280; line-height:1.7; margin:24px 0 8px; text-align:center;">
      We loved working with you. If you've got friends or neighbors who need landscaping, we'd be lucky to be your referral.<br>
      Questions about this receipt? Reply or call <a href="tel:+14024055475" style="color:#2d7a3a; text-decoration:none; font-weight:600;">(402) 405-5475</a>.
    </div>

    <div style="text-align:center; margin:28px 0 8px;">
      <p style="color:#1f2937; font-size:14px; margin:0; font-weight:600;">Thank you!</p>
      <p style="color:#6b7280; font-size:13px; margin:4px 0 0;">— Riley &amp; the Lucky Landscapes Team 🍀</p>
    </div>
  `);
}

export async function sendInvoicePaidReceipt({ to, customer, invoice, amount, method }) {
  const resend = getResend();
  if (!resend || !to) return { ok: false, skip: true };
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'there';
  try {
    const result = await resend.emails.send({
      from: getFrom(),
      reply_to: getReplyTo(),
      to: [to],
      subject: `Payment received — thanks ${customerName}! (${invoice.invoice_number || 'Invoice'})`,
      html: buildInvoicePaidHtml({ customer, invoice, amount, method }),
      text: [
        `Hi ${customerName},`,
        '',
        `Your payment for invoice ${invoice.invoice_number || ''} has cleared. Keep this email as your receipt.`,
        '',
        `─── PAYMENT RECEIPT ───`,
        `Invoice: ${invoice.invoice_number || ''}`,
        `Amount: ${fmtUSD(amount)}`,
        `Paid via: ${methodLabel(method)}`,
        `Date: ${fmtDate(new Date())}`,
        '',
        `Questions? Reply or call (402) 405-5475.`,
        '',
        `— Riley & the Lucky Landscapes Team 🍀`,
      ].join('\n'),
    });
    if (result.error) {
      console.error('[customerEmails] invoice paid receipt failed:', result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, emailId: result.data?.id };
  } catch (err) {
    console.error('[customerEmails] invoice paid receipt threw:', err);
    return { ok: false, error: err.message };
  }
}
