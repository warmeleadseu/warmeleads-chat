import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { berekenBatchWinst } from '@/lib/batchWinst';
import { laadFacturenPerBatch } from '@/lib/batchWinstLaden';
import { bouwResultaat, verdiendPerDag, type PeriodeSoort, type PersoneelsRegel, type WinstBatch } from '@/lib/resultaatPerPeriode';

/**
 * Resultaat per periode: verdiende omzet min advertentiekosten min
 * personeelskosten. Vanaf 1 mei 2026 (sinds dan zijn de advertentiekosten
 * bekend). Alleen superadmin. Zie src/lib/resultaatPerPeriode.ts.
 *
 * Filters:
 * - uitsluiten: klant-id's die niet meetellen. Hun omzet, hun leveringen en
 *   hun deel van de advertentiekosten (de kosten van de leads die zij kregen,
 *   gedeeld door het aantal klanten van die lead) gaan eruit. Bijvoorbeeld een
 *   partij die afspraken voor ons belt.
 * - afspraken=1: de afsprakenbatches tellen mee, per geleverde afspraak op de
 *   dag dat hij werd ingepland (geannuleerd of verzet telt niet).
 */

export const maxDuration = 60;

const START = '2026-05-01';
const SOORTEN = ['leads', 'bulk_leads', 'niche_research'];
const PERIODES: PeriodeSoort[] = ['week', 'maand', 'kwartaal', 'jaar'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Afspraken die niet als geleverd tellen (zie appointmentBatchSync.ts). */
const AFSPRAAK_NIET_GELEVERD = new Set(['cancelled', 'rescheduled']);

const nlDag = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const plus = (m: Map<string, number>, dag: string, bedrag: number) => { if (bedrag) m.set(dag, (m.get(dag) ?? 0) + bedrag); };

class LaadFout extends Error {}

export async function GET(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;

  const soortIn = request.nextUrl.searchParams.get('soort') as PeriodeSoort | null;
  const soort: PeriodeSoort = soortIn && PERIODES.includes(soortIn) ? soortIn : 'maand';
  const uitgesloten = new Set((request.nextUrl.searchParams.get('uitsluiten') ?? '').split(',').map(x => x.trim()).filter(x => UUID.test(x)));
  const metAfspraken = request.nextUrl.searchParams.get('afspraken') === '1';
  const vandaag = nlDag(new Date().toISOString());
  const supabase = createServerClient();

  try {
    /* Betaalde batches van externe klanten. */
    type BatchRij = {
      id: string; customer_id: string; batch_kind: string; status: string; batch_size: number; total_price: number | string | null;
      is_paid: boolean | null; mollie_payment_id: string | null; leads_delivered_external: number | null;
      extern_bedrag_excl: number | string | null; created_at: string; completed_at: string | null;
      customers: { intern?: boolean } | { intern?: boolean }[] | null;
    };
    const batches: BatchRij[] = [];
    for (let p = 0; p < 20; p++) {
      const { data, error } = await supabase
        .from('customer_batches')
        .select('id, customer_id, batch_kind, status, batch_size, total_price, is_paid, mollie_payment_id, leads_delivered_external, extern_bedrag_excl, created_at, completed_at, customers(intern)')
        .in('batch_kind', SOORTEN)
        .eq('is_paid', true)
        .order('id')
        .range(p * 1000, p * 1000 + 999);
      if (error) throw new LaadFout(`batches: ${error.message}`);
      batches.push(...((data ?? []) as BatchRij[]).filter(b => !(Array.isArray(b.customers) ? b.customers[0] : b.customers)?.intern && !uitgesloten.has(b.customer_id)));
      if (!data || data.length < 1000) break;
    }
    const ids = batches.map(b => b.id);

    const [facturenPerBatch, leveringenRuw, advertentieRuw, personeelRuw, facturenRuw] = await Promise.all([
      laadFacturenPerBatch(supabase, ids),
      (async () => {
        const uit: { batch_id: string; dag: string; aantal: number }[] = [];
        /* De database geeft per aanvraag hooguit 1000 rijen; zonder pagina's
           vielen er bij veel batches stilletjes leverdagen weg. */
        for (let i = 0; i < ids.length; i += 100) {
          for (let p = 0; p < 100; p++) {
            const { data, error } = await supabase
              .rpc('winst_leveringen_per_dag', { p_batch_ids: ids.slice(i, i + 100) })
              .order('batch_id')
              .order('dag')
              .range(p * 1000, p * 1000 + 999);
            if (error) throw new LaadFout(`leveringen: ${error.message}`);
            uit.push(...((data ?? []) as { batch_id: string; dag: string; aantal: number }[]));
            if (!data || data.length < 1000) break;
          }
        }
        return uit;
      })(),
      (async () => {
        const uit: { dag: string; uitgaven: number | string }[] = [];
        for (let p = 0; p < 20; p++) {
          const { data, error } = await supabase.rpc('winst_advertentie_per_dag', { p_van: START, p_tot: vandaag }).order('dag').range(p * 1000, p * 1000 + 999);
          if (error) return { data: null, error };
          uit.push(...((data ?? []) as { dag: string; uitgaven: number | string }[]));
          if (!data || data.length < 1000) break;
        }
        return { data: uit, error: null };
      })(),
      supabase.from('personeelskosten').select('id, omschrijving, bedrag_per_maand, ingang, einde').order('ingang'),
      (async () => {
        const uit: Record<string, unknown>[] = [];
        for (let p = 0; p < 20; p++) {
          const { data, error } = await supabase
            .from('invoices')
            .select('id, customer_id, batch_id, appointment_batch_id, credit_note_of, subtotal, status, paid_at, created_at, customers(intern)')
            .gte('created_at', '2026-01-01')
            .order('id')
            .range(p * 1000, p * 1000 + 999);
          if (error) throw new LaadFout(`facturen: ${error.message}`);
          uit.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return uit;
      })(),
    ]);
    if (advertentieRuw.error) throw new LaadFout(`advertentie: ${advertentieRuw.error.message}`);
    if (personeelRuw.error) throw new LaadFout(`personeel: ${personeelRuw.error.message}`);

    const leveringenPerBatch = new Map<string, { dag: string; aantal: number }[]>();
    const leveringen = new Map<string, number>();
    for (const l of leveringenRuw) {
      leveringenPerBatch.set(l.batch_id, [...(leveringenPerBatch.get(l.batch_id) ?? []), { dag: l.dag, aantal: l.aantal }]);
      plus(leveringen, l.dag, l.aantal);
    }

    /* Verdiend: per batch naar rato van levering. */
    const verdiend = new Map<string, number>();
    const gefactureerd = new Map<string, number>();
    for (const b of batches) {
      const facturen = facturenPerBatch.get(b.id) ?? [];
      const w = berekenBatchWinst(b, facturen, null);
      const invoer: WinstBatch = {
        id: b.id, batch_kind: b.batch_kind, status: b.status, omzet: w.omzet, grootte: w.grootte,
        geleverdExtern: w.geleverdExtern, aangemaakt: nlDag(b.created_at),
        afgerond: b.completed_at ? nlDag(b.completed_at) : null, leveringen: leveringenPerBatch.get(b.id) ?? [],
      };
      for (const [dag, bedrag] of verdiendPerDag(invoer)) plus(verdiend, dag, bedrag);
      /* Gefactureerd zonder factuur in het systeem (extern of batchprijs): op de aanmaakdag. */
      if (facturen.length === 0 || w.omzetBron === 'extern') plus(gefactureerd, nlDag(b.created_at), w.omzet);
    }

    /* Facturen: gefactureerd op de betaaldag; losse facturen (zonder batch) ook
       als verdiend. Afspraken en interne klanten tellen niet. */
    const batchSet = new Set(ids);
    type Factuur = { id: string; customer_id: string | null; batch_id: string | null; appointment_batch_id: string | null; credit_note_of: string | null; subtotal: number | string | null; status: string; paid_at: string | null; created_at: string; customers: { intern?: boolean } | { intern?: boolean }[] | null };
    const facturen = facturenRuw as unknown as Factuur[];
    const perId = new Map(facturen.map(f => [f.id, f]));
    const afspraakBatches = metAfspraken ? await laadAfspraakBatches(supabase, uitgesloten) : null;
    const afspraakSet = new Set(afspraakBatches?.map(b => b.id) ?? []);
    const telt = (f: Factuur) =>
      !(Array.isArray(f.customers) ? f.customers[0] : f.customers)?.intern &&
      !(f.customer_id && uitgesloten.has(f.customer_id)) &&
      (!f.appointment_batch_id || afspraakSet.has(f.appointment_batch_id));
    for (const f of facturen) {
      const bedrag = Number(f.subtotal) || 0;
      if (f.credit_note_of) {
        const origineel = perId.get(f.credit_note_of);
        if (!origineel || !telt(origineel)) continue;
        if (origineel.batch_id && !batchSet.has(origineel.batch_id)) continue;
        const dag = nlDag(f.created_at);
        plus(gefactureerd, dag, -Math.abs(bedrag));
        if (!origineel.batch_id && !origineel.appointment_batch_id && origineel.status === 'paid') plus(verdiend, dag, -Math.abs(bedrag));
        continue;
      }
      if (f.status !== 'paid' || !f.paid_at || !telt(f)) continue;
      if (f.batch_id && !batchSet.has(f.batch_id)) continue;
      const dag = nlDag(f.paid_at);
      if (f.batch_id) {
        /* Een extern bedrag gaat voor op de factuur: die batch telde hierboven al. */
        const b = batches.find(x => x.id === f.batch_id);
        if (b && b.extern_bedrag_excl !== null && b.extern_bedrag_excl !== undefined && String(b.extern_bedrag_excl) !== '') continue;
        plus(gefactureerd, dag, bedrag);
      } else if (f.appointment_batch_id) {
        /* Afspraken: gefactureerd op de betaaldag; verdiend per geleverde afspraak (hieronder). */
        plus(gefactureerd, dag, bedrag);
      } else {
        plus(gefactureerd, dag, bedrag);
        plus(verdiend, dag, bedrag);
      }
    }

    /* Afspraken: per geleverde afspraak op de dag dat hij werd ingepland. */
    if (afspraakBatches) {
      const factuurPerAfspraakBatch = new Map<string, { subtotal: number; credit: boolean }[]>();
      for (const f of facturen) {
        const doel = f.appointment_batch_id ?? (f.credit_note_of ? perId.get(f.credit_note_of)?.appointment_batch_id : null);
        if (!doel || !afspraakSet.has(doel)) continue;
        factuurPerAfspraakBatch.set(doel, [...(factuurPerAfspraakBatch.get(doel) ?? []), { subtotal: Number(f.subtotal) || 0, credit: Boolean(f.credit_note_of) }]);
      }
      for (const b of afspraakBatches) {
        const fs2 = factuurPerAfspraakBatch.get(b.id) ?? [];
        const gewoon = fs2.filter(x => !x.credit);
        const omzet = gewoon.length > 0
          ? gewoon.reduce((t, x) => t + x.subtotal, 0) - fs2.filter(x => x.credit).reduce((t, x) => t + Math.abs(x.subtotal), 0)
          : Number(b.total_price) || 0;
        if (gewoon.length === 0) plus(gefactureerd, nlDag(b.created_at), omzet);
        const perDag = new Map<string, number>();
        for (const a of b.afspraken) plus(perDag, nlDag(a), 1);
        const invoer: WinstBatch = {
          id: b.id, batch_kind: 'afspraken', status: b.status, omzet, grootte: Math.max(0, Number(b.batch_size) || 0),
          geleverdExtern: 0, aangemaakt: nlDag(b.created_at), afgerond: b.status === 'completed' ? nlDag(b.updated_at ?? b.created_at) : null,
          leveringen: [...perDag.entries()].map(([dag, aantal]) => ({ dag, aantal })),
        };
        for (const [dag, bedrag] of verdiendPerDag(invoer)) plus(verdiend, dag, bedrag);
      }
    }

    const advertentie = new Map<string, number>();
    for (const a of (advertentieRuw.data ?? []) as { dag: string; uitgaven: number | string }[]) plus(advertentie, a.dag, Number(a.uitgaven) || 0);
    /* Uitgesloten klanten: hun deel van de advertentiekosten eraf. */
    const kostenUitgesloten = uitgesloten.size > 0 ? await laadKostenVanKlanten(supabase, uitgesloten) : new Map<string, number>();
    for (const [dag, bedrag] of kostenUitgesloten) plus(advertentie, dag, -bedrag);

    const personeel = (personeelRuw.data ?? []) as (PersoneelsRegel & { id: string; omschrijving: string })[];
    const perioden = bouwResultaat({
      soort, start: START, vandaag, verdiend, gefactureerd, advertentie, leveringen,
      personeel: personeel.map(p => ({ bedrag_per_maand: Number(p.bedrag_per_maand), ingang: p.ingang, einde: p.einde })),
    });

    const uitgeslotenKosten = Math.round([...kostenUitgesloten.values()].reduce((t, v) => t + v, 0) * 100) / 100;
    return NextResponse.json(
      { soort, start: START, vandaag, perioden, personeel, filter: { uitgesloten: [...uitgesloten], afspraken: metAfspraken, uitgeslotenKosten } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('[admin/winst/resultaat]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Het resultaat kon niet volledig worden berekend; probeer het opnieuw' }, { status: 500 });
  }
}

type AfspraakBatch = { id: string; status: string; batch_size: number; total_price: number | string | null; created_at: string; updated_at: string | null; afspraken: string[] };

/** Betaalde afsprakenbatches (geen interne of uitgesloten klanten), met de momenten van hun geleverde afspraken. */
async function laadAfspraakBatches(supabase: ReturnType<typeof createServerClient>, uitgesloten: Set<string>): Promise<AfspraakBatch[]> {
  const { data, error } = await supabase
    .from('appointment_batches')
    .select('id, customer_id, status, batch_size, total_price, is_paid, created_at, updated_at, customers(intern)')
    .eq('is_paid', true);
  if (error) throw new LaadFout(`afsprakenbatches: ${error.message}`);
  const batches = (data ?? []).filter(b => {
    const k = (Array.isArray(b.customers) ? b.customers[0] : b.customers) as { intern?: boolean } | null;
    return !k?.intern && !uitgesloten.has(b.customer_id as string);
  });
  const ids = batches.map(b => b.id as string);
  const perBatch = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: afs, error: afsFout } = await supabase.from('appointments').select('batch_id, status, created_at').in('batch_id', ids.slice(i, i + 200));
    if (afsFout) throw new LaadFout(`afspraken: ${afsFout.message}`);
    for (const a of afs ?? []) {
      if (AFSPRAAK_NIET_GELEVERD.has(a.status as string)) continue;
      perBatch.set(a.batch_id as string, [...(perBatch.get(a.batch_id as string) ?? []), a.created_at as string]);
    }
  }
  return batches.map(b => ({
    id: b.id as string, status: b.status as string, batch_size: Number(b.batch_size) || 0, total_price: b.total_price as number | string | null,
    created_at: b.created_at as string, updated_at: (b.updated_at as string | null) ?? null, afspraken: perBatch.get(b.id as string) ?? [],
  }));
}

/**
 * Advertentiekosten per dag van de leads die deze klanten kregen: per lead de
 * kosten gedeeld door het aantal klanten dat hem kreeg, maal het aantal van
 * deze klanten daaronder. Zelfde verdeling als de winst per batch.
 */
async function laadKostenVanKlanten(supabase: ReturnType<typeof createServerClient>, klanten: Set<string>): Promise<Map<string, number>> {
  const leadIds = new Set<string>();
  for (let p = 0; p < 50; p++) {
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .in('customer_id', [...klanten])
      .not('source', 'in', '(mirror,demo)')
      .order('id')
      .range(p * 1000, p * 1000 + 999);
    if (error) throw new LaadFout(`toewijzingen uitgesloten klanten: ${error.message}`);
    for (const a of data ?? []) leadIds.add(a.lead_id as string);
    if (!data || data.length < 1000) break;
  }
  const ids = [...leadIds];
  const klantenPerLead = new Map<string, Set<string>>();
  const kosten = new Map<string, { kosten: number; dag: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const deel = ids.slice(i, i + 200);
    const [toew, lk] = await Promise.all([
      supabase.from('lead_assignments').select('lead_id, customer_id').in('lead_id', deel).not('source', 'in', '(mirror,demo)'),
      supabase.from('lead_kosten').select('lead_id, kosten, dag').in('lead_id', deel),
    ]);
    if (toew.error) throw new LaadFout(`toewijzingen leads: ${toew.error.message}`);
    if (lk.error) throw new LaadFout(`leadkosten: ${lk.error.message}`);
    for (const a of toew.data ?? []) {
      const set = klantenPerLead.get(a.lead_id as string) ?? new Set<string>();
      set.add(a.customer_id as string);
      klantenPerLead.set(a.lead_id as string, set);
    }
    for (const k of lk.data ?? []) kosten.set(k.lead_id as string, { kosten: Number(k.kosten) || 0, dag: String(k.dag).slice(0, 10) });
  }
  const perDag = new Map<string, number>();
  for (const [leadId, set] of klantenPerLead) {
    const k = kosten.get(leadId);
    if (!k || k.dag < START || set.size === 0) continue;
    const aandeel = [...set].filter(c => klanten.has(c)).length / set.size;
    plus(perDag, k.dag, k.kosten * aandeel);
  }
  return perDag;
}
