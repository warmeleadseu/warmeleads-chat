import type { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

/** Minstens één betaalde `customer_batches`-rij (leadbatch, bulk, niche, …). */
export async function getHasPaidCustomerBatch(supabase: Supabase, customerId: string): Promise<boolean> {
  const { count } = await supabase
    .from('customer_batches')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_paid', true);
  return (count ?? 0) > 0;
}

/**
 * Portaal toont alleen demo (template)leads totdat de klant minstens één batch heeft betaald.
 * Onafhankelijk van signup_source / demo_mode-kolom — voorkomt dat CRM-aangemaakte portalen echte leads tonen vóór betaling.
 */
export function shouldUseDemoPortalExperience({
  hasPaidCustomerBatch,
}: {
  signup_source?: string | null;
  demo_mode?: boolean | null;
  hasPaidCustomerBatch: boolean;
}): boolean {
  if (hasPaidCustomerBatch) return false;
  return true;
}
