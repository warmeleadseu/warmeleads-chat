import { handtekeningKlopt, serverHandtekening } from './herbestelToken';

/**
 * Persoonlijke betaallink voor één openstaande factuur, zonder in te loggen.
 *
 * Aanleiding (11 nov 2026): de mails bevatten een Mollie-link die op het moment
 * van versturen werd aangemaakt. Betaalt de klant pas later, dan is die
 * betaling bij Mollie verlopen en bleef alleen de portaalknop over (inloggen).
 * Wie wel meteen betaalde, kwam daarna ook op het inlogscherm uit.
 *
 * Deze link maakt bij elke klik zo nodig een verse Mollie-betaling en stuurt
 * na betalen naar een eigen bedankpagina. De handtekening is een HMAC over het
 * factuur-id: niets op te slaan, niet te raden, en alleen geldig voor die ene
 * factuur. Wie de link heeft, kan alleen die factuur betalen. Hij verloopt niet;
 * zodra de factuur betaald of vervallen is, ziet de klant dat.
 */

const basis = (siteUrl?: string) =>
  (siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu').replace(/\/$/, '');

export function factuurBetaalToken(invoiceId: string): string {
  return serverHandtekening(`betaal:${invoiceId}`);
}

export function factuurBetaalTokenKlopt(invoiceId: string, token: unknown): boolean {
  if (typeof token !== 'string' || !token) return false;
  return handtekeningKlopt(token, factuurBetaalToken(invoiceId));
}

/** De link in de mail: opent (zo nodig) een verse betaling en stuurt door naar Mollie. */
export function factuurBetaalUrl(invoiceId: string, siteUrl?: string): string {
  return `${basis(siteUrl)}/betalen/${invoiceId}?t=${factuurBetaalToken(invoiceId)}`;
}

/** Waar Mollie de klant na het betalen heen stuurt. */
export function factuurBedankUrl(invoiceId: string, siteUrl?: string): string {
  return `${basis(siteUrl)}/betalen/${invoiceId}/klaar?t=${factuurBetaalToken(invoiceId)}`;
}
