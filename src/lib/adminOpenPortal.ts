import { adminFetch } from '@/lib/adminAuth';

/** Opent het klantportaal in een nieuw tabblad via admin-impersonate (zelfde als klantenbeheer / prospects). */
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
  window.open(`/portal?impersonate=${encodeURIComponent(data.token)}`, '_blank', 'noopener,noreferrer');
  return { ok: true };
}
