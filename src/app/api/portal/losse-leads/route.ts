import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized, logImpersonatedWrite } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { computeInvoiceVat } from '@/lib/invoiceVat';
import { AankoopFout, laadAanbod, startAankoop } from '@/lib/losseLeads';
import { LOSSE_LEADS_BRANCHES, LOSSE_LEADS_UITLEG, LOSSE_LEAD_PRIJS, MAX_PER_AANKOOP } from '@/lib/losseLeadsRegels';

/**
 * Losse leads in het portaal: leads die buiten alle regio's vielen en nog
 * nooit zijn uitgedeeld, voor EUR 15 per stuk. Elke klant met een account ziet
 * het aanbod; kopen kan wie mag bestellen.
 *
 * GET              het aanbod (zonder persoonsgegevens)
 * GET ?aankoop=id  de stand van een eigen aankoop (terug van Mollie)
 * POST {lead_ids}  reserveren en de Mollie-betaling starten
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const supabase = createServerClient();

  const aankoopId = request.nextUrl.searchParams.get('aankoop');
  if (aankoopId) {
    const { data } = await supabase
      .from('losse_lead_aankopen')
      .select('status, lead_ids, geleverd_ids, terugbetaald_ids, terugbetaald_bedrag')
      .eq('id', aankoopId)
      .eq('customer_id', session.customer.id)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: 'Aankoop niet gevonden' }, { status: 404 });
    return NextResponse.json({
      aankoop: {
        status: data.status,
        gekocht: (data.lead_ids as string[]).length,
        geleverd: (data.geleverd_ids as string[]).length,
        terugbetaald: Number(data.terugbetaald_bedrag) || 0,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const [aanbod, { data: branches }] = await Promise.all([
      laadAanbod(supabase, session.customer.id),
      supabase.from('branches').select('slug, name').in('slug', [...LOSSE_LEADS_BRANCHES]),
    ]);
    const btw = computeInvoiceVat({ subtotalExclBtw: LOSSE_LEAD_PRIJS, country: session.customer.country ?? 'NL', customerVatId: session.customer.vat_id ?? null });
    return NextResponse.json({
      uitleg: LOSSE_LEADS_UITLEG,
      prijs_excl: LOSSE_LEAD_PRIJS,
      prijs_incl: btw.total_incl_btw,
      verlegd: btw.vat_mode === 'reverse_charge_be',
      max_per_aankoop: MAX_PER_AANKOOP,
      mag_kopen: hasPermission(session, PERMISSIONS.ORDERS_CREATE),
      branches: (branches ?? []).map(b => ({ slug: b.slug, naam: b.name })),
      leads: aanbod,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[portal/losse-leads] aanbod laden mislukt:', e);
    return NextResponse.json({ error: 'Het aanbod kon niet worden geladen' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_CREATE)) return forbidden();

  const body = await request.json().catch(() => ({}));
  const leadIds = Array.isArray(body?.lead_ids) ? (body.lead_ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];

  await logImpersonatedWrite(session, 'losse_leads_kopen', 'losse_lead_aankoop', null, { aantal: leadIds.length });

  const supabase = createServerClient();
  const { data: koper } = await supabase
    .from('customers')
    .select('id, name, email, country, vat_id')
    .eq('id', session.customer.id)
    .single();
  if (!koper?.email) return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });

  try {
    const { aankoopId, checkoutUrl } = await startAankoop(supabase, {
      koper: { id: koper.id, name: koper.name, email: koper.email, country: koper.country ?? null, vat_id: koper.vat_id ?? null },
      portalUserId: session.portalUser?.id ?? null,
      leadIds,
    });
    if (!checkoutUrl) throw new Error('Geen betaallink');
    return NextResponse.json({ aankoopId, checkoutUrl });
  } catch (e) {
    if (e instanceof AankoopFout) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('[portal/losse-leads] aankoop starten mislukt:', e);
    return NextResponse.json({ error: 'Betaling starten mislukt. Probeer het opnieuw.' }, { status: 500 });
  }
}
