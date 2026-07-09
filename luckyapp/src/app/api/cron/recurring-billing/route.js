import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getStripe, getServiceSupabase, getAppOrigin } from '@/lib/stripeServer';
import { notifyOrg } from '@/lib/notify';
import { sendRecurringInvoiceEmail } from '@/lib/customerEmails';
import { addInterval, amountForNextCharge, isFixedTerm } from '@/lib/recurring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// URL-safe hex token (same shape as makeUrlSafeToken in src/lib/data.js).
function makeToken() {
  return randomBytes(18).toString('hex');
}

// Next INV-#### for an org (max existing numeric suffix + 1). Low-volume daily
// cron, so a full scan is fine; sequential inserts keep it monotonic within a run.
async function nextInvoiceNumber(supabase, orgId) {
  const { data } = await supabase.from('invoices').select('invoice_number').eq('org_id', orgId);
  let max = 0;
  for (const r of (data || [])) {
    const m = String(r.invoice_number || '').match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Daily. Generates the period's invoice for every active plan that's due, then
// either auto-charges the saved card (payment_mode='autopay') or emails the pay
// link. Advances next_run_date by the plan's interval.
export async function GET(request) {
  // Fail closed — Vercel's un-forgeable header OR the shared secret. In prod,
  // neither present → 401. Dev is allowed through for smoke-testing. (Do NOT
  // wrap this in `if (cronSecret)` — that would skip auth if the env var is unset.)
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron');
  const authed = isVercelCron || (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`);
  if (!authed && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
  const stripe = getStripe(); // may be null if Stripe isn't configured
  const origin = getAppOrigin(request);
  const todayStr = todayDateStr();

  const { data: plans, error } = await supabase
    .from('recurring_plans')
    .select('*, customers(id, first_name, last_name, email, stripe_customer_id)')
    .eq('status', 'active')
    .lte('next_run_date', todayStr);
  if (error) {
    console.error('[recurring-billing] query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = { due: (plans || []).length, processed: 0, charged: 0, invoiced: 0, failed: 0, skipped: 0, completed: 0 };

  for (const plan of (plans || [])) {
    try {
      const customer = plan.customers || {};
      // On the last period of a fixed term this returns the exact remainder so
      // the payments sum to contract_amount to the cent (never overcharge).
      const amount = amountForNextCharge(plan);
      if (amount <= 0) { summary.skipped++; continue; }

      const fixedTerm = isFixedTerm(plan);
      const periodNo = (Number(plan.periods_billed) || 0) + 1;

      // 1. Line items for the generated invoice. Fixed-term plans always bill a
      //    single computed line (the final period's amount differs).
      const items = (!fixedTerm && Array.isArray(plan.line_items) && plan.line_items.length)
        ? plan.line_items
        : [{ name: plan.title, quantity: 1, unitPrice: amount, total: amount }];
      const subtotal = items.reduce((s, it) => s + (Number(it.total) || 0), 0);
      const total = subtotal; // recurring lines are tax-inclusive; no tax row

      // 2. Create the unpaid invoice with its own pay token.
      const invoiceNumber = await nextInvoiceNumber(supabase, plan.org_id);
      const { data: invoice, error: invErr } = await supabase.from('invoices').insert({
        org_id: plan.org_id,
        customer_id: plan.customer_id,
        invoice_number: invoiceNumber,
        status: 'unpaid',
        subtotal, tax: 0, tax_rate: 0, total, amount_paid: 0,
        items,
        due_date: todayStr,
        public_token: makeToken(),
        notes: fixedTerm
          ? `Recurring: ${plan.title} (payment ${periodNo} of ${plan.total_periods})`
          : `Recurring: ${plan.title}`,
      }).select().single();
      if (invErr || !invoice) {
        console.error('[recurring-billing] invoice insert failed for plan', plan.id, invErr);
        summary.failed++;
        continue;
      }

      // 3. Charge the saved card, or fall back to the pay link.
      const canAutopay = plan.payment_mode === 'autopay'
        && plan.stripe_payment_method_id
        && customer.stripe_customer_id
        && !!stripe;
      let charged = false;

      if (canAutopay) {
        try {
          await stripe.paymentIntents.create({
            amount: Math.round(total * 100),
            currency: 'usd',
            customer: customer.stripe_customer_id,
            payment_method: plan.stripe_payment_method_id,
            off_session: true,
            confirm: true,
            description: `${plan.title} — Lucky Landscapes`,
            receipt_email: customer.email || undefined,
            metadata: {
              kind: 'recurring_charge',
              invoice_id: invoice.id,
              invoice_number: invoiceNumber,
              plan_id: plan.id,
              org_id: plan.org_id,
              customer_id: plan.customer_id,
            },
          });
          // Success path: the Stripe webhook (payment_intent.succeeded → invoice
          // branch) records the payment row, marks the invoice paid, and emails
          // the receipt — same as any online payment. We don't double-write here.
          charged = true;
          summary.charged++;
        } catch (chargeErr) {
          // Declined / requires authentication → invoice stays unpaid; email the
          // pay link so they can pay manually, and flag it for the team.
          console.warn('[recurring-billing] autopay declined, plan', plan.id, chargeErr?.message);
          summary.failed++;
          await sendRecurringInvoiceEmail({ to: customer.email, customer, invoice, planTitle: plan.title, origin, autopayFailed: true }).catch(() => {});
          try {
            await notifyOrg({
              orgId: plan.org_id,
              type: 'autopay_failed',
              title: `Autopay declined — ${[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Customer'}`,
              body: `Card declined for "${plan.title}" (${invoiceNumber}). Pay link emailed to the customer.`,
              link: `/invoices/${invoice.id}`,
              data: { planId: plan.id, invoiceId: invoice.id },
            });
          } catch { /* best effort */ }
        }
      }

      if (!charged && !canAutopay) {
        // Invoice mode (no card on file) → email the pay link.
        await sendRecurringInvoiceEmail({ to: customer.email, customer, invoice, planTitle: plan.title, origin }).catch(() => {});
        summary.invoiced++;
      }

      // 4. Count the payment and advance — or close out a finished contract.
      const done = fixedTerm && periodNo >= Number(plan.total_periods);
      await supabase.from('recurring_plans').update({
        periods_billed: periodNo,
        status: done ? 'completed' : plan.status,
        next_run_date: done ? plan.next_run_date : addInterval(plan.next_run_date, plan.interval),
        last_run_at: new Date().toISOString(),
        last_invoice_id: invoice.id,
        updated_at: new Date().toISOString(),
      }).eq('id', plan.id);
      if (done) summary.completed++;

      summary.processed++;
    } catch (planErr) {
      console.error('[recurring-billing] plan error', plan.id, planErr);
      summary.failed++;
    }
  }

  return NextResponse.json({ ok: true, date: todayStr, ...summary });
}
