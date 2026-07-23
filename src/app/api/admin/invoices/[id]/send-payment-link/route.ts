import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { resendOpenInvoiceWithPaymentLinks } from '@/lib/invoice';
import { amCustomerAccessOrFilter } from '@/lib/permissions';

/** Stuurt (opnieuw) de open-factuurmail met verse Mollie-betaallink naar de klant. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await params;
  const supabase = createServerClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status, customer_id')
    .eq('id', id)
    .single();

  if (!invoice) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id')
      .eq('id', invoice.customer_id)
      .or(amCustomerAccessOrFilter(admin.id))
      .single();
    if (!myCust) return forbidden();
  }

  if (invoice.status !== 'open') {
    return NextResponse.json({ error: 'Alleen een openstaande factuur kan een betaallink krijgen' }, { status: 400 });
  }

  try {
    await resendOpenInvoiceWithPaymentLinks(id);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Betaallink versturen mislukt' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
