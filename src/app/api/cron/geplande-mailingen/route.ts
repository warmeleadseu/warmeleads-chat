import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { nogNietAanwezig } from '@/lib/terugbelMeldingen';
import { BEZIG_TE_LANG_MIN, verstuurMailing, type GeplandeMailing } from '@/lib/geplandeMailingen';

/**
 * Elke vijf minuten: verstuurt goedgekeurde mailingen waarvan het tijdstip is
 * aangebroken (src/lib/geplandeMailingen.ts). Eén mailing per ronde; eerst
 * claimen, zodat twee rondes nooit dezelfde mailing versturen.
 */
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;
  const supabase = createServerClient();
  const nu = new Date();

  /* Blijft een mailing hangen op 'bezig' (functie afgebroken), dan melden we dat; opnieuw versturen doen we niet automatisch. */
  await supabase
    .from('geplande_mailingen')
    .update({ status: 'mislukt', fout: 'Versturen afgebroken; controleer in de mailhistorie wie hem al kreeg', klaar_op: nu.toISOString() })
    .eq('status', 'bezig')
    .lt('gestart_op', new Date(nu.getTime() - BEZIG_TE_LANG_MIN * 60_000).toISOString());

  const { data: klaar, error } = await supabase
    .from('geplande_mailingen')
    .select('*')
    .eq('status', 'goedgekeurd')
    .lte('verstuur_op', nu.toISOString())
    .order('verstuur_op')
    .limit(1);
  if (nogNietAanwezig(error)) return NextResponse.json({ ok: true, aanwezig: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const m = (klaar ?? [])[0] as GeplandeMailing | undefined;
  if (!m) return NextResponse.json({ ok: true, verstuurd: 0 });

  const { data: geclaimd } = await supabase
    .from('geplande_mailingen')
    .update({ status: 'bezig', gestart_op: nu.toISOString(), updated_at: nu.toISOString() })
    .eq('id', m.id)
    .eq('status', 'goedgekeurd')
    .select('id');
  if (!geclaimd || geclaimd.length === 0) return NextResponse.json({ ok: true, overgeslagen: 'al geclaimd' });

  try {
    const telling = await verstuurMailing(supabase, m);
    await supabase
      .from('geplande_mailingen')
      .update({ ...telling, status: 'verstuurd', klaar_op: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', m.id);
    await logAudit({
      adminId: m.goedgekeurd_door, adminName: 'Geplande mailing', action: 'email.geplande_mailing_verstuurd',
      entityType: 'geplande_mailing', entityId: m.id, details: { naam: m.naam, ontvangers: m.ontvangers.length, ...telling },
    }).catch(() => {});
    console.info('[cron/geplande-mailingen]', m.naam, telling);
    return NextResponse.json({ ok: true, mailing: m.naam, ...telling });
  } catch (err) {
    const fout = err instanceof Error ? err.message : String(err);
    await supabase.from('geplande_mailingen').update({ status: 'mislukt', fout, klaar_op: new Date().toISOString() }).eq('id', m.id);
    console.error('[cron/geplande-mailingen]', m.naam, fout);
    return NextResponse.json({ error: fout }, { status: 500 });
  }
}
