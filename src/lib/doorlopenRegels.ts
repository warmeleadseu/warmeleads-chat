/**
 * Doorlopend op factuur: de regels, puur en te testen.
 *
 * Afspraak (28 okt 2026): altijd een keuze van de klant of de accountmanager,
 * nooit een standaard. Staat het aan, dan start bij een volledig geleverde
 * batch direct een nieuwe met dezelfde voorwaarden, die meteen levert en op
 * factuur gaat. Zonder vinkje verandert er niets aan het gewone proces.
 *
 * Aanleiding: van 117 afgeronde batches in een jaar kreeg minder dan de helft
 * een vervolg, en wie nabestelde zat mediaan 10 dagen zonder leads.
 */

/** Maximaal bedrag per doorloop, exclusief btw. */
export const DOORLOOP_MAX_EXCL = 2500;
export const BETAALTERMIJN_DAGEN = 7;
/** Bij dit percentage krijgt de klant de aankondiging (met stopknop). */
export const AANKONDIG_PCT = 90;
/** Zonder aankondiging vooraf (te laat aangezet): zo lang wachten na de aankondiging. */
export const WACHT_NA_LATE_AANKONDIGING_UUR = 24;
/** Een gemiste doorloop pakt de cron tot zo lang na afronding nog op. */
export const VANGNET_DAGEN = 14;
const MIN_GROOTTE = 10;

export type DoorloopStapSoort = 'herinnering' | 'pauze' | 'bellen';
export const DOORLOOP_STAPPEN: { stap: number; dag: number; soort: DoorloopStapSoort }[] = [
  { stap: 1, dag: 5, soort: 'herinnering' },
  { stap: 2, dag: 7, soort: 'pauze' },
  { stap: 3, dag: 14, soort: 'bellen' },
];

/** Mag een batch leads krijgen? Spiegel van de kolom `mag_leveren`. */
export function batchMagLeveren(b: { is_paid?: boolean | null; op_factuur?: boolean | null }): boolean {
  return b.is_paid === true || b.op_factuur === true;
}

/** Komt deze batch in aanmerking om door te lopen (los van de klant)? */
export function batchKanDoorlopen(b: {
  batch_kind?: string | null; delivery_model?: string | null; price_per_lead?: number | string | null; batch_size?: number | null;
}): boolean {
  if ((b.batch_kind ?? 'leads') !== 'leads') return false;
  if (b.delivery_model === 'manual' || b.delivery_model === 'unlimited') return false;
  return Number(b.price_per_lead) > 0 && Number(b.batch_size) > 0;
}

/**
 * Grootte van de doorloop: dezelfde als de vorige, maar nooit boven het
 * maximum. Past er minder dan 10 in, dan loopt hij niet door.
 */
export function doorloopGrootte(prijsPerLead: number, vorigeGrootte: number): { grootte: number; verkleind: boolean } | null {
  if (!(prijsPerLead > 0) || !(vorigeGrootte > 0)) return null;
  const pastErIn = Math.floor((DOORLOOP_MAX_EXCL + 1e-9) / prijsPerLead);
  const grootte = Math.min(Math.floor(vorigeGrootte), pastErIn);
  if (grootte < MIN_GROOTTE) return null;
  return { grootte, verkleind: grootte < vorigeGrootte };
}

export type ZelfAanzettenReden = 'ok' | 'geen_betaalde_batch' | 'achterstallig' | 'niet_beschikbaar';

/**
 * Mag de klant het zelf aanzetten? Vanaf één betaalde batch en zonder
 * achterstallige factuur. Beheer mag het altijd.
 */
export function magZelfAanzetten(k: {
  betaaldeBatches: number; achterstalligeFacturen: number; intern?: boolean | null; demo?: boolean | null;
}): ZelfAanzettenReden {
  if (k.intern || k.demo) return 'niet_beschikbaar';
  if (k.achterstalligeFacturen > 0) return 'achterstallig';
  if (k.betaaldeBatches < 1) return 'geen_betaalde_batch';
  return 'ok';
}

export const ZELF_AANZETTEN_UITLEG: Record<Exclude<ZelfAanzettenReden, 'ok'>, string> = {
  geen_betaalde_batch: 'Doorlopend op factuur kan vanaf je tweede batch. Na je eerste betaalde batch kun je het hier aanzetten.',
  achterstallig: 'Er staat nog een factuur open waarvan de betaaltermijn voorbij is. Na betaling kun je het weer aanzetten.',
  niet_beschikbaar: 'Doorlopend op factuur is voor dit account niet beschikbaar.',
};

/** Hele dagen tussen twee momenten. */
export function dagenSinds(vanaf: string | Date, nu: Date = new Date()): number {
  const t = new Date(vanaf).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((nu.getTime() - t) / 86_400_000);
}

/** Hoogste stap die nu aan de beurt is en nog niet gedaan, of null. */
export function volgendeDoorloopStap(
  b: { created_at: string; doorloop_stap?: number | null },
  nu: Date = new Date(),
): (typeof DOORLOOP_STAPPEN)[number] | null {
  const dagen = dagenSinds(b.created_at, nu);
  const gedaan = b.doorloop_stap ?? 0;
  const open = DOORLOOP_STAPPEN.filter(s => s.dag <= dagen && s.stap > gedaan);
  return open.length > 0 ? open[open.length - 1] : null;
}

/** Datum waarop een doorloopfactuur betaald moet zijn. */
export function betaalUiterlijk(aangemaakt: string | Date): Date {
  return new Date(new Date(aangemaakt).getTime() + BETAALTERMIJN_DAGEN * 86_400_000);
}

/**
 * Wanneer mag de doorloop starten? Bij een aankondiging vooraf (90%) meteen
 * bij 100%. Kwam de aankondiging pas bij of na 100% (later aangezet), dan
 * krijgt de klant eerst een dag om te stoppen.
 */
export function magStarten(
  b: { doorloop_aangekondigd_op?: string | null; completed_at?: string | null },
  nu: Date = new Date(),
): boolean {
  if (!b.doorloop_aangekondigd_op) return false;
  const aangekondigd = new Date(b.doorloop_aangekondigd_op).getTime();
  const klaar = b.completed_at ? new Date(b.completed_at).getTime() : Number.POSITIVE_INFINITY;
  if (aangekondigd < klaar) return true;
  return nu.getTime() - aangekondigd >= WACHT_NA_LATE_AANKONDIGING_UUR * 3_600_000;
}
