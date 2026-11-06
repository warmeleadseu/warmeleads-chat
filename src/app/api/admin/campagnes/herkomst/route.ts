import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { laadBatchHerkomst } from '@/lib/campagneEffectiviteitLaden';

/**
 * Herkomst van de leads in één batch: uit de gekoppelde campagne(s), uit
 * andere campagnes of zonder campagne, met de koppelingen in de tijd.
 * Alleen superadmin. GET ?batch=<id>
 */

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const batchId = request.nextUrl.searchParams.get('batch') ?? '';
  if (!UUID.test(batchId)) return NextResponse.json({ error: 'Ongeldige batch' }, { status: 400 });
  try {
    return NextResponse.json(await laadBatchHerkomst(createServerClient(), batchId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin/campagnes/herkomst] laden mislukt:', e);
    return NextResponse.json({ error: 'De herkomst kon niet worden geladen' }, { status: 500 });
  }
}
