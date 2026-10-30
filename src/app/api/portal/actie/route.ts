import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { actieFase, actieLabels, lotenVoorBulk } from '@/lib/lotenActie';
import { laadBulkPerKlant, laadZichtbareActie } from '@/lib/lotenActieLaden';

/**
 * De actie met loten in het portaal: alleen de eigen loten van de klant,
 * voor de actie die nu in beeld hoort. Geen andere deelnemers en geen
 * winnaar; die belt beheer zelf.
 */

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const supabase = createServerClient();
  const geen = NextResponse.json({ zichtbaar: false }, { headers: { 'Cache-Control': 'no-store' } });

  try {
    const zichtbaar = await laadZichtbareActie(supabase);
    if (!zichtbaar) return geen;
    const { actie, trekking } = zichtbaar;

    const { data: klant } = await supabase.from('customers').select('intern, demo_mode').eq('id', session.customer.id).maybeSingle();
    if (klant?.intern || klant?.demo_mode) return geen;

    const [{ data: loten, error }, bulk] = await Promise.all([
      supabase.from('actie_loten').select('loten').eq('actie', actie.code).eq('customer_id', session.customer.id).is('vervallen_op', null),
      laadBulkPerKlant(supabase, actie),
    ]);
    if (error) throw new Error(error.message);
    const batchLoten = (loten ?? []).reduce((s, r) => s + (Number(r.loten) || 0), 0);
    const bulkLoten = lotenVoorBulk(actie, bulk.get(session.customer.id) ?? 0);

    return NextResponse.json(
      {
        zichtbaar: true,
        fase: actieFase(actie),
        getrokken: !!trekking,
        loten: batchLoten + bulkLoten,
        batches: (loten ?? []).length,
        eindLabel: actieLabels(actie).eindLabel,
        prijsLeads: actie.prijsLeads,
        leadsPerLot: actie.leadsPerLot,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    /* De actie is bijzaak in het portaal: bij een fout tonen we hem gewoon niet. */
    console.error('[portal/actie]', err instanceof Error ? err.message : err);
    return geen;
  }
}
