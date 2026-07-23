import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { sendUnpaidBatchReminderEmail } from '@/lib/email';
import { ensureInvoiceMollieCheckout } from '@/lib/invoiceCheckout';
import { amCustomerAccessOrFilter } from '@/lib/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await params;
  const supabase = createServerClient();

  const { data: batch, error: batchError } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, price_per_lead, total_price, is_paid, customers(name)')
    .eq('id', id)
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
  }

  if (admin.role === 'accountmanager') {
    const { data: myCustomer } = await supabase
      .from('customers')
      .select('id').or(amCustomerAccessOrFilter(admin.id))
      .eq('id', batch.customer_id)
      .single();

    if (!myCustomer) {
      return NextResponse.json({ error: 'Geen toegang tot deze batch' }, { status: 403 });
    }
  }

  if (batch.is_paid) {
    return NextResponse.json({ error: 'Deze batch is al betaald' }, { status: 400 });
  }

  const [{ data: customer, error: customerError }, { data: branchRow }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, email, contact_person, vat_id, country')
      .eq('id', batch.customer_id)
      .single(),
    supabase
      .from('branches')
      .select('slug, name')
      .eq('slug', batch.branch)
      .single(),
  ]);

  if (customerError || !customer) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }

  if (!customer.email) {
    return NextResponse.json({ error: 'Klant heeft geen e-mailadres' }, { status: 400 });
  }

  const { data: openInvoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, description, customer_id, total_incl_btw, mollie_payment_id')
    .eq('batch_id', batch.id)
    .eq('status', 'open')
    .maybeSingle();

  let directCheckoutUrl: string | undefined;
  if (openInvoice) {
    try {
      const { checkoutUrl } = await ensureInvoiceMollieCheckout({
        id: openInvoice.id,
        invoice_number: openInvoice.invoice_number,
        description: openInvoice.description,
        customer_id: openInvoice.customer_id,
        total_incl_btw: Number(openInvoice.total_incl_btw),
        mollie_payment_id: openInvoice.mollie_payment_id,
      });
      directCheckoutUrl = checkoutUrl;
    } catch {
      /* herinnering zonder directe link als Mollie faalt */
    }
  }

  const sent = await sendUnpaidBatchReminderEmail(
    customer,
    {
      id: batch.id,
      branch: batch.branch,
      branch_name: branchRow?.name || batch.branch,
      batch_size: batch.batch_size,
      price_per_lead: batch.price_per_lead,
      total_price: batch.total_price,
    },
    { directCheckoutUrl },
  );

  if (!sent) {
    return NextResponse.json({ error: 'E-mail versturen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
