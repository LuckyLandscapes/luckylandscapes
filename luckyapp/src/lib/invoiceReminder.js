// Shared invoice-reminder helpers — used by:
//   - /api/send-invoice-reminder         (manual button on finance page)
//   - /api/cron/auto-dunning             (Vercel cron, daily 9am)
//   - /api/preview-invoice-reminder      (renders HTML for preview)
//
// Keeping all three on one template ensures the email a customer sees from
// auto-dunning is identical to the one a manual click sends, and identical
// to what shows up in preview.

import { Resend } from 'resend';

export function fmtUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

export function fmtDate(d) {
  if (!d) return null;
  return new Date(d + (typeof d === 'string' && d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// daysOver → tone (matches finance.js A/R aging buckets).
export function pickTone(daysOver) {
  if (daysOver <= 30)  return 'friendly';
  if (daysOver <= 60)  return 'firm';
  return 'urgent';
}

export const TONE_COPY = {
  friendly: {
    subject: (num, bal) => `Friendly reminder — ${fmtUSD(bal)} due on invoice ${num}`,
    headline: (name) => `Hi ${name}, just a quick reminder 👋`,
    lead: 'We wanted to send a friendly nudge — your invoice below is showing as unpaid. If it slipped through, no worries! You can pay online in just a few clicks below. If you already sent payment, please disregard this.',
  },
  firm: {
    subject: (num, bal) => `Past due: ${fmtUSD(bal)} on invoice ${num}`,
    headline: (name) => `Hi ${name}, your invoice is past due`,
    lead: 'Our records show this invoice is past its due date and still unpaid. We\'d really appreciate it if you could take care of this in the next few days. Pay online below, or reach out if there\'s a question we can answer.',
  },
  urgent: {
    subject: (num, bal) => `URGENT: ${fmtUSD(bal)} significantly past due — invoice ${num}`,
    headline: (name) => `Hi ${name}, we need to settle this invoice`,
    lead: 'This invoice is now significantly past due. Please pay it online below as soon as possible, or call us at (402) 405-5475 so we can work something out. We don\'t want this to go any further.',
  },
};

export function buildReminderHtml({ invoice, customer, tone, daysOver, balance, payUrl }) {
  const copy = TONE_COPY[tone];
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'there';
  const dueDate = fmtDate(invoice.due_date);
  const headerBg = tone === 'urgent' ? '#fef2f2' : tone === 'firm' ? '#fffbeb' : '#f7f5f0';
  const headerBorder = tone === 'urgent' ? '#fecaca' : tone === 'firm' ? '#fde68a' : '#e5e7eb';
  const overdueColor = tone === 'urgent' ? '#b91c1c' : '#b45309';

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
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1f2937; margin:0 0 12px; font-size:22px; font-weight:700;">${copy.headline(customerName)}</h2>
      <p style="color:#4b5563; font-size:15px; line-height:1.65; margin:0 0 24px;">${copy.lead}</p>

      <div style="background:${headerBg}; border:1px solid ${headerBorder}; border-radius:10px; padding:18px 22px; margin-bottom:24px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Invoice</td>
              <td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">${invoice.invoice_number}</td></tr>
          ${dueDate ? `<tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Due date</td>
              <td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">${dueDate}</td></tr>` : ''}
          ${daysOver > 0 ? `<tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Days past due</td>
              <td style="padding:5px 0; text-align:right; font-weight:700; color:${overdueColor}; font-size:14px;">${daysOver} day${daysOver !== 1 ? 's' : ''}</td></tr>` : ''}
          <tr><td style="padding:8px 0 0; border-top:1px solid #e5e7eb; color:#1f2937; font-size:15px; font-weight:700;">Balance due</td>
              <td style="padding:8px 0 0; border-top:1px solid #e5e7eb; text-align:right; font-size:20px; font-weight:800; color:#2d7a3a;">${fmtUSD(balance)}</td></tr>
        </table>
      </div>

      <div style="text-align:center; margin:28px 0;">
        <a href="${payUrl}" style="display:inline-block; background:#2d7a3a; color:#fff; text-decoration:none; padding:16px 44px; border-radius:10px; font-weight:700; font-size:16px; box-shadow:0 2px 8px rgba(45,122,58,0.25);">
          Pay ${fmtUSD(balance)} Online →
        </a>
        <div style="color:#6b7280; font-size:13px; margin-top:12px; line-height:1.5;">
          💳 Credit/Debit Card &nbsp;•&nbsp; 🏦 Bank Transfer (ACH)<br>
          <span style="color:#9ca3af; font-size:11px;">Secured by Stripe</span>
        </div>
      </div>

      <div style="font-size:13px; color:#6b7280; line-height:1.7; margin:0 0 20px; text-align:center;">
        <strong style="color:#4b5563;">Questions or need to work something out?</strong><br>
        Reply to this email or call <a href="tel:+14024055475" style="color:#2d7a3a; text-decoration:none; font-weight:600;">(402) 405-5475</a>.<br>
        Cash or check: drop off or mail to <strong>109 South Canopy ST, Lincoln, NE</strong>.
      </div>

      <div style="text-align:center; margin:28px 0 8px;">
        <p style="color:#6b7280; font-size:13px; margin:4px 0 0;">— The Lucky Landscapes Team 🍀</p>
      </div>

      <div style="border-top:1px solid #e5e7eb; padding-top:20px; margin-top:28px; text-align:center;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">
          <strong>Lucky Landscapes</strong> • (402) 405-5475 • rileykopf@luckylandscapes.com
        </p>
      </div>
    </div>
  </div>
</body></html>`;
}

export function buildReminderText({ invoice, customer, tone, daysOver, balance, payUrl }) {
  const copy = TONE_COPY[tone];
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'there';
  const dueDate = fmtDate(invoice.due_date);
  return [
    copy.headline(customerName),
    '',
    copy.lead,
    '',
    `─── INVOICE ${invoice.invoice_number} ───`,
    `Balance Due: ${fmtUSD(balance)}`,
    dueDate ? `Due: ${dueDate}` : null,
    daysOver > 0 ? `Days past due: ${daysOver}` : null,
    '',
    `Pay online: ${payUrl}`,
    '',
    `Questions? Reply or call (402) 405-5475.`,
    '',
    `— Lucky Landscapes 🍀`,
  ].filter(l => l !== null).join('\n');
}

// Computes daysOver from due_date (or created_at if no due date set).
export function computeDaysOver(invoice, today = new Date()) {
  const due = invoice.due_date
    ? new Date(invoice.due_date + 'T12:00:00')
    : new Date(invoice.created_at);
  return Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
}

/**
 * Send a reminder for a single invoice. Centralizes:
 *   - looking up the invoice + customer
 *   - tone selection
 *   - Resend dispatch
 *   - audit log row
 *   - reminder counter bump
 *
 * Caller is expected to pass an already-loaded supabase service client.
 * Returns { ok, tone, daysOver, balance, sentTo, emailId, error? } — never throws.
 */
export async function sendInvoiceReminder({ supabase, invoiceId, sentBy = null, origin = 'https://app.luckylandscapes.com' }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not set', skip: true };
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, customers(first_name, last_name, email)')
    .eq('id', invoiceId)
    .single();
  if (error || !invoice) return { ok: false, error: 'Invoice not found' };
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return { ok: false, error: 'Invoice is not outstanding', skip: true };
  }

  const customer = invoice.customers || {};
  const to = customer.email || invoice.sent_to_email;
  if (!to) return { ok: false, error: 'No email on file', skip: true };

  const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
  if (balance <= 0) return { ok: false, error: 'No outstanding balance', skip: true };

  const daysOver = computeDaysOver(invoice);
  const tone = pickTone(daysOver);
  const payUrl = `${origin.replace(/\/$/, '')}/pay/${invoice.public_token}`;

  const html = buildReminderHtml({ invoice, customer, tone, daysOver, balance, payUrl });
  const text = buildReminderText({ invoice, customer, tone, daysOver, balance, payUrl });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';
  const replyTo = process.env.RESEND_REPLY_TO || 'rileykopf@luckylandscapes.com';

  let emailId = null;
  let sendErr = null;
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      reply_to: replyTo,
      to: [to],
      subject: TONE_COPY[tone].subject(invoice.invoice_number, balance),
      html,
      text,
      headers: {
        'List-Unsubscribe': `<mailto:rileykopf@luckylandscapes.com?subject=Unsubscribe>`,
      },
    });
    if (result.error) sendErr = result.error;
    else emailId = result.data?.id || null;
  } catch (err) {
    sendErr = err;
  }

  // Audit log — written either way so we know what happened
  await supabase.from('invoice_reminders').insert({
    org_id: invoice.org_id,
    invoice_id: invoice.id,
    sent_to_email: to,
    tone,
    days_overdue: daysOver,
    balance,
    sent_by: sentBy,
    email_id: emailId,
    error: sendErr ? (sendErr.message || String(sendErr)) : null,
  });

  if (sendErr) return { ok: false, error: sendErr.message || String(sendErr), tone, daysOver, balance };

  // Bump the invoice counters on success
  await supabase
    .from('invoices')
    .update({
      last_reminder_at: new Date().toISOString(),
      reminder_count: (invoice.reminder_count || 0) + 1,
    })
    .eq('id', invoice.id);

  return { ok: true, tone, daysOver, balance, sentTo: to, emailId };
}
