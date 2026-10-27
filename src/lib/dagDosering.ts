import { amsterdamUur } from './leverSpreiding';

/**
 * Dagdosering: het dagmaximum van een batch gelijkmatig over de dag.
 *
 * Aanleiding (27 okt 2026): klanten met een laag dagmaximum (De Content
 * Factory en DTA, 5 per dag) kregen hun hele dagportie elke ochtend vóór
 * 08:30, allemaal leads van gisteren die op de nieuwe dag hadden gewacht. Het
 * maximum was dan meteen op, verse leads van overdag konden er niet meer bij
 * en wachtten op hun beurt tot de volgende ochtend.
 *
 * Met dagdosering aan:
 * - tussen 08:00 en 16:00 groeit wat de batch mag hebben gelijkmatig mee met
 *   de klok (bij 5 per dag: om 08:00 1, om 12:00 3, om 16:00 alle 5); na 16:00
 *   mag de rest van het maximum; vóór 08:00 niets;
 * - een lead die nog geen klant heeft en langer dan 18 uur wacht, gaat niet
 *   meer naar zo'n batch maar naar Restleads, zodat er geen achterstand ontstaat
 *   die elke dag wordt doorgeschoven.
 */

export const DOSERING_VAN_UUR = 8;
export const DOSERING_TOT_UUR = 16;
export const MAX_WACHTTIJD_UUR = 18;

const AMS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Minuten sinds middernacht, Nederlandse tijd. */
function minutenVanDag(t: Date): number {
  const [u, m] = AMS.format(t).split(':').map(Number);
  return (u % 24) * 60 + m;
}

/** Hoeveel leads een gedoseerde batch vandaag op dit moment al mag hebben. */
export function toegestaanTotNu(dagmaximum: number, nu: Date = new Date()): number {
  if (!(dagmaximum > 0)) return Infinity;
  const min = minutenVanDag(nu);
  const van = DOSERING_VAN_UUR * 60;
  const tot = DOSERING_TOT_UUR * 60;
  if (min < van) return 0;
  if (min >= tot) return dagmaximum;
  const deel = (min - van) / (tot - van);
  return Math.min(dagmaximum, Math.max(1, Math.ceil(dagmaximum * deel)));
}

/**
 * Wanneer mag een gedoseerde batch die vandaag al `vandaag` leads heeft er weer
 * één bij? Null als het nu al mag, of als het maximum voor vandaag op is.
 */
export function volgendeRuimte(dagmaximum: number, vandaag: number, nu: Date = new Date()): Date | null {
  if (!(dagmaximum > 0) || vandaag >= dagmaximum) return null;
  if (vandaag < toegestaanTotNu(dagmaximum, nu)) return null;
  /* Per minuut vooruit tot er ruimte is (hooguit tot 16:00 van deze dag). */
  for (let i = 1; i <= 24 * 60; i++) {
    const t = new Date(nu.getTime() + i * 60_000);
    if (minutenVanDag(t) === 0) return null; /* nieuwe dag: dan telt een nieuw maximum */
    if (vandaag < toegestaanTotNu(dagmaximum, t)) return t;
  }
  return null;
}

/** Heeft deze lead (nog zonder klant) langer gewacht dan een gedoseerde batch aanneemt? */
export function teLangGewacht(createdAt: string | null | undefined, nu: Date = new Date()): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return nu.getTime() - t > MAX_WACHTTIJD_UUR * 3_600_000;
}

/** Is het nu binnen het doseervenster? (voor labels) */
export function binnenDoseerVenster(nu: Date = new Date()): boolean {
  const u = amsterdamUur(nu);
  return u >= DOSERING_VAN_UUR && u < DOSERING_TOT_UUR;
}
