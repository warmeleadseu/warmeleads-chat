/**
 * Terugbellen voor accountmanagers (migratie 203), puur en te testen.
 *
 * Een terugbelafspraak met een prospect is een belttaak met een tijdstip en een
 * seintje vooraf (5 of 15 minuten). Wie de taak toegewezen heeft, krijgt in het
 * admin-paneel een pop-up en, als die aanstaat, een pushmelding. De pop-up
 * blijft tot 30 minuten na het tijdstip komen; daarna staat de taak gewoon bij
 * de verlopen taken.
 */

export const SEINTJE_KEUZES = [5, 15] as const;
export type SeintjeMin = (typeof SEINTJE_KEUZES)[number];
export const STANDAARD_SEINTJE: SeintjeMin = 5;
/** Zo lang na het tijdstip blijft de pop-up komen. */
export const POPUP_TOT_MIN = 30;
export const MAX_SEINTJE_MIN = Math.max(...SEINTJE_KEUZES);
export const TERUGBEL_TITEL = 'Terugbellen';

const MIN = 60_000;

export type ProspectTerugbelmoment = {
  id: string;
  prospect_id: string;
  title: string;
  description: string | null;
  due_at: string;
  seintje_min: SeintjeMin;
  bedrijf: string;
  contact: string | null;
  telefoon: string | null;
  plaats: string | null;
};

/** 5 of 15; al het andere betekent geen seintje. */
export function leesSeintje(v: unknown): SeintjeMin | null {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return (SEINTJE_KEUZES as readonly unknown[]).includes(n) ? (n as SeintjeMin) : null;
}

export type ProspectPopupFase = 'vooraf' | 'nu';

/** Moet de pop-up nu in beeld, en in welke vorm? */
export function prospectPopupFase(m: { due_at: string; seintje_min: number }, nu: number): ProspectPopupFase | null {
  const na = (nu - Date.parse(m.due_at)) / MIN;
  if (!Number.isFinite(na) || na < -m.seintje_min) return null;
  if (na < 0) return 'vooraf';
  return na <= POPUP_TOT_MIN ? 'nu' : null;
}

/** Is het tijd voor de pushmelding? Eén keer, vanaf het seintje tot het einde van de pop-up. */
export function seintjeNu(m: { due_at: string; seintje_min: number }, nu: Date): boolean {
  return prospectPopupFase(m, nu.getTime()) !== null;
}

/** Kolommen van migratie 203 bestaan nog niet: dan zonder seintje opslaan. */
export function seintjeKolomOntbreekt(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204') && /seintje_min|herinnerd_op/.test(error.message ?? '');
}

/** Dezelfde wijziging zonder de seintje-velden. */
export function zonderSeintje<T extends Record<string, unknown>>(rij: T): Omit<T, 'seintje_min' | 'herinnerd_op'> {
  const { seintje_min: _s, herinnerd_op: _h, ...rest } = rij;
  void _s; void _h;
  return rest;
}

/** Verschuift het tijdstip, dan komt het seintje opnieuw. */
export function taakWijzigingen(body: { due_at?: unknown; seintje_min?: unknown }, huidig: { due_at: string | null }): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  if ('seintje_min' in body) uit.seintje_min = leesSeintje(body.seintje_min);
  if ('due_at' in body) {
    const nieuw = typeof body.due_at === 'string' && body.due_at ? body.due_at : null;
    const verschoven = nieuw === null || huidig.due_at === null || Date.parse(nieuw) !== Date.parse(huidig.due_at);
    if (verschoven || 'seintje_min' in body) uit.herinnerd_op = null;
  } else if ('seintje_min' in body) {
    uit.herinnerd_op = null;
  }
  return uit;
}
