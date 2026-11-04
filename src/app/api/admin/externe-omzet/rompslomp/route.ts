import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { RompslompFout, synchroniseerRompslomp } from '@/lib/rompslompSync';

/** Rompslomp nu ophalen (alleen superadmin); ?proef=1 laat alleen zien wat er zou gebeuren. */

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { admin, error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const proef = request.nextUrl.searchParams.get('proef') === '1';
  try {
    const uitkomst = await synchroniseerRompslomp(createServerClient(), { proef });
    if (!proef) {
      await logAudit({
        adminId: admin?.id ?? null, adminName: admin?.name ?? null, action: 'externe_omzet_rompslomp', entityType: 'externe_omzet', entityId: null,
        details: { nieuw: uitkomst.nieuw, bijgewerkt: uitkomst.bijgewerkt, tellenMee: uitkomst.tellenMee, bedragMee: uitkomst.bedragMee },
      }).catch(() => {});
    }
    return NextResponse.json({ success: true, ...uitkomst });
  } catch (err) {
    console.error('[externe-omzet/rompslomp]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof RompslompFout ? err.message : 'Ophalen uit Rompslomp mislukt' }, { status: 502 });
  }
}
