import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { neemCronSlot, geefCronSlotTerug } from '@/lib/cronSlot';
import { sendActieLotenEmail } from '@/lib/email';
import { actieLabels, lotenVoorBulk, type Actie } from '@/lib/lotenActie';
import { ActieLaadFout, laadActies, laadBatchStanden, laadBulkPerKlant, laadLotRijen, type LotRij } from '@/lib/lotenActieLaden';

/**
 * Elke 10 minuten: de acties met loten bijhouden (zie src/lib/lotenActie.ts).
 * Per actie die loopt of net is afgelopen:
 *
 * 1. Nieuw betaalde leadbatches krijgen hun loten (één regel per batch per
 *    actie; de unieke sleutel voorkomt dubbel tellen).
 * 2. Loten van een batch die gecrediteerd of niet meer betaald is, vervallen.
 * 3. Wie loten kreeg, krijgt één mail met de stand (maximaal 3 pogingen).
 *
 * Eén ronde voor alle betaalroutes (Mollie, factuur betaald in beheer, batch
 * betaald aangemaakt), in plaats van code op elke plek. Na de laatste dag
 * komen er geen loten meer bij; mails van de laatste avond gaan nog door.
 *
 * ?proef=1 laat zien wat er zou gebeuren zonder iets te doen.
 */

export const maxDuration = 300;

const SLOT = 'cron:loten-actie';
const MAX_MAILPOGINGEN = 3;
const NALOOP_MS = 2 * 86_400_000;

const SELECT_LOT = 'id, customer_id, batch_id, batch_size, loten, betaald_op, mail_verstuurd_op, mail_pogingen, mail_fout, vervallen_op, vervallen_reden, created_at';

async function verwerkActie(supabase: SupabaseClient, actie: Actie, nu: Date, proef: boolean, brancheNaam: Map<string, string>) {
  const [standen, bestaand, bulk] = await Promise.all([
    laadBatchStanden(supabase, actie),
    laadLotRijen(supabase, actie),
    laadBulkPerKlant(supabase, actie, nu),
  ]);
  const perBatch = new Map(bestaand.map(r => [r.batch_id, r]));
  const labels = actieLabels(actie);

  /* ── 1. Nieuwe loten ── */
  const nieuw = standen
    .filter(s => s.beoordeling.telt && !perBatch.has(s.id))
    .map(s => {
      const b = s.beoordeling as { telt: true; loten: number; betaaldOp: string };
      return { actie: actie.code, customer_id: s.customer_id, batch_id: s.id, batch_size: s.batch_size, loten: b.loten, betaald_op: b.betaaldOp };
    });

  /* ── 2. Vervallen ── */
  const standPerBatch = new Map(standen.map(s => [s.id, s]));
  const vervallen = bestaand
    .filter(r => !r.vervallen_op)
    .map(r => {
      const s = standPerBatch.get(r.batch_id);
      /* Niet meer in de lijst betekent: niet meer betaald (of verwijderd). */
      if (!s) return { id: r.id, batch_id: r.batch_id, reden: 'niet meer betaald' };
      if (!s.beoordeling.telt && (s.beoordeling.reden === 'gecrediteerd' || s.beoordeling.reden === 'niet betaald')) {
        return { id: r.id, batch_id: r.batch_id, reden: s.beoordeling.reden };
      }
      return null;
    })
    .filter((x): x is { id: string; batch_id: string; reden: string } => x !== null);

  if (proef) {
    const klant = (id: string) => standen.find(s => s.customer_id === id)?.klant?.name ?? id;
    return {
      actie: actie.code, proef: true,
      nieuw: nieuw.map(n => ({ klant: klant(n.customer_id), batch_id: n.batch_id, leads: n.batch_size, loten: n.loten, betaald_op: n.betaald_op })),
      vervallen,
      mailOpen: bestaand.filter(r => !r.mail_verstuurd_op && !r.vervallen_op && r.mail_pogingen < MAX_MAILPOGINGEN).length,
      bulk: [...bulk.entries()].map(([id, n]) => ({ klant: klant(id), bulkleads: n, loten: lotenVoorBulk(actie, n) })),
    };
  }

  let ingevoegd: LotRij[] = [];
  if (nieuw.length > 0) {
    const { data, error } = await supabase
      .from('actie_loten')
      .upsert(nieuw, { onConflict: 'actie,batch_id', ignoreDuplicates: true })
      .select(SELECT_LOT);
    if (error) throw new ActieLaadFout(`loten opslaan: ${error.message}`);
    ingevoegd = (data ?? []) as LotRij[];
  }
  for (const v of vervallen) {
    await supabase
      .from('actie_loten')
      .update({ vervallen_op: nu.toISOString(), vervallen_reden: v.reden })
      .eq('id', v.id)
      .is('vervallen_op', null);
  }

  /* ── 3. Mailen ── */
  const vervallenIds = new Set(vervallen.map(v => v.id));
  const alle = [...bestaand.filter(r => !vervallenIds.has(r.id)), ...ingevoegd];
  const geldigPerKlant = new Map<string, number>();
  for (const r of alle) if (!r.vervallen_op) geldigPerKlant.set(r.customer_id, (geldigPerKlant.get(r.customer_id) ?? 0) + r.loten);
  const teMailen = alle.filter(r => !r.vervallen_op && !r.mail_verstuurd_op && r.mail_pogingen < MAX_MAILPOGINGEN);

  let verstuurd = 0;
  const fouten: { batch_id: string; fout: string }[] = [];
  for (const r of teMailen) {
    const s = standPerBatch.get(r.batch_id);
    const k = s?.klant;
    let fout: string | null = null;
    if (!s || !k?.email) {
      fout = 'klant heeft geen e-mailadres';
    } else {
      const ok = await sendActieLotenEmail(
        { id: k.id, name: k.name, email: k.email, contact_person: k.contact_person ?? undefined },
        {
          batchId: r.batch_id,
          branche: brancheNaam.get(s.branch) ?? s.branch,
          batchSize: r.batch_size,
          loten: r.loten,
          totaalLoten: (geldigPerKlant.get(r.customer_id) ?? r.loten) + lotenVoorBulk(actie, bulk.get(r.customer_id) ?? 0),
          prijsLeads: actie.prijsLeads,
          leadsPerLot: actie.leadsPerLot,
          startLabel: labels.startLabel,
          eindLabel: labels.eindLabel,
          actie: actie.code,
        },
      );
      if (!ok) fout = 'versturen mislukt';
    }
    await supabase
      .from('actie_loten')
      .update(fout
        ? { mail_pogingen: r.mail_pogingen + 1, mail_fout: fout }
        : { mail_pogingen: r.mail_pogingen + 1, mail_fout: null, mail_verstuurd_op: new Date().toISOString() })
      .eq('id', r.id);
    if (fout) fouten.push({ batch_id: r.batch_id, fout });
    else verstuurd++;
  }

  return { actie: actie.code, nieuw: ingevoegd.length, vervallen: vervallen.length, verstuurd, fouten };
}

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const proef = request.nextUrl.searchParams.get('proef') === '1';
  const nu = new Date();
  const supabase = createServerClient();

  let acties: Actie[];
  try {
    acties = (await laadActies(supabase)).filter(a => nu.getTime() >= Date.parse(a.start) && nu.getTime() <= Date.parse(a.eind) + NALOOP_MS);
  } catch (err) {
    console.error('[cron/loten-actie]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onbekende fout' }, { status: 500 });
  }
  if (acties.length === 0) return NextResponse.json({ ok: true, gedaan: 'geen lopende actie' });

  if (!proef && !(await neemCronSlot(supabase, SLOT, 9, { bijFout: 'stoppen' }))) {
    return NextResponse.json({ ok: true, overgeslagen: 'vorige ronde loopt nog' });
  }

  try {
    const { data: branches } = await supabase.from('branches').select('slug, name');
    const brancheNaam = new Map((branches ?? []).map(b => [b.slug as string, b.name as string]));
    const resultaten = [];
    for (const actie of acties) resultaten.push(await verwerkActie(supabase, actie, nu, proef, brancheNaam));
    return NextResponse.json({ ok: true, proef, resultaten });
  } catch (err) {
    console.error('[cron/loten-actie]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onbekende fout' }, { status: 500 });
  } finally {
    if (!proef) await geefCronSlotTerug(supabase, SLOT);
  }
}
