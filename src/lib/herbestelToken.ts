import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Persoonlijke link om een batch met één klik opnieuw te bestellen, zonder in
 * te loggen.
 *
 * Aanleiding (27 okt 2026): de herbestelmails bij 80% en 100% stuurden naar het
 * portaal, maar 52 van de 87 klanten waren daar 30+ dagen niet ingelogd, en de
 * helft van de afgeronde batches kreeg geen vervolg.
 *
 * De link bevat een HMAC over batch-id en vervaldag, dus er hoeft niets te
 * worden opgeslagen en hij is niet te raden. Hij werkt alleen voor die ene
 * batch (en dus die klant en die voorwaarden) en verloopt na 14 dagen. Wie de
 * link heeft kan alleen een bestelling starten die hij zelf moet betalen.
 */

export const HERBESTEL_GELDIG_DAGEN = 14;

/** Waar de link vandaan kwam, voor de meting. Geen onderdeel van de handtekening. */
export type HerbestelBron = '80' | '100' | 'herinnering' | 'verlopen' | 'resultaat';
const BRONNEN: HerbestelBron[] = ['80', '100', 'herinnering', 'verlopen', 'resultaat'];

function sleutel(): string {
  const s = process.env.HERBESTEL_TOKEN_SECRET || oudeSleutel();
  if (!s) throw new Error('Geen servergeheim beschikbaar voor herbestellinks');
  return s;
}

function oudeSleutel(): string | undefined {
  return process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Overgang (28 okt 2026): tot HERBESTEL_TOKEN_SECRET bestond, werden links met
 * het cron-geheim ondertekend. Die blijven geldig tot hun eigen vervaldag; een
 * link die later vervalt kan nooit met de oude sleutel zijn gemaakt. Na 11 nov
 * 2026 is dit overbodig en mag het weg.
 */
export const OUDE_SLEUTEL_TOT_DAG = 20768;

function hmac(sleutelWaarde: string, batchId: string, tot: number): string {
  return createHmac('sha256', sleutelWaarde).update(`herbestel:${batchId}:${tot}`).digest('hex').slice(0, 32);
}

function gelijk(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Vervaldag als hele dagen sinds 1970, zodat de link kort blijft. */
export function vervaldag(nu: Date = new Date()): number {
  return Math.floor(nu.getTime() / 86_400_000) + HERBESTEL_GELDIG_DAGEN;
}

export function maakHerbestelToken(batchId: string, tot: number): string {
  return hmac(sleutel(), batchId, tot);
}

export type TokenUitslag = 'ok' | 'ongeldig' | 'verlopen';

export function controleerHerbestelToken(batchId: string, tot: unknown, token: unknown, nu: Date = new Date()): TokenUitslag {
  const dag = typeof tot === 'string' ? Number(tot) : typeof tot === 'number' ? tot : NaN;
  if (!Number.isInteger(dag) || typeof token !== 'string' || !token) return 'ongeldig';
  let geldig = gelijk(token, maakHerbestelToken(batchId, dag));
  const oud = oudeSleutel();
  if (!geldig && process.env.HERBESTEL_TOKEN_SECRET && oud && dag <= OUDE_SLEUTEL_TOT_DAG) {
    geldig = gelijk(token, hmac(oud, batchId, dag));
  }
  if (!geldig) return 'ongeldig';
  if (Math.floor(nu.getTime() / 86_400_000) > dag) return 'verlopen';
  return 'ok';
}

export function leesBron(v: unknown): HerbestelBron | null {
  return typeof v === 'string' && (BRONNEN as string[]).includes(v) ? (v as HerbestelBron) : null;
}

export function herbestelUrl(batchId: string, bron: HerbestelBron, opts?: { siteUrl?: string; nu?: Date }): string {
  const basis = opts?.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  const tot = vervaldag(opts?.nu);
  return `${basis}/herbestellen/${batchId}?v=${tot}&t=${maakHerbestelToken(batchId, tot)}&b=${bron}`;
}
