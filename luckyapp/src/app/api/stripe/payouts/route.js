import { NextResponse } from 'next/server';
import { getStripe, isStripeConfigured } from '@/lib/stripeServer';
import { authenticateRequest } from '@/lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/stripe/payouts
// Returns the Stripe balance + recent and upcoming payouts so the UI can
// surface "money arriving in your bank on X day" — the same view as the
// Stripe Dashboard but inside Lucky App. No payload required.
//
// Response shape:
// {
//   configured: boolean,
//   balance: { available: number, pending: number, currency: 'usd' },
//   payouts: Array<{ id, amount, currency, status, arrivalDate, method, type, description }>,
// }
//
// `arrivalDate` is the date Stripe says the money will land in your bank
// (`payout.arrival_date`, ISO yyyy-mm-dd). `status` is one of:
//   'in_transit' | 'paid' | 'pending' | 'canceled' | 'failed'
export async function GET(request) {
  // Owner/admin-only financial data — never expose the live bank balance +
  // payout history to an anonymous caller.
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  if (!isStripeConfigured()) {
    return NextResponse.json({
      configured: false,
      balance: null,
      payouts: [],
    });
  }

  try {
    const stripe = getStripe();
    const [balance, payouts] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.payouts.list({ limit: 10 }),
    ]);

    const sumByCurrency = (entries, currency = 'usd') =>
      (entries || [])
        .filter((e) => e.currency === currency)
        .reduce((sum, e) => sum + (e.amount || 0), 0) / 100;

    return NextResponse.json({
      configured: true,
      balance: {
        available: sumByCurrency(balance.available),
        pending: sumByCurrency(balance.pending),
        currency: 'usd',
      },
      payouts: payouts.data.map((p) => ({
        id: p.id,
        amount: (p.amount || 0) / 100,
        currency: p.currency,
        status: p.status,
        arrivalDate: p.arrival_date
          ? new Date(p.arrival_date * 1000).toISOString().slice(0, 10)
          : null,
        method: p.method,            // 'standard' | 'instant'
        type: p.type,                // 'bank_account' | 'card'
        description: p.description,
        created: p.created ? new Date(p.created * 1000).toISOString() : null,
      })),
    });
  } catch (err) {
    console.error('[stripe payouts] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch Stripe payouts' },
      { status: 500 }
    );
  }
}
