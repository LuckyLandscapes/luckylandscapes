// Returns the exact HTML the customer would see for an invoice reminder.
// Used by the "Preview" button on the finance page so the owner can see what
// the auto-dunning system is sending out without actually sending anything.

import { NextResponse } from 'next/server';
import { getServiceSupabase, getAppOrigin } from '@/lib/stripeServer';
import {
  buildReminderHtml, computeDaysOver, pickTone,
} from '@/lib/invoiceReminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const invoiceId = url.searchParams.get('invoiceId');
  const toneOverride = url.searchParams.get('tone'); // optional: friendly|firm|urgent

  if (!invoiceId) {
    return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, customers(first_name, last_name, email)')
    .eq('id', invoiceId)
    .single();
  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const customer = invoice.customers || {};
  const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
  const daysOver = computeDaysOver(invoice);
  const tone = ['friendly', 'firm', 'urgent'].includes(toneOverride) ? toneOverride : pickTone(daysOver);
  const origin = getAppOrigin(request);
  const payUrl = `${origin.replace(/\/$/, '')}/pay/${invoice.public_token}`;

  const html = buildReminderHtml({ invoice, customer, tone, daysOver, balance, payUrl });

  // Wrap with a slim preview banner at the top so it's clear this is a preview
  // (and not a real email that got delivered).
  const previewBanner = `
<div style="position:sticky; top:0; z-index:10; background:#1f2937; color:#fff; padding:10px 20px; font-family:-apple-system,sans-serif; font-size:13px;">
  <strong>📧 Email Preview</strong> — This is what the customer would receive.
  Tone: <strong style="text-transform:uppercase;">${tone}</strong> ·
  Days overdue: ${daysOver} ·
  <a href="?invoiceId=${invoiceId}&tone=friendly" style="color:#a7f3d0;">friendly</a> |
  <a href="?invoiceId=${invoiceId}&tone=firm" style="color:#fde68a;">firm</a> |
  <a href="?invoiceId=${invoiceId}&tone=urgent" style="color:#fecaca;">urgent</a>
</div>`;

  const wrapped = html.replace('<body', '<body data-preview="1"').replace('<body data-preview="1" style="', `<body data-preview="1" style="`);
  // Inject the banner immediately after <body ...>
  const injected = wrapped.replace(/<body([^>]*)>/, `<body$1>${previewBanner}`);

  return new Response(injected, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
