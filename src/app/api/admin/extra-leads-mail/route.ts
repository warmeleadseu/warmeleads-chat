import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { INTRO_TYPE, MAANDAG_TYPE, TEST_ADRES, maandagVan } from '@/lib/extraLeadsMail';
import {
  bouwVoor, isMaandagmailAan, laadMailAanbod, laadOntvangers, stuurTest, verstuurAanIedereen, zetMaandagmail, type Soort,
} from '@/lib/extraLeadsMailVerzenden';

/**
 * Beheer van de Extra leads-mails (alleen superadmin).
 *
 * GET  ?soort=intro|maandag&klant=<id>  voorbeeld, ontvangers en stand
 * POST {actie:'test', soort, klant?}    testmail naar info@warmeleads.eu
 * POST {actie:'intro', aantal}          introductiemail naar alle ontvangers;
 *                                       aantal moet kloppen met wat het scherm toonde
 * POST {actie:'schakelaar', aan}        maandagmail aan of uit
 */

export const maxDuration = 300;

const isSoort = (s: unknown): s is Soort => s === 'intro' || s === 'maandag';

async function telVerstuurd(supabase: ReturnType<typeof createServerClient>, type: string, week?: string): Promise<number> {
  let q = supabase.from('email_log').select('id', { count: 'exact', head: true }).eq('type', type).neq('status', 'failed');
  if (week) q = q.contains('metadata', { week });
  const { count } = await q;
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const supabase = createServerClient();
  const soort: Soort = isSoort(request.nextUrl.searchParams.get('soort')) ? (request.nextUrl.searchParams.get('soort') as Soort) : 'intro';
  const klantId = request.nextUrl.searchParams.get('klant');

  try {
    const [aan, aanbod, ontvangers] = await Promise.all([isMaandagmailAan(supabase), laadMailAanbod(supabase), laadOntvangers(supabase)]);
    const week = maandagVan();
    const [introVerstuurd, maandagDezeWeek] = await Promise.all([
      telVerstuurd(supabase, INTRO_TYPE),
      telVerstuurd(supabase, MAANDAG_TYPE, week),
    ]);

    const rijen = ontvangers.map(o => ({
      id: o.id,
      naam: o.naam,
      email: o.email,
      branches: [...o.branches].map(aanbod.brancheNaam),
      regios: o.regios.slice(0, 3),
      maandag_aantal: bouwVoor('maandag', o, aanbod, '#')?.aantal ?? 0,
    }));

    const voorbeeldKlant = klantId ? ontvangers.find(o => o.id === klantId) : null;
    const voorbeeld = bouwVoor(soort, voorbeeldKlant ?? { voornaam: 'Jan', branches: new Set(aanbod.leads.map(l => l.branch)), regios: [] }, aanbod, '#');

    return NextResponse.json({
      aan,
      test_adres: TEST_ADRES,
      week,
      aanbod: aanbod.leads.length,
      intro_verstuurd: introVerstuurd,
      maandag_deze_week: maandagDezeWeek,
      ontvangers: rijen,
      voorbeeld: voorbeeld ? { onderwerp: voorbeeld.onderwerp, html: voorbeeld.html } : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin/extra-leads-mail] laden mislukt:', e);
    return NextResponse.json({ error: 'Laden mislukt' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { admin, error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const supabase = createServerClient();
  const body = await request.json().catch(() => ({}));

  try {
    if (body?.actie === 'schakelaar') {
      const aan = body.aan === true;
      await zetMaandagmail(supabase, aan);
      void logAudit({ adminId: admin.id, adminName: admin.name, action: 'extra_leads_maandagmail_schakelaar', entityType: 'app_settings', entityId: 'extra_leads_maandagmail', details: { aan } });
      return NextResponse.json({ aan });
    }

    if (body?.actie === 'test') {
      if (!isSoort(body.soort)) return NextResponse.json({ error: 'Onbekende mail' }, { status: 400 });
      const r = await stuurTest(supabase, body.soort, typeof body.klant === 'string' ? body.klant : null);
      if (!r.ok) return NextResponse.json({ error: r.error || 'Versturen mislukt' }, { status: 400 });
      return NextResponse.json({ ok: true, naar: TEST_ADRES, onderwerp: r.onderwerp });
    }

    if (body?.actie === 'intro') {
      /* Het scherm stuurt mee hoeveel ontvangers het toonde: zo gaat er niets
         weg naar een lijst die intussen anders is dan wat je bevestigde. */
      const ontvangers = await laadOntvangers(supabase);
      if (Number(body.aantal) !== ontvangers.length) {
        return NextResponse.json({ error: `Het aantal ontvangers is intussen ${ontvangers.length}. Ververs de pagina en bevestig opnieuw.` }, { status: 409 });
      }
      const res = await verstuurAanIedereen(supabase, 'intro', { deadlineMs: 270_000 });
      void logAudit({ adminId: admin.id, adminName: admin.name, action: 'extra_leads_intromail', entityType: 'email', entityId: INTRO_TYPE, details: { ...res, mislukt: res.mislukt.length } });
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 });
  } catch (e) {
    console.error('[admin/extra-leads-mail] actie mislukt:', e);
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
