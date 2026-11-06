import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { laadRedenen } from '@/lib/campagneEffectiviteitLaden';

/**
 * Waarom leads van een campagne bij andere klanten kwamen en niet bij de
 * gekoppelde klant. Alleen superadmin.
 * GET ?campagne=<meta campaign id>&van=yyyy-mm-dd&tot=yyyy-mm-dd
 */

export const maxDuration = 60;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const q = request.nextUrl.searchParams;
  const campagne = q.get('campagne') ?? '';
  const van = q.get('van') ?? '';
  const tot = q.get('tot') ?? '';
  if (!/^[\w-]{1,64}$/.test(campagne) || !DATUM.test(van) || !DATUM.test(tot) || van > tot) {
    return NextResponse.json({ error: 'Ongeldige campagne of periode' }, { status: 400 });
  }
  try {
    return NextResponse.json(await laadRedenen(createServerClient(), campagne, van, tot), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin/campagnes/redenen] laden mislukt:', e);
    return NextResponse.json({ error: 'De redenen konden niet worden geladen' }, { status: 500 });
  }
}
