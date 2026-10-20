import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { neemCronSlot, geefCronSlotTerug, cronSlotBezet } from '@/lib/cronSlot';
import { draaiVangnet, vangnetMinuutOverslaan } from '@/lib/directVangnet';

/**
 * Elke minuut: leads in branches met een direct-klant die bij binnenkomst
 * geen klant kregen, alsnog binnen een minuut verdelen. Zie directVangnet.ts.
 * Met ?proef=1 alleen laten zien wat het zou doen.
 */
export const maxDuration = 60;

const EIGEN_SLOT = 'cron:direct-vangnet';
const VERDEELRONDE = 'cron:distribute';

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const proef = request.nextUrl.searchParams.get('proef') === '1';
  if (proef) return NextResponse.json({ proef: true, ...(await draaiVangnet(supabase, { proef: true })) });

  /* Nooit tegelijk met de kwartierronde. Die minuten slaan we over, en loopt
     de verdeelronde nog, dan doen we niets. Het slot van de verdeelronde
     raken we niet aan: zo kan een vastgelopen vangnet de kwartierronde nooit
     ophouden. Het eigen slot voorkomt twee vangnetten tegelijk; lukt het
     nemen niet, dan slaan we deze minuut over. */
  if (vangnetMinuutOverslaan()) return NextResponse.json({ ok: true, overgeslagen: 'kwartierronde' });
  if (await cronSlotBezet(supabase, VERDEELRONDE)) return NextResponse.json({ ok: true, overgeslagen: 'verdeelronde loopt' });
  if (!(await neemCronSlot(supabase, EIGEN_SLOT, 2, { bijFout: 'stoppen' }))) {
    return NextResponse.json({ ok: true, overgeslagen: 'vorig vangnet loopt nog' });
  }
  try {
    const r = await draaiVangnet(supabase);
    if (r.kandidaten > 0) console.info('[cron/direct-vangnet]', { kandidaten: r.kandidaten, geocodeerd: r.geocodeerd, verdeeld: r.verdeeld, uitgesteld: r.uitgesteld });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error('[cron/direct-vangnet] mislukt:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Vangnet mislukt' }, { status: 500 });
  } finally {
    await geefCronSlotTerug(supabase, EIGEN_SLOT);
  }
}
