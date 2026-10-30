import type { SupabaseClient } from '@supabase/supabase-js';
import {
  actieLabels, beoordeelBatch, kiesZichtbareActie, lotenVoorBulk, rijNaarActie,
  type Actie, type ActieRij, type Beoordeling, type FactuurRij,
} from '@/lib/lotenActie';

/**
 * Laden voor de acties met loten: de acties zelf, welke batches tellen mee,
 * hoeveel bulkleads kreeg elke klant, en de stand per deelnemer. Altijd per
 * actie. Gedeeld door de cron, de beheerpagina, het live-dashboard, het
 * portaal en de trekking, zodat ze allemaal hetzelfde tellen.
 */

const PAGINA = 1000;
const STUK = 200;
/** Zo ver vóór de start kijken naar batches die in de actie betaald kunnen zijn. */
const AANGEMAAKT_TERUG_DAGEN = 120;

export class ActieLaadFout extends Error {}

export type Klant = {
  id: string; name: string; email: string | null; contact_person: string | null;
  intern: boolean | null; demo_mode: boolean | null;
};

export type BatchStand = {
  id: string; customer_id: string; branch: string; batch_size: number;
  klant: Klant | null; facturen: FactuurRij[]; beoordeling: Beoordeling;
};

export type LotRij = {
  id: string; customer_id: string; batch_id: string; batch_size: number; loten: number; betaald_op: string;
  mail_verstuurd_op: string | null; mail_pogingen: number; mail_fout: string | null;
  vervallen_op: string | null; vervallen_reden: string | null; created_at: string;
};

export type DeelnemerStand = {
  customer_id: string; klant: string; email: string | null;
  batchLoten: number; batches: number; bulkLeads: number; bulkLoten: number; totaal: number;
};

const eenKlant = (k: Klant | Klant[] | null): Klant | null => (Array.isArray(k) ? k[0] ?? null : k);

function stukken<T>(lijst: T[], n = STUK): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += n) uit.push(lijst.slice(i, i + n));
  return uit;
}

/** Alle acties, de nieuwste eerst. */
export async function laadActies(supabase: SupabaseClient): Promise<Actie[]> {
  const { data, error } = await supabase
    .from('acties')
    .select('code, naam, start_op, eind_op, prijs_leads, leads_per_lot, bulk_per_lot')
    .order('start_op', { ascending: false });
  if (error) throw new ActieLaadFout(`acties: ${error.message}`);
  return ((data ?? []) as ActieRij[]).map(rijNaarActie);
}

export type TrekkingRij = {
  actie: string; winnaar_customer_id: string; lotnummer: number; totaal_loten: number;
  deelnemers: { customer_id: string; klant: string; loten: number }[];
  getrokken_door_naam: string | null; getrokken_op: string;
};

/** De trekkingen per actie-code. */
export async function laadTrekkingen(supabase: SupabaseClient): Promise<Map<string, TrekkingRij>> {
  const { data, error } = await supabase
    .from('actie_trekkingen')
    .select('actie, winnaar_customer_id, lotnummer, totaal_loten, deelnemers, getrokken_door_naam, getrokken_op');
  if (error) throw new ActieLaadFout(`trekkingen: ${error.message}`);
  return new Map(((data ?? []) as TrekkingRij[]).map(t => [t.actie, t]));
}

/** De actie die nu op het dashboard en in het portaal hoort, met haar trekking. */
export async function laadZichtbareActie(
  supabase: SupabaseClient,
  nu: Date = new Date(),
): Promise<{ actie: Actie; trekking: TrekkingRij | null } | null> {
  const [acties, trekkingen] = await Promise.all([laadActies(supabase), laadTrekkingen(supabase)]);
  const getrokkenOp = new Map([...trekkingen.values()].map(t => [t.actie, t.getrokken_op]));
  const actie = kiesZichtbareActie(acties, getrokkenOp, nu);
  return actie ? { actie, trekking: trekkingen.get(actie.code) ?? null } : null;
}

/** Alle betaalde leadbatches die in de actie betaald kunnen zijn, met hun beoordeling. */
export async function laadBatchStanden(supabase: SupabaseClient, actie: Actie): Promise<BatchStand[]> {
  const vanaf = new Date(Date.parse(actie.start) - AANGEMAAKT_TERUG_DAGEN * 86_400_000).toISOString();
  type Rij = {
    id: string; customer_id: string; branch: string; batch_kind: string | null; batch_size: number | null; is_paid: boolean | null;
    created_at: string; total_price: number | string | null; price_per_lead: number | string | null; customers: Klant | Klant[] | null;
  };
  const rijen: Rij[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_kind, batch_size, is_paid, created_at, total_price, price_per_lead, customers(id, name, email, contact_person, intern, demo_mode)')
      .eq('batch_kind', 'leads')
      .eq('is_paid', true)
      .gte('created_at', vanaf)
      .lt('created_at', actie.eind)
      .order('created_at')
      .range(p * PAGINA, (p + 1) * PAGINA - 1);
    if (error) throw new ActieLaadFout(`batches: ${error.message}`);
    rijen.push(...((data ?? []) as Rij[]));
    if (!data || data.length < PAGINA) break;
  }

  const facturen = new Map<string, FactuurRij[]>();
  for (const ids of stukken(rijen.map(r => r.id))) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, batch_id, status, paid_at, credit_note_of')
      .in('batch_id', ids);
    if (error) throw new ActieLaadFout(`facturen: ${error.message}`);
    for (const f of (data ?? []) as (FactuurRij & { batch_id: string })[]) {
      const lijst = facturen.get(f.batch_id) ?? [];
      lijst.push({ id: f.id, status: f.status, paid_at: f.paid_at, credit_note_of: f.credit_note_of });
      facturen.set(f.batch_id, lijst);
    }
  }
  /* Een creditnota hangt soms niet aan de batch maar alleen aan de factuur. */
  const gewoneIds = [...facturen.values()].flat().filter(f => !f.credit_note_of).map(f => f.id);
  for (const ids of stukken(gewoneIds)) {
    const { data, error } = await supabase.from('invoices').select('id, status, paid_at, credit_note_of').in('credit_note_of', ids);
    if (error) throw new ActieLaadFout(`creditnota's: ${error.message}`);
    for (const c of (data ?? []) as FactuurRij[]) {
      for (const [batchId, lijst] of facturen) {
        if (lijst.some(f => f.id === c.credit_note_of) && !lijst.some(f => f.id === c.id)) {
          facturen.set(batchId, [...lijst, c]);
        }
      }
    }
  }

  return rijen.map(r => {
    const klant = eenKlant(r.customers);
    const f = facturen.get(r.id) ?? [];
    return {
      id: r.id, customer_id: r.customer_id, branch: r.branch, batch_size: Number(r.batch_size) || 0, klant, facturen: f,
      beoordeling: beoordeelBatch(actie, { ...r, klant }, f),
    };
  });
}

async function alleKlantIds(
  bouw: (van: number, tot: number) => PromiseLike<{ data: { customer_id: string | null }[] | null; error: { message: string } | null }>,
): Promise<string[]> {
  const uit: string[] = [];
  for (let p = 0; p < 200; p++) {
    const { data, error } = await bouw(p * PAGINA, (p + 1) * PAGINA - 1);
    if (error) throw new ActieLaadFout(`bulkleveringen: ${error.message}`);
    for (const r of data ?? []) if (r.customer_id) uit.push(r.customer_id);
    if (!data || data.length < PAGINA) break;
  }
  return uit;
}

/**
 * Bulkleads per klant die in de actie geleverd zijn: losse bulkverkoop
 * (bulk_assign zonder batch) en leveringen in een bulkbatch. Een
 * bulk_assign in een gewone leadbatch hoort bij die batch en telt hier niet.
 */
export async function laadBulkPerKlant(supabase: SupabaseClient, actie: Actie, nu: Date = new Date()): Promise<Map<string, number>> {
  const tot = new Date(Math.min(nu.getTime(), Date.parse(actie.eind))).toISOString();
  const telling = new Map<string, number>();
  if (Date.parse(tot) <= Date.parse(actie.start)) return telling;

  const los = await alleKlantIds((van, totIdx) =>
    supabase
      .from('lead_assignments')
      .select('customer_id')
      .eq('source', 'bulk_assign')
      .is('batch_id', null)
      .gte('assigned_at', actie.start)
      .lt('assigned_at', tot)
      .order('id')
      .range(van, totIdx),
  );

  const { data: bulkBatches, error } = await supabase.from('customer_batches').select('id').eq('batch_kind', 'bulk_leads');
  if (error) throw new ActieLaadFout(`bulkbatches: ${error.message}`);
  const inBatch: string[] = [];
  for (const ids of stukken((bulkBatches ?? []).map(b => b.id as string))) {
    inBatch.push(...await alleKlantIds((van, totIdx) =>
      supabase
        .from('lead_assignments')
        .select('customer_id')
        .in('batch_id', ids)
        .gte('assigned_at', actie.start)
        .lt('assigned_at', tot)
        .order('id')
        .range(van, totIdx),
    ));
  }

  for (const id of [...los, ...inBatch]) telling.set(id, (telling.get(id) ?? 0) + 1);
  if (telling.size === 0) return telling;

  /* Interne en demo-klanten doen niet mee. */
  const { data: klanten, error: kErr } = await supabase
    .from('customers')
    .select('id, intern, demo_mode')
    .in('id', [...telling.keys()]);
  if (kErr) throw new ActieLaadFout(`klanten: ${kErr.message}`);
  for (const k of klanten ?? []) if (k.intern || k.demo_mode) telling.delete(k.id as string);
  return telling;
}

export async function laadLotRijen(supabase: SupabaseClient, actie: Actie): Promise<LotRij[]> {
  const { data, error } = await supabase
    .from('actie_loten')
    .select('id, customer_id, batch_id, batch_size, loten, betaald_op, mail_verstuurd_op, mail_pogingen, mail_fout, vervallen_op, vervallen_reden, created_at')
    .eq('actie', actie.code)
    .order('betaald_op');
  if (error) throw new ActieLaadFout(`loten: ${error.message}`);
  return (data ?? []) as LotRij[];
}

/** De stand per deelnemer van één actie: geldige batchloten plus bulkloten. */
export async function laadDeelnemers(
  supabase: SupabaseClient,
  actie: Actie,
  opties: { lotRijen?: LotRij[]; bulk?: Map<string, number>; nu?: Date } = {},
): Promise<DeelnemerStand[]> {
  const lotRijen = opties.lotRijen ?? await laadLotRijen(supabase, actie);
  const bulk = opties.bulk ?? await laadBulkPerKlant(supabase, actie, opties.nu);

  const stand = new Map<string, { batchLoten: number; batches: number; bulkLeads: number }>();
  for (const r of lotRijen) {
    if (r.vervallen_op) continue;
    const s = stand.get(r.customer_id) ?? { batchLoten: 0, batches: 0, bulkLeads: 0 };
    s.batchLoten += r.loten;
    s.batches += 1;
    stand.set(r.customer_id, s);
  }
  for (const [id, n] of bulk) {
    const s = stand.get(id) ?? { batchLoten: 0, batches: 0, bulkLeads: 0 };
    s.bulkLeads = n;
    stand.set(id, s);
  }
  if (stand.size === 0) return [];

  const { data: klanten, error } = await supabase.from('customers').select('id, name, email').in('id', [...stand.keys()]);
  if (error) throw new ActieLaadFout(`klantnamen: ${error.message}`);
  const naam = new Map((klanten ?? []).map(k => [k.id as string, { naam: k.name as string, email: (k.email as string | null) ?? null }]));

  return [...stand.entries()]
    .map(([id, s]) => {
      const bulkLoten = lotenVoorBulk(actie, s.bulkLeads);
      return {
        customer_id: id, klant: naam.get(id)?.naam ?? 'Onbekende klant', email: naam.get(id)?.email ?? null,
        batchLoten: s.batchLoten, batches: s.batches, bulkLeads: s.bulkLeads, bulkLoten, totaal: s.batchLoten + bulkLoten,
      };
    })
    .filter(d => d.totaal > 0 || d.bulkLeads > 0)
    .sort((a, b) => b.totaal - a.totaal || a.klant.localeCompare(b.klant, 'nl'));
}

export type ActieSamenvatting = {
  naam: string; eind: string; eindLabel: string; prijsLeads: number; leadsPerLot: number;
  totaalLoten: number; deelnemers: number;
  top: { klant: string; loten: number }[];
  winnaar: string | null;
};

/** Voor het live-dashboard: de stand van de zichtbare actie, of null als er geen in beeld hoort. */
export async function laadActieSamenvatting(supabase: SupabaseClient, nu: Date = new Date()): Promise<ActieSamenvatting | null> {
  const zichtbaar = await laadZichtbareActie(supabase, nu);
  if (!zichtbaar) return null;
  const { actie, trekking } = zichtbaar;
  const deelnemers = (await laadDeelnemers(supabase, actie, { nu })).filter(d => d.totaal > 0);
  let winnaar: string | null = null;
  if (trekking) {
    const { data } = await supabase.from('customers').select('name').eq('id', trekking.winnaar_customer_id).maybeSingle();
    winnaar = (data?.name as string | undefined) ?? 'Onbekende klant';
  }
  return {
    naam: actie.naam, eind: actie.eind, eindLabel: actieLabels(actie).eindLabel, prijsLeads: actie.prijsLeads, leadsPerLot: actie.leadsPerLot,
    totaalLoten: deelnemers.reduce((s, d) => s + d.totaal, 0),
    deelnemers: deelnemers.length,
    top: deelnemers.slice(0, 6).map(d => ({ klant: d.klant, loten: d.totaal })),
    winnaar,
  };
}
