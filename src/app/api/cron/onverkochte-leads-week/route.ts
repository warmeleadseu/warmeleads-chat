import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { layout, sendEmail } from '@/lib/email';
import { MASTER_PORTAL_MIRROR_BY_BRANCH } from '@/lib/masterPortalMirror';
import { bouwInhoud, stelWeekoverzichtSamen, vorigeWeek } from '@/lib/onverkochtWeekoverzicht';

/**
 * Maandagochtend: overzicht van de onverkochte leads van vorige week per
 * branche en regio, naar alle actieve gebruikers van het CRM. Met ?proef=1
 * komt de inhoud terug zonder dat er iets wordt verstuurd.
 */
const MAIL_TYPE = 'onverkochte_leads_week';

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const week = vorigeWeek();
  const overzicht = await stelWeekoverzichtSamen(supabase, week, Object.values(MASTER_PORTAL_MIRROR_BY_BRANCH));
  const { onderwerp, html } = bouwInhoud(week, overzicht.groepen, overzicht.brancheNaam, overzicht);

  if (request.nextUrl.searchParams.get('proef') === '1') {
    return NextResponse.json({ week, onderwerp, groepen: overzicht.groepen, totaalLeads: overzicht.totaalLeads, nepnummers: overzicht.nepnummers });
  }

  const { data: gebruikers } = await supabase.from('admin_users').select('email, name').eq('is_active', true);

  /* Niet twee keer dezelfde week naar dezelfde persoon, ook als de cron opnieuw draait. */
  const { data: al } = await supabase
    .from('email_log')
    .select('to_email')
    .eq('type', MAIL_TYPE)
    .neq('status', 'failed')
    .contains('metadata', { week: week.van });
  const gehad = new Set((al ?? []).map(r => String(r.to_email).toLowerCase()));

  let verstuurd = 0;
  for (const g of gebruikers ?? []) {
    const email = String(g.email ?? '').trim();
    if (!email || gehad.has(email.toLowerCase())) continue;
    const ok = await sendEmail(email, onderwerp, layout(onderwerp, html), {
      type: MAIL_TYPE,
      toName: (g.name as string | null) ?? undefined,
      metadata: { week: week.van, tot: week.tot, onverkocht: overzicht.groepen.reduce((s, x) => s + x.totaal, 0) },
    });
    if (ok) verstuurd++;
  }

  return NextResponse.json({ ok: true, week, verstuurd, ontvangers: (gebruikers ?? []).length });
}
