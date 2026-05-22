import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrmProviderId } from './crmProviders';

/** Aparte rij in customer_integrations (geen OAuth-tokens). */
export const CRM_PREFERENCE_PROVIDER = 'crm_preference' as const;

type CrmPreferenceSettings = {
  preferred_crm_provider?: CrmProviderId | string | null;
};

export async function getPreferredCrmProvider(
  supabase: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('customer_integrations')
    .select('settings')
    .eq('customer_id', customerId)
    .eq('provider', CRM_PREFERENCE_PROVIDER)
    .maybeSingle();

  if (error || !data?.settings) return null;
  const settings = data.settings as CrmPreferenceSettings;
  const v = settings.preferred_crm_provider;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function setPreferredCrmProvider(
  supabase: SupabaseClient,
  customerId: string,
  providerId: CrmProviderId | string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('customer_integrations').upsert(
    {
      customer_id: customerId,
      provider: CRM_PREFERENCE_PROVIDER,
      settings: { preferred_crm_provider: providerId },
      updated_at: now,
    },
    { onConflict: 'customer_id,provider' },
  );
  if (error) throw new Error(error.message);
}
