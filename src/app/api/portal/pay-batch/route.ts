import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { createBatchPayment } from '@/lib/mollie';
import { computeInvoiceVat, mollieBtwLabel } from '@/lib/invoiceVat';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_CREATE)) return forbidden();

  const { customer } = session;

  try {
    const { batch_id } = await request.json();
    if (!batch_id) return NextResponse.json({ error: 'batch_id is verplicht' }, { status: 400 });

    const supabase = createServerClient();

    const { data: leadBatch } = await supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, price_per_lead, total_price, is_paid, mollie_payment_id')
      .eq('id', batch_id)
      .eq('customer_id', customer.id)
      .maybeSingle();

    const { data: apptBatch } = await supabase
      .from('appointment_batches')
      .select('id, customer_id, branch, batch_size, price_per_appointment, total_price, is_paid, mollie_payment_id')
      .eq('id', batch_id)
      .eq('customer_id', customer.id)
      .maybeSingle();

    const batch = leadBatch || null;
    const appointmentBatch = !leadBatch ? apptBatch : null;

    if (!batch && !appointmentBatch) {
      return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
    }

    if (batch) {
      if (batch.is_paid) return NextResponse.json({ error: 'Batch is al betaald' }, { status: 400 });

      const { data: openInvoice } = await supabase
        .from('invoices')
        .select('id, invoice_number, description, customer_id, total_incl_btw, mollie_payment_id')
        .eq('batch_id', batch.id)
        .eq('customer_id', customer.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openInvoice) {
        const { ensureInvoiceMollieCheckout } = await import('@/lib/invoiceCheckout');
        const { checkoutUrl } = await ensureInvoiceMollieCheckout({
          id: openInvoice.id,
          invoice_number: openInvoice.invoice_number,
          description: openInvoice.description,
          customer_id: openInvoice.customer_id,
          total_incl_btw: Number(openInvoice.total_incl_btw),
          mollie_payment_id: openInvoice.mollie_payment_id,
        });
        return NextResponse.json({ checkoutUrl });
      }

      const { data: custData } = await supabase
        .from('customers')
        .select('id, name, email, country, vat_id')
        .eq('id', customer.id)
        .single();

      if (!custData) return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });

      const totalExBtw = Number(batch.total_price || 0);
      const payVat = computeInvoiceVat({
        subtotalExclBtw: totalExBtw,
        country: (custData.country as string | null | undefined) ?? customer.country ?? 'NL',
        customerVatId: custData.vat_id,
      });
      const totalInclBtw = payVat.total_incl_btw;
      const molliePayVatPhrase = mollieBtwLabel(payVat.vat_mode);

      if (totalInclBtw <= 0) {
        return NextResponse.json({ error: 'Geen geldig bedrag voor deze batch' }, { status: 400 });
      }

      const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', batch.branch).single();
      const branchName = branchRow?.name || batch.branch;

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';
      const payment = await createBatchPayment({
        orderId: `batch:${batch.id}`,
        amount: totalInclBtw,
        description: `WarmeLeads batch: ${batch.batch_size} ${branchName} leads (${molliePayVatPhrase})`,
        redirectUrl: `${baseUrl}/portal?paid=${batch.id}`,
        webhookUrl: `${baseUrl}/api/webhooks/mollie`,
        customerEmail: custData.email,
        customerName: custData.name,
      });

      await supabase
        .from('customer_batches')
        .update({ mollie_payment_id: payment.id })
        .eq('id', batch.id);

      return NextResponse.json({ checkoutUrl: payment.getCheckoutUrl() });
    }

    if (!appointmentBatch) {
      return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
    }
    const appt = appointmentBatch;
    if (appt.is_paid) {
      return NextResponse.json({ error: 'Batch is al betaald' }, { status: 400 });
    }

    const { data: openApptInvoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, description, customer_id, total_incl_btw, mollie_payment_id')
      .eq('appointment_batch_id', appt.id)
      .eq('customer_id', customer.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openApptInvoice) {
      const { ensureInvoiceMollieCheckout } = await import('@/lib/invoiceCheckout');
      const { checkoutUrl } = await ensureInvoiceMollieCheckout({
        id: openApptInvoice.id,
        invoice_number: openApptInvoice.invoice_number,
        description: openApptInvoice.description,
        customer_id: openApptInvoice.customer_id,
        total_incl_btw: Number(openApptInvoice.total_incl_btw),
        mollie_payment_id: openApptInvoice.mollie_payment_id,
      });
      return NextResponse.json({ checkoutUrl });
    }

    const { data: custDataAppt } = await supabase
      .from('customers')
      .select('id, name, email, country, vat_id')
      .eq('id', customer.id)
      .single();

    if (!custDataAppt) return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });

    const totalExBtwAppt = Number(appt.total_price || 0);
    const payVatAppt = computeInvoiceVat({
      subtotalExclBtw: totalExBtwAppt,
      country: (custDataAppt.country as string | null | undefined) ?? customer.country ?? 'NL',
      customerVatId: custDataAppt.vat_id,
    });
    const totalInclBtwAppt = payVatAppt.total_incl_btw;
    const molliePayVatPhraseAppt = mollieBtwLabel(payVatAppt.vat_mode);

    if (totalInclBtwAppt <= 0) {
      return NextResponse.json({ error: 'Geen geldig bedrag voor deze batch' }, { status: 400 });
    }

    const { data: branchRowAppt } = await supabase
      .from('branches')
      .select('name')
      .eq('slug', appt.branch)
      .single();
    const branchNameAppt = branchRowAppt?.name || appt.branch;

    const baseUrlAppt = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';
    const paymentAppt = await createBatchPayment({
      orderId: `batch:${appt.id}`,
      amount: totalInclBtwAppt,
      description: `WarmeLeads afspraken: ${appt.batch_size} ${branchNameAppt} (${molliePayVatPhraseAppt})`,
      redirectUrl: `${baseUrlAppt}/portal/bestellen?product=appointments&paid=1`,
      webhookUrl: `${baseUrlAppt}/api/webhooks/mollie`,
      customerEmail: custDataAppt.email,
      customerName: custDataAppt.name,
    });

    await supabase
      .from('appointment_batches')
      .update({ mollie_payment_id: paymentAppt.id })
      .eq('id', appt.id);

    return NextResponse.json({ checkoutUrl: paymentAppt.getCheckoutUrl() });
  } catch (err) {
    console.error('Pay batch error:', err);
    return NextResponse.json({ error: 'Er is iets misgegaan bij het starten van de betaling' }, { status: 500 });
  }
}
