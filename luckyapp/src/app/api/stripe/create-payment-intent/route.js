import { NextResponse } from 'next/server';
import { getStripe, isStripeConfigured, getServiceSupabase } from '@/lib/stripeServer';

export async function POST(request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' }, { status: 500 });
    }

    const { token } = await request.json();
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id, org_id, customer_id, invoice_number, total, amount_paid, status, public_token, customers(first_name, last_name, email)')
      .eq('public_token', token)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });
    }
    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Invoice cancelled' }, { status: 400 });
    }

    const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
    if (balance <= 0) {
      return NextResponse.json({ error: 'No balance due' }, { status: 400 });
    }

    const amountInCents = Math.round(balance * 100);
    const customer = invoice.customers || {};
    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      payment_method_types: ['card', 'us_bank_account'],
      description: `Invoice ${invoice.invoice_number} — Lucky Landscapes`,
      receipt_email: customer.email || undefined,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        org_id: invoice.org_id,
        customer_id: invoice.customer_id || '',
        public_token: invoice.public_token,
      },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: balance,
      invoiceNumber: invoice.invoice_number,
      customerName,
    });
  } catch (err) {
    console.error('[create-payment-intent] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create payment intent' }, { status: 500 });
  }
}
