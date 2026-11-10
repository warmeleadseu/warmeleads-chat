import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { synchroniseerRompslomp } from '@/lib/rompslompSync';
import { alarmeerSuperadmins, escHtml } from '@/lib/superadminAlarm';

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
    /* Niet stil laten mislukken: zonder deze ronde ontbreken nieuwe facturen in
       de omzet (nov 2026: de API-sleutel werkte niet meer en dat viel dagen niet op). */
    if (!proef) {
      const sleutel = /401|unauthori|token|sleutel/i.test(tekst);
      await alarmeerSuperadmins(
        createServerClient(),
        'rompslomp_sync_fout',
        'De facturen uit Rompslomp konden niet worden opgehaald',
        `<p style="font-size:14px;color:#334155;line-height:1.6">De nachtelijke ronde die de verkoopfacturen uit Rompslomp ophaalt, is mislukt. Nieuwe facturen ontbreken dan in de omzet.</p>
         <p style="font-size:13px;color:#475569">Melding: ${escHtml(tekst).slice(0, 300)}</p>
         <p style="font-size:14px;color:#334155;line-height:1.6">${sleutel ? 'Waarschijnlijk is de API-sleutel ingetrokken of verlopen. Maak in Rompslomp een nieuwe aan en zet die in Vercel als ROMPSLOMP_API_TOKEN.' : 'De ronde draait elke nacht opnieuw.'}</p>`,
        { fout: tekst.slice(0, 300) },
      ).catch(e => console.error('[cron/rompslomp] alarm mislukt', e));
    }
    return NextResponse.json({ error: tekst }, { status: 500 });
  }
}
