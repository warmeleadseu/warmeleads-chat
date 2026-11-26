import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { dagoverzichtNu, stuurDagoverzichten, stuurProspectSeintjes, stuurSeintjes } from '@/lib/terugbelMeldingen';

/**
 * Elke minuut: pushmeldingen voor terugbelmomenten die over vijf minuten aan de
 * beurt zijn, voor terugbelafspraken van accountmanagers met prospects, en om
 * 8 uur het dagoverzicht per mail (src/lib/terugbelMeldingen.ts).
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;
  const supabase = createServerClient();
  const nu = new Date();
  try {
    const seintjes = await stuurSeintjes(supabase, nu);
    const mails = seintjes.aanwezig && dagoverzichtNu(nu) ? await stuurDagoverzichten(supabase, nu) : 0;
    /* Prospects apart, zodat een fout daar de seintjes voor klanten niet tegenhoudt. */
    const prospects = await stuurProspectSeintjes(supabase, nu).catch(err => {
      console.error('[cron/terugbellen] prospects', err instanceof Error ? err.message : err);
      return { momenten: 0, verstuurd: 0 };
    });
    if (seintjes.momenten > 0 || mails > 0 || prospects.momenten > 0) console.info('[cron/terugbellen]', { ...seintjes, mails, prospects });
    return NextResponse.json({ ok: true, ...seintjes, mails, prospects });
  } catch (err) {
    console.error('[cron/terugbellen]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Seintjes versturen mislukt' }, { status: 500 });
  }
}
