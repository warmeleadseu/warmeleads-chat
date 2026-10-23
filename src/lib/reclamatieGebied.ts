import { haversineKm } from './portalDistanceOrigin';
import { targetCountryAllowsLead } from './targetCountryMatch';
import { leadMatchesAnyProvinceTarget } from './provinceTargetMatch';
import { binnenProvincieMarge, margeVan } from './provincieDoelMarge';

/**
 * Bij een reclamatie "buiten afgesproken gebied": hoe ver ligt de lead buiten
 * het gebied dat met de klant is afgesproken? Zodat dat niet elke keer met de
 * hand nagemeten hoeft te worden.
 *
 * Het afgesproken gebied is de straal (of provincie) zelf. Onze eigen marge
 * daaromheen telt hier niet als "binnen": die staat er apart bij, want een
 * lead binnen de marge is wel buiten wat de klant verwacht.
 */

export type GebiedsDoel = {
  target_type?: string | null;
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  provinces?: string[] | null;
  country?: string | null;
  marge_km?: number | null;
};

export type GebiedsLead = { lat?: number | null; lng?: number | null; provincie?: string | null; land?: string | null; postcode?: string | null };

export type GebiedOordeel =
  | { status: 'binnen'; doel: string | null; afstandMiddenKm: number | null }
  | { status: 'buiten'; kmBuiten: number; doel: string | null; straalKm: number; binnenMarge: boolean }
  | { status: 'buiten_provincie'; provincies: string[]; binnenMarge: boolean }
  | { status: 'onbekend'; waarom: string };

const km = (n: number) => Math.round(n * 10) / 10;

export function beoordeelGebied(lead: GebiedsLead, doelen: GebiedsDoel[]): GebiedOordeel {
  if (doelen.length === 0) return { status: 'onbekend', waarom: 'geen gebied ingesteld' };
  const heeftCoordinaten = lead.lat != null && lead.lng != null;

  let besteStraal: { buiten: number; doel: GebiedsDoel; afstand: number } | null = null;
  const provincieDoelen: GebiedsDoel[] = [];

  for (const d of doelen) {
    if (!targetCountryAllowsLead(d as { country?: string | null }, lead as never)) continue;
    if ((d.target_type || 'radius') === 'province') {
      const provs = Array.isArray(d.provinces) ? d.provinces : [];
      if (provs.length === 0) continue;
      if (leadMatchesAnyProvinceTarget(lead as never, provs)) {
        return { status: 'binnen', doel: lead.provincie ? `provincie ${lead.provincie}` : (d.label ?? null), afstandMiddenKm: null };
      }
      provincieDoelen.push(d);
      continue;
    }
    if (!heeftCoordinaten || d.lat == null || d.lng == null || d.radius_km == null) continue;
    const afstand = haversineKm(lead.lat as number, lead.lng as number, d.lat, d.lng);
    const buiten = afstand - Number(d.radius_km);
    if (buiten <= 0) return { status: 'binnen', doel: d.label ?? null, afstandMiddenKm: km(afstand) };
    if (!besteStraal || buiten < besteStraal.buiten) besteStraal = { buiten, doel: d, afstand };
  }

  if (besteStraal) {
    return {
      status: 'buiten',
      kmBuiten: km(besteStraal.buiten),
      doel: besteStraal.doel.label ?? null,
      straalKm: Number(besteStraal.doel.radius_km),
      binnenMarge: besteStraal.buiten <= margeVan(besteStraal.doel as { marge_km?: number | null }),
    };
  }
  if (provincieDoelen.length > 0) {
    const provincies = provincieDoelen.flatMap(d => d.provinces ?? []).map(p => p.replace(/^[A-Z]{2}:/, ''));
    const binnenMarge = provincieDoelen.some(d => margeVan(d as { marge_km?: number | null }) > 0
      && binnenProvincieMarge(lead as never, d.provinces ?? [], margeVan(d as { marge_km?: number | null })));
    return { status: 'buiten_provincie', provincies: [...new Set(provincies)], binnenMarge };
  }
  return { status: 'onbekend', waarom: heeftCoordinaten ? 'geen passend gebied voor dit land' : 'locatie van de lead onbekend' };
}

/** Korte tekst voor in de lijst. */
export function gebiedTekst(o: GebiedOordeel): string {
  switch (o.status) {
    case 'binnen':
      return o.afstandMiddenKm != null
        ? `Binnen het gebied (${String(o.afstandMiddenKm).replace('.', ',')} km van het middelpunt)`
        : `Binnen het gebied${o.doel ? ` (${o.doel})` : ''}`;
    case 'buiten':
      return `${String(o.kmBuiten).replace('.', ',')} km buiten het gebied (straal ${o.straalKm} km${o.doel ? ` rond ${o.doel}` : ''})${o.binnenMarge ? ', binnen onze marge' : ''}`;
    case 'buiten_provincie':
      return `Buiten de afgesproken provincie (${o.provincies.join(', ')})${o.binnenMarge ? ', binnen onze marge' : ''}`;
    default:
      return `Afstand onbekend: ${o.waarom}`;
  }
}
