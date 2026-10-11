import type { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

/**
 * Brede check: klant is "echt" zodra:
 *  - er minstens één **betaalde** `customer_batches`-rij is (lead, bulk, niche, ...), **of**
 *  - er minstens één **betaalde** `appointment_batches`-rij is (afspraken), **of**
 *  - er minstens één **non-demo lead_assignments**-rij is (bulk-export, distributie, hand-toewijzing).
 *
 * Afspraakbatches telden tot 11 okt 2026 niet mee: een klant die alleen
 * afspraken kocht (zoals RJ CV Optimalisatie) bleef na betaling in het
 * demoportaal hangen.
 *
 * Dit voorkomt dat klanten met al verkochte/uitgedeelde leads opnieuw in het demoportaal vallen
 * wanneer `customer_batches.is_paid` om wat voor reden dan ook niet (meer) waar is.
 */
export async function getHasPaidCustomerBatch(supabase: Supabase, customerId: string): Promise<boolean> {
  const [paidBatchRes, paidAppointmentRes, realAssignRes] = await Promise.all([
    supabase
      .from('customer_batches')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('is_paid', true),
    supabase
      .from('appointment_batches')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('is_paid', true),
    supabase
      .from('lead_assignments')
      .select('lead_id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .neq('source', 'demo'),
  ]);
  if ((paidBatchRes.count ?? 0) > 0) return true;
  if ((paidAppointmentRes.count ?? 0) > 0) return true;
  if ((realAssignRes.count ?? 0) > 0) return true;
  return false;
}

/**
 * Portaal toont alleen demo (template)leads totdat de klant minstens één batch heeft betaald
 * óf minstens één echte lead heeft (zie `getHasPaidCustomerBatch`).
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
