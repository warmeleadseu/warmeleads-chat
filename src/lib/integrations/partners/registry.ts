import { SNELRAAK } from './snelraak';
import type { PartnerDefinitie } from './types';

/**
 * Alle partnerkoppelingen. Een nieuwe partner is één definitie hier; het
 * portaal, de admin, de levering en de retry-cron pakken hem vanzelf op.
 */
export const PARTNERS: PartnerDefinitie[] = [SNELRAAK];

export function partnerOpId(id: string): PartnerDefinitie | null {
  return PARTNERS.find(p => p.id === id) ?? null;
}

export function partnerOpProvider(provider: string): PartnerDefinitie | null {
  return PARTNERS.find(p => p.provider === provider) ?? null;
}

export const PARTNER_PROVIDERS: string[] = PARTNERS.map(p => p.provider);

export function isPartnerProvider(provider: string): boolean {
  return PARTNER_PROVIDERS.includes(provider);
}
