import { adminFetch } from '@/lib/adminAuth';

/** Prefix voor de eenmalige, same-origin overdracht van het impersonatie-token via localStorage. */
export const IMPERSONATION_HANDOFF_PREFIX = 'wl_imp_handoff_';
/** Overdracht is maar heel kort geldig; de nieuwe tab leest en wist hem meteen. */
export const IMPERSONATION_HANDOFF_TTL_MS = 60_000;

function randomRef(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Opent het klantportaal in een nieuw tabblad via admin-impersonate.
 *
 * Het (gevoelige) JWT staat NIET meer in de URL. In plaats daarvan schrijven we
 * het eenmalig naar localStorage onder een willekeurige ref; de URL bevat enkel
 * die opake ref. De portaal-tab leest de ref, wist de entry direct (one-time)
 * en wisselt het token in voor een sessie.
 */
export async function openCustomerPortalAsAdmin(
  customerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await adminFetch('/api/admin/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_id: customerId }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
  if (!res.ok) {
    return { ok: false, error: data.error || 'Portaal openen mislukt' };
  }
  if (!data.token) {
    return { ok: false, error: 'Geen token ontvangen' };
  }

  const ref = randomRef();
  try {
    localStorage.setItem(
      `${IMPERSONATION_HANDOFF_PREFIX}${ref}`,
      JSON.stringify({ token: data.token, ts: Date.now() }),
    );
  } catch {
    return { ok: false, error: 'Kon impersonatie niet voorbereiden (opslag geblokkeerd)' };
  }

  window.open(`/portal?imp_ref=${encodeURIComponent(ref)}`, '_blank', 'noopener,noreferrer');
  return { ok: true };
}
