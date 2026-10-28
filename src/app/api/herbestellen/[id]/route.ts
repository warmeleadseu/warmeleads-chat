import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimitShared, getClientIp } from '@/lib/rateLimit';
import { controleerHerbestelToken, leesBron } from '@/lib/herbestelToken';
import { doorloopStatus, zetDoorlopend } from '@/lib/doorlopen';
import { berekenHerbestelling, geldigeGrootte, grootteKeuzes, laadHerbestelling, startHerbestelling } from '@/lib/herbestelling';

/**
 * Publieke route achter de herbestellink uit de mail: bekijken en bestellen
 * zonder in te loggen. Alleen met een geldig token, en alleen gegevens die de
 * klant zelf al kent (zijn eigen batch).
 */

export const dynamic = 'force-dynamic';

const FOUT: Record<string, { status: number; tekst: string }> = {
  ongeldig: { status: 404, tekst: 'Deze link is niet geldig.' },
  verlopen: { status: 410, tekst: 'Deze link is verlopen. Bestel via je portaal of neem contact met ons op.' },
  niet_gevonden: { status: 404, tekst: 'Deze batch bestaat niet meer.' },
  niet_mogelijk: { status: 409, tekst: 'Deze batch kan niet online opnieuw worden besteld. Neem contact met ons op.' },
};
const fout = (soort: string) => NextResponse.json({ error: FOUT[soort].tekst, soort }, { status: FOUT[soort].status });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = request.nextUrl.searchParams;
  const t = controleerHerbestelToken(id, q.get('v'), q.get('t'));
  const supabase = createServerClient();

  /* Terug van Mollie: alleen de stand van die bestelling. Mag ook na het
     verlopen van de link, anders ziet de klant geen bevestiging. */
  const orderId = q.get('order');
  if (orderId && t !== 'ongeldig') {
    const { data: order } = await supabase
      .from('batch_orders')
      .select('id, status, batch_size, batch_id')
      .eq('id', orderId)
      .eq('source_batch_id', id)
      .maybeSingle();
    if (!order) return fout('niet_gevonden');
    return NextResponse.json({ order: { status: order.status, batch_size: order.batch_size, actief: !!order.batch_id } });
  }

  if (t !== 'ok') return fout(t);
  const r = await laadHerbestelling(supabase, id);
  if (!r.ok) return fout(r.reden);
  const g = r.data;

  const keuzes = grootteKeuzes(g.vorigeGrootte);
  const [prijzen, doorloop] = await Promise.all([
    Promise.all(keuzes.map(async n => ({ grootte: n, ...(await berekenHerbestelling(supabase, g, n)) }))),
    doorloopStatus(supabase, g.klant.id).catch(() => null),
  ]);

  return NextResponse.json({
    bedrijf: g.klant.name,
    contactpersoon: g.klant.contact_person,
    branche: g.brancheNaam,
    prijs_per_lead: g.batch.price_per_lead,
    vorige_grootte: g.vorigeGrootte,
    leads_per_dag: g.batch.leads_per_day,
    leads_per_week: g.batch.leads_per_week,
    met_filters: g.batch.lead_filters.length > 0,
    al_nabesteld: g.alNabesteld,
    doorlopend: { aan: doorloop?.aan === true, mag_aanzetten: doorloop?.zelf === 'ok' },
    keuzes: prijzen.map(p => ({ grootte: p.grootte, totaal_excl: p.totaalExcl, totaal_incl: p.totaalIncl, korting: p.korting, btw: p.btwLabel })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rl = await rateLimitShared(`herbestellen:${getClientIp(request)}`, 'herbestellen', 10, 10 * 60_000);
  if (rl.limited && rl.response) return rl.response;

  const body = await request.json().catch(() => ({}));
  const t = controleerHerbestelToken(id, body?.v, body?.t);
  if (t !== 'ok') return fout(t);
  const grootte = geldigeGrootte(body?.grootte);
  if (!grootte) return NextResponse.json({ error: 'Kies een aantal tussen 10 en 1000.' }, { status: 400 });

  const supabase = createServerClient();
  const r = await laadHerbestelling(supabase, id);
  if (!r.ok) return fout(r.reden);

  const basis = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';
  const bron = leesBron(body?.b);
  try {
    const { checkoutUrl } = await startHerbestelling(supabase, r.data, {
      grootte,
      bron,
      terugUrl: orderId => `${basis}/herbestellen/${id}?v=${encodeURIComponent(String(body.v))}&t=${encodeURIComponent(String(body.t))}&order=${orderId}`,
    });
    if (!checkoutUrl) throw new Error('Geen betaallink');
    /* Zelf aangevinkt: doorlopend aan (alleen als de klant dat mag). */
    if (body?.doorlopend === true) {
      await zetDoorlopend(supabase, r.data.klant.id, true, { soort: 'klant', naam: `Klant (${r.data.klant.name}, herbestellink)` })
        .catch(e => console.error('[herbestellen] doorlopend aanzetten mislukt', e));
    }
    return NextResponse.json({ checkoutUrl });
  } catch (e) {
    console.error('[herbestellen] start mislukt:', e);
    return NextResponse.json({ error: 'Betaling starten mislukt. Probeer het opnieuw of neem contact met ons op.' }, { status: 500 });
  }
}
