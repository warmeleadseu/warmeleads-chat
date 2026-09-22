import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { haalKoppelingenVoorBron } from '@/lib/portaalkoppelingen';

/**
 * Voor welke andere klanten mag dit portaal afspraken inboeken?
 *
 * Levert alleen de naam en de toegestane branches van de ontvanger. Bewust
 * niets over hun agenda, klanten of volume: dat gaat de boekende partij niet aan.
 */
export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const supabase = createServerClient();
  const koppelingen = await haalKoppelingenVoorBron(supabase, session.customer.id);

  /* De branches van de ontvanger erbij, want de keuzelijst moet weten waarin
     er geboekt kan worden. Een koppeling zonder branchebeperking valt terug op
     alle branches die de ontvanger afneemt. */
  const doelIds = koppelingen.map(k => k.doel_customer_id);
  const brancheperKlant: Record<string, string[]> = {};
  if (doelIds.length > 0) {
    const { data } = await supabase.from('customers').select('id, branches').in('id', doelIds);
    for (const r of data || []) brancheperKlant[r.id] = r.branches || [];
  }

  return NextResponse.json({
    koppelingen: koppelingen.map(k => ({
      id: k.id,
      klant_id: k.doel_customer_id,
      naam: k.doel_naam,
      branches: (k.branches && k.branches.length > 0)
        ? k.branches.filter(b => (brancheperKlant[k.doel_customer_id] || []).includes(b))
        : (brancheperKlant[k.doel_customer_id] || []),
      mag_wijzigen_tot_bevestiging: k.mag_wijzigen_tot_bevestiging,
    })),
  });
}
