import { parseProvinceTargetToken } from './provinceTargetMatch';
import { grensSleutelsVoorSelectie, afstandTotProvincieGrensKm } from './provincieMarge';

/**
 * Marge rond een provinciedoel.
 *
 * Een straaldoel kon altijd al opgerekt worden met `radius_km`; een
 * provinciedoel was alles of niets. Bij vdz brigade (Utrecht + Zuid-Holland)
 * viel een lead in Sleeuwijk eruit omdat hij 1 km over de grens ligt, terwijl
 * de adviseur er langs rijdt.
 *
 * Deze functie beantwoordt één vraag: ligt de lead binnen `margeKm` van de
 * grens van een van deze provincies? Twee plekken gebruiken hem, de
 * verdeelmotor en `matchLeadToTargets`, zodat ze niet uit elkaar kunnen lopen.
 */

export interface MargeLocatie {
  lat?: number | null;
  lng?: number | null;
}

/**
 * De grenssleutels voor provincietokens zoals ze in `customer_targets` staan.
 *
 * Die staan er als `NL:Utrecht`, terwijl het grensbestand wordt bevraagd op de
 * kale naam. Die vertaling verkeerd doen levert geen fout op maar stilzwijgend
 * nul resultaten, en dan lijkt elke lead buiten het gebied te vallen.
 */
export function grenssleutelsVoorTokens(tokens: string[]): string[] {
  const namen = tokens
    .map(t => parseProvinceTargetToken(t).name)
    .map(n => n.trim())
    .filter(Boolean);
  return grensSleutelsVoorSelectie(namen);
}

export function binnenProvincieMarge(
  locatie: MargeLocatie,
  provincieTokens: string[],
  margeKm: number,
): boolean {
  if (!margeKm || margeKm <= 0) return false;
  if (locatie.lat == null || locatie.lng == null) return false;
  if (!provincieTokens.length) return false;

  const sleutels = grenssleutelsVoorTokens(provincieTokens);
  if (sleutels.length === 0) return false;

  const afstand = afstandTotProvincieGrensKm(locatie.lat, locatie.lng, sleutels, margeKm);
  return afstand != null && afstand <= margeKm;
}

/** De marge van een doelrij, met een veilige ondergrens. */
export function margeVan(target: { marge_km?: number | null }): number {
  const m = Number(target.marge_km);
  return Number.isFinite(m) && m > 0 ? Math.min(100, m) : 0;
}
