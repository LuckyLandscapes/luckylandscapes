import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

function formatUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

// ─── POST — email a contract sign link to the customer ───────────────────────
// Body shape:
//   { contractId, to, customerName, message? }
// On success, marks the contract as `sent` (status bumped from 'draft' if so)
// and stamps `sent_at`.
export async function POST(request) {
  try {
    const body = await request.json();
    const { contractId, to, customerName, message } = body;

    if (!contractId || !to) {
      return NextResponse.json({ error: 'Missing required fields: contractId, to' }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not set' }, { status: 500 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

    const { data: contract, error: fetchErr } = await supabase
      .from('contracts')
      .select(`
        id, contract_number, status, title, category,
        total_amount, deposit_amount, public_token, customer_snapshot
      `)
      .eq('id', contractId)
      .single();

    if (fetchErr || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }
    if (contract.status === 'signed') {
      return NextResponse.json({ error: 'This contract is already signed.' }, { status: 400 });
    }
    if (contract.status === 'void') {
      return NextResponse.json({ error: 'This contract has been voided.' }, { status: 400 });
    }

    // Build the public sign link from the request origin so this works in dev,
    // staging, and prod without extra env coordination.
    const origin = process.env.NEXT_PUBLIC_APP_URL
      || `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;
    const signLink = `${origin.replace(/\/$/, '')}/sign/${contract.public_token}`;

    const total = formatUSD(contract.total_amount);
    const deposit = Number(contract.deposit_amount || 0);
    const depositStr = formatUSD(deposit);
    const projectLabel = contract.title || contract.category || 'Service Agreement';
    const intro = message
      || `Your service agreement for the ${projectLabel.toLowerCase()} project is ready to review and sign. Take a moment to read through it — sign when you're ready, or hit "Request changes" if anything needs adjustment before work begins.`;

    // ─── HTML email ────────────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#f5f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:#ffffff;">

    <div style="background:#2D4A22; padding:32px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:24px;">🍀</span>
        <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700; display:inline;">Lucky Landscapes</h1>
      </div>
      <p style="color:rgba(255,255,255,0.75); margin:6px 0 0 32px; font-size:13px;">Service Agreement — ready for your signature</p>
    </div>

    <div style="padding:32px;">
      <h2 style="color:#1f2937; margin:0 0 12px; font-size:22px; font-weight:700;">Hi ${customerName || 'there'}, your contract is ready ✍️</h2>
      <p style="color:#4b5563; font-size:15px; line-height:1.65; margin:0 0 22px;">${intro}</p>

      <div style="background:#f7f5f0; border:1px solid #e5e7eb; border-radius:10px; padding:18px 22px; margin-bottom:20px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Agreement</td><td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">#${contract.contract_number}</td></tr>
          ${projectLabel ? `<tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Project</td><td style="padding:5px 0; text-align:right; font-weight:600; color:#1f2937; font-size:14px;">${projectLabel}</td></tr>` : ''}
          <tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Total</td><td style="padding:5px 0; text-align:right; font-weight:700; color:#1f2937; font-size:14px;">${total}</td></tr>
          ${deposit > 0 ? `<tr><td style="padding:5px 0; color:#6b7280; font-size:13px;">Deposit on signing</td><td style="padding:5px 0; text-align:right; font-weight:600; color:#2d7a3a; font-size:14px;">${depositStr}</td></tr>` : ''}
        </table>
      </div>

      <div style="text-align:center; margin:8px 0 24px;">
        <a href="${signLink}" style="display:inline-block; background:#2d7a3a; color:#fff; text-decoration:none; padding:16px 32px; border-radius:10px; font-weight:700; font-size:15px; box-shadow:0 2px 8px rgba(45,122,58,0.25);">
          Review &amp; Sign Agreement
        </a>
        <div style="font-size:12px; color:#888; margin-top:10px;">
          Or open the link directly: <a href="${signLink}" style="color:#2d7a3a; word-break:break-all;">${signLink}</a>
        </div>
      </div>

      <div style="background:#f0f7f0; border:1px solid #d4e7d4; border-radius:10px; padding:18px 22px; margin:0 0 24px;">
        <div style="font-weight:700; color:#1f6f3a; margin-bottom:10px; font-size:14px;">How signing works</div>
        <p style="color:#4b5563; font-size:13px; line-height:1.7; margin:0;">
          • <strong>Read every section</strong> of the agreement carefully.<br>
          • <strong>Sign with your finger or mouse</strong> in the signature box, type your full legal name, then submit.<br>
          • <strong>Need changes first?</strong> Tap "Request changes" on the page and tell us what to adjust — we'll send a revised version.<br>
          • Once signed, you'll get a copy of the signed PDF for your records.
        </p>
      </div>

      <p style="color:#6b7280; font-size:13px; line-height:1.65; margin:24px 0 0;">
        Questions before signing? Reply to this email or call us at <a href="tel:+14024055475" style="color:#2d7a3a;">(402) 405-5475</a>.
      </p>

      <div style="text-align:center; margin:28px 0 8px;">
        <p style="color:#1f2937; font-size:14px; margin:0; font-weight:600;">Looking forward to working with you!</p>
        <p style="color:#6b7280; font-size:13px; margin:4px 0 0;">— The Lucky Landscapes Team 🍀</p>
      </div>

      <div style="border-top:1px solid #e5e7eb; padding-top:20px; margin-top:28px; text-align:center;">
        <p style="color:#9ca3af; font-size:12px; margin:0;"><strong>Lucky Landscapes</strong> • (402) 405-5475 • rileykopf@luckylandscapes.com</p>
        <p style="color:#9ca3af; font-size:12px; margin:4px 0 0;">109 South Canopy ST, Lincoln, NE</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = [
      `Hi ${customerName || 'there'},`,
      '',
      intro,
      '',
      `─── CONTRACT #${contract.contract_number}${projectLabel ? ` — ${projectLabel}` : ''} ───`,
      `Total:   ${total}`,
      deposit > 0 ? `Deposit: ${depositStr} (due on signing)` : null,
      '─────────────────────────────',
      '',
      `Review and sign here: ${signLink}`,
      '',
      'Need changes first? Open the link and tap "Request changes" to tell us what to adjust.',
      '',
      'Questions? Call (402) 405-5475 or reply to this email.',
      '',
      '— The Lucky Landscapes Team',
    ].filter(Boolean).join('\n');

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Lucky Landscapes <onboarding@resend.dev>';
    const replyTo = process.env.RESEND_REPLY_TO || 'rileykopf@luckylandscapes.com';

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendErr } = await resend.emails.send({
      from: fromAddress,
      to,
      reply_to: replyTo,
      subject: `Sign your Lucky Landscapes service agreement (#${contract.contract_number})`,
      html,
      text,
    });

    if (sendErr) {
      console.error('[send-contract] Resend error:', sendErr);
      return NextResponse.json({ error: sendErr.message || 'Failed to send email' }, { status: 500 });
    }

    // Mark sent (only if currently draft — don't downgrade a viewed/declined row)
    const updates = { sent_at: new Date().toISOString() };
    if (contract.status === 'draft') updates.status = 'sent';
    await supabase.from('contracts').update(updates).eq('id', contract.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-contract] error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to send contract' }, { status: 500 });
  }
}
