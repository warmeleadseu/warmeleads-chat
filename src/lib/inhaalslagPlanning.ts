import { LOOKBACK_VENSTER_UREN, buitenDeNacht, trekTijdstippen, type Rng } from './leverSpreiding';
import { volgendeKlantVanaf } from './wachttijdKlanten';

/**
 * Een inhaalslag (terugkijkperiode van een batch) gefaseerd over 8 uur.
 *
 * Een batch met een terugkijkperiode kreeg de oudere leads in één klap: bij
 * kWh Garant (12 okt 2026) zouden dat er in één minuut 7 zijn. Nu krijgen ze
 * elk een willekeurig moment in de komende 8 uur, met een dagritme (weinig
 * tussen 23:00 en 06:00; valt het venster in de nacht, dan schuift het door
 * naar de ochtend). De oudste lead komt het eerst, zodat de volgorde in de
 * lijst van de klant klopt met de volgorde waarin de leads binnenkwamen. De
 * wachtrij levert elke minuut af wat aan de beurt is.
 *
 * Met spoed (alleen handmatig, bij het aanmaken van een batch) gaat alles
 * meteen.
 */

export const INHAALSLAG_VENSTER_UREN = LOOKBACK_VENSTER_UREN;
export const INHAALSLAG_PAUZE_UREN = 12;

export type InhaalslagKandidaat = {
  lead_id: string;
  /** Vroegste moment waarop deze lead mag (12 uur na de vorige klant), of null. */
  vroegst: Date | null;
  /** Wanneer de lead binnenkwam; bepaalt de volgorde. */
  created_at?: string | null;
};

/** Hooguit zoveel minuten na het vroegste moment, zodat ook die leads niet precies op de minuut komen. */
const SPELING_NA_WACHTTIJD_MIN = 20;

/**
 * Willekeurige tijdstippen voor de kandidaten, oudste lead eerst. Mag een lead
 * nog niet (12 uur na een andere klant), dan kort na het eerste moment dat het
 * wel mag. Valt dat buiten het venster, dan valt hij af.
 */
export function planInhaalslag(
  kandidaten: InhaalslagKandidaat[],
  nu: Date = new Date(),
  vensterUren: number = INHAALSLAG_VENSTER_UREN,
  rng: Rng = Math.random,
): { lead_id: string; gepland_voor: Date }[] {
  const venster = vensterUren * 3_600_000;
  const einde = nu.getTime() + venster;
  const binnen = kandidaten
    .filter(k => !k.vroegst || k.vroegst.getTime() <= einde)
    .sort((a, b) => tijd(a.created_at) - tijd(b.created_at));
  if (binnen.length === 0) return [];
  const momenten = trekTijdstippen(binnen.length, { start: nu, vensterMs: venster, rng });
  return binnen.map((k, i) => {
    let t = momenten[i].getTime();
    if (k.vroegst && k.vroegst.getTime() > t) {
      t = buitenDeNacht(new Date(k.vroegst.getTime() + Math.floor(rng() * SPELING_NA_WACHTTIJD_MIN * 60_000)), rng).getTime();
    }
    return { lead_id: k.lead_id, gepland_voor: new Date(t) };
  });
}

/** Met spoed: alles meteen, behalve leads die nog op de 12 uur moeten wachten (die zodra het mag, niet 's nachts). */
export function planInhaalslagSpoed(
  kandidaten: InhaalslagKandidaat[],
  nu: Date = new Date(),
  rng: Rng = Math.random,
): { lead_id: string; gepland_voor: Date }[] {
  return [...kandidaten]
    .sort((a, b) => tijd(a.created_at) - tijd(b.created_at))
    .map(k => {
      /* Wie nog op de 12 uur wacht: kort nadat het mag, maar niet midden in de nacht. */
      const gepland = k.vroegst && k.vroegst.getTime() > nu.getTime()
        ? buitenDeNacht(new Date(k.vroegst.getTime() + Math.floor(rng() * 10 * 60_000)), rng)
        : nu;
      return { lead_id: k.lead_id, gepland_voor: gepland };
    });
}

function tijd(iso: string | null | undefined): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** Wanneer de wachttijd na de laatste andere klant om is (12 uur, of 8 uur voor een derde klant), of null als dat al zo is. */
export function vroegsteMoment(
  bestaande: { customer_id: string | null; assigned_at: string | null }[],
  klantId: string,
  nu: Date = new Date(),
): Date | null {
  return volgendeKlantVanaf(bestaande, klantId, nu);
}
