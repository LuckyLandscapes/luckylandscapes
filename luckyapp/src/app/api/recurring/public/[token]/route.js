import { NextResponse } from 'next/server';
import { getStripe, getServiceSupabase } from '@/lib/stripeServer';
import { authorizationText } from '@/lib/recurring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public tokens are URL-safe hex (see makeUrlSafeToken in src/lib/data.js).
const TOKEN_RE = /^[a-f0-9]{16,}$/;

function loadPlan(supabase, token) {
  return supabase
    .from('recurring_plans')
    .select('id, org_id, customer_id, title, amount, interval, status, authorized_at, payment_mode, contract_amount, total_periods, periods_billed, customers(first_name, last_name, email, phone, stripe_customer_id)')
    .eq('public_token', token)
    .maybeSingle();
}

// GET — plan summary for the /autopay/[token] consent page (no secrets).
export async function GET(request, { params }) {
  const { token } = await params;
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const { data: plan, error } = await loadPlan(supabase, token);
  if (error || !plan) return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404 });

  const c = plan.customers || {};
  return NextResponse.json({
    plan: {
      title: plan.title,
      amount: Number(plan.amount || 0),
      interval: plan.interval,
      status: plan.status,
      authorized: !!plan.authorized_at,
      customerFirstName: c.first_name || '',
      contractAmount: plan.contract_amount != null ? Number(plan.contract_amount) : null,
      totalPeriods: plan.total_periods != null ? Number(plan.total_periods) : null,
      periodsBilled: Number(plan.periods_billed || 0),
      authorizationText: authorizationText({
        amount: plan.amount,
        interval: plan.interval,
        title: plan.title,
        totalPeriods: plan.total_periods,
        contractAmount: plan.contract_amount,
      }),
    },
  });
}

// POST — create/get the Stripe Customer and a SetupIntent so the customer can
// save a card. The card + consent are recorded on the plan by the webhook when
// `setup_intent.succeeded` fires (server-verified, never trusts the client).
export async function POST(request, { params }) {
  const { token } = await params;
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }
  const stripe = getStripe();
  const supabase = getServiceSupabase();
  if (!stripe || !supabase) return NextResponse.json({ error: 'Payments not configured' }, { status: 500 });

  const { data: plan, error } = await loadPlan(supabase, token);
  if (error || !plan) return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404 });
  if (plan.status === 'cancelled') {
    return NextResponse.json({ error: 'This plan has been cancelled.' }, { status: 400 });
  }

  const customer = plan.customers || {};
  try {
    let stripeCustomerId = customer.stripe_customer_id;
    if (!stripeCustomerId) {
      const created = await stripe.customers.create({
        name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || undefined,
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        metadata: { org_id: plan.org_id, customer_id: plan.customer_id },
      });
      stripeCustomerId = created.id;
      await supabase.from('customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', plan.customer_id);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { kind: 'recurring_authorization', plan_id: plan.id, org_id: plan.org_id },
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    console.error('[recurring setup-intent] error:', err);
    return NextResponse.json({ error: err.message || 'Could not set up the card. Please try again.' }, { status: 500 });
  }
}
