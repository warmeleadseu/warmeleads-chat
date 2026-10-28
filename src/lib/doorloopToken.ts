import { handtekeningKlopt, serverHandtekening } from './herbestelToken';

/**
 * Link om doorlopend op factuur uit te zetten zonder in te loggen (in elke
 * mail over doorlopen). Hij werkt alleen voor die ene klant en verloopt na
 * 60 dagen; wie hem heeft kan alleen stoppen, niets aanzetten of bestellen.
 */

export const STOPLINK_GELDIG_DAGEN = 60;

function dag(nu: Date): number {
  return Math.floor(nu.getTime() / 86_400_000);
}

export function maakStopToken(customerId: string, tot: number): string {
  return serverHandtekening(`doorlopen-stop:${customerId}:${tot}`);
}

export function controleerStopToken(customerId: string, tot: unknown, token: unknown, nu: Date = new Date()): 'ok' | 'ongeldig' | 'verlopen' {
  const d = typeof tot === 'string' ? Number(tot) : typeof tot === 'number' ? tot : NaN;
  if (!customerId || !Number.isInteger(d)) return 'ongeldig';
  if (!handtekeningKlopt(token, maakStopToken(customerId, d))) return 'ongeldig';
  return dag(nu) > d ? 'verlopen' : 'ok';
}

export function doorloopStopUrl(customerId: string, opts?: { siteUrl?: string; nu?: Date }): string {
  const basis = opts?.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  const tot = dag(opts?.nu ?? new Date()) + STOPLINK_GELDIG_DAGEN;
  return `${basis}/doorlopen/stoppen?k=${customerId}&v=${tot}&t=${maakStopToken(customerId, tot)}`;
}
