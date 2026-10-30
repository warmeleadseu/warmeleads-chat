import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { ACTIE, actieFase, lotenVoorBulk } from '@/lib/lotenActie';
import { actieZichtbaar, laadBulkPerKlant, laadTrekking } from '@/lib/lotenActieLaden';

/**
 * Najaarsactie in het portaal: alleen de eigen loten van de klant. Geen
 * andere deelnemers en geen winnaar; die belt beheer zelf.
 */

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const supabase = createServerClient();
  const geen = NextResponse.json({ zichtbaar: false }, { headers: { 'Cache-Control': 'no-store' } });

  try {
    const trekking = await laadTrekking(supabase);
    if (!actieZichtbaar(trekking)) return geen;

    const { data: klant } = await supabase.from('customers').select('intern, demo_mode').eq('id', session.customer.id).maybeSingle();
    if (klant?.intern || klant?.demo_mode) return geen;

    const [{ data: loten, error }, bulk] = await Promise.all([
      supabase.from('actie_loten').select('loten').eq('actie', ACTIE.code).eq('customer_id', session.customer.id).is('vervallen_op', null),
      laadBulkPerKlant(supabase),
    ]);
    if (error) throw new Error(error.message);
    const batchLoten = (loten ?? []).reduce((s, r) => s + (Number(r.loten) || 0), 0);
    const bulkLoten = lotenVoorBulk(bulk.get(session.customer.id) ?? 0);

    return NextResponse.json(
      {
        zichtbaar: true,
        fase: actieFase(),
        getrokken: !!trekking,
        loten: batchLoten + bulkLoten,
        batches: (loten ?? []).length,
        eindLabel: ACTIE.eindLabel,
        prijsLeads: ACTIE.prijsLeads,
        leadsPerLot: ACTIE.leadsPerLot,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    /* De actie is bijzaak in het portaal: bij een fout tonen we hem gewoon niet. */
    console.error('[portal/actie]', err instanceof Error ? err.message : err);
    return geen;
  }
}
