import { NextResponse } from 'next/server';
import { getStripe, isStripeConfigured, getServiceSupabase } from '@/lib/stripeServer';
import { notifyOrg } from '@/lib/notify';
import { sendDepositReceipt, sendInvoicePaidReceipt } from '@/lib/customerEmails';

const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtCustomerName = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || 'Customer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const stripe = getStripe();
  const sig = request.headers.get('stripe-signature');
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Hard-fail without a webhook secret. Accepting unsigned events lets anyone
  // forge payment_succeeded and mark invoices paid — never acceptable.
  if (!whSecret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not set; refusing all events');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event;
  const rawBody = await request.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err) {
    console.error('[stripe webhook] verify failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const meta = intent.metadata || {};
      const orgId = meta.org_id;

      // ── Quote deposit (materials + delivery to schedule the job) ──────────
      if (meta.kind === 'quote_deposit') {
        const quoteId = meta.quote_id;
        if (!quoteId || !orgId) {
          console.warn('[stripe webhook] quote_deposit missing metadata');
          return NextResponse.json({ received: true });
        }

        const charge = intent.latest_charge
          ? await stripe.charges.retrieve(typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id)
          : null;
        const pm = charge?.payment_method_details;
        const method = pm?.us_bank_account ? 'ach' : 'card';
        const fee = charge?.balance_transaction
          ? (await stripe.balanceTransactions.retrieve(typeof charge.balance_transaction === 'string' ? charge.balance_transaction : charge.balance_transaction.id)).fee / 100
          : 0;
        const amount = intent.amount_received / 100;
        const paidAt = new Date(intent.created * 1000).toISOString();

        // Idempotency: have we already recorded this payment intent against the quote?
        const { data: existingQuote } = await supabase
          .from('quotes')
          .select('id, deposit_payment_intent_id')
          .eq('id', quoteId)
          .maybeSingle();

        if (existingQuote?.deposit_payment_intent_id === intent.id) {
          console.log('[stripe webhook] quote deposit already recorded:', intent.id);
          return NextResponse.json({ received: true });
        }

        // Record a payment row (no invoice_id yet — this is a quote deposit)
        await supabase.from('payments').insert({
          org_id: orgId,
          invoice_id: null,
          customer_id: meta.customer_id || null,
          amount,
          method,
          status: 'succeeded',
          stripe_payment_intent_id: intent.id,
          stripe_charge_id: charge?.id || null,
          processor_fee: fee,
          net_amount: amount - fee,
          paid_at: paidAt,
          notes: `Quote #${meta.quote_number || ''} deposit (${meta.deposit_type === 'percentage' && meta.deposit_percentage ? `${meta.deposit_percentage}% of total` : 'materials + delivery'}) via ${method === 'ach' ? 'bank transfer' : 'card'}`,
        });

        // Mark quote accepted + record the deposit
        await supabase.from('quotes').update({
          status: 'accepted',
          accepted_at: paidAt,
          deposit_paid_at: paidAt,
          deposit_payment_intent_id: intent.id,
        }).eq('id', quoteId);

        // Look up the quote + customer (used for both team notification + customer receipt)
        let quoteRecord = null;
        let customerRecord = null;
        try {
          const { data: q } = await supabase
            .from('quotes')
            .select('id, quote_number, customers ( id, first_name, last_name, email )')
            .eq('id', quoteId)
            .maybeSingle();
          quoteRecord = q;
          customerRecord = q?.customers || null;
        } catch (lookupErr) {
          console.error('[stripe webhook] quote/customer lookup failed', lookupErr);
        }

        // Notify the team — quote accepted + deposit paid (single combined event)
        try {
          const quoteNumber = quoteRecord?.quote_number || meta.quote_number || '';
          const customerName = fmtCustomerName(customerRecord);
          await notifyOrg({
            orgId,
            type: 'quote_accepted',
            title: `Quote #${quoteNumber} accepted — ${customerName}`,
            body: `${customerName} accepted Quote #${quoteNumber} and paid the ${fmtMoney(amount)} deposit via ${method === 'ach' ? 'bank transfer' : 'card'}.`,
            link: `/quotes/${quoteId}`,
            data: { quoteId, amount, method },
          });
        } catch (notifyErr) {
          console.error('[stripe webhook] quote_accepted notify failed', notifyErr);
        }

        // Customer-facing deposit receipt (best-effort; never blocks)
        try {
          const customerEmail = customerRecord?.email;
          if (customerEmail) {
            await sendDepositReceipt({
              to: customerEmail,
              customer: customerRecord,
              quote: quoteRecord || { quote_number: meta.quote_number },
              amount,
              method,
            });
          } else {
            console.warn('[stripe webhook] deposit paid but customer has no email on file');
          }
        } catch (mailErr) {
          console.error('[stripe webhook] deposit receipt failed', mailErr);
        }

        return NextResponse.json({ received: true });
      }

      // ── Invoice payment (existing flow) ───────────────────────────────────
      const invoiceId = meta.invoice_id;
      if (!invoiceId || !orgId) {
        console.warn('[stripe webhook] payment_intent.succeeded missing invoice metadata');
        return NextResponse.json({ received: true });
      }

      // Determine method (card vs ach) from charges
      const charge = intent.latest_charge
        ? await stripe.charges.retrieve(typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id)
        : null;
      const pm = charge?.payment_method_details;
      const method = pm?.us_bank_account ? 'ach' : 'card';
      const fee = charge?.balance_transaction
        ? (await stripe.balanceTransactions.retrieve(typeof charge.balance_transaction === 'string' ? charge.balance_transaction : charge.balance_transaction.id)).fee / 100
        : 0;
      const amount = intent.amount_received / 100;

      // Idempotency: skip if we already recorded this payment_intent
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_payment_intent_id', intent.id)
        .maybeSingle();

      if (existing) {
        console.log('[stripe webhook] payment already recorded:', intent.id);
        return NextResponse.json({ received: true });
      }

      // Fetch the invoice FIRST so we can detect already-paid / overpayment
      // before we commit the new payment row. Two paths can fire for the
      // same invoice — manual "Mark Paid" / "Record Payment" AND the webhook —
      // and the prior code blindly incremented amount_paid, doubling the
      // amount on the invoice when both fired (see screenshot 2026-05-12).
      const { data: inv, error: invFetchErr } = await supabase
        .from('invoices')
        .select('total, amount_paid, status, invoice_number, customer_id, items')
        .eq('id', invoiceId)
        .single();
      if (invFetchErr) {
        console.error('[stripe webhook] invoice fetch failed:', invFetchErr);
        return NextResponse.json({ error: 'invoice fetch failed' }, { status: 500 });
      }

      const currentPaid = Number(inv?.amount_paid || 0);
      const total = Number(inv?.total || 0);
      const alreadyFullyPaid = inv?.status === 'paid' || currentPaid >= total;
      const wouldOverpay = currentPaid + amount > total + 0.01; // 1¢ tolerance for FP rounding

      // Record payment row. If the invoice was already paid (or this charge
      // would push amount_paid past total), we STILL log the row — Stripe
      // genuinely took the customer's money and we need an audit trail — but
      // we flag it so Riley can refund and avoid double-counting in revenue.
      const isDuplicate = alreadyFullyPaid || wouldOverpay;
      const noteParts = [`Online payment via ${method === 'ach' ? 'bank transfer' : 'card'}`];
      if (isDuplicate) {
        noteParts.push(
          alreadyFullyPaid
            ? 'DUPLICATE — invoice was already marked paid before this charge succeeded. Refund the customer to balance.'
            : `OVERPAYMENT — this charge pushes total paid (${(currentPaid + amount).toFixed(2)}) past invoice total (${total.toFixed(2)}). Refund the difference.`
        );
      }
      const { error: payErr } = await supabase.from('payments').insert({
        org_id: orgId,
        invoice_id: invoiceId,
        customer_id: meta.customer_id || null,
        amount,
        method,
        status: 'succeeded',
        stripe_payment_intent_id: intent.id,
        stripe_charge_id: charge?.id || null,
        processor_fee: fee,
        net_amount: amount - fee,
        paid_at: new Date(intent.created * 1000).toISOString(),
        notes: noteParts.join(' '),
      });
      if (payErr) {
        // Don't update the invoice if we failed to record the payment — return
        // a 5xx so Stripe retries the webhook. The idempotency check above
        // prevents a double-insert on the retry.
        console.error('[stripe webhook] failed to insert payment:', payErr);
        return NextResponse.json({ error: 'payment insert failed' }, { status: 500 });
      }

      // Update invoice totals — only if this isn't a duplicate. For duplicates
      // we leave invoice.amount_paid alone (already at total) so the invoice
      // doesn't show $6010 paid against a $3005 total. The duplicate payment
      // row above preserves the audit trail.
      let newStatus = null;
      if (inv && !isDuplicate) {
        const newPaid = currentPaid + amount;
        newStatus = newPaid >= total ? 'paid' : 'partial';
        const updates = {
          amount_paid: newPaid,
          status: newStatus,
          payment_method: method,
        };
        if (newStatus === 'paid') updates.paid_date = new Date().toISOString().split('T')[0];
        const { error: invUpdateErr } = await supabase.from('invoices').update(updates).eq('id', invoiceId);
        if (invUpdateErr) {
          console.error('[stripe webhook] invoice update failed:', invUpdateErr);
          return NextResponse.json({ error: 'invoice update failed' }, { status: 500 });
        }
      }

      // Always notify the org when a duplicate fires so Riley can refund.
      // This is separate from the normal "invoice paid" notification flow below.
      if (isDuplicate) {
        try {
          await notifyOrg({
            orgId,
            type: 'invoice_overpaid',
            title: `⚠️ Duplicate payment on Invoice #${inv?.invoice_number || ''}`,
            body: `Stripe charged ${fmtMoney(amount)} but this invoice was already marked paid. Refund the customer in Stripe to balance. The duplicate payment is flagged in the invoice's payment history.`,
            link: `/invoices/${invoiceId}`,
            data: { invoiceId, amount, method, kind: 'duplicate_payment' },
          });
        } catch (notifyErr) {
          console.error('[stripe webhook] duplicate notify failed', notifyErr);
        }
      }

      // Notify the team — only when the invoice is fully paid.
      // Also send the customer their paid receipt at the same time.
      if (inv && newStatus === 'paid') {
        let customer = null;
        if (inv.customer_id) {
          try {
            const { data: c } = await supabase
              .from('customers')
              .select('first_name, last_name, email')
              .eq('id', inv.customer_id)
              .maybeSingle();
            customer = c;
          } catch (lookupErr) {
            console.error('[stripe webhook] invoice customer lookup failed', lookupErr);
          }
        }

        try {
          const customerName = fmtCustomerName(customer);
          await notifyOrg({
            orgId,
            type: 'invoice_paid',
            title: `Invoice #${inv.invoice_number || ''} paid — ${customerName}`,
            body: `${customerName} paid ${fmtMoney(amount)} via ${method === 'ach' ? 'bank transfer' : 'card'}. Invoice is now fully paid.`,
            link: `/invoices/${invoiceId}`,
            data: { invoiceId, amount, method },
          });
        } catch (notifyErr) {
          console.error('[stripe webhook] invoice_paid notify failed', notifyErr);
        }

        // Customer-facing paid receipt (best-effort)
        try {
          if (customer?.email) {
            await sendInvoicePaidReceipt({
              to: customer.email,
              customer,
              invoice: inv,
              amount,
              method,
            });
          } else {
            console.warn('[stripe webhook] invoice paid but customer has no email on file');
          }
        } catch (mailErr) {
          console.error('[stripe webhook] invoice paid receipt failed', mailErr);
        }
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      console.warn('[stripe webhook] payment failed:', intent.id, intent.last_payment_error?.message);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
