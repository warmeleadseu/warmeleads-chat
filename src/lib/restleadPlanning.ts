/**
 * Het spreiden van restlead-leveringen over de tijd.
 *
 * De gewone verdeling houdt 12 uur aan tussen de eerste en de tweede klant van
 * dezelfde lead, zodat een consument niet binnen een uur door drie bedrijven
 * wordt gebeld. In Restleads werd alles ineens uitgedeeld, waardoor precies dat
 * wél gebeurde.
 */

export const COOLDOWN_UREN = 12;

/** Buiten deze uren leveren we niet: dan gaat er toch niemand achteraan. */
export const VROEGSTE_UUR = 8;
export const LAATSTE_UUR = 20;

export interface PlanInvoer {
  /** Wanneer deze lead voor het laatst aan een klant is gegeven. */
  laatsteToewijzing: Date | null;
  /** Aantal klanten dat nu geleverd moet worden, op volgorde. */
  aantal: number;
  nu?: Date;
}

/**
 * Verschuift een moment naar de eerstvolgende werkbare tijd.
 *
 * Valt het 's nachts, dan naar 08:00 diezelfde of de volgende ochtend. Een lead
 * die om 03:00 binnenkomt wordt toch pas 's ochtends gebeld, en het oogt
 * slordig richting de klant.
 */
export function naarWerkbaarMoment(moment: Date): Date {
  const d = new Date(moment);
  const uur = d.getHours();
  if (uur < VROEGSTE_UUR) {
    d.setHours(VROEGSTE_UUR, 0, 0, 0);
    return d;
  }
  if (uur >= LAATSTE_UUR) {
    d.setDate(d.getDate() + 1);
    d.setHours(VROEGSTE_UUR, 0, 0, 0);
    return d;
  }
  return d;
}

/**
 * De momenten waarop de gekozen klanten geleverd worden.
 *
 * De eerste mag meteen zodra de cooldown sinds de vorige toewijzing verstreken
 * is. Kreeg de lead drie dagen geleden al een klant, dan is die twaalf uur
 * allang voorbij en hoeft er niet opnieuw gewacht te worden; alleen tussen de
 * nieuwe onderling.
 */
export function planMomenten(invoer: PlanInvoer): Date[] {
  const nu = invoer.nu ?? new Date();
  const momenten: Date[] = [];

  let vorige = invoer.laatsteToewijzing;

  for (let i = 0; i < invoer.aantal; i++) {
    let moment: Date;
    if (!vorige) {
      moment = new Date(nu);
    } else {
      const vroegst = new Date(vorige.getTime() + COOLDOWN_UREN * 3600_000);
      moment = vroegst.getTime() > nu.getTime() ? vroegst : new Date(nu);
    }
    const werkbaar = naarWerkbaarMoment(moment);
    momenten.push(werkbaar);
    vorige = werkbaar;
  }

  return momenten;
}

/** Korte omschrijving van een gepland moment, voor in het scherm. */
export function beschrijfMoment(moment: Date, nu: Date = new Date()): string {
  const verschilMin = (moment.getTime() - nu.getTime()) / 60_000;
  if (verschilMin <= 2) return 'nu';

  const zelfdeDag = moment.toDateString() === nu.toDateString();
  const morgen = new Date(nu);
  morgen.setDate(morgen.getDate() + 1);
  const isMorgen = moment.toDateString() === morgen.toDateString();

  const tijd = moment.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  if (zelfdeDag) return `vandaag ${tijd}`;
  if (isMorgen) return `morgen ${tijd}`;
  return `${moment.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })} ${tijd}`;
}
