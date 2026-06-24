import { createServerClient } from '@/lib/supabase';
import {
  getOutboundWebhookConfig,
  isBranchAllowed,
  isOutboundWebhookSyncReady,
} from './integrationRepo';
import { buildWebhookPayload } from './payload';
import { sendWebhookRequest } from './transport';
import { OUTBOUND_WEBHOOK_PROVIDER, type LeadForWebhook } from './types';

export type WebhookSyncArgs = {
  customerId: string;
  leadId: string;
  assignmentId: string;
  options?: { forceResend?: boolean };
};

/**
 * Stuurt 1 toegewezen lead naar de uitgaande webhook van de klant.
 * Idempotent per (assignment, provider) via integration_sync_log; faalt zacht
 * (logt status) maar gooit door zodat de cron-retry de attempts kan ophogen.
 */
export async function syncAssignmentToOutboundWebhook(args: WebhookSyncArgs): Promise<void> {
  const supabase = createServerClient();
  const { customerId, leadId, assignmentId } = args;

  const config = await getOutboundWebhookConfig(supabase, customerId);
  if (!isOutboundWebhookSyncReady(config)) return;

  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('id, customer_id, lead_id')
    .eq('id', assignmentId)
    .maybeSingle();
  if (!assignment || assignment.customer_id !== customerId || assignment.lead_id !== leadId) {
    return;
  }

  const { data: existingLog } = await supabase
    .from('integration_sync_log')
    .select('id, status, attempts')
    .eq('assignment_id', assignmentId)
    .eq('provider', OUTBOUND_WEBHOOK_PROVIDER)
    .maybeSingle();
  if (existingLog?.status === 'success' && !args.options?.forceResend) return;

  const { data: leadRow } = await supabase.from('leads').select('*').eq('id', leadId).single();
  const lead = leadRow as LeadForWebhook | null;
  if (!lead || lead.bron === 'demo') return;

  // Branche-filter: alleen branches die de klant in z'n webhook-config koos.
  if (!isBranchAllowed(config.settings, lead.branch)) return;

  const now = new Date().toISOString();
  const logPayload = {
    customer_id: customerId,
    lead_id: leadId,
    assignment_id: assignmentId,
    provider: OUTBOUND_WEBHOOK_PROVIDER,
    status: 'pending' as const,
    attempts: (existingLog?.attempts ?? 0) + 1,
    updated_at: now,
  };

  if (existingLog?.id) {
    await supabase.from('integration_sync_log').update(logPayload).eq('id', existingLog.id);
  } else {
    const { error: insErr } = await supabase
      .from('integration_sync_log')
      .insert({ ...logPayload, attempts: 1 });
    if (insErr?.code === '23505') return;
  }

  try {
    const payload = buildWebhookPayload(lead, assignmentId, config.settings.field_mappings);
    const res = await sendWebhookRequest(config.settings.url!, config.token, payload);
    if (!res.ok) {
      const detail = res.bodySnippet ? `: ${res.bodySnippet}` : '';
      throw new Error(`Webhook gaf HTTP ${res.status}${detail}`);
    }

    await supabase
      .from('integration_sync_log')
      .update({ status: 'success', error_message: null, updated_at: new Date().toISOString() })
      .eq('assignment_id', assignmentId)
      .eq('provider', OUTBOUND_WEBHOOK_PROVIDER);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook-aflevering mislukt';
    await supabase
      .from('integration_sync_log')
      .update({
        status: 'failed',
        error_message: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('assignment_id', assignmentId)
      .eq('provider', OUTBOUND_WEBHOOK_PROVIDER);
    throw err;
  }
}
