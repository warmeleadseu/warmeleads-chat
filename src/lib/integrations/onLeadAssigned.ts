import { createServerClient } from '@/lib/supabase';
import { resolveIntegrationSyncTargets } from '@/lib/integrations/syncRouting';
import { syncAssignmentToGoogleSheets } from '@/lib/googleSheets/syncAssignment';
import { syncAssignmentToTeamleader } from '@/lib/teamleader/syncAssignment';
import { isOutboundWebhookReadyForCustomer } from '@/lib/integrations/outboundWebhook/integrationRepo';
import { syncAssignmentToOutboundWebhook } from '@/lib/integrations/outboundWebhook/syncAssignment';

export function onLeadAssignedToCustomer(args: {
  customerId: string;
  leadId: string;
  assignmentId: string;
}): void {
  void runIntegrationSyncs(args).catch((err) => {
    console.error('[integrations] sync routing failed', {
      customerId: args.customerId,
      assignmentId: args.assignmentId,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

async function runIntegrationSyncs(args: {
  customerId: string;
  leadId: string;
  assignmentId: string;
}): Promise<void> {
  const supabase = createServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('branches')
    .eq('id', args.customerId)
    .maybeSingle();

  const branches = (customer?.branches as string[] | null) ?? [];
  const targets = await resolveIntegrationSyncTargets(supabase, args.customerId, branches);

  if (targets.teamleader) {
    await syncAssignmentToTeamleader(args).catch((err) => {
      console.error('[teamleader] sync failed', {
        customerId: args.customerId,
        assignmentId: args.assignmentId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

  if (targets.google_sheets) {
    await syncAssignmentToGoogleSheets(args).catch((err) => {
      console.error('[google_sheets] sync failed', {
        customerId: args.customerId,
        assignmentId: args.assignmentId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Uitgaande webhook staat los van de CRM-keuze: vuurt altijd als ingesteld.
  if (await isOutboundWebhookReadyForCustomer(supabase, args.customerId)) {
    await syncAssignmentToOutboundWebhook(args).catch((err) => {
      console.error('[outbound_webhook] sync failed', {
        customerId: args.customerId,
        assignmentId: args.assignmentId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }
}
