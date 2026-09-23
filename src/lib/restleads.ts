import { haversineKm } from './portalDistanceOrigin';
import { targetCountryAllowsLead } from './targetCountryMatch';
import { leadMatchesAnyProvinceTarget } from './provinceTargetMatch';

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
}

export interface Doelgebied {
  target_type?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  provinces?: string[] | null;
  country?: string | null;
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
}

/** Hoe ver ligt de lead buiten het dichtstbijzijnde doelgebied? 0 = erbinnen. */
export function afstandBuitenGebied(lead: RestLead, doelen: Doelgebied[]): number | null {
  let beste: number | null = null;

  for (const d of doelen) {
    if (!targetCountryAllowsLead(d as { country?: string | null }, lead)) continue;

    if ((d.target_type || 'radius') === 'province') {
      const provs = Array.isArray(d.provinces) ? d.provinces : [];
      if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) return 0;
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


/**
 * Welke klanten deze lead alsnog kunnen krijgen.
 *
 * Controleert hetzelfde als de normale verdeling: branche, het plafond van
 * drie klanten, onderlinge uitsluitingen, batchfilters, ruimte in de batch en
 * een geldig telefoonnummer.
 *
 * Bewust NIET meegenomen: de 12-uurs cooldown en de dag- en weekplafonds. Die
 * doseren de automatische verdeling; hier deelt een mens handmatig uit en dan
 * is doseren niet de bedoeling.
 */
export function vindKandidaten(
  lead: RestLead,
  batches: KandidaatBatch[],
  alToegewezenAan: Set<string>,
  instellingen: RestleadInstellingen,
  matchtFilters: (lead: RestLead, filters: unknown[]) => boolean,
): Kandidaat[] {
  /* Een ongeldig telefoonnummer is precies de reden dat een lead blijft
     liggen; hem alsnog uitdelen lost niets op. */
  if (lead.phone_valid === false) return [];
  if (alToegewezenAan.size >= 3) return [];

  const uit: Kandidaat[] = [];

  for (const batch of batches) {
    if (batch.branch !== lead.branch) continue;
    if (alToegewezenAan.has(batch.customer_id)) continue;
    if (batch.ruimte <= 0) continue;

    /* Uitsluitingen werken beide kanten op: deze klant mag de lead niet als
       een uitgesloten partij hem al heeft, en andersom. */
    let uitgesloten = false;
    for (const bestaande of alToegewezenAan) {
      if (batch.uitsluitingen.includes(bestaande)) { uitgesloten = true; break; }
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
