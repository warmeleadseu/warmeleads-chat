import grenzen from '@/data/provincieGrenzen.json';

/**
 * Leads meenemen die net buiten een geselecteerde provincie vallen.
 *
 * WAAROM
 * ------
 * Bij bulkverkoop is een lead die drie kilometer over de provinciegrens ligt
 * praktisch net zo bruikbaar als een lead er net binnen, maar hij viel altijd
 * buiten de selectie omdat het filter puur op het tekstveld `provincie` werkt.
 * Met een marge wordt de partij groter zonder dat de afnemer er iets van merkt.
 *
 * HOE
 * ---
 * Het systeem kende geen provinciegrenzen; die zijn toegevoegd als vast
 * bestand (src/data/provincieGrenzen.json): de contouren van de twaalf
 * Nederlandse en elf Belgische provincies, vereenvoudigd tot ongeveer 1.700
 * punten. Nauwkeurig tot op een paar honderd meter, wat voor dit doel ruim
 * voldoende is en het bestand op 26 KB houdt.
 *
 * Of een lead ín de provincie ligt komt gewoon uit zijn `provincie`-veld. Deze
 * module hoeft dus alleen te bepalen hoe ver een lead dáárbuiten van de grens
 * af ligt, en daarvoor is de contour als lijn genoeg. Er is geen
 * punt-in-vlaktoets nodig.
 *
 * Afstanden zijn hemelsbreed. Een marge rond Noord-Holland reikt dus over het
 * IJsselmeer; dat is een bewuste keuze.
 */

type ProvincieGrens = { bbox: [number, number, number, number]; ringen: [number, number][][] };
const GRENZEN = grenzen as unknown as Record<string, ProvincieGrens>;

/** Graden naar kilometers, lokaal benaderd. Ruim nauwkeurig genoeg onder ~50 km. */
const KM_PER_GRAAD_LAT = 110.574;
function kmPerGraadLng(lat: number): number {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

/**
 * Sleutels in het grensbestand voor een provincienaam zoals het filter die
 * gebruikt. Het filter kent geen landonderscheid, dus "Limburg" levert zowel
 * de Nederlandse als de Belgische contour op. Dat sluit aan bij het bestaande
 * gedrag, waar `provincie = 'Limburg'` ook beide landen matcht.
 */
export function grensSleutelsVoor(provincieNaam: string): string[] {
  const naam = provincieNaam.trim();
  if (!naam) return [];
  return ['NL', 'BE'].map(land => `${land}:${naam}`).filter(sleutel => sleutel in GRENZEN);
}

/** Alle sleutels voor een lijst geselecteerde provincies, zonder dubbelen. */
export function grensSleutelsVoorSelectie(provincies: string[]): string[] {
  return [...new Set(provincies.flatMap(grensSleutelsVoor))];
}

/** Kortste afstand van een punt tot een lijnstuk, in kilometers. */
function afstandTotSegmentKm(
  lat: number, lng: number,
  aLng: number, aLat: number,
  bLng: number, bLat: number,
): number {
  const schaalLng = kmPerGraadLng(lat);
  const px = (lng - aLng) * schaalLng;
  const py = (lat - aLat) * KM_PER_GRAAD_LAT;
  const vx = (bLng - aLng) * schaalLng;
  const vy = (bLat - aLat) * KM_PER_GRAAD_LAT;
  const lengte2 = vx * vx + vy * vy;
  if (lengte2 === 0) return Math.hypot(px, py);
  let t = (px * vx + py * vy) / lengte2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - t * vx, py - t * vy);
}

/**
 * Kortste afstand van een punt tot de grens van één van de opgegeven
 * provincies, in kilometers. `null` als geen van de sleutels bestaat.
 *
 * `maxKm` kapt de berekening af: ligt het punt ver buiten de omhullende
 * rechthoek van een provincie, dan wordt die provincie overgeslagen. Dat
 * scheelt het merendeel van het rekenwerk bij grote leadlijsten.
 */
export function afstandTotProvincieGrensKm(
  lat: number,
  lng: number,
  sleutels: string[],
  maxKm?: number,
): number | null {
  let best = Infinity;
  for (const sleutel of sleutels) {
    const provincie = GRENZEN[sleutel];
    if (!provincie) continue;

    if (maxKm != null) {
      const [minLng, minLat, maxLng, maxLat] = provincie.bbox;
      const marge = maxKm / Math.min(KM_PER_GRAAD_LAT, Math.max(kmPerGraadLng(lat), 1));
      if (lat < minLat - marge || lat > maxLat + marge) continue;
      if (lng < minLng - marge || lng > maxLng + marge) continue;
    }

    for (const ring of provincie.ringen) {
      for (let i = 0; i < ring.length - 1; i++) {
        const d = afstandTotSegmentKm(lat, lng, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]);
        if (d < best) {
          best = d;
          if (best === 0) return 0;
        }
      }
    }
  }
  return best === Infinity ? null : Math.round(best * 10) / 10;
}

export type MargeLead = {
  provincie?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/**
 * Valt deze lead binnen de marge rond de geselecteerde provincies?
 *
 * Leads waarvan het provincieveld al matcht komen hier niet langs; die zijn
 * door het gewone filter al meegenomen. Leads zonder coördinaten kunnen niet
 * op afstand beoordeeld worden en vallen af.
 */
export function leadBinnenProvincieMarge(
  lead: MargeLead,
  sleutels: string[],
  margeKm: number,
): boolean {
  if (!sleutels.length || !(margeKm > 0)) return false;
  if (lead.lat == null || lead.lng == null) return false;
  if (!Number.isFinite(lead.lat) || !Number.isFinite(lead.lng)) return false;
  const afstand = afstandTotProvincieGrensKm(lead.lat, lead.lng, sleutels, margeKm);
  return afstand != null && afstand <= margeKm;
}

/** Bovengrens op de marge, zodat een typefout niet het halve land binnenhaalt. */
export const MAX_PROVINCIE_MARGE_KM = 100;

/** Leest en normaliseert de marge uit een query- of body-waarde. */
export function parseProvincieMargeKm(waarde: string | number | null | undefined): number | null {
  if (waarde == null || waarde === '') return null;
  const n = typeof waarde === 'number' ? waarde : parseFloat(String(waarde).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_PROVINCIE_MARGE_KM, Math.round(n * 10) / 10);
}

export type MargeBbox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/**
 * Omhullende rechthoek rond de geselecteerde provincies plus de marge.
 *
 * Dient als grove voorselectie in de database: alles buiten deze rechthoek kan
 * onmogelijk binnen de marge liggen, dus dat hoeft niet opgehaald te worden.
 * De exacte toets gebeurt daarna in geheugen, net als bij het bestaande
 * plaatsnaam-plus-straalfilter.
 */
export function provincieMargeBbox(sleutels: string[], margeKm: number): MargeBbox | null {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  let gevonden = false;
  for (const sleutel of sleutels) {
    const p = GRENZEN[sleutel];
    if (!p) continue;
    gevonden = true;
    const [bMinLng, bMinLat, bMaxLng, bMaxLat] = p.bbox;
    if (bMinLat < minLat) minLat = bMinLat;
    if (bMaxLat > maxLat) maxLat = bMaxLat;
    if (bMinLng < minLng) minLng = bMinLng;
    if (bMaxLng > maxLng) maxLng = bMaxLng;
  }
  if (!gevonden) return null;

  const latMarge = margeKm / KM_PER_GRAAD_LAT;
  const midLat = (minLat + maxLat) / 2;
  const lngMarge = margeKm / Math.max(kmPerGraadLng(midLat), 1);
  return {
    minLat: minLat - latMarge,
    maxLat: maxLat + latMarge,
    minLng: minLng - lngMarge,
    maxLng: maxLng + lngMarge,
  };
}

/**
 * Hoort deze lead bij de selectie? Ofwel omdat zijn provincieveld matcht,
 * ofwel omdat hij binnen de marge rond die provincies valt.
 */
export function leadValtBinnenProvincieSelectie(
  lead: MargeLead,
  provincies: string[],
  sleutels: string[],
  margeKm: number,
): boolean {
  const naam = (lead.provincie || '').trim();
  if (naam && provincies.includes(naam)) return true;
  return leadBinnenProvincieMarge(lead, sleutels, margeKm);
}

export type ProvincieMargeContext = {
  /** Provincienamen zoals in het filter, dus zonder landvoorvoegsel. */
  provincies: string[];
  /** Sleutels in het grensbestand, met landvoorvoegsel. */
  sleutels: string[];
  margeKm: number;
  box: MargeBbox;
};

/**
 * Leidt de margecontext af uit de filterparameters. Geeft `null` zodra er geen
 * provincie of geen bruikbare marge is; de aanroeper valt dan terug op het
 * gewone provinciefilter.
 *
 * Eén plek voor alle vier de routes (lijst, teller, export en bulk toewijzen),
 * zodat die niet uiteen kunnen lopen. Zou de export de marge negeren, dan zie
 * je in het scherm 120 leads staan en exporteer je er 95.
 */
export function resolveProvincieMarge(filters: {
  province?: string | null;
  province_margin_km?: string | number | null;
}): ProvincieMargeContext | null {
  const provincies = String(filters.province || '').split(',').map(p => p.trim()).filter(Boolean);
  if (provincies.length === 0) return null;

  const margeKm = parseProvincieMargeKm(filters.province_margin_km);
  if (margeKm == null) return null;

  const sleutels = grensSleutelsVoorSelectie(provincies);
  if (sleutels.length === 0) return null;

  const box = provincieMargeBbox(sleutels, margeKm);
  if (!box) return null;

  return { provincies, sleutels, margeKm, box };
}

/** Houdt uit een opgehaalde set alleen de rijen over die echt binnen de selectie vallen. */
export function filterRijenOpProvincieMarge<T extends MargeLead>(
  rijen: T[],
  ctx: ProvincieMargeContext,
): T[] {
  return rijen.filter(r => leadValtBinnenProvincieSelectie(r, ctx.provincies, ctx.sleutels, ctx.margeKm));
}

/** Zelfde plafonds als de straal-scan, zodat één filter niet de database leegtrekt. */
export const MARGE_PAGINA = 1000;
export const MARGE_SCAN_MAX = 100_000;

/**
 * Loopt een reeds gefilterde query pagina voor pagina af en geeft alle rijen
 * terug. Nodig wanneer de exacte toets pas in geheugen kan gebeuren, zoals bij
 * de provinciemarge. Bestaat naast `filterQueryRowsByPlaatsRadius`, die
 * hetzelfde doet maar meteen op straal filtert.
 */
export async function scanRijenGepagineerd<T>(
  haalPagina: (van: number, tot: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>,
  maxRijen: number = MARGE_SCAN_MAX,
): Promise<{ rows: T[]; error: string | null }> {
  const rijen: T[] = [];
  let offset = 0;
  while (rijen.length < maxRijen) {
    const { data, error } = await haalPagina(offset, offset + MARGE_PAGINA - 1);
    if (error) return { rows: rijen, error: error.message || 'Ophalen mislukt' };
    if (!data?.length) break;
    rijen.push(...data);
    if (data.length < MARGE_PAGINA) break;
    offset += data.length;
  }
  return { rows: rijen, error: null };
}
