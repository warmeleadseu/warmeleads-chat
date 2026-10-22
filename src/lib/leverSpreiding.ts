/**
 * Wanneer een lead bij een klant aankomt: meteen, of verspreid op een
 * willekeurig, geloofwaardig moment.
 *
 * Aanleiding (oktober 2026): leads die niet vers binnenkwamen gingen in
 * groepen tegelijk naar de klant. Bij Mediabink kwamen op 19 oktober 28 leads
 * binnen één minuut, omdat de kwartierronde na de betaling alles uit de
 * terugkijkperiode in één keer uitdeelde. Om middernacht, als het
 * dagmaximum opnieuw begint, kregen klanten hun wachtende leads allemaal om
 * 00:00. Een tweede of derde klant kreeg leads in groepjes op het kwartier.
 *
 * Nu geldt: een verse lead gaat nog steeds meteen. Alles wat ouder is, en
 * elke verse lead extra voor dezelfde batch in één ronde, krijgt een
 * willekeurig moment in de wachtrij. Dat moment volgt een dagritme: overdag
 * gewoon, 's nachts (23:00 tot 06:00) bijna niet. De klant ziet de echte tijd
 * waarop de lead werd afgeleverd.
 */

/** Een lead tot zo oud geldt als vers: die gaat (op de eerste per batch per ronde na) meteen. */
export const VERS_MAX_MIN = 30;
/** Venster voor een extra verse lead in dezelfde ronde. */
export const KORT_VENSTER_MIN = 30;
/** Venster voor een oudere lead uit de verdeelronde (tweede of derde klant, wachtende leads). */
export const SPREIDING_VENSTER_UREN = 2;
/** Venster voor een lookback (terugkijkperiode van een batch). */
export const LOOKBACK_VENSTER_UREN = 8;
/** Twee leads voor dezelfde batch nooit vlak na elkaar. */
export const MIN_AFSTAND_MIN = 4;
/** Hoe ver een venster maximaal doorschuift als het in de nacht valt. */
const MAX_VERLENGING_UUR = 12;

const AMSTERDAM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hourCycle: 'h23' });

/** Uur (0-23) in Nederlandse tijd. */
export function amsterdamUur(t: Date): number {
  return Number(AMSTERDAM.format(t)) % 24;
}

/**
 * Hoe gewoon het is dat er op dit uur een lead binnenkomt. Overdag 1, de
 * randen van de avond en ochtend half, de nacht bijna nul (niet helemaal: een
 * enkele nachtelijke lead is geloofwaardiger dan een gat van zeven uur).
 */
export function ritmeGewicht(uur: number): number {
  if (uur >= 7 && uur <= 21) return 1;
  if (uur === 6 || uur === 22) return 0.45;
  return 0.012;
}

export type Rng = () => number;

/**
 * Trekt `aantal` willekeurige tijdstippen vanaf `start`, verspreid over een
 * venster van `vensterMs` "daguren". Valt het venster (deels) in de nacht,
 * dan schuift het einde door tot er evenveel daguren in zitten (hooguit 12
 * uur extra), zodat de leads vooral 's ochtends komen. Tijdstippen liggen
 * minstens `minAfstandMs` uit elkaar (als dat past) en zijn oplopend.
 */
export function trekTijdstippen(
  aantal: number,
  opties: { start: Date; vensterMs: number; rng?: Rng; minAfstandMs?: number },
): Date[] {
  if (aantal <= 0) return [];
  const rng = opties.rng ?? Math.random;
  const minuut = 60_000;
  const start = opties.start.getTime();

  /* Per minuut het gewicht, tot er genoeg daguren in het venster zitten. */
  const nodig = opties.vensterMs / minuut;
  const maxMinuten = nodig + MAX_VERLENGING_UUR * 60;
  const gewichten: number[] = [];
  let som = 0;
  let uurCache = -1;
  let uurVan = -1;
  for (let m = 0; m < maxMinuten && som < nodig; m++) {
    const t = start + m * minuut;
    const blok = Math.floor(t / 3_600_000);
    if (blok !== uurCache) { uurCache = blok; uurVan = amsterdamUur(new Date(t)); }
    const g = ritmeGewicht(uurVan);
    gewichten.push(g);
    som += g;
  }
  const cumulatief: number[] = [];
  let acc = 0;
  for (const g of gewichten) { acc += g; cumulatief.push(acc); }

  const trek = (): number => {
    const doel = rng() * acc;
    let lo = 0;
    let hi = cumulatief.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulatief[mid] < doel) lo = mid + 1;
      else hi = mid;
    }
    /* Binnen de minuut ook een willekeurige seconde. */
    return start + lo * minuut + Math.floor(rng() * minuut);
  };

  const lengte = gewichten.length * minuut;
  const minAfstand = Math.min(opties.minAfstandMs ?? MIN_AFSTAND_MIN * minuut, lengte / (aantal + 1));
  const uit: number[] = [];
  for (let i = 0; i < aantal; i++) {
    let t = trek();
    for (let poging = 0; poging < 25 && uit.some(x => Math.abs(x - t) < minAfstand); poging++) t = trek();
    uit.push(t);
  }
  return uit.sort((a, b) => a - b).map(t => new Date(t));
}

/** Is deze lead nog vers (net binnengekomen)? Zonder datum: niet vers. */
export function isVers(createdAt: string | null | undefined, nu: Date = new Date()): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return nu.getTime() - t <= VERS_MAX_MIN * 60_000;
}

export type LeverKeuze =
  | { soort: 'meteen' }
  | { soort: 'spreiden'; vensterMs: number };

/**
 * Meteen leveren of verspreiden, voor een lead uit de verdeelronde (niet bij
 * binnenkomst: dan gaat een lead altijd meteen).
 *
 * - Direct leveren: altijd meteen (dat is de belofte aan die klant).
 * - Verse lead, en de eerste voor deze batch in deze ronde: meteen.
 * - Verse lead, maar de batch kreeg deze ronde al een lead: kort verspreid.
 * - Oudere lead: verspreid over een paar uur.
 */
export function kiesLevering(opties: { vers: boolean; direct: boolean; batchKreegAlLeadDezeRonde: boolean }): LeverKeuze {
  if (opties.direct) return { soort: 'meteen' };
  if (opties.vers && !opties.batchKreegAlLeadDezeRonde) return { soort: 'meteen' };
  if (opties.vers) return { soort: 'spreiden', vensterMs: KORT_VENSTER_MIN * 60_000 };
  return { soort: 'spreiden', vensterMs: SPREIDING_VENSTER_UREN * 3_600_000 };
}

/**
 * Eén willekeurig moment voor een extra lead van een batch, rekening houdend
 * met de momenten die al voor die batch klaarstaan (niet vlak erop).
 */
export function kiesMoment(opties: { nu: Date; vensterMs: number; bezet?: Date[]; rng?: Rng }): Date {
  const rng = opties.rng ?? Math.random;
  const bezet = (opties.bezet ?? []).map(d => d.getTime());
  const minAfstand = MIN_AFSTAND_MIN * 60_000;
  let gekozen = trekTijdstippen(1, { start: opties.nu, vensterMs: opties.vensterMs, rng })[0];
  for (let i = 0; i < 25 && bezet.some(b => Math.abs(b - gekozen.getTime()) < minAfstand); i++) {
    gekozen = trekTijdstippen(1, { start: opties.nu, vensterMs: opties.vensterMs, rng })[0];
  }
  return gekozen;
}

/** 23:00 tot 06:00 in Nederlandse tijd. */
export function isNacht(t: Date): boolean {
  const u = amsterdamUur(t);
  return u >= 23 || u < 6;
}

/**
 * Een moment dat in de nacht valt (bijvoorbeeld het einde van de 12 uur
 * wachttijd om 23:40), doorschuiven naar de vroege ochtend: tussen 07:00 en
 * 08:30, op een willekeurige minuut en seconde. Overdag blijft het zoals het is.
 */
export function buitenDeNacht(t: Date, rng: Rng = Math.random): Date {
  if (!isNacht(t)) return t;
  let m = t.getTime();
  for (let i = 0; i < 8 * 60 && isNacht(new Date(m)); i++) m += 60_000;
  /* m ligt nu net na 06:00; daarna 60 tot 150 minuten later. */
  const zes = m - (new Date(m).getUTCMinutes() * 60_000) - new Date(m).getUTCSeconds() * 1000 - new Date(m).getUTCMilliseconds();
  return new Date(zes + (60 + Math.floor(rng() * 90)) * 60_000 + Math.floor(rng() * 60_000));
}
