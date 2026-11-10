import type { SupabaseClient } from '@supabase/supabase-js';
import { amsterdamWallTimeToUtc } from './appointmentSlots';
import { fetchActiveBatchTargetsByBatch, type GeoTargetRow } from './batchTargets';
import { laadCampagneRegels } from './campagneExclusiviteit';
import { REDENEN, redenNietGekoppeld, type RedenBatch, type RedenCode } from './campagneRedenen';
import {
  berekenCampagnes, berekenHerkomst, bestemmingVan, gekoppeldOp, type BatchHerkomst, type CampagneLead, type CampagneRij, type Context,
  type HerkomstLead, type Klant, type Koppeling, type Toewijzing, type Uitgaven,
} from './campagneEffectiviteit';

/** Laden voor campagneEffectiviteit.ts: alleen lezen, in pagina's van 1000. */

const GEEN_ECHTE_TOEWIJZING = new Set(['mirror', 'demo']);
/* Leads zonder bron tellen mee: NOT IN laat NULL anders vallen. */
const ECHTE_LEAD = 'bron.is.null,bron.not.in.(excel_import,demo)';

async function alles<T>(maak: (van: number, tot: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const uit: T[] = [];
  for (let p = 0; p < 100; p++) {
    const { data, error } = await maak(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    uit.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return uit;
}

async function inDelen<T>(ids: string[], maak: (deel: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const uit: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await maak(ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    uit.push(...(data ?? []));
  }
  return uit;
}

/**
 * De koppelingen, met als eind uiterlijk het afronden van de batch: een
 * afgeronde batch houdt zijn Meta-link, maar krijgt daarna geen leads meer.
 */
async function laadKoppelingen(supabase: SupabaseClient, filter?: { batchId?: string }): Promise<Koppeling[]> {
  const rijen = await alles<Koppeling>((a, b) => {
    let q = supabase.from('meta_campagne_koppelingen').select('batch_id, campaign_id, van, tot, bron');
    if (filter?.batchId) q = q.eq('batch_id', filter.batchId);
    return q.order('van').range(a, b);
  });
  const klaar = new Map(
    (await inDelen<{ id: string; completed_at: string | null }>([...new Set(rijen.map(r => r.batch_id))], deel =>
      supabase.from('customer_batches').select('id, completed_at').in('id', deel).not('completed_at', 'is', null)))
      .map(b => [b.id, b.completed_at as string]),
  );
  return rijen.flatMap(r => {
    const eind = klaar.get(r.batch_id);
    if (!eind) return [r];
    if (new Date(eind).getTime() <= new Date(r.van).getTime()) return [];
    return [{ ...r, tot: r.tot && new Date(r.tot).getTime() < new Date(eind).getTime() ? r.tot : eind }];
  });
}

async function laadContext(supabase: SupabaseClient, leadIds: string[], koppelingen: Koppeling[]): Promise<Context> {
  const [toew, klanten, aankopen, wacht] = await Promise.all([
    inDelen<{ lead_id: string; customer_id: string; batch_id: string | null; source: string | null }>(leadIds, deel =>
      supabase.from('lead_assignments').select('lead_id, customer_id, batch_id, source').in('lead_id', deel)),
    alles<{ id: string; name: string | null; intern: boolean | null; afspraakpartner: boolean | null }>((a, b) =>
      supabase.from('customers').select('id, name, intern, afspraakpartner').range(a, b)),
    alles<{ batch_id: string | null }>((a, b) => supabase.from('losse_lead_aankopen').select('batch_id').not('batch_id', 'is', null).range(a, b)),
    inDelen<{ lead_id: string }>(leadIds, deel =>
      supabase.from('geplande_leadleveringen').select('lead_id').eq('status', 'gepland').in('lead_id', deel)),
  ]);
  const toewijzingen = new Map<string, Toewijzing[]>();
  for (const t of toew) {
    if (GEEN_ECHTE_TOEWIJZING.has(t.source ?? '')) continue;
    toewijzingen.set(t.lead_id, [...(toewijzingen.get(t.lead_id) ?? []), { lead_id: t.lead_id, customer_id: t.customer_id, batch_id: t.batch_id }]);
  }
  return {
    koppelingen,
    toewijzingen,
    klanten: new Map<string, Klant>(klanten.map(k => [k.id, { naam: k.name || 'Onbekend', betaalt: !k.intern && !k.afspraakpartner }])),
    extraLeadsBatches: new Set(aankopen.map(a => a.batch_id as string)),
    gepland: new Set(wacht.map(w => w.lead_id)),
    nu: new Date(),
  };
}

async function laadBatchKlant(supabase: SupabaseClient, batchIds: string[]): Promise<{ klant: Map<string, string>; actief: Set<string> }> {
  const rijen = await inDelen<{ id: string; status: string | null; customers: { name: string | null } | { name: string | null }[] | null }>(batchIds, deel =>
    supabase.from('customer_batches').select('id, status, customers(name)').in('id', deel));
  return {
    klant: new Map(rijen.map(r => {
      const c = Array.isArray(r.customers) ? r.customers[0] : r.customers;
      return [r.id, c?.name || 'Onbekend'];
    })),
    actief: new Set(rijen.filter(r => r.status === 'active').map(r => r.id)),
  };
}

/** Alle campagnes met uitgaven of leads in de periode (datums yyyy-mm-dd, tot en met). */
export async function laadCampagneOverzicht(supabase: SupabaseClient, van: string, tot: string): Promise<CampagneRij[]> {
  /* Dagen in Nederlandse tijd, zoals de uitgaven van Meta (meta_ad_spend.date). */
  const totExcl = nlDagGrens(tot, 1);
  const [spend, leads, koppelingen] = await Promise.all([
    alles<{ campaign_id: string; campaign_name: string | null; spend: number | string | null; leads_count: number | null }>((a, b) =>
      supabase.from('meta_ad_spend').select('campaign_id, campaign_name, spend, leads_count').gte('date', van).lte('date', tot).range(a, b)),
    alles<{ id: string; meta_campaign_id: string; created_at: string; phone_valid: boolean | null }>((a, b) =>
      supabase.from('leads').select('id, meta_campaign_id, created_at, phone_valid')
        .not('meta_campaign_id', 'is', null)
        .or(ECHTE_LEAD)
        .gte('created_at', nlDagGrens(van, 0).toISOString()).lt('created_at', totExcl.toISOString())
        .order('created_at').range(a, b)),
    laadKoppelingen(supabase),
  ]);
  const ctx = await laadContext(supabase, leads.map(l => l.id), koppelingen);
  const [batches, partners] = await Promise.all([
    laadBatchKlant(supabase, [...new Set(koppelingen.map(k => k.batch_id))]),
    alles<{ source_metadata: { meta_campaign_id?: string | null } | null }>((a, b) =>
      supabase.from('prospects').select('source_metadata').eq('source', 'meta_partner')
        .gte('created_at', nlDagGrens(van, 0).toISOString()).lt('created_at', totExcl.toISOString())
        .order('id').range(a, b)),
  ]);
  const partnerPerCampagne = new Map<string, number>();
  for (const p of partners) {
    const c = p.source_metadata?.meta_campaign_id;
    if (c) partnerPerCampagne.set(c, (partnerPerCampagne.get(c) ?? 0) + 1);
  }
  const rijen = berekenCampagnes({
    uitgaven: spend.map<Uitgaven>(s => ({ campaign_id: s.campaign_id, naam: s.campaign_name, spend: Number(s.spend) || 0, meta_leads: Number(s.leads_count) || 0 })),
    leads: leads.map<CampagneLead>(l => ({ id: l.id, campaign_id: l.meta_campaign_id, created_at: l.created_at, phone_valid: l.phone_valid })),
    ctx,
    batchKlant: batches.klant,
    actieveBatches: batches.actief,
    van,
    tot,
  });
  return rijen.map(r => (partnerPerCampagne.has(r.campaign_id) ? { ...r, partner_aanmeldingen: partnerPerCampagne.get(r.campaign_id) } : r));
}

/** Waar de leads van één batch vandaan kwamen, met de koppelingen in de tijd. */
export async function laadBatchHerkomst(supabase: SupabaseClient, batchId: string): Promise<BatchHerkomst> {
  const [toew, koppelingen] = await Promise.all([
    alles<{ lead_id: string; source: string | null; leads: { meta_campaign_id: string | null; created_at: string } | { meta_campaign_id: string | null; created_at: string }[] | null }>((a, b) =>
      supabase.from('lead_assignments').select('lead_id, source, leads(meta_campaign_id, created_at)').eq('batch_id', batchId).range(a, b)),
    laadKoppelingen(supabase, { batchId }),
  ]);
  const geleverd: HerkomstLead[] = toew
    .filter(t => !GEEN_ECHTE_TOEWIJZING.has(t.source ?? ''))
    .map(t => {
      const l = Array.isArray(t.leads) ? t.leads[0] : t.leads;
      return { lead_id: t.lead_id, campaign_id: l?.meta_campaign_id ?? null, created_at: l?.created_at ?? '' };
    });

  const campagnes = [...new Set([...koppelingen.map(k => k.campaign_id), ...geleverd.map(l => l.campaign_id).filter((c): c is string => !!c)])];
  const vroegst = koppelingen.reduce((m, k) => (k.van < m ? k.van : m), new Date().toISOString());
  const gekoppeld = [...new Set(koppelingen.map(k => k.campaign_id))];

  const [campagneLeads, spend, namen] = await Promise.all([
    gekoppeld.length === 0 ? Promise.resolve([]) : alles<{ id: string; meta_campaign_id: string; created_at: string }>((a, b) =>
      supabase.from('leads').select('id, meta_campaign_id, created_at').in('meta_campaign_id', gekoppeld)
        .or(ECHTE_LEAD).gte('created_at', vroegst).order('created_at').range(a, b)),
    gekoppeld.length === 0 ? Promise.resolve([]) : alles<{ campaign_id: string; date: string; spend: number | string | null }>((a, b) =>
      supabase.from('meta_ad_spend').select('campaign_id, date, spend').in('campaign_id', gekoppeld).gte('date', vroegst.slice(0, 10)).range(a, b)),
    campagnes.length === 0 ? Promise.resolve([]) : inDelen<{ campaign_id: string; campaign_name: string | null }>(campagnes, deel =>
      supabase.from('meta_ad_spend').select('campaign_id, campaign_name').in('campaign_id', deel).order('date', { ascending: false }).limit(5000)),
  ]);

  const perCampagne = new Map<string, HerkomstLead[]>();
  for (const l of campagneLeads) perCampagne.set(l.meta_campaign_id, [...(perCampagne.get(l.meta_campaign_id) ?? []), { lead_id: l.id, campaign_id: l.meta_campaign_id, created_at: l.created_at }]);
  const uitgavenPerDag = new Map<string, Map<string, number>>();
  for (const s of spend) {
    const m = uitgavenPerDag.get(s.campaign_id) ?? new Map<string, number>();
    m.set(s.date, (m.get(s.date) ?? 0) + (Number(s.spend) || 0));
    uitgavenPerDag.set(s.campaign_id, m);
  }
  const naamMap = new Map<string, string>();
  for (const n of namen) if (n.campaign_name && !naamMap.has(n.campaign_id)) naamMap.set(n.campaign_id, n.campaign_name);

  return berekenHerkomst({ batchId, geleverd, campagneLeads: perCampagne, koppelingen, uitgavenPerDag, namen: naamMap, nu: new Date() });
}

export type RedenGroep = {
  code: RedenCode;
  label: string;
  aantal: number;
  voorbeelden: { plaats: string | null; provincie: string | null; binnen: string; naar: string[] }[];
};

/**
 * Waarom de leads van deze campagne die bij "andere klanten" terechtkwamen
 * niet bij de gekoppelde klant kwamen (zie campagneRedenen.ts).
 */
export async function laadRedenen(supabase: SupabaseClient, campaignId: string, van: string, tot: string): Promise<{ totaal: number; groepen: RedenGroep[] }> {
  /* Dagen in Nederlandse tijd, zoals de uitgaven van Meta (meta_ad_spend.date). */
  const totExcl = nlDagGrens(tot, 1);
  const [leads, alleKoppelingen, regels] = await Promise.all([
    alles<{ id: string; branch: string; created_at: string; lat: number | null; lng: number | null; provincie: string | null; land: string | null; postcode: string | null; plaatsnaam: string | null; phone_valid: boolean | null; custom_fields: Record<string, string> | null; meta_campaign_id: string }>((a, b) =>
      supabase.from('leads').select('id, branch, created_at, lat, lng, provincie, land, postcode, plaatsnaam, phone_valid, custom_fields, meta_campaign_id')
        .eq('meta_campaign_id', campaignId).or(ECHTE_LEAD)
        .gte('created_at', nlDagGrens(van, 0).toISOString()).lt('created_at', totExcl.toISOString())
        .order('created_at').range(a, b)),
    laadKoppelingen(supabase),
    laadCampagneRegels(supabase),
  ]);
  const koppelingen = alleKoppelingen.filter(k => k.campaign_id === campaignId);
  const ctx = await laadContext(supabase, leads.map(l => l.id), alleKoppelingen);

  const andere = leads.filter(l => bestemmingVan({ id: l.id, campaign_id: campaignId, created_at: l.created_at, phone_valid: l.phone_valid }, koppelingen, ctx).bestemming === 'andere_klant');
  if (andere.length === 0) return { totaal: 0, groepen: [] };

  const batchIds = [...new Set(koppelingen.map(k => k.batch_id))];
  const [batches, batchTargets, toewMomenten, leadToew] = await Promise.all([
    inDelen<{ id: string; customer_id: string; branch: string; status: string | null; batch_size: number | null; leads_per_day: number | null; leads_per_week: number | null; dagdosering: boolean | null; starts_at: string | null; created_at: string; lookback_days: number | null; lead_filters: unknown }>(batchIds, deel =>
      supabase.from('customer_batches').select('id, customer_id, branch, status, batch_size, leads_per_day, leads_per_week, dagdosering, starts_at, created_at, lookback_days, lead_filters').in('id', deel)),
    fetchActiveBatchTargetsByBatch(supabase, batchIds),
    alles<{ batch_id: string; assigned_at: string; source: string | null }>((a, b) =>
      supabase.from('lead_assignments').select('batch_id, assigned_at, source').in('batch_id', batchIds).range(a, b)),
    inDelen<{ lead_id: string; customer_id: string; assigned_at: string; source: string | null }>(andere.map(l => l.id), deel =>
      supabase.from('lead_assignments').select('lead_id, customer_id, assigned_at, source').in('lead_id', deel)),
  ]);
  const klantIds = [...new Set([...batches.map(b => b.customer_id), ...leadToew.map(t => t.customer_id)])];
  const [klantTargets, uitsl] = await Promise.all([
    inDelen<GeoTargetRow & { customer_id: string; marge_km?: number | null }>(klantIds, deel =>
      supabase.from('customer_targets').select('*').in('customer_id', deel).eq('is_active', true)),
    inDelen<{ id: string; exclude_customers: string[] | null }>(klantIds, deel =>
      supabase.from('customers').select('id, exclude_customers').in('id', deel)),
  ]);

  const leveringen = new Map<string, number[]>();
  for (const t of toewMomenten) {
    if (GEEN_ECHTE_TOEWIJZING.has(t.source ?? '')) continue;
    leveringen.set(t.batch_id, [...(leveringen.get(t.batch_id) ?? []), new Date(t.assigned_at).getTime()]);
  }
  const doelenPerKlant = new Map<string, GeoTargetRow[]>();
  for (const t of klantTargets) doelenPerKlant.set(t.customer_id, [...(doelenPerKlant.get(t.customer_id) ?? []), t]);
  const redenBatches = new Map<string, RedenBatch>(batches.map(b => {
    const eigen = batchTargets.get(b.id);
    return [b.id, {
      id: b.id, customer_id: b.customer_id, branch: b.branch, status: b.status, batch_size: Number(b.batch_size) || 0,
      leads_per_day: b.leads_per_day, leads_per_week: b.leads_per_week, dagdosering: b.dagdosering,
      starts_at: b.starts_at, created_at: b.created_at, lookback_days: b.lookback_days,
      lead_filters: Array.isArray(b.lead_filters) ? (b.lead_filters as RedenBatch['lead_filters']) : null,
      targets: eigen && eigen.length > 0 ? eigen : doelenPerKlant.get(b.customer_id) ?? [],
      leveringen: (leveringen.get(b.id) ?? []).sort((x, y) => x - y),
    }];
  }));
  const uitsluitingen = new Map(uitsl.map(u => [u.id, Array.isArray(u.exclude_customers) ? u.exclude_customers : []]));
  const klantenPerLead = new Map<string, { customer_id: string; assigned_at: string }[]>();
  for (const t of leadToew) {
    if (GEEN_ECHTE_TOEWIJZING.has(t.source ?? '')) continue;
    klantenPerLead.set(t.lead_id, [...(klantenPerLead.get(t.lead_id) ?? []), { customer_id: t.customer_id, assigned_at: t.assigned_at }]);
  }

  const groepen = new Map<RedenCode, RedenGroep>();
  for (const l of andere) {
    const golden = gekoppeldOp(koppelingen, l.created_at).map(k => redenBatches.get(k.batch_id)).filter((b): b is RedenBatch => !!b);
    const klanten = klantenPerLead.get(l.id) ?? [];
    const code = redenNietGekoppeld({ ...l, klanten }, golden, { regels, uitsluitingen });
    const g = groepen.get(code) ?? { code, label: REDENEN[code], aantal: 0, voorbeelden: [] };
    g.aantal++;
    if (g.voorbeelden.length < 8) {
      g.voorbeelden.push({
        plaats: l.plaatsnaam, provincie: l.provincie, binnen: l.created_at,
        naar: [...new Set(klanten.map(k => ctx.klanten.get(k.customer_id)?.naam ?? 'Onbekend'))],
      });
    }
    groepen.set(code, g);
  }
  return { totaal: andere.length, groepen: [...groepen.values()].sort((a, b) => b.aantal - a.aantal) };
}

/** Middernacht Nederlandse tijd van dag `ymd` plus `plusDagen`. */
function nlDagGrens(ymd: string, plusDagen: number): Date {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + plusDagen);
  return amsterdamWallTimeToUtc(d.toISOString().slice(0, 10), '00:00');
}
