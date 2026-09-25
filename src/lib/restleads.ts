import { haversineKm } from './portalDistanceOrigin';
import { targetCountryAllowsLead } from './targetCountryMatch';
import { leadMatchesAnyProvinceTarget } from './provinceTargetMatch';
import { binnenProvincieMarge, margeVan } from './provincieDoelMarge';

/**
 * Leads die tussen wal en schip vielen, en welke klanten ze alsnog kunnen krijgen.
 *
 * Twee lijsten uit dezelfde berekening:
 *   - "nog kansrijk": de laatste 7 dagen, hier valt nog wat te redden
 *   - "verlopen": 7 tot 90 dagen oud, voorraad om als exclusieve bulk te verkopen
 *
 * Een lead verdwijnt uit beide zodra hij twee keer is uitgedeeld. Deel je er een
 * uit die op 0 stond, dan blijft hij staan met 1x erbij en kan hij nog een keer.
 *
 * Bewust een berekening en geen opgeslagen tabel: een klant die je vanmiddag
 * aanmaakt of een doelgebied dat je zojuist verruimt telt zo meteen mee. Een
 * nachtelijke lijst zou dat pas de volgende ochtend weten, en we hebben deze
 * maand al twee keer gezien wat een opgeslagen teller doet die uit de pas loopt.
 */

/** Boven dit aantal uitdelingen hoort een lead niet meer in de lijst. */
export const MAX_UITDELINGEN = 2;

/**
 * Voorvoegsel op de reden van een wachtrijrij die vanuit dit scherm is gemaakt.
 *
 * Hieraan ziet het overzicht dat een lead hier al is afgehandeld en dus uit de
 * werklijst mag, ook als hij daarna nog maar één klant heeft. Wie hem handmatig
 * plaatst heeft er immers zelf voor gekozen het daarbij te laten.
 */
export const RESTLEAD_REDEN = 'Restleads:';

/**
 * Hoe lang een handmatige uitdeling nog teruggedraaid kan worden.
 *
 * Kort met opzet: daarna heeft de klant de lead in zijn portaal zien staan of
 * via een koppeling binnengekregen, en een lead weghalen die hij misschien al
 * heeft gebeld levert meer verwarring op dan het oplost.
 */
export const TERUGDRAAI_VENSTER_MINUTEN = 5;

export interface RestleadInstellingen {
  /** Standaardmarge buiten het doelgebied, in kilometers. */
  marge_km: number;
  /** Ruimere marge voor klanten die droog staan of leads die niets opbrachten. */
  ruime_marge_km: number;
  /** Vanaf hoeveel dagen zonder levering een klant 'droog' heet. */
  droog_na_dagen: number;
}

export const STANDAARD_INSTELLINGEN: RestleadInstellingen = {
  marge_km: 5,
  ruime_marge_km: 10,
  droog_na_dagen: 7,
};

export interface RestLead {
  id: string;
  naam_klant: string | null;
  plaatsnaam: string | null;
  provincie: string | null;
  postcode: string | null;
  land: string | null;
  branch: string;
  lat: number | null;
  lng: number | null;
  phone_valid: boolean | null;
  wervingsdatum: string | null;
  created_at: string;
  custom_fields?: Record<string, unknown> | null;
}

export interface KandidaatBatch {
  batch_id: string;
  customer_id: string;
  klant: string;
  branch: string;
  prijs_per_lead: number;
  ruimte: number;
  distribution_priority: boolean;
  /** Dagen sinds deze klant voor het laatst een lead kreeg; null = nog nooit. */
  droog_dagen: number | null;
  doelen: Doelgebied[];
  lead_filters: unknown[];
  uitsluitingen: string[];
  /* Wat de verdeling nog meer bekijkt. Alleen nodig om te kunnen zeggen waarom
     een kandidaat (nog) niet automatisch is geplaatst. */
  starts_at?: string | null;
  leads_per_day?: number | null;
  leads_per_week?: number | null;
  /** Toewijzingen aan deze batch sinds het begin van de Nederlandse dag. */
  vandaag?: number;
  /** Toewijzingen aan deze batch sinds maandag. */
  deze_week?: number;
}

export interface Doelgebied {
  target_type?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  provinces?: string[] | null;
  country?: string | null;
  marge_km?: number | null;
}

/**
 * Plaatst de gewone verdeling deze kandidaat zelf, en zo niet: waarom niet?
 *
 * - `automatisch`: voldoet aan alle regels, de volgende verdeelronde pakt hem op
 * - `wacht`: tijdelijk geblokkeerd (cooldown, plafond, batch nog niet gestart);
 *   daarna gaat hij vanzelf
 * - `handwerk`: buiten het gebied; de verdeling doet dat bewust nooit
 */
export interface AutoStatus {
  status: 'automatisch' | 'wacht' | 'handwerk';
  uitleg: string;
}

export interface Kandidaat {
  customer_id: string;
  batch_id: string;
  klant: string;
  prijs_per_lead: number;
  /** 0 = binnen het gebied; anders het aantal km erbuiten. */
  km_buiten: number;
  reden: string;
  distribution_priority: boolean;
  automatisch: AutoStatus;
}

/** Hoe ver ligt de lead buiten het dichtstbijzijnde doelgebied? 0 = erbinnen. */
export function afstandBuitenGebied(lead: RestLead, doelen: Doelgebied[]): number | null {
  let beste: number | null = null;

  for (const d of doelen) {
    if (!targetCountryAllowsLead(d as { country?: string | null }, lead)) continue;

    if ((d.target_type || 'radius') === 'province') {
      const provs = Array.isArray(d.provinces) ? d.provinces : [];
      if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) return 0;
      /* Net over de provinciegrens, binnen de marge van dit doel: de verdeling
         telt dat als binnen het gebied, dus hier ook. */
      const marge = margeVan(d);
      if (provs.length > 0 && marge > 0 && binnenProvincieMarge(lead, provs, marge)) return 0;
      continue;
    }

    if (lead.lat == null || lead.lng == null) continue;
    if (d.lat == null || d.lng == null || d.radius_km == null) continue;

    const buiten = haversineKm(lead.lat, lead.lng, d.lat, d.lng) - d.radius_km;
    if (buiten <= 0) return 0;
    if (beste === null || buiten < beste) beste = buiten;
  }

  return beste;
}

/**
 * De marge die voor deze combinatie geldt.
 *
 * Ruimer als de klant al een tijd droog staat (om hem tevreden te houden) of
 * als de lead nog niets heeft opgebracht (dan staat hij volledig in het rood en
 * is elke plaatsing winst).
 */
export function geldendeMarge(
  instellingen: RestleadInstellingen,
  batch: Pick<KandidaatBatch, 'droog_dagen'>,
  aantalUitdelingen: number,
): { km: number; ruim: boolean; waarom: string | null } {
  const droog =
    batch.droog_dagen === null || batch.droog_dagen >= instellingen.droog_na_dagen;
  const nietsOpgebracht = aantalUitdelingen === 0;

  if (!droog && !nietsOpgebracht) {
    return { km: instellingen.marge_km, ruim: false, waarom: null };
  }

  const redenen: string[] = [];
  if (droog) {
    redenen.push(
      batch.droog_dagen === null
        ? 'klant kreeg nog nooit een lead'
        : `klant staat ${Math.round(batch.droog_dagen)} dagen droog`,
    );
  }
  if (nietsOpgebracht) redenen.push('lead is nog nergens geplaatst');

  return { km: instellingen.ruime_marge_km, ruim: true, waarom: redenen.join(', ') };
}

export function beschrijfKandidaat(kmBuiten: number, ruimeReden: string | null): string {
  if (kmBuiten <= 0) return 'binnen het gebied';
  const afstand = `${kmBuiten < 1 ? '<1' : Math.round(kmBuiten)} km buiten`;
  return ruimeReden ? `${afstand}, ${ruimeReden}` : afstand;
}


const COOLDOWN_UREN = 12;

/** Waarom de gewone verdeling deze kandidaat (nog) niet zelf heeft geplaatst. */
export function automatischeStatus(
  kmBuiten: number,
  batch: Pick<KandidaatBatch, 'starts_at' | 'leads_per_day' | 'leads_per_week' | 'vandaag' | 'deze_week'>,
  laatsteToewijzing: Date | null,
  nu: Date = new Date(),
): AutoStatus {
  const tijd = (d: Date) =>
    d.toLocaleString('nl-NL', {
      timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit',
    });

  if (kmBuiten > 0) {
    return {
      status: 'handwerk',
      uitleg: 'Buiten het gebied: de verdeling plaatst alleen binnen het gebied, dit is handwerk.',
    };
  }
  if (laatsteToewijzing) {
    const vrij = new Date(laatsteToewijzing.getTime() + COOLDOWN_UREN * 3600_000);
    if (vrij > nu) {
      return { status: 'wacht', uitleg: `Wacht op de 12 uur tussen twee klanten; gaat vanzelf vanaf ${tijd(vrij)}.` };
    }
  }
  if (batch.starts_at && new Date(batch.starts_at) > nu) {
    return { status: 'wacht', uitleg: `Batch start pas ${tijd(new Date(batch.starts_at))}; daarna gaat hij vanzelf.` };
  }
  if (batch.leads_per_day && batch.leads_per_day > 0 && (batch.vandaag ?? 0) >= batch.leads_per_day) {
    return { status: 'wacht', uitleg: `Dagplafond van ${batch.leads_per_day} bereikt; morgen weer ruimte.` };
  }
  if (batch.leads_per_week && batch.leads_per_week > 0 && (batch.deze_week ?? 0) >= batch.leads_per_week) {
    return { status: 'wacht', uitleg: `Weekplafond van ${batch.leads_per_week} bereikt; maandag weer ruimte.` };
  }
  return {
    status: 'automatisch',
    uitleg: 'Voldoet aan alle regels; de verdeling plaatst hem binnen een kwartier.',
  };
}

export interface KandidaatOpties {
  /** Uitsluitingen van de klanten die de lead al hebben (de andere kant op). */
  uitsluitingenPerKlant?: Map<string, string[]>;
  /** Plafond voor deze lead; lager dan drie als dat op de lead is ingesteld. */
  maxKlanten?: number;
  laatsteToewijzing?: Date | null;
  nu?: Date;
}

/**
 * Welke klanten deze lead alsnog kunnen krijgen.
 *
 * Controleert hetzelfde als de normale verdeling: branche, het plafond per
 * lead, onderlinge uitsluitingen (beide kanten op), batchfilters, ruimte in de
 * batch en een geldig telefoonnummer. Per klant telt de eerste batch die past,
 * in FIFO-volgorde, net als in de verdeling; geef de batches dus in die
 * volgorde mee.
 *
 * De 12-uurs cooldown en de dag- en weekplafonds houden een kandidaat níet
 * tegen: hier deelt een mens uit. Ze staan wel in `automatisch`, zodat je ziet
 * waarom de verdeling hem nog niet zelf heeft geplaatst.
 */
export function vindKandidaten(
  lead: RestLead,
  batches: KandidaatBatch[],
  alToegewezenAan: Set<string>,
  instellingen: RestleadInstellingen,
  matchtFilters: (lead: RestLead, filters: unknown[]) => boolean,
  opties: KandidaatOpties = {},
): Kandidaat[] {
  /* Een ongeldig telefoonnummer is precies de reden dat een lead blijft
     liggen; hem alsnog uitdelen lost niets op. */
  if (lead.phone_valid === false) return [];
  if (alToegewezenAan.size >= (opties.maxKlanten ?? 3)) return [];

  const uit: Kandidaat[] = [];

  for (const batch of batches) {
    if (batch.branch !== lead.branch) continue;
    if (alToegewezenAan.has(batch.customer_id)) continue;
    if (batch.ruimte <= 0) continue;
    if (uit.some(k => k.customer_id === batch.customer_id)) continue;

    /* Uitsluitingen werken beide kanten op: deze klant mag de lead niet als
       een uitgesloten partij hem al heeft, en een klant die hem al heeft kan
       deze klant evengoed uitsluiten. */
    let uitgesloten = false;
    for (const bestaande of alToegewezenAan) {
      if (batch.uitsluitingen.includes(bestaande)) { uitgesloten = true; break; }
      if (opties.uitsluitingenPerKlant?.get(bestaande)?.includes(batch.customer_id)) { uitgesloten = true; break; }
    }
    if (uitgesloten) continue;

    if (!matchtFilters(lead, batch.lead_filters)) continue;

    const buiten = afstandBuitenGebied(lead, batch.doelen);
    if (buiten === null) continue;

    const marge = geldendeMarge(instellingen, batch, alToegewezenAan.size);
    if (buiten > marge.km) continue;

    uit.push({
      customer_id: batch.customer_id,
      batch_id: batch.batch_id,
      klant: batch.klant,
      prijs_per_lead: batch.prijs_per_lead,
      km_buiten: buiten,
      reden: beschrijfKandidaat(buiten, buiten > instellingen.marge_km ? marge.waarom : null),
      distribution_priority: batch.distribution_priority,
      automatisch: automatischeStatus(buiten, batch, opties.laatsteToewijzing ?? null, opties.nu),
    });
  }

  /* Voorrangsbatches bovenaan, daarna wie het dichtst bij ligt, daarna wie het
     meeste betaalt. */
  return uit.sort((a, b) => {
    if (a.distribution_priority !== b.distribution_priority) return a.distribution_priority ? -1 : 1;
    if (a.km_buiten !== b.km_buiten) return a.km_buiten - b.km_buiten;
    return b.prijs_per_lead - a.prijs_per_lead;
  });
}

/** In welke lijst hoort deze lead? */
export function lijstVoor(lead: { created_at: string }, nu: Date = new Date()): 'kansrijk' | 'verlopen' | null {
  const dagen = (nu.getTime() - new Date(lead.created_at).getTime()) / 86_400_000;
  if (Number.isNaN(dagen) || dagen < 0) return null;
  if (dagen <= 7) return 'kansrijk';
  if (dagen <= 90) return 'verlopen';
  return null;
}
