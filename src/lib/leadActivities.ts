import type { SupabaseClient } from '@supabase/supabase-js';

export type LeadActivityInput = {
  leadId: string;
  customerId?: string | null;
  actorType: 'admin' | 'portal_user' | 'system' | 'cron';
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  details?: Record<string, unknown>;
};

/** Insert a CRM timeline entry (non-blocking on failure). */
export async function logLeadActivity(
  supabase: SupabaseClient,
  input: LeadActivityInput,
): Promise<void> {
  try {
    await supabase.from('lead_activities').insert({
      lead_id: input.leadId,
      customer_id: input.customerId ?? null,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
      action: input.action,
      details: input.details ?? {},
    });
  } catch (err) {
    console.error('[logLeadActivity]', err);
  }
}
