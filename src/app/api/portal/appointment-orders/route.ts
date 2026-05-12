import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { createBatchPayment } from '@/lib/mollie';
import { calculatePricePerLead, mergeCustomTiers } from '@/lib/pricing';
import { computeInvoiceVat, mollieBtwLabel } from '@/lib/invoiceVat';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_VIEW)) return forbidden();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('appointment_orders')
    .select('*')
    .eq('customer_id', session.customer.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Kon bestellingen niet ophalen' }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_CREATE)) return forbidden();

  const { customer } = session;

  try {
    const body = await request.json();
    const {
      batch_size,
      branch,
      appointments_per_week,
      appointments_per_day,
      lead_filters,
      notes,
      source_batch_id,
    } = body;

    if (!branch) return NextResponse.json({ error: 'Branche verplicht' }, { status: 400 });
    if (!batch_size || batch_size < 1) return NextResponse.json({ error: 'Batch grootte ongeldig' }, { status: 400 });

    const supabase = createServerClient();

    const { data: custData } = await supabase
      .from('customers')
      .select('id, name, email, country, vat_id')
      .eq('id', customer.id)
      .single();

    if (!custData) return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });

    const billingCountry = (custData.country as string | null | undefined) ?? customer.country ?? 'NL';

    const [{ data: branchData }, { data: customPricing }] = await Promise.all([
      supabase
        .from('branches')
        .select('name, appointment_pricing_tiers, appointment_nationwide_discount, appointment_min_batch_size')
        .eq('slug', branch)
        .single(),
      supabase
        .from('customer_appointment_pricing')
        .select('pricing_tiers, nationwide_discount')
        .eq('customer_id', customer.id)
        .eq('branch_slug', branch)
        .maybeSingle(),
    ]);

    if (!branchData) return NextResponse.json({ error: 'Branche niet gevonden' }, { status: 404 });

    const minBatch = branchData.appointment_min_batch_size || 5;
    if (batch_size < minBatch) {
      return NextResponse.json({ error: `Batch grootte moet minimaal ${minBatch} zijn` }, { status: 400 });
    }

    const hasCustom = !!(customPricing?.pricing_tiers?.length);
    const customTiers = hasCustom ? customPricing!.pricing_tiers : [];
    const branchTiers = branchData.appointment_pricing_tiers || [];
    const tiers = customTiers.length > 0 ? mergeCustomTiers(branchTiers, customTiers) : branchTiers;

    const nationwideDiscount = hasCustom && customPricing!.nationwide_discount != null
      ? customPricing!.nationwide_discount
      : (branchData.appointment_nationwide_discount || 0);

    const result = calculatePricePerLead(tiers, batch_size, {
      nationwideDiscount: Number(nationwideDiscount),
      isNationwide: false,
      isCustom: hasCustom,
    });

    if (!result) {
      return NextResponse.json({ error: 'Geen prijsinformatie beschikbaar' }, { status: 400 });
    }

    const price_per_appointment = result.price_per_lead;
    const total_price = Number((price_per_appointment * batch_size).toFixed(2));
    const apptVat = computeInvoiceVat({
      subtotalExclBtw: total_price,
      country: billingCountry,
      customerVatId: custData.vat_id,
    });
    const total_incl_btw = apptVat.total_incl_btw;
    const mollieApptVatPhrase = mollieBtwLabel(apptVat.vat_mode);

    const { data: order, error: orderErr } = await supabase
      .from('appointment_orders')
      .insert({
        customer_id: customer.id,
        branch,
        batch_size,
        price_per_appointment,
        total_price,
        appointments_per_week: appointments_per_week ?? null,
        appointments_per_day: appointments_per_day ?? null,
        lead_filters: Array.isArray(lead_filters) ? lead_filters : [],
        notes: notes || null,
        source_batch_id: source_batch_id || null,
        status: 'pending',
      })
      .select()
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Bestelling aanmaken mislukt' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';

    let payment;
    try {
      payment = await createBatchPayment({
        orderId: order.id,
        amount: total_incl_btw,
        description: `WarmeLeads afspraken: ${batch_size} ${branchData.name} afspraken (${mollieApptVatPhrase})`,
        redirectUrl: `${baseUrl}/portal/bestellen?product=appointments&order=${order.id}&status=redirect`,
        webhookUrl: `${baseUrl}/api/webhooks/mollie`,
        customerEmail: custData.email,
        customerName: custData.name,
        kind: 'appointment_order',
      });
    } catch (mollieErr) {
      console.error('Mollie appointment payment creation failed:', mollieErr);
      await supabase.from('appointment_orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Betaling aanmaken mislukt. Probeer het opnieuw.' }, { status: 500 });
    }

    await supabase
      .from('appointment_orders')
      .update({ mollie_payment_id: payment.id })
      .eq('id', order.id);

    return NextResponse.json({
      orderId: order.id,
      checkoutUrl: payment.getCheckoutUrl(),
    });
  } catch (err) {
    console.error('Appointment order creation error:', err);
    return NextResponse.json({ error: 'Er is iets misgegaan' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_CREATE)) return forbidden();

  try {
    const { order_id } = await request.json();
    if (!order_id) return NextResponse.json({ error: 'order_id is verplicht' }, { status: 400 });

    const supabase = createServerClient();
    const { data: order } = await supabase
      .from('appointment_orders')
      .select('id, status, customer_id')
      .eq('id', order_id)
      .eq('customer_id', session.customer.id)
      .single();

    if (!order) return NextResponse.json({ error: 'Bestelling niet gevonden' }, { status: 404 });
    if (order.status === 'paid') {
      return NextResponse.json({ error: 'Een betaalde bestelling kan niet worden verwijderd' }, { status: 400 });
    }

    await supabase.from('appointment_orders').delete().eq('id', order_id).eq('customer_id', session.customer.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
