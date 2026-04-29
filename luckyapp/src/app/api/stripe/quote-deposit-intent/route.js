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

    const { data: quote, error } = await supabase
      .from('quotes')
      .select(`
        id, org_id, customer_id, quote_number, status,
        materials_cost, delivery_fee, deposit_paid_at, public_token,
        customers ( first_name, last_name, email )
      `)
      .eq('public_token', token)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.deposit_paid_at) {
      return NextResponse.json({ error: 'Deposit already paid for this quote.' }, { status: 400 });
    }

    const materials = Number(quote.materials_cost || 0);
    const delivery = Number(quote.delivery_fee || 0);
    const deposit = Math.max(0, materials + delivery);

    if (deposit <= 0) {
      return NextResponse.json(
        { error: 'No deposit set for this quote. Please contact Lucky Landscapes to schedule.' },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(deposit * 100);
    const customer = quote.customers || {};
    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      payment_method_types: ['card', 'us_bank_account'],
      description: `Quote #${quote.quote_number} deposit (materials + delivery) — Lucky Landscapes`,
      receipt_email: customer.email || undefined,
      metadata: {
        kind: 'quote_deposit',
        quote_id: quote.id,
        quote_number: String(quote.quote_number),
        org_id: quote.org_id,
        customer_id: quote.customer_id || '',
        public_token: quote.public_token,
        materials_cost: String(materials),
        delivery_fee: String(delivery),
      },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: deposit,
      materials,
      delivery,
      quoteNumber: quote.quote_number,
      customerName,
    });
  } catch (err) {
    console.error('[quote-deposit-intent] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create payment intent' }, { status: 500 });
  }
}
