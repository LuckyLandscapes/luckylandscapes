import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/stripeServer';

export async function GET(_request, { params }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, status, total, subtotal, tax, tax_rate, amount_paid,
      due_date, paid_date, items, notes, terms, created_at, public_token,
      customers ( first_name, last_name, email, phone, address, city, state, zip ),
      organizations ( name )
    `)
    .eq('public_token', token)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Mark as viewed (best-effort, fire-and-forget)
  supabase
    .from('invoices')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', invoice.id)
    .then(() => {})
    .catch(() => {});

  return NextResponse.json({ invoice });
}
