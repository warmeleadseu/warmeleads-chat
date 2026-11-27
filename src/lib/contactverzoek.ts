/**
 * Contactverzoek na 3× voicemail (pure regels, ook bruikbaar in de browser).
 *
 * Na de derde voicemail krijgt de prospect één mail met een persoonlijke
 * contactpagina (/contact/[id]). Daar kiest hij: terugbellen op een moment
 * naar keuze (wordt een terugbeltaak met seintje voor de accountmanager),
 * zelf een gesprek plannen, ons bellen, of laten weten dat hij geen interesse
 * heeft.
 */

/** Bij de hoeveelste voicemail de mail weggaat (één keer per prospect). */
export const CONTACTMAIL_BIJ_VOICEMAIL = 3;
export const CONTACTMAIL_SOORT = 'voicemail_contactverzoek';
export const WARMELEADS_TELEFOON = '085 047 7067';
export const WARMELEADS_TEL_LINK = 'tel:+31850477067';

export const TERUGBEL_KEUZES = [
  { key: 'zsm', label: 'Zo snel mogelijk' },
  { key: 'vandaag_middag', label: 'Vandaag tussen 13:00 en 17:00' },
  { key: 'morgen_ochtend', label: 'Volgende werkdag in de ochtend' },
  { key: 'morgen_middag', label: 'Volgende werkdag in de middag' },
] as const;
export type TerugbelKeuze = (typeof TERUGBEL_KEUZES)[number]['key'];

export function isTerugbelKeuze(v: unknown): v is TerugbelKeuze {
  return typeof v === 'string' && TERUGBEL_KEUZES.some(k => k.key === v);
}

/** Uur en minuut en weekdag in Nederlandse tijd. */
function nlDelen(d: Date): { jaar: number; maand: number; dag: number; uur: number; minuut: number; weekdag: number } {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { jaar: +p.year, maand: +p.month, dag: +p.day, uur: +p.hour % 24, minuut: +p.minute, weekdag: wd };
}

/** Datum in Nederlandse tijd op een bepaalde dag (offset in dagen vanaf vandaag) en tijd. */
function nlMoment(basis: Date, dagenVerder: number, uur: number, minuut: number): Date {
  const d = nlDelen(basis);
  /* Begin met UTC-schatting en corrigeer met het werkelijke verschil (zomer-/wintertijd). */
  const schatting = new Date(Date.UTC(d.jaar, d.maand - 1, d.dag + dagenVerder, uur, minuut));
  const echt = nlDelen(schatting);
  const verschilMin = (echt.uur * 60 + echt.minuut) - (uur * 60 + minuut);
  const correctie = ((verschilMin + 720) % 1440 + 1440) % 1440 - 720;
  return new Date(schatting.getTime() - correctie * 60_000);
}

/** Aantal dagen tot de volgende werkdag (ma–vr), vanaf morgen. */
function dagenTotVolgendeWerkdag(weekdag: number): number {
  if (weekdag === 5) return 3; // vrijdag → maandag
  if (weekdag === 6) return 2; // zaterdag → maandag
  return 1;
}

function isWerkdag(weekdag: number): boolean {
  return weekdag >= 1 && weekdag <= 5;
}

/**
 * Het moment van de terugbeltaak bij de keuze van de prospect. Buiten
 * kantoortijd (ma–vr 9–17) schuift het naar de eerstvolgende werkdag.
 */
export function terugbelMoment(keuze: TerugbelKeuze, nu: Date = new Date()): Date {
  const d = nlDelen(nu);
  const minNu = d.uur * 60 + d.minuut;
  const werkdag = isWerkdag(d.weekdag);
  const volgende = werkdag ? dagenTotVolgendeWerkdag(d.weekdag) : (d.weekdag === 6 ? 2 : 1);
  const binnenKantoor = werkdag && minNu >= 9 * 60 && minNu < 16 * 60 + 45;

  if (keuze === 'zsm') {
    if (binnenKantoor) return new Date(nu.getTime() + 15 * 60_000);
    if (werkdag && minNu < 9 * 60) return nlMoment(nu, 0, 9, 15);
    return nlMoment(nu, volgende, 9, 15);
  }
  if (keuze === 'vandaag_middag') {
    if (werkdag && minNu < 13 * 60) return nlMoment(nu, 0, 13, 0);
    if (binnenKantoor) return new Date(nu.getTime() + 15 * 60_000);
    return nlMoment(nu, volgende, 13, 0);
  }
  const dagen = werkdag ? dagenTotVolgendeWerkdag(d.weekdag) : volgende;
  return keuze === 'morgen_ochtend' ? nlMoment(nu, dagen, 9, 30) : nlMoment(nu, dagen, 13, 30);
}

/** Telefoonnummer half afgeschermd voor op de openbare contactpagina. */
export function maskeerTelefoon(tel: string | null | undefined): string | null {
  const cijfers = (tel ?? '').replace(/\D/g, '');
  if (cijfers.length < 6) return null;
  return `${cijfers.slice(0, 2)}••••${cijfers.slice(-3)}`;
}
