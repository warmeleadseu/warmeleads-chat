import { matchesAllFilters } from './distribution';
import { leadMatchesAnyProvinceTarget } from './provinceTargetMatch';
import { binnenProvincieMarge, effectieveStraal, margeVan } from './provincieDoelMarge';
import { targetCountryAllowsLead } from './targetCountryMatch';
import { leadPastInBatchVenster } from './verdeelGrenzen';
import { campagneStaatToe, type CampagneRegels } from './campagneExclusiviteit';
import { getLeadLimitPeriodAnchors } from './batchAssignmentCaps';
import { toegestaanTotNu } from './dagDosering';
import { effectiveMaxAssignments } from './assignmentCap';
import { haversineKm } from './portalDistanceOrigin';
import type { GeoTargetRow } from './batchTargets';

/**
 * Waarom een lead uit een gekoppelde campagne niet bij de gekoppelde klant
 * kwam, maar wel bij een andere klant. We lopen dezelfde regels na als de
 * verdeling (distribution.ts), op het moment dat de lead binnenkwam: de eerste
 * regel die de gekoppelde batch tegenhoudt is de reden.
 *
 * Een reconstructie: werkgebied, filters en limieten gelden zoals ze nu zijn
 * ingesteld; de tellingen (vol, dag- en weekmaximum) komen uit de leveringen
 * van toen.
 */

export const REDENEN = {
  geen_batch: 'Campagne hing op dat moment aan geen batch',
  andere_branche: 'Andere branche dan de gekoppelde batch',
  nog_niet_gestart: 'Gekoppelde batch was nog niet gestart',
  batch_niet_actief: 'Gekoppelde batch staat gepauzeerd of wacht op betaling',
  campagne_regel: 'Campagne uitgesloten of exclusief voor een andere batch',
  ongeldig_nummer: 'Ongeldig telefoonnummer',
  geen_gebied: 'Gekoppelde klant heeft geen werkgebied ingesteld',
  buiten_gebied: 'Buiten het werkgebied van de gekoppelde klant',
  filter: 'Valt buiten de leadfilters van de gekoppelde batch',
  uitsluiting: 'Gekoppelde klant sluit een klant uit die de lead al had',
  batch_vol: 'Gekoppelde batch was vol',
  weekmaximum: 'Weekmaximum van de gekoppelde batch bereikt',
  dagmaximum: 'Dagmaximum van de gekoppelde batch bereikt',
  dagdosering: 'Dagdosering: de batch had zijn deel van die dag al',
  max_klanten: 'Lead zat al bij het maximum aantal klanten',
  andere_klant_eerst: 'Andere klant ging voor (kleiner gebied, eerlijk verdelen of voorrang), daarna niet meer bij de gekoppelde klant',
} as const;
export type RedenCode = keyof typeof REDENEN;
/** Volgorde van de verdeling: hoe verder in de lijst, hoe dichter de batch bij de lead kwam. */
const VOLGORDE = Object.keys(REDENEN) as RedenCode[];

export type RedenBatch = {
  id: string;
  customer_id: string;
  branch: string;
  /** Huidige status; gepauzeerd of in afwachting van betaling krijgt geen leads. */
  status?: string | null;
  batch_size: number;
  leads_per_day: number | null;
  leads_per_week: number | null;
  dagdosering: boolean | null;
  starts_at: string | null;
  created_at: string;
  lookback_days: number | null;
  lead_filters: Parameters<typeof matchesAllFilters>[1] | null;
  /** Geldende werkgebieden: die van de batch, anders die van de klant. */
  targets: (GeoTargetRow & { marge_km?: number | null })[];
  /** Leveringsmomenten aan deze batch (ms), oplopend. */
  leveringen: number[];
};

export type RedenLead = {
  id: string;
  branch: string;
  created_at: string;
  lat: number | null;
  lng: number | null;
  provincie: string | null;
  land: string | null;
  postcode: string | null;
  phone_valid: boolean | null;
  custom_fields: Record<string, string> | null;
  meta_campaign_id: string | null;
  /** Klanten die de lead kregen, met moment. */
  klanten: { customer_id: string; assigned_at: string }[];
};

function binnenGebied(lead: RedenLead, targets: RedenBatch['targets']): boolean {
  const heeftCoords = lead.lat != null && lead.lng != null;
  for (const t of targets) {
    if (!targetCountryAllowsLead(t, lead)) continue;
    if ((t.target_type || 'radius') === 'province') {
      const provs = Array.isArray(t.provinces) ? t.provinces : [];
      const marge = margeVan(t);
      if (provs.length > 0 && (leadMatchesAnyProvinceTarget(lead, provs)
        || (marge > 0 && binnenProvincieMarge(lead, provs, marge)))) return true;
    } else if (heeftCoords && t.lat != null && t.lng != null && t.radius_km != null) {
      if (haversineKm(lead.lat as number, lead.lng as number, t.lat, t.lng) <= effectieveStraal({ radius_km: t.radius_km, marge_km: t.marge_km })) return true;
    }
  }
  return false;
}

function telTussen(momenten: number[], van: number, tot: number): number {
  let n = 0;
  for (const m of momenten) if (m >= van && m < tot) n++;
  return n;
}

/** De reden voor één gekoppelde batch. */
export function redenVoorBatch(
  lead: RedenLead,
  batch: RedenBatch,
  ctx: { regels: CampagneRegels; uitsluitingen: Map<string, string[]> },
): RedenCode {
  const t = new Date(lead.created_at);
  const ms = t.getTime();
  if (lead.branch !== batch.branch) return 'andere_branche';
  if ((batch.starts_at && new Date(batch.starts_at).getTime() > ms) || !leadPastInBatchVenster(lead, batch)) return 'nog_niet_gestart';
  /* Alleen de huidige status is bekend: een batch die nu gepauzeerd is of op
     betaling wacht, kreeg ook toen niets (zo VDZ Brigade, nov 2026). */
  if (batch.status === 'paused' || batch.status === 'pending') return 'batch_niet_actief';
  if (!campagneStaatToe(batch.id, lead, ctx.regels, t)) return 'campagne_regel';
  if (lead.phone_valid === false) return 'ongeldig_nummer';
  if (batch.targets.length === 0) return 'geen_gebied';
  if (!binnenGebied(lead, batch.targets)) return 'buiten_gebied';
  const filters = Array.isArray(batch.lead_filters) ? batch.lead_filters : [];
  if (!matchesAllFilters({ ...lead, lat: lead.lat ?? 0, lng: lead.lng ?? 0, custom_fields: lead.custom_fields ?? undefined }, filters)) return 'filter';

  const eigenUit = ctx.uitsluitingen.get(batch.customer_id) ?? [];
  if (lead.klanten.some(k => eigenUit.includes(k.customer_id) || (ctx.uitsluitingen.get(k.customer_id) ?? []).includes(batch.customer_id))) return 'uitsluiting';

  if (batch.batch_size > 0 && telTussen(batch.leveringen, 0, ms) >= batch.batch_size) return 'batch_vol';
  const { dayStart, weekStart } = getLeadLimitPeriodAnchors(t);
  if (batch.leads_per_week && batch.leads_per_week > 0 && telTussen(batch.leveringen, weekStart.getTime(), ms) >= batch.leads_per_week) return 'weekmaximum';
  if (batch.leads_per_day && batch.leads_per_day > 0) {
    const vandaag = telTussen(batch.leveringen, dayStart.getTime(), ms);
    if (vandaag >= batch.leads_per_day) return 'dagmaximum';
    if (batch.dagdosering !== false && vandaag >= toegestaanTotNu(batch.leads_per_day, t)) return 'dagdosering';
  }
  const klanten = new Set(lead.klanten.map(k => k.customer_id));
  if (klanten.size >= effectiveMaxAssignments({ custom_fields: lead.custom_fields ?? undefined })) return 'max_klanten';
  return 'andere_klant_eerst';
}

/**
 * De reden over alle batches waaraan de campagne toen gekoppeld was: die van
 * de batch die het dichtst bij de lead kwam.
 */
export function redenNietGekoppeld(
  lead: RedenLead,
  batches: RedenBatch[],
  ctx: { regels: CampagneRegels; uitsluitingen: Map<string, string[]> },
): RedenCode {
  let beste: RedenCode = 'geen_batch';
  for (const b of batches) {
    const r = redenVoorBatch(lead, b, ctx);
    if (VOLGORDE.indexOf(r) > VOLGORDE.indexOf(beste)) beste = r;
  }
  return beste;
}
