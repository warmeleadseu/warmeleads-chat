import type { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

/** Klant gebruikt demo-leads zolang er nog geen betaalde customer_batch is én het account daarvoor in aanmerking komt. */
export async function getHasPaidCustomerBatch(supabase: Supabase, customerId: string): Promise<boolean> {
  const { count } = await supabase
    .from('customer_batches')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_paid', true);
  return (count ?? 0) > 0;
}

export function shouldUseDemoPortalExperience(params: {
  signup_source: string | null | undefined;
  demo_mode: boolean | null | undefined;
  hasPaidCustomerBatch: boolean;
}): boolean {
  if (params.hasPaidCustomerBatch) return false;
  return params.signup_source === 'website' || params.demo_mode === true;
}
