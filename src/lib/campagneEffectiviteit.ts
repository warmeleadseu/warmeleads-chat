/**
 * Hoe effectief een Meta-campagne is: hoeveel leads Meta telt, hoeveel er bij
 * ons binnenkomen en waar ze heen gaan. Puur rekenwerk; laden staat in
 * campagneEffectiviteitLaden.ts.
 *
 * "Gekoppeld" betekent: de campagne hing aan de batch (Meta-link) op het
 * moment dat de lead binnenkwam, volgens meta_campagne_koppelingen (migratie
 * 195). Koppelingen van vóór 6 nov 2026 zijn geschat (bron 'startstand': vanaf
 * het aanmaken van de batch); cijfers die daarop leunen krijgen geschat = true.
 */

export type Koppeling = { batch_id: string; campaign_id: string; van: string; tot: string | null; bron: 'startstand' | 'wijziging' };
export type CampagneLead = { id: string; campaign_id: string; created_at: string; phone_valid: boolean | null };
export type Toewijzing = { lead_id: string; customer_id: string; batch_id: string | null };
export type Klant = { naam: string; betaalt: boolean };
export type Uitgaven = { campaign_id: string; naam: string | null; spend: number; meta_leads: number };

/** Waar een lead uiteindelijk terechtkwam; de eerste die past telt. */
export const BESTEMMINGEN = ['gekoppeld', 'extra_leads', 'andere_klant', 'intern', 'wacht', 'te_koop', 'verloren'] as const;
export type Bestemming = (typeof BESTEMMINGEN)[number];

/** Campagnes die niet voor WarmeLeads-klanten draaien (zoals bij de leadkosten). */
export const NIET_WARMELEADS = /\b(pakketadvies|energie)\b/i;
/** Tot zo lang staat een onverkochte lead te koop in Extra leads. */
const TE_KOOP_DAGEN = 11;

export type Context = {
  koppelingen: Koppeling[];
  toewijzingen: Map<string, Toewijzing[]>;
  klanten: Map<string, Klant>;
  /** Batches die een aankoop via Extra leads zijn. */
  extraLeadsBatches: Set<string>;
  /** Leads die in de wachtrij staan voor een klant. */
  gepland: Set<string>;
  nu: Date;
};

/** Per campagne de koppelingen, zodat opzoeken per lead snel gaat. */
export function koppelingenPerCampagne(k: Koppeling[]): Map<string, Koppeling[]> {
  const m = new Map<string, Koppeling[]>();
  for (const x of k) m.set(x.campaign_id, [...(m.get(x.campaign_id) ?? []), x]);
  return m;
}

/** De koppelingen van deze campagne die golden op moment t. */
export function gekoppeldOp(koppelingen: Koppeling[], t: string): Koppeling[] {
  const ms = new Date(t).getTime();
  return koppelingen.filter(k => new Date(k.van).getTime() <= ms && (k.tot === null || ms < new Date(k.tot).getTime()));
}

export function bestemmingVan(
  lead: CampagneLead,
  koppelingen: Koppeling[],
  ctx: Pick<Context, 'toewijzingen' | 'klanten' | 'extraLeadsBatches' | 'gepland' | 'nu'>,
): { bestemming: Bestemming; geschat: boolean; gekoppeldeBatches: string[] } {
  const golden = gekoppeldOp(koppelingen, lead.created_at);
  const batches = new Set(golden.map(k => k.batch_id));
  const toew = ctx.toewijzingen.get(lead.id) ?? [];
  const geschat = golden.some(k => k.bron === 'startstand');
  const naarGekoppeld = toew.filter(t => t.batch_id && batches.has(t.batch_id)).map(t => t.batch_id as string);
  const uit = (bestemming: Bestemming) => ({ bestemming, geschat, gekoppeldeBatches: naarGekoppeld });

  if (naarGekoppeld.length > 0) return uit('gekoppeld');
  if (toew.some(t => t.batch_id && ctx.extraLeadsBatches.has(t.batch_id))) return uit('extra_leads');
  if (toew.some(t => ctx.klanten.get(t.customer_id)?.betaalt ?? true)) return uit('andere_klant');
  if (toew.length > 0) return uit('intern');
  if (ctx.gepland.has(lead.id)) return uit('wacht');
  const oud = ctx.nu.getTime() - new Date(lead.created_at).getTime() >= TE_KOOP_DAGEN * 86_400_000;
  return uit(lead.phone_valid === false || oud ? 'verloren' : 'te_koop');
}

/** actief: de batch loopt nog (status actief) en de koppeling is niet beëindigd. */
export type GekoppeldAan = { batch_id: string; klant: string; van: string; tot: string | null; geschat: boolean; actief: boolean };

export type CampagneRij = {
  campaign_id: string;
  naam: string;
  uitgaven: number;
  meta_leads: number;
  binnen: number;
  /** Binnengekomen leads als percentage van wat Meta telt. */
  binnen_pct: number | null;
  per_bestemming: Record<Bestemming, number>;
  /** Leveringen (een gedeelde lead telt per klant). */
  leveringen: number;
  /** Leads naar de gekoppelde klant die ook naar een andere betalende klant gingen. */
  gekoppeld_ook_elders: number;
  gekoppeld_pct: number | null;
  kosten_per_lead: number | null;
  kosten_per_gekoppelde_lead: number | null;
  gekoppeld_aan: GekoppeldAan[];
  /** Klanten met aantallen, meeste eerst. */
  per_klant: { klant: string; leads: number; gekoppeld: boolean }[];
  geschat: boolean;
  /** Aanmeldingen van installateurs (partnerwerving): die komen bij Prospects binnen, niet als lead. */
  partner_aanmeldingen?: number;
};

const rond = (n: number) => Math.round(n * 100) / 100;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export function berekenCampagnes(opts: {
  uitgaven: Uitgaven[];
  leads: CampagneLead[];
  ctx: Context;
  batchKlant: Map<string, string>;
  /** Batches met status actief. */
  actieveBatches?: Set<string>;
  van: string;
  tot: string;
}): CampagneRij[] {
  const { ctx } = opts;
  const perCampagne = koppelingenPerCampagne(ctx.koppelingen);
  const uitg = new Map<string, Uitgaven>();
  for (const u of opts.uitgaven) {
    const o = uitg.get(u.campaign_id);
    uitg.set(u.campaign_id, o
      ? { ...o, spend: o.spend + u.spend, meta_leads: o.meta_leads + u.meta_leads, naam: o.naam ?? u.naam }
      : { ...u });
  }
  const leadsPer = new Map<string, CampagneLead[]>();
  for (const l of opts.leads) leadsPer.set(l.campaign_id, [...(leadsPer.get(l.campaign_id) ?? []), l]);

  const ids = new Set([...uitg.keys(), ...leadsPer.keys()]);
  const vanMs = new Date(`${opts.van}T00:00:00Z`).getTime();
  const totMs = new Date(`${opts.tot}T23:59:59.999Z`).getTime();
  const rijen: CampagneRij[] = [];

  for (const id of ids) {
    const u = uitg.get(id);
    const naam = u?.naam ?? id;
    if (NIET_WARMELEADS.test(naam)) continue;
    const leads = leadsPer.get(id) ?? [];
    const kop = perCampagne.get(id) ?? [];
    const per = Object.fromEntries(BESTEMMINGEN.map(b => [b, 0])) as Record<Bestemming, number>;
    const perKlant = new Map<string, { leads: number; gekoppeld: boolean }>();
    let leveringen = 0;
    let ookElders = 0;
    let geschat = false;

    for (const l of leads) {
      const r = bestemmingVan(l, kop, ctx);
      per[r.bestemming]++;
      if (r.geschat && r.bestemming === 'gekoppeld') geschat = true;
      const toew = ctx.toewijzingen.get(l.id) ?? [];
      leveringen += toew.length;
      const gekoppeldeBatches = new Set(r.gekoppeldeBatches);
      if (r.bestemming === 'gekoppeld' && toew.some(t => !(t.batch_id && gekoppeldeBatches.has(t.batch_id)) && (ctx.klanten.get(t.customer_id)?.betaalt ?? true))) ookElders++;
      for (const k of new Set(toew.map(t => t.customer_id))) {
        const naamK = ctx.klanten.get(k)?.naam ?? 'Onbekend';
        const isGek = toew.some(t => t.customer_id === k && t.batch_id && gekoppeldeBatches.has(t.batch_id));
        const o = perKlant.get(naamK) ?? { leads: 0, gekoppeld: false };
        perKlant.set(naamK, { leads: o.leads + 1, gekoppeld: o.gekoppeld || isGek });
      }
    }

    /* Koppelingen die in de periode golden. */
    const gekoppeldAan = kop
      .filter(k => new Date(k.van).getTime() <= totMs && (k.tot === null || new Date(k.tot).getTime() >= vanMs))
      .map(k => ({
        batch_id: k.batch_id, klant: opts.batchKlant.get(k.batch_id) ?? 'Onbekend', van: k.van, tot: k.tot, geschat: k.bron === 'startstand',
        actief: k.tot === null && (opts.actieveBatches?.has(k.batch_id) ?? false),
      }))
      .sort((a, b) => b.van.localeCompare(a.van));

    const spend = rond(u?.spend ?? 0);
    rijen.push({
      campaign_id: id,
      naam,
      uitgaven: spend,
      meta_leads: u?.meta_leads ?? 0,
      binnen: leads.length,
      binnen_pct: pct(leads.length, u?.meta_leads ?? 0),
      per_bestemming: per,
      leveringen,
      gekoppeld_ook_elders: ookElders,
      gekoppeld_pct: gekoppeldAan.length > 0 ? pct(per.gekoppeld, leads.length) : null,
      kosten_per_lead: leads.length > 0 && spend > 0 ? rond(spend / leads.length) : null,
      kosten_per_gekoppelde_lead: per.gekoppeld > 0 && spend > 0 ? rond(spend / per.gekoppeld) : null,
      gekoppeld_aan: gekoppeldAan,
      per_klant: [...perKlant.entries()].map(([klant, v]) => ({ klant, ...v })).sort((a, b) => b.leads - a.leads || a.klant.localeCompare(b.klant)),
      geschat,
    });
  }
  return rijen.sort((a, b) => b.uitgaven - a.uitgaven || b.binnen - a.binnen);
}

export type Signaal = { soort: 'rood' | 'oranje'; tekst: string };

/** Waar je naar moet kijken. */
export function signalen(r: CampagneRij): Signaal[] {
  const uit: Signaal[] = [];
  /* Partnerwerving: geen consumentenleads en geen batch, dus de gewone
     signalen zeggen hier niets. */
  if ((r.partner_aanmeldingen ?? 0) > 0 && r.binnen === 0) return uit;
  if (r.gekoppeld_aan.length > 0 && r.binnen >= 10 && r.gekoppeld_pct !== null && r.gekoppeld_pct < 50) {
    uit.push({ soort: 'rood', tekst: `Maar ${r.gekoppeld_pct.toLocaleString('nl-NL')}% naar de gekoppelde klant` });
  }
  const onverkocht = r.per_bestemming.te_koop + r.per_bestemming.verloren;
  if (r.binnen >= 10 && onverkocht / r.binnen > 0.25) {
    uit.push({ soort: 'oranje', tekst: `${Math.round((onverkocht / r.binnen) * 100)}% zonder klant` });
  }
  if (r.meta_leads >= 20 && r.binnen_pct !== null && r.binnen_pct < 75) {
    uit.push({ soort: 'oranje', tekst: `Maar ${r.binnen_pct.toLocaleString('nl-NL')}% van de Meta-leads komt binnen` });
  }
  if (r.gekoppeld_aan.length === 0 && r.uitgaven > 0) uit.push({ soort: 'oranje', tekst: 'Niet gekoppeld aan een batch' });
  return uit;
}

/* ---------- Herkomst van de leads in één batch ---------- */

export type HerkomstLead = { lead_id: string; campaign_id: string | null; created_at: string };

export type BatchHerkomst = {
  leveringen: number;
  uit_gekoppeld: number;
  uit_andere: number;
  zonder_campagne: number;
  geschat: boolean;
  andere_campagnes: { campaign_id: string; naam: string; leads: number }[];
  koppelingen: {
    campaign_id: string; naam: string; van: string; tot: string | null; geschat: boolean;
    /** Leads van deze campagne binnen in de koppelperiode, en hoeveel daarvan naar deze batch gingen. */
    binnen: number; naar_batch: number; uitgaven: number;
    /** Andere batches die in dezelfde periode aan deze campagne hingen. */
    gedeeld_met: number;
    /** Deel van de uitgaven voor deze batch: gelijk verdeeld over de gekoppelde batches. */
    uitgaven_aandeel: number;
    kosten_per_lead_naar_batch: number | null;
  }[];
};

export function berekenHerkomst(opts: {
  batchId: string;
  /** De leads die aan deze batch zijn geleverd. */
  geleverd: HerkomstLead[];
  /** Per gekoppelde campagne alle binnengekomen leads in de koppelperiode. */
  campagneLeads: Map<string, HerkomstLead[]>;
  koppelingen: Koppeling[];
  /** Uitgaven per campagne per dag (yyyy-mm-dd). */
  uitgavenPerDag: Map<string, Map<string, number>>;
  namen: Map<string, string>;
  nu: Date;
}): BatchHerkomst {
  const eigen = opts.koppelingen.filter(k => k.batch_id === opts.batchId);
  const perCampagne = koppelingenPerCampagne(eigen);
  let uitGek = 0, uitAnd = 0, zonder = 0, geschat = false;
  const anders = new Map<string, number>();
  for (const l of opts.geleverd) {
    if (!l.campaign_id) { zonder++; continue; }
    const golden = gekoppeldOp(perCampagne.get(l.campaign_id) ?? [], l.created_at);
    if (golden.length > 0) {
      uitGek++;
      if (golden.some(k => k.bron === 'startstand')) geschat = true;
    } else {
      uitAnd++;
      anders.set(l.campaign_id, (anders.get(l.campaign_id) ?? 0) + 1);
    }
  }
  const geleverdIds = new Set(opts.geleverd.map(l => l.lead_id));
  const dag = (d: Date) => d.toISOString().slice(0, 10);

  return {
    leveringen: opts.geleverd.length,
    uit_gekoppeld: uitGek,
    uit_andere: uitAnd,
    zonder_campagne: zonder,
    geschat,
    andere_campagnes: [...anders.entries()]
      .map(([campaign_id, leads]) => ({ campaign_id, naam: opts.namen.get(campaign_id) ?? campaign_id, leads }))
      .sort((a, b) => b.leads - a.leads),
    koppelingen: eigen
      .map(k => {
        const vanMs = new Date(k.van).getTime();
        const totMs = k.tot ? new Date(k.tot).getTime() : opts.nu.getTime();
        const binnen = (opts.campagneLeads.get(k.campaign_id) ?? []).filter(l => {
          const t = new Date(l.created_at).getTime();
          return t >= vanMs && t < totMs;
        });
        const naar = binnen.filter(l => geleverdIds.has(l.lead_id)).length;
        let uitgaven = 0;
        const vanDag = dag(new Date(vanMs));
        const totDag = dag(new Date(totMs));
        for (const [d, s] of opts.uitgavenPerDag.get(k.campaign_id) ?? new Map<string, number>()) {
          if (d >= vanDag && d <= totDag) uitgaven += s;
        }
        uitgaven = rond(uitgaven);
        /* Hangt de campagne ook aan andere batches, dan telde elke batch de
           volledige uitgaven: samen meer dan er werd uitgegeven. */
        const gedeeldMet = new Set(opts.koppelingen
          .filter(o => o.campaign_id === k.campaign_id && o.batch_id !== opts.batchId)
          .filter(o => new Date(o.van).getTime() < totMs && (o.tot ? new Date(o.tot).getTime() : opts.nu.getTime()) > vanMs)
          .map(o => o.batch_id)).size;
        const aandeel = rond(uitgaven / (1 + gedeeldMet));
        return {
          campaign_id: k.campaign_id,
          naam: opts.namen.get(k.campaign_id) ?? k.campaign_id,
          van: k.van,
          tot: k.tot,
          geschat: k.bron === 'startstand',
          binnen: binnen.length,
          naar_batch: naar,
          uitgaven,
          gedeeld_met: gedeeldMet,
          uitgaven_aandeel: aandeel,
          kosten_per_lead_naar_batch: naar > 0 && aandeel > 0 ? rond(aandeel / naar) : null,
        };
      })
      .sort((a, b) => b.van.localeCompare(a.van)),
  };
}
