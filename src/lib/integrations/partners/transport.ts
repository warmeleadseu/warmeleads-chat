import { assertPublicHttpUrl } from '@/lib/ssrfGuard';
import type { PartnerAntwoord } from './types';

/** Meer lezen we niet uit een antwoord; we bewaren er hooguit een kort stukje van. */
const MAX_ANTWOORD_BYTES = 64_000;

/**
 * Eén POST naar een partner. Gooit nooit: de partnerdefinitie beslist wat een
 * antwoord betekent (beoordeel), deze functie meldt alleen wat er gebeurde.
 *
 * Geen Authorization-header: bij partners als Snelraak zit het geheim in de URL.
 * Redirects volgen we niet, zodat een publiek adres ons nooit naar een intern
 * adres kan omleiden.
 */
export async function verstuurNaarPartner(
  url: string,
  payload: unknown,
  opties: { timeoutMs: number; idempotencyKey?: string | null },
): Promise<PartnerAntwoord> {
  const leeg: PartnerAntwoord = { status: 0, body: '', timeout: false, netwerkfout: true, retryAfter: null };

  const guard = await assertPublicHttpUrl(url);
  if (!guard.ok) return { ...leeg, body: 'adres geweigerd door beveiliging' };

  const controller = new AbortController();
  const klok = setTimeout(() => controller.abort(), opties.timeoutMs);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opties.idempotencyKey) headers['Idempotency-Key'] = opties.idempotencyKey;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'manual',
    });
    let body = '';
    try {
      body = (await res.text()).slice(0, MAX_ANTWOORD_BYTES);
    } catch {
      /* antwoord niet leesbaar: de status zegt genoeg */
    }
    return { status: res.status, body, timeout: false, netwerkfout: false, retryAfter: res.headers.get('retry-after') };
  } catch (err) {
    const afgebroken = (err as { name?: string } | null)?.name === 'AbortError';
    /* Bewust geen err.message doorgeven: een netwerkfout kan de URL bevatten. */
    return { ...leeg, timeout: afgebroken, netwerkfout: !afgebroken };
  } finally {
    clearTimeout(klok);
  }
}
