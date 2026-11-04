import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { synchroniseerRompslomp } from '@/lib/rompslompSync';

/**
 * Elke nacht: de verkoopfacturen uit Rompslomp bijwerken in externe_omzet
 * (zie src/lib/rompslompSync.ts). ?proef=1 laat zien wat er zou gebeuren.
 */

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;
  const proef = request.nextUrl.searchParams.get('proef') === '1';
  try {
    const { voorstellen, ...uitkomst } = await synchroniseerRompslomp(createServerClient(), { proef });
    return NextResponse.json({ ok: true, proef, ...uitkomst, ...(proef ? { voorstellen } : {}) });
  } catch (err) {
    const tekst = err instanceof Error ? err.message : String(err);
    console.error('[cron/rompslomp]', tekst);
    return NextResponse.json({ error: tekst }, { status: 500 });
  }
}
