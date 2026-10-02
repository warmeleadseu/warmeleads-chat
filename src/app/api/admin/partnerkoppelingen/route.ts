import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { PARTNERS, partnerOpProvider } from '@/lib/integrations/partners/registry';
import { partnerStatus } from '@/lib/integrations/partners/service';

/**
 * Overzicht van alle partnerkoppelingen: per klant de status, zodat in één
 * oogopslag te zien is waar iets misgaat. Koppelingen die aandacht nodig
 * hebben staan bovenaan.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin beheert partnerkoppelingen' }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data: rijen } = await supabase
    .from('customer_integrations')
    .select('customer_id, provider, customers(name, branches)')
    .in('provider', PARTNERS.map(p => p.provider));

  const koppelingen = await Promise.all(
    (rijen || []).map(async r => {
      const partner = partnerOpProvider(r.provider as string)!;
      const klant = r.customers as unknown as { name?: string; branches?: string[] } | null;
      return {
        customer_id: r.customer_id as string,
        klant: klant?.name ?? 'Onbekend',
        ...(await partnerStatus(supabase, r.customer_id as string, partner, klant?.branches ?? [])),
      };
    }),
  );

  koppelingen.sort((a, b) => {
    const gewicht = (k: typeof a) => (k.actie_nodig ? 0 : !k.aan ? 2 : 1);
    return gewicht(a) - gewicht(b) || a.klant.localeCompare(b.klant);
  });

  return NextResponse.json(
    {
      partners: PARTNERS.map(p => ({ id: p.id, naam: p.naam, tagline: p.tagline, urlUitleg: p.urlUitleg })),
      koppelingen,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
