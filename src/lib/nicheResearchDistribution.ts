import type { SupabaseClient } from '@supabase/supabase-js';
import { syncBatchDelivered } from './batchSync';
import { sendLeadNotification } from './email';
import { sendNewLeadPush } from './pushNotification';
import { isInboundLeadBranchSlug } from './nicheResearch';

type NicheResearchBatch = {
  id: string;
  customer_id: string;
  batch_size: number;
  leads_delivered: number | null;
  starts_at: string | null;
  customers: { id: string; is_active: boolean; portal_active: boolean };
};

export type NicheResearchAssignment = {
  customer_id: string;
  batch_id: string;
};

/**
 * Wijs inbound leads toe aan actieve onderzoeksbatches op basis van `lead_branch_slug`.
 * Geen geo-targeting: alle geldige leads op die branche tellen mee voor het onderzoek.
 */
export async function tryAssignLeadToNicheResearchBatch(
  supabase: SupabaseClient,
  lead: {
    id: string;
    branch: string;
    phone_valid?: boolean | null;
    bron?: string | null;
  },
): Promise<NicheResearchAssignment | null> {
  if (!isInboundLeadBranchSlug(lead.branch)) return null;
  if (lead.bron === 'demo' || lead.bron === 'excel_import') return null;
  if (lead.phone_valid === false) return null;

  const { data: existing } = await supabase
    .from('lead_assignments')
    .select('customer_id')
    .eq('lead_id', lead.id);
  const assignedCustomerIds = new Set((existing || []).map((r) => r.customer_id));

  const { data: batches } = await supabase
    .from('customer_batches')
    .select(
      'id, customer_id, batch_size, leads_delivered, starts_at, customers!inner(id, is_active, portal_active)',
    )
    .eq('batch_kind', 'niche_research')
    .eq('lead_branch_slug', lead.branch)
    .eq('status', 'active')
    .neq('is_paid', false)
    .eq('customers.is_active', true)
    .order('created_at', { ascending: true });

  const list = (batches || []) as unknown as NicheResearchBatch[];
  if (list.length === 0) return null;

  const now = new Date();

  for (const batch of list) {
    if (assignedCustomerIds.has(batch.customer_id)) continue;
    if (batch.starts_at && new Date(batch.starts_at) > now) continue;

    const { data: inserted, error } = await supabase
      .from('lead_assignments')
      .insert({
        lead_id: lead.id,
        customer_id: batch.customer_id,
        batch_id: batch.id,
        distance_km: null,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') continue;
      console.error('[nicheResearch] assignment insert failed:', error.message);
      continue;
    }

    const { onLeadAssignedToCustomer } = await import('@/lib/integrations/onLeadAssigned');
    onLeadAssignedToCustomer({
      customerId: batch.customer_id,
      leadId: lead.id,
      assignmentId: inserted.id,
    });

    await syncBatchDelivered(supabase, batch.id);

    try {
      const { data: custData } = await supabase
        .from('customers')
        .select('id, name, email, contact_person, email_notifications')
        .eq('id', batch.customer_id)
        .single();
      if (custData) {
        const { data: leadData } = await supabase.from('leads').select('*').eq('id', lead.id).single();
        if (leadData) {
          if (custData.email && custData.email_notifications) {
            sendLeadNotification(custData, leadData);
          }
          sendNewLeadPush(custData.id, leadData).catch(() => {});
        }
      }
    } catch {
      /* notifications optional */
    }

    return { customer_id: batch.customer_id, batch_id: batch.id };
  }

  return null;
}
