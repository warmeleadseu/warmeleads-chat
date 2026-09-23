import { leadMatchesAnyProvinceTarget } from './provinceTargetMatch';
import { haversineKm } from './portalDistanceOrigin';

/**
 * Het werkgebied van een agent: provincies én cirkels rond een plaats.
 *
 * WAAROM ÉÉN GEDEELDE FUNCTIE
 * ---------------------------
 * De beoordeling stond op twee plekken en die deden niet hetzelfde:
 * `distribution.ts` controleerde alleen `type === 'provinces'` en
 * `appointmentAssignment.ts` alleen `type === 'postcodes'`. De teampagina
 * schrijft uitsluitend provincies weg, dus bij afspraken werd het werkgebied
 * van een agent volledig genegeerd: iemand die op alleen Limburg stond kreeg
 * gewoon een afspraak in Groningen toegewezen.
 *
 * Niemand was daar tegenaan gelopen omdat geen van de twintig agents een
 * regiobeperking had. Beide kanten gaan nu hierlangs.
 */

export interface AgentGebied {
  /** Zoals de plaatszoeker hem bevestigde, niet zoals hij is ingetypt. */
  label: string;
  lat: number;
  lng: number;
  radius_km: number;
  /* Er bestaan plaatsen met dezelfde naam in beide landen: "Hasselt" komt uit
     op Overijssel, niet op Belgisch Limburg. Het land erbij maakt zichtbaar
     welke er is gevonden. */
  land?: string | null;
}

export interface AgentRegels {
  mode?: string;
  branches?: string[];
  regions?: { type?: string; values?: string[] } | null;
  gebieden?: AgentGebied[] | null;
}

/** Waar een lead of afspraak zich bevindt, voor zover bekend. */
export interface Locatie {
  provincie?: string | null;
  land?: string | null;
  postcode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export function isGeldigGebied(g: unknown): g is AgentGebied {
  if (!g || typeof g !== 'object') return false;
  const x = g as Record<string, unknown>;
  return (
    typeof x.label === 'string' && x.label.trim().length > 0 &&
    typeof x.lat === 'number' && Number.isFinite(x.lat) &&
    typeof x.lng === 'number' && Number.isFinite(x.lng) &&
    typeof x.radius_km === 'number' && Number.isFinite(x.radius_km) && x.radius_km > 0
  );
}

export function leesGebieden(regels: AgentRegels | null | undefined): AgentGebied[] {
  const ruw = regels?.gebieden;
  if (!Array.isArray(ruw)) return [];
  return ruw.filter(isGeldigGebied);
}

function heeftProvincies(regels: AgentRegels): boolean {
  const r = regels.regions;
  return Boolean(r && Array.isArray(r.values) && r.values.length > 0);
}

/** Of deze locatie binnen één van de cirkels van de agent valt. */
export function valtBinnenGebieden(gebieden: AgentGebied[], locatie: Locatie): boolean {
  if (gebieden.length === 0) return false;
  if (locatie.lat == null || locatie.lng == null) return false;
  return gebieden.some(g => haversineKm(locatie.lat!, locatie.lng!, g.lat, g.lng) <= g.radius_km);
}

/** Of deze locatie in één van de provincies van de agent ligt. */
export function valtBinnenProvincies(regels: AgentRegels, locatie: Locatie): boolean {
  const waarden = regels.regions?.values;
  if (!Array.isArray(waarden) || waarden.length === 0) return false;

  const type = regels.regions?.type ?? 'provinces';
  if (type === 'postcodes') {
    const pc4 = (locatie.postcode || '').replace(/\s/g, '').slice(0, 4);
    if (!pc4) return false;
    return waarden.some(v => pc4.startsWith(String(v).replace(/\s/g, '').slice(0, 4)));
  }
  return leadMatchesAnyProvinceTarget(locatie, waarden);
}

/**
 * Of het werkgebied van de agent deze locatie dekt.
 *
 * Geen enkel gebied ingesteld betekent "heel het werkgebied van de klant", niet
 * "niets". Zo blijft een agent zonder instellingen gewoon alles ontvangen,
 * precies zoals nu.
 *
 * Staat er wel iets ingesteld, dan is het een OF: een agent met Limburg én een
 * cirkel rond Zwolle werkt in allebei. Een EN zou betekenen dat je twee
 * gebieden instelt en vervolgens niets meer krijgt.
 */
export function agentDektLocatie(regels: AgentRegels | null | undefined, locatie: Locatie): boolean {
  const r = regels || {};
  const gebieden = leesGebieden(r);
  const metProvincies = heeftProvincies(r);

  if (!metProvincies && gebieden.length === 0) return true;

  if (metProvincies && valtBinnenProvincies(r, locatie)) return true;
  if (valtBinnenGebieden(gebieden, locatie)) return true;

  return false;
}

/** Korte omschrijving van het werkgebied, voor in het scherm. */
export function beschrijfGebied(regels: AgentRegels | null | undefined): string {
  const r = regels || {};
  const delen: string[] = [];
  const provincies = r.regions?.values ?? [];
  if (provincies.length > 0) {
    delen.push(`${provincies.length} ${provincies.length === 1 ? 'provincie' : 'provincies'}`);
  }
  const gebieden = leesGebieden(r);
  if (gebieden.length > 0) {
    delen.push(`${gebieden.length} ${gebieden.length === 1 ? 'straal' : 'stralen'}`);
  }
  return delen.length === 0 ? 'Heel het werkgebied' : delen.join(' + ');
}
