import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Persoonlijke link waarmee een lead zijn eigen afspraak kan bevestigen,
 * verzetten of afzeggen.
 *
 * Geen inlog, want een consument gaat geen account maken voor één afspraak.
 * De link bevat een HMAC over het afspraak-id, zodat er niets hoeft te worden
 * opgeslagen en hij niet te raden is. Het token hangt aan de afspraak, dus bij
 * verzetten krijgt de opvolger vanzelf een nieuwe link.
 */

function sleutel(): string {
  const s = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Geen servergeheim beschikbaar voor afspraaktokens');
  return s;
}

export function maakLeadToken(appointmentId: string): string {
  return createHmac('sha256', sleutel())
    .update(`lead-afspraak:${appointmentId}`)
    .digest('hex')
    .slice(0, 32);
}

export function controleerLeadToken(appointmentId: string, token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const verwacht = maakLeadToken(appointmentId);
  if (token.length !== verwacht.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(verwacht));
}

export function leadAfspraakUrl(appointmentId: string, siteUrl?: string): string {
  const basis = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  return `${basis}/afspraak/${appointmentId}?t=${maakLeadToken(appointmentId)}`;
}

/**
 * Of de lead nog iets met zijn afspraak mag doen.
 *
 * Na afloop heeft reageren geen zin meer, en een al afgeboekte afspraak
 * terugzetten via een oude link uit een mailbox zou de administratie van de
 * klant overschrijven.
 */
export function leadMagNogReageren(
  afspraak: { status: string; starts_at: string },
  nu: Date = new Date(),
): boolean {
  if (afspraak.status !== 'scheduled') return false;
  const start = new Date(afspraak.starts_at);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() > nu.getTime();
}
