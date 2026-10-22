import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { neemCronSlot, geefCronSlotTerug, cronSlotBezet } from '@/lib/cronSlot';
import { verwerkGeplandeLeveringen } from '@/lib/geplandeLeveringen';
import { vangnetMinuutOverslaan } from '@/lib/directVangnet';

/**
 * Elke minuut: leveringen uit de wachtrij die aan de beurt zijn. Zo komt een
 * verspreide of gefaseerde lead aan op het willekeurige moment dat ervoor
 * gekozen is, in plaats van op het volgende kwartier.
 */
export const maxDuration = 60;

const EIGEN_SLOT = 'cron:geplande-leveringen';
const VERDEELRONDE = 'cron:distribute';

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();

  /* Nooit tegelijk met de kwartierronde: die werkt de wachtrij zelf ook af.
     Het slot van de verdeelronde raken we niet aan; het eigen slot voorkomt
     twee rondes tegelijk. Lukt het nemen niet, dan slaan we deze minuut over. */
  if (vangnetMinuutOverslaan()) return NextResponse.json({ ok: true, overgeslagen: 'kwartierronde' });
  if (await cronSlotBezet(supabase, VERDEELRONDE)) return NextResponse.json({ ok: true, overgeslagen: 'verdeelronde loopt' });
  if (!(await neemCronSlot(supabase, EIGEN_SLOT, 2, { bijFout: 'stoppen' }))) {
    return NextResponse.json({ ok: true, overgeslagen: 'vorige ronde loopt nog' });
  }
  try {
    const r = await verwerkGeplandeLeveringen(supabase, { max: 60, tijdBudgetMs: 40_000 });
    if (r.bekeken > 0) console.info('[cron/geplande-leveringen]', r);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error('[cron/geplande-leveringen] mislukt:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Wachtrij afwerken mislukt' }, { status: 500 });
  } finally {
    await geefCronSlotTerug(supabase, EIGEN_SLOT);
  }
}
