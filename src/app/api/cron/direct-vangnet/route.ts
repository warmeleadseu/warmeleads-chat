import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { neemCronSlot, geefCronSlotTerug } from '@/lib/cronSlot';
import { draaiVangnet, vangnetMinuutOverslaan } from '@/lib/directVangnet';

/**
 * Elke minuut: leads in branches met een direct-klant die bij binnenkomst
 * geen klant kregen, alsnog binnen een minuut verdelen. Zie directVangnet.ts.
 * Met ?proef=1 alleen laten zien wat het zou doen.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const proef = request.nextUrl.searchParams.get('proef') === '1';
  if (proef) return NextResponse.json({ proef: true, ...(await draaiVangnet(supabase, { proef: true })) });

  /* Nooit tegelijk met de kwartierronde: die minuten slaan we over, en loopt
     de verdeelronde nog, dan is het slot bezet en doen we niets. */
  if (vangnetMinuutOverslaan()) return NextResponse.json({ ok: true, overgeslagen: 'kwartierronde' });
  const slot = 'cron:distribute';
  if (!(await neemCronSlot(supabase, slot, 2))) {
    return NextResponse.json({ ok: true, overgeslagen: 'verdeelronde loopt' });
  }
  try {
    const r = await draaiVangnet(supabase);
    if (r.kandidaten > 0) console.info('[cron/direct-vangnet]', { kandidaten: r.kandidaten, geocodeerd: r.geocodeerd, verdeeld: r.verdeeld });
    return NextResponse.json({ ok: true, ...r });
  } finally {
    await geefCronSlotTerug(supabase, slot);
  }
}
