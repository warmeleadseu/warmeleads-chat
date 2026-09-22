import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { bouwAgendaIcs, controleerAgendaToken, type IcsAfspraak } from '@/lib/agendaIcs';

/**
 * Abonneerbare agendafeed voor Google Agenda en Outlook.
 *
 * Bewust geen sessiecontrole: een agenda-abonnement stuurt geen cookies mee.
 * De toegang zit in het token in de URL, dat een HMAC is over klant en
 * gebruiker. Daarom staan hier ook alleen de velden die de klant zelf al ziet.
 */

export const dynamic = 'force-dynamic';

/* Een halfjaar terug en een jaar vooruit. Ruim genoeg om terug te kijken,
   zonder dat de feed bij een drukke klant eindeloos groeit. */
const DAGEN_TERUG = 183;
const DAGEN_VOORUIT = 365;
const MAX_AFSPRAKEN = 2000;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams;
  const customerId = url.get('klant');
  const portalUserId = url.get('gebruiker');
  const token = url.get('token') || '';

  if (!customerId) {
    return new NextResponse('Ontbrekende parameters', { status: 400 });
  }

  if (!controleerAgendaToken(customerId, portalUserId, token)) {
    /* Bewust hetzelfde antwoord als bij een onbekende klant, zodat je met deze
       route niet kunt aftasten welke klant-ids bestaan. */
    return new NextResponse('Geen toegang', { status: 403 });
  }

  const supabase = createServerClient();

  const { data: klant } = await supabase
    .from('customers')
    .select('name')
    .eq('id', customerId)
    .maybeSingle();
  if (!klant) return new NextResponse('Geen toegang', { status: 403 });

  const van = new Date(Date.now() - DAGEN_TERUG * 86_400_000);
  const tot = new Date(Date.now() + DAGEN_VOORUIT * 86_400_000);

  let q = supabase
    .from('appointments')
    .select('id, starts_at, duration_minutes, status, contact_name, contact_phone, contact_email, street, house_number, postcode, city, notes, branch, updated_at, created_at')
    .eq('customer_id', customerId)
    .gte('starts_at', van.toISOString())
    .lte('starts_at', tot.toISOString())
    .order('starts_at', { ascending: true })
    .limit(MAX_AFSPRAKEN);

  if (portalUserId) q = q.eq('portal_user_id', portalUserId);

  const { data, error } = await q;
  if (error) {
    console.error('[portal/agenda-feed]', error.message);
    return new NextResponse('Agenda kon niet worden geladen', { status: 500 });
  }

  const { data: branches } = await supabase.from('branches').select('slug, name');
  const branchNamen: Record<string, string> = {};
  for (const b of branches || []) branchNamen[b.slug] = b.name;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  const ics = bouwAgendaIcs((data || []) as IcsAfspraak[], {
    kalenderNaam: `WarmeLeads agenda — ${klant.name}`,
    siteUrl,
    branchNamen,
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="warmeleads-agenda.ics"',
      /* Kort cachen: Google haalt de feed uit zichzelf periodiek op, en een
         lange cache zou een net verzette afspraak uren laten hangen. */
      'Cache-Control': 'public, max-age=300',
    },
  });
}
