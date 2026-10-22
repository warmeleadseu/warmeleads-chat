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
 */

export const maxDuration = 60;

const START = '2026-05-01';
const SOORTEN = ['leads', 'bulk_leads', 'niche_research'];
const PERIODES: PeriodeSoort[] = ['week', 'maand', 'kwartaal', 'jaar'];

const nlDag = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const plus = (m: Map<string, number>, dag: string, bedrag: number) => { if (bedrag) m.set(dag, (m.get(dag) ?? 0) + bedrag); };

class LaadFout extends Error {}

export async function GET(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;

  const soortIn = request.nextUrl.searchParams.get('soort') as PeriodeSoort | null;
  const soort: PeriodeSoort = soortIn && PERIODES.includes(soortIn) ? soortIn : 'maand';
  const vandaag = nlDag(new Date().toISOString());
  const supabase = createServerClient();

  try {
    /* Betaalde batches van externe klanten. */
    type BatchRij = {
      id: string; batch_kind: string; status: string; batch_size: number; total_price: number | string | null;
      is_paid: boolean | null; mollie_payment_id: string | null; leads_delivered_external: number | null;
      extern_bedrag_excl: number | string | null; created_at: string; completed_at: string | null;
      customers: { intern?: boolean } | { intern?: boolean }[] | null;
    };
    const batches: BatchRij[] = [];
    for (let p = 0; p < 20; p++) {
      const { data, error } = await supabase
        .from('customer_batches')
        .select('id, batch_kind, status, batch_size, total_price, is_paid, mollie_payment_id, leads_delivered_external, extern_bedrag_excl, created_at, completed_at, customers(intern)')
        .in('batch_kind', SOORTEN)
        .eq('is_paid', true)
        .order('id')
        .range(p * 1000, p * 1000 + 999);
      if (error) throw new LaadFout(`batches: ${error.message}`);
      batches.push(...((data ?? []) as BatchRij[]).filter(b => !(Array.isArray(b.customers) ? b.customers[0] : b.customers)?.intern));
      if (!data || data.length < 1000) break;
    }
    const ids = batches.map(b => b.id);

    const [facturenPerBatch, leveringenRuw, advertentieRuw, personeelRuw, facturenRuw] = await Promise.all([
      laadFacturenPerBatch(supabase, ids),
      (async () => {
        const uit: { batch_id: string; dag: string; aantal: number }[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const { data, error } = await supabase.rpc('winst_leveringen_per_dag', { p_batch_ids: ids.slice(i, i + 200) });
          if (error) throw new LaadFout(`leveringen: ${error.message}`);
          uit.push(...((data ?? []) as { batch_id: string; dag: string; aantal: number }[]));
        }
        return uit;
      })(),
      supabase.rpc('winst_advertentie_per_dag', { p_van: START, p_tot: vandaag }),
      supabase.from('personeelskosten').select('id, omschrijving, bedrag_per_maand, ingang, einde').order('ingang'),
      (async () => {
        const uit: Record<string, unknown>[] = [];
        for (let p = 0; p < 20; p++) {
          const { data, error } = await supabase
            .from('invoices')
            .select('id, batch_id, appointment_batch_id, credit_note_of, subtotal, status, paid_at, created_at, customers(intern)')
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
    type Factuur = { id: string; batch_id: string | null; appointment_batch_id: string | null; credit_note_of: string | null; subtotal: number | string | null; status: string; paid_at: string | null; created_at: string; customers: { intern?: boolean } | { intern?: boolean }[] | null };
    const facturen = facturenRuw as unknown as Factuur[];
    const perId = new Map(facturen.map(f => [f.id, f]));
    const telt = (f: Factuur) => !f.appointment_batch_id && !(Array.isArray(f.customers) ? f.customers[0] : f.customers)?.intern;
    for (const f of facturen) {
      const bedrag = Number(f.subtotal) || 0;
      if (f.credit_note_of) {
        const origineel = perId.get(f.credit_note_of);
        if (!origineel || !telt(origineel)) continue;
        if (origineel.batch_id && !batchSet.has(origineel.batch_id)) continue;
        const dag = nlDag(f.created_at);
        plus(gefactureerd, dag, -Math.abs(bedrag));
        if (!origineel.batch_id && origineel.status === 'paid') plus(verdiend, dag, -Math.abs(bedrag));
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
      } else {
        plus(gefactureerd, dag, bedrag);
        plus(verdiend, dag, bedrag);
      }
    }

    const advertentie = new Map<string, number>();
    for (const a of (advertentieRuw.data ?? []) as { dag: string; uitgaven: number | string }[]) plus(advertentie, a.dag, Number(a.uitgaven) || 0);

    const personeel = (personeelRuw.data ?? []) as (PersoneelsRegel & { id: string; omschrijving: string })[];
    const perioden = bouwResultaat({
      soort, start: START, vandaag, verdiend, gefactureerd, advertentie, leveringen,
      personeel: personeel.map(p => ({ bedrag_per_maand: Number(p.bedrag_per_maand), ingang: p.ingang, einde: p.einde })),
    });

    return NextResponse.json(
      { soort, start: START, vandaag, perioden, personeel },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('[admin/winst/resultaat]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Het resultaat kon niet volledig worden berekend; probeer het opnieuw' }, { status: 500 });
  }
}
