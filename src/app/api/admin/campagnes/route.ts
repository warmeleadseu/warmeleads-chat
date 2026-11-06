import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { signalen } from '@/lib/campagneEffectiviteit';
import { laadCampagneOverzicht } from '@/lib/campagneEffectiviteitLaden';

/**
 * Effectiviteit van de Meta-campagnes in een periode: leads volgens Meta,
 * binnengekomen leads en waar ze heen gingen. Alleen superadmin.
 * GET ?van=yyyy-mm-dd&tot=yyyy-mm-dd (standaard de laatste 30 dagen)
 */

export const maxDuration = 60;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;

  const q = request.nextUrl.searchParams;
  const vandaag = new Date();
  const standaardVan = new Date(vandaag);
  standaardVan.setUTCDate(standaardVan.getUTCDate() - 29);
  const van = DATUM.test(q.get('van') ?? '') ? q.get('van')! : iso(standaardVan);
  const tot = DATUM.test(q.get('tot') ?? '') ? q.get('tot')! : iso(vandaag);
  if (van > tot) return NextResponse.json({ error: 'De begindatum ligt na de einddatum' }, { status: 400 });

  try {
    const rijen = await laadCampagneOverzicht(createServerClient(), van, tot);
    return NextResponse.json({
      van,
      tot,
      /* Vanaf hier wordt elke koppeling vastgelegd; daarvoor is hij geschat. */
      geschiedenis_sinds: '2026-11-06',
      campagnes: rijen.map(r => ({ ...r, signalen: signalen(r) })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin/campagnes] laden mislukt:', e);
    return NextResponse.json({ error: 'De campagnes konden niet worden geladen' }, { status: 500 });
  }
}
