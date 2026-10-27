/**
 * Betaalherinneringen voor onbetaalde batches: welke stap wanneer. Puur, dus
 * ook bruikbaar in het beheerscherm. Uitvoeren gebeurt in offerteVerloop.ts en
 * de cron betaalherinneringen.
 */

export type HerinnerSoort = 'mail' | 'bellen' | 'verlopen';
export type HerinnerStap = { stap: number; dag: number; soort: HerinnerSoort };

/** Dag 2, 5 en 10 een mail, dag 14 bellen, dag 21 verloopt het aanbod. */
export const HERINNER_STAPPEN: readonly HerinnerStap[] = [
  { stap: 1, dag: 2, soort: 'mail' },
  { stap: 2, dag: 5, soort: 'mail' },
  { stap: 3, dag: 10, soort: 'mail' },
  { stap: 4, dag: 14, soort: 'bellen' },
  { stap: 5, dag: 21, soort: 'verlopen' },
];

export const VERLOOP_DAGEN = 21;

type ReeksBatch = { created_at: string; herinnering_vanaf?: string | null; betaalherinnering_stap?: number | null };

/** Hele dagen sinds `vanaf`. */
export function dagenOud(vanaf: string, nu: Date = new Date()): number {
  const t = new Date(vanaf).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((nu.getTime() - t) / 86_400_000));
}

/**
 * De stap die nu aan de beurt is, of null. Alleen de hoogste stap die al
 * verstreken is en nog niet is gedaan: een batch die pas op dag 11 meedoet
 * krijgt één mail (die van dag 10), geen drie tegelijk.
 */
export function volgendeHerinnerStap(batch: ReeksBatch, nu: Date = new Date()): HerinnerStap | null {
  const oud = dagenOud(batch.herinnering_vanaf || batch.created_at, nu);
  const gedaan = batch.betaalherinnering_stap ?? 0;
  const verstreken = HERINNER_STAPPEN.filter(s => s.dag <= oud);
  const hoogste = verstreken[verstreken.length - 1];
  if (!hoogste || hoogste.stap <= gedaan) return null;
  return hoogste;
}

/** Voor het beheerscherm: wat is gedaan en wat komt er wanneer. */
export function herinnerOverzicht(batch: ReeksBatch): {
  gedaan: HerinnerStap | null;
  volgende: (HerinnerStap & { op: Date }) | null;
} {
  const gedaanNr = batch.betaalherinnering_stap ?? 0;
  const gedaan = HERINNER_STAPPEN.find(s => s.stap === gedaanNr) ?? null;
  const v = HERINNER_STAPPEN.find(s => s.stap > gedaanNr) ?? null;
  const basis = new Date(batch.herinnering_vanaf || batch.created_at).getTime();
  return { gedaan, volgende: v ? { ...v, op: new Date(basis + v.dag * 86_400_000) } : null };
}

export function stapOmschrijving(s: HerinnerStap): string {
  if (s.soort === 'mail') return `herinneringsmail ${s.stap} (dag ${s.dag})`;
  if (s.soort === 'bellen') return `belactie accountmanager (dag ${s.dag})`;
  return `aanbod verloopt (dag ${s.dag})`;
}
