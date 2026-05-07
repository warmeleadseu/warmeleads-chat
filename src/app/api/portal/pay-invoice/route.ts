import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { ensureInvoiceMollieCheckout } from '@/lib/invoiceCheckout';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_CREATE)) return forbidden();

  const { customer } = session;

  try {
    const { invoice_id } = await request.json();
    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id is verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, description, customer_id, total_incl_btw, status, mollie_payment_id, batch_id')
      .eq('id', invoice_id)
      .eq('customer_id', customer.id)
      .single();

    if (invErr || !inv) {
      return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });
    }
    if (inv.status !== 'open') {
      return NextResponse.json({ error: 'Deze factuur is niet meer openstaand' }, { status: 400 });
    }

    const totalIncl = Number(inv.total_incl_btw);
    if (!totalIncl || totalIncl <= 0) {
      return NextResponse.json({ error: 'Geen geldig bedrag voor deze factuur' }, { status: 400 });
    }

    const { checkoutUrl } = await ensureInvoiceMollieCheckout({
      id: inv.id,
      invoice_number: inv.invoice_number,
      description: inv.description,
      customer_id: inv.customer_id,
      total_incl_btw: totalIncl,
      mollie_payment_id: inv.mollie_payment_id,
    });

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error('[portal/pay-invoice]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Betaling starten mislukt' },
      { status: 500 },
    );
  }
}
