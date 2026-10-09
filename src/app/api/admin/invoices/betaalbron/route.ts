import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { getMollieClient } from '@/lib/mollie';

/**
 * Stelt voor oudere betaalde facturen vast of de klant echt via Mollie betaalde.
 *
 * Tot 9 okt 2026 liet "Markeer als betaald" het Mollie-ID van de betaallink
 * gewoon staan, waardoor een factuur die wij met de hand op betaald zetten
 * (klant betaalde via Rompslomp) er hetzelfde uitzag als een Mollie-betaling.
 * Mollie weet het wel: staat de betaling daar op "paid", dan betaalde de
 * klant via Mollie; anders hebben wij hem op betaald gezet.
 *
 * Werkt per portie (binnen de looptijd) en is veilig om vaker te draaien.
 */

const PORTIE = 40;

export async function POST(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;

  const supabase = createServerClient();
  const { data: teDoen, error } = await supabase
    .from('invoices')
    .select('id, mollie_payment_id')
    .eq('status', 'paid')
    .is('betaald_via', null)
    .like('mollie_payment_id', 'tr\\_%')
    .order('created_at', { ascending: true })
    .limit(PORTIE);
  if (error) return NextResponse.json({ error: 'Facturen konden niet worden geladen' }, { status: 500 });

  let mollie: ReturnType<typeof getMollieClient>;
  try {
    mollie = getMollieClient();
  } catch {
    return NextResponse.json({ error: 'Mollie is niet ingesteld op de server' }, { status: 500 });
  }

  let viaMollie = 0;
  let handmatig = 0;
  const fouten: string[] = [];

  /* Vijf tegelijk: snel genoeg, en ruim binnen wat Mollie toestaat. */
  for (let i = 0; i < (teDoen ?? []).length; i += 5) {
    await Promise.all((teDoen ?? []).slice(i, i + 5).map(async f => {
      try {
        const betaling = await mollie.payments.get(f.mollie_payment_id as string);
        const betaald = betaling.status === 'paid';
        const { error: upd } = await supabase
          .from('invoices')
          .update(betaald
            ? { betaald_via: 'mollie', betaald_door: null }
            : { betaald_via: 'handmatig', betaald_door: `vastgesteld via Mollie (betaling ${betaling.status})` })
          .eq('id', f.id)
          .is('betaald_via', null);
        if (upd) throw new Error(upd.message);
        if (betaald) viaMollie++;
        else handmatig++;
      } catch (err) {
        /* Onbekend bij Mollie of tijdelijk niet bereikbaar: laten staan, dan
           blijft hij zichtbaar als "nog onbekend" en kan het opnieuw. */
        fouten.push(`${f.mollie_payment_id}: ${err instanceof Error ? err.message.slice(0, 120) : 'onbekende fout'}`);
      }
    }));
  }

  const { count: resterend } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'paid')
    .is('betaald_via', null);

  return NextResponse.json({ gecontroleerd: (teDoen ?? []).length, viaMollie, handmatig, fouten, resterend: resterend ?? 0 });
}
