/**
 * Manual recovery: sync a Stripe payment_intent into the database.
 *
 * Use when the webhook missed an event (e.g. Vercel deploy timing).
 *
 * Run with:  node src/scripts/sync-stripe-payment.js pi_3TQZBT...
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

(async () => {
  const intentId = process.argv[2];
  if (!intentId || !intentId.startsWith('pi_')) {
    console.error('Usage: node src/scripts/sync-stripe-payment.js pi_xxx');
    process.exit(1);
  }

  console.log(`Fetching payment intent ${intentId}...`);
  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.status !== 'succeeded') {
    console.error(`Payment intent status is ${intent.status}, not succeeded. Aborting.`);
    process.exit(1);
  }

  const meta = intent.metadata || {};
  const invoiceId = meta.invoice_id;
  const orgId = meta.org_id;
  if (!invoiceId || !orgId) {
    console.error('Missing invoice_id or org_id in metadata. Cannot link payment.');
    process.exit(1);
  }

  // Skip if already recorded
  const { data: existing } = await supabase
    .from('payments').select('id').eq('stripe_payment_intent_id', intent.id).maybeSingle();
  if (existing) {
    console.log(`Payment already recorded (id=${existing.id}). Nothing to do.`);
    process.exit(0);
  }

  // Fetch the charge to get fee + payment method
  const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
  const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
  const pm = charge?.payment_method_details;
  const method = pm?.us_bank_account ? 'ach' : 'card';
  const balTxnId = typeof charge?.balance_transaction === 'string' ? charge.balance_transaction : charge?.balance_transaction?.id;
  const balTxn = balTxnId ? await stripe.balanceTransactions.retrieve(balTxnId) : null;
  const fee = (balTxn?.fee || 0) / 100;
  const amount = intent.amount_received / 100;

  // Insert payment
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
    notes: `Manually synced via script — ${method === 'ach' ? 'bank transfer' : 'card'}`,
  });
  if (payErr) { console.error('Insert failed:', payErr); process.exit(1); }

  // Update invoice
  const { data: inv } = await supabase
    .from('invoices').select('total, amount_paid, invoice_number').eq('id', invoiceId).single();
  const newPaid = Number(inv.amount_paid || 0) + amount;
  const newStatus = newPaid >= Number(inv.total || 0) ? 'paid' : 'partial';
  const updates = { amount_paid: newPaid, status: newStatus, payment_method: method };
  if (newStatus === 'paid') updates.paid_date = new Date().toISOString().split('T')[0];
  await supabase.from('invoices').update(updates).eq('id', invoiceId);

  console.log(`✓ Synced payment of $${amount.toFixed(2)} (fee $${fee.toFixed(2)}, net $${(amount - fee).toFixed(2)}) to invoice ${inv.invoice_number}`);
  console.log(`  Invoice status: ${newStatus} ($${newPaid.toFixed(2)} / $${Number(inv.total).toFixed(2)})`);
  process.exit(0);
})();
