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

  const { customer } = session;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('batch_orders')
    .select('*')
    .eq('customer_id', customer.id)
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
      batch_size: rawBatchSize,
      source_batch_id,
      notes,
      leads_per_day: customerLeadsPerDay,
      batch_kind: rawBatchKind,
      niche_title: rawNicheTitle,
    } = body;

    const batchKind =
      rawBatchKind === 'niche_research' ? 'niche_research' : 'leads';

    const supabase = createServerClient();

    const { data: custData } = await supabase
      .from('customers')
      .select('id, name, email, contact_person, welcome_offer_used, welcome_offer_expires_at, country, vat_id')
      .eq('id', customer.id)
      .single();

    if (!custData) return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });

    if (batchKind === 'niche_research') {
      const nicheTitle = typeof rawNicheTitle === 'string' ? rawNicheTitle.trim() : '';
      if (nicheTitle.length < 3) {
        return NextResponse.json(
          { error: 'Geef een duidelijke naam voor de niche (minimaal 3 tekens).' },
          { status: 400 },
        );
      }

      const RESEARCH_EXCL = 1000;
      const batch_size = 1;
      const branch = 'niche_research';
      const price_per_lead = RESEARCH_EXCL;
      const total_price = RESEARCH_EXCL;
      const nicheVat = computeInvoiceVat({
        subtotalExclBtw: total_price,
        country: custData.country,
        customerVatId: custData.vat_id,
      });
      const total_incl_btw = nicheVat.total_incl_btw;
      const mollieVatPhrase = mollieBtwLabel(nicheVat.vat_mode);

      const combinedNotes = [
        `[Onderzoeksbatch] ${nicheTitle}`,
        typeof notes === 'string' && notes.trim() ? notes.trim() : '',
      ]
        .filter(Boolean)
        .join('\n');

      const { data: order, error: orderErr } = await supabase
        .from('batch_orders')
        .insert({
          customer_id: customer.id,
          branch,
          batch_size,
          price_per_lead,
          total_price,
          leads_per_week: null,
          leads_per_day: null,
          lead_filters: [],
          notes: combinedNotes || null,
          source_batch_id: null,
          status: 'pending',
          welcome_discount_applied: false,
          batch_kind: 'niche_research',
          niche_title: nicheTitle,
        })
        .select()
        .single();

      if (orderErr || !order) {
        console.error('[portal/orders] niche research order insert:', orderErr);
        return NextResponse.json({ error: 'Bestelling aanmaken mislukt' }, { status: 500 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';

      let payment;
      try {
        payment = await createBatchPayment({
          orderId: order.id,
          amount: total_incl_btw,
          description: `WarmeLeads onderzoeksbatch: ${nicheTitle} (${mollieVatPhrase})`,
          redirectUrl: `${baseUrl}/portal/bestellen?order=${order.id}&status=redirect`,
          webhookUrl: `${baseUrl}/api/webhooks/mollie`,
          customerEmail: custData.email,
          customerName: custData.name,
        });
      } catch (mollieErr) {
        console.error('Mollie payment creation failed, cleaning up order:', mollieErr);
        await supabase.from('batch_orders').delete().eq('id', order.id);
        return NextResponse.json({ error: 'Betaling aanmaken mislukt. Probeer het opnieuw.' }, { status: 500 });
      }

      await supabase.from('batch_orders').update({ mollie_payment_id: payment.id }).eq('id', order.id);

      return NextResponse.json({
        orderId: order.id,
        checkoutUrl: payment.getCheckoutUrl(),
      });
    }

    const batch_size = rawBatchSize;

    if (!batch_size || batch_size < 10) {
      return NextResponse.json({ error: 'Batch grootte moet minimaal 10 zijn' }, { status: 400 });
    }

    let welcomeEligible =
      custData.welcome_offer_used === false &&
      custData.welcome_offer_expires_at &&
      new Date(custData.welcome_offer_expires_at) > new Date();

    if (welcomeEligible) {
      const { count } = await supabase
        .from('batch_orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .eq('welcome_discount_applied', true)
        .in('status', ['pending', 'open']);
      if ((count ?? 0) > 0) welcomeEligible = false;
    }

    let branch = body.branch;
    let price_per_lead: number | null = null;
    let leads_per_week: number | null = null;
    let leads_per_day: number | null = null;
    let lead_filters: unknown[] = [];

    if (source_batch_id) {
      const { data: sourceBatch } = await supabase
        .from('customer_batches')
        .select('branch, price_per_lead, leads_per_week, leads_per_day, lead_filters')
        .eq('id', source_batch_id)
        .eq('customer_id', customer.id)
        .single();

      if (sourceBatch) {
        branch = branch || sourceBatch.branch;
        price_per_lead = sourceBatch.price_per_lead;
        leads_per_week = sourceBatch.leads_per_week;
        leads_per_day = sourceBatch.leads_per_day;
        lead_filters = sourceBatch.lead_filters || [];
      }
    }

    if (!branch || !price_per_lead) {
      const { data: latestBatch } = await supabase
        .from('customer_batches')
        .select('branch, price_per_lead, leads_per_week, leads_per_day, lead_filters')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestBatch) {
        branch = branch || latestBatch.branch;
        price_per_lead = price_per_lead || latestBatch.price_per_lead;
        leads_per_week = leads_per_week || latestBatch.leads_per_week;
        leads_per_day = leads_per_day || latestBatch.leads_per_day;
        lead_filters = lead_filters.length > 0 ? lead_filters : (latestBatch.lead_filters || []);
      }
    }

    if (customerLeadsPerDay !== undefined) {
      leads_per_day = customerLeadsPerDay > 0 ? customerLeadsPerDay : null;
    }

    if (!branch && body.branch) branch = body.branch;

    if (!price_per_lead && branch) {
      const [{ data: branchData }, { data: customPricing }] = await Promise.all([
        supabase
          .from('branches')
          .select('pricing_tiers, nationwide_discount')
          .eq('slug', branch)
          .single(),
        supabase
          .from('customer_pricing')
          .select('pricing_tiers, nationwide_discount')
          .eq('customer_id', customer.id)
          .eq('branch_slug', branch)
          .maybeSingle(),
      ]);

      if (branchData) {
        const branchTiers = branchData.pricing_tiers || [];
        const hasCustom = !!(customPricing?.pricing_tiers?.length);
        const customTiers = hasCustom ? customPricing!.pricing_tiers : [];
        const tiers = customTiers.length > 0
          ? mergeCustomTiers(branchTiers, customTiers)
          : branchTiers;

        const nationwideDiscount = hasCustom && customPricing!.nationwide_discount != null
          ? customPricing!.nationwide_discount
          : (branchData.nationwide_discount || 0);

        const result = calculatePricePerLead(tiers, batch_size, {
          nationwideDiscount: Number(nationwideDiscount),
          isNationwide: false,
          isCustom: hasCustom,
        });

        if (result) {
          price_per_lead = result.price_per_lead;
        }
      }
    }

    if (!branch || !price_per_lead) {
      return NextResponse.json({ error: 'Geen branche of prijsinformatie beschikbaar. Neem contact op met WarmeLeads.' }, { status: 400 });
    }

    const subtotalBeforeDiscount = Number(price_per_lead) * batch_size;
    const discountAmount = welcomeEligible ? Math.round(subtotalBeforeDiscount * 0.20 * 100) / 100 : 0;
    const total_price = subtotalBeforeDiscount - discountAmount;
    const leadsVat = computeInvoiceVat({
      subtotalExclBtw: total_price,
      country: custData.country,
      customerVatId: custData.vat_id,
    });
    const total_incl_btw = leadsVat.total_incl_btw;
    const mollieLeadsVatPhrase = mollieBtwLabel(leadsVat.vat_mode);

    const { data: order, error: orderErr } = await supabase
      .from('batch_orders')
      .insert({
        customer_id: customer.id,
        branch,
        batch_size,
        price_per_lead,
        total_price,
        leads_per_week,
        leads_per_day,
        lead_filters,
        notes: notes || null,
        source_batch_id: source_batch_id || null,
        status: 'pending',
        welcome_discount_applied: welcomeEligible && discountAmount > 0,
        batch_kind: 'leads',
        niche_title: null,
      })
      .select()
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Bestelling aanmaken mislukt' }, { status: 500 });
    }

    const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', branch).single();
    const branchName = branchRow?.name || branch;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';

    let payment;
    try {
      const discountLabel = discountAmount > 0 ? ` (incl. 20% welkomstkorting)` : '';
      payment = await createBatchPayment({
        orderId: order.id,
        amount: total_incl_btw,
        description: `WarmeLeads batch: ${batch_size} ${branchName} leads${discountLabel} (${mollieLeadsVatPhrase})`,
        redirectUrl: `${baseUrl}/portal/bestellen?order=${order.id}&status=redirect`,
        webhookUrl: `${baseUrl}/api/webhooks/mollie`,
        customerEmail: custData.email,
        customerName: custData.name,
      });
    } catch (mollieErr) {
      console.error('Mollie payment creation failed, cleaning up order:', mollieErr);
      await supabase.from('batch_orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Betaling aanmaken mislukt. Probeer het opnieuw.' }, { status: 500 });
    }

    await supabase
      .from('batch_orders')
      .update({ mollie_payment_id: payment.id })
      .eq('id', order.id);

    return NextResponse.json({
      orderId: order.id,
      checkoutUrl: payment.getCheckoutUrl(),
    });
  } catch (err) {
    console.error('Order creation error:', err);
    return NextResponse.json({ error: 'Er is iets misgegaan bij het aanmaken van de bestelling.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_CREATE)) return forbidden();

  const { customer } = session;

  try {
    const { order_id } = await request.json();
    if (!order_id) return NextResponse.json({ error: 'order_id is verplicht' }, { status: 400 });

    const supabase = createServerClient();

    const { data: order } = await supabase
      .from('batch_orders')
      .select('id, status, customer_id')
      .eq('id', order_id)
      .eq('customer_id', customer.id)
      .single();

    if (!order) return NextResponse.json({ error: 'Bestelling niet gevonden' }, { status: 404 });

    if (order.status === 'paid') {
      return NextResponse.json({ error: 'Een betaalde bestelling kan niet worden verwijderd' }, { status: 400 });
    }

    await supabase.from('batch_orders').delete().eq('id', order_id).eq('customer_id', customer.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
