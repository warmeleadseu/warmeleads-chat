import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getPreferredCrmProvider,
  resolveEffectiveCrmProvider,
} from '@/lib/integrations/crmPreferences';
import { getGoogleSheetsIntegrationPublic } from '@/lib/googleSheets/integrationRepo';
import { hasSavedSheetMappings } from '@/lib/googleSheets/fieldMappingLogic';
import { GOOGLE_SHEETS_PROVIDER } from '@/lib/googleSheets/types';
import { getTeamleaderIntegration } from '@/lib/teamleader/integrationRepo';
import { TEAMLEADER_PROVIDER } from '@/lib/teamleader/types';
import { isOutboundWebhookReadyForCustomer } from '@/lib/integrations/outboundWebhook/integrationRepo';
import { OUTBOUND_WEBHOOK_PROVIDER } from '@/lib/integrations/outboundWebhook/types';

export type IntegrationSyncTargets = {
  teamleader: boolean;
  google_sheets: boolean;
};

export function isTeamleaderSyncReady(
  integration: Awaited<ReturnType<typeof getTeamleaderIntegration>>,
): boolean {
  if (!integration?.connected_at) return false;
  if (integration.settings.enabled === false) return false;
  return Boolean(integration.settings.pipeline_id);
}

export function isGoogleSheetsSyncReady(
  integration: Awaited<ReturnType<typeof getGoogleSheetsIntegrationPublic>>,
  customerBranches: string[],
): boolean {
  if (!integration?.connected_at) return false;
  if (integration.settings.enabled === false) return false;
  const spreadsheetOk = Boolean(
    integration.settings.spreadsheet_id && integration.settings.sheet_name,
  );
  if (!spreadsheetOk) return false;
  return hasSavedSheetMappings(integration.settings.field_mappings, customerBranches);
}

/** Pure helper — gebruikt door resolveIntegrationSyncTargets en tests. */
export function resolveIntegrationSyncTargetsFromState(args: {
  preferredStored: string | null;
  teamleaderConnected: boolean;
  sheetsConnected: boolean;
  tlReady: boolean;
  gsReady: boolean;
}): IntegrationSyncTargets {
  const effective = resolveEffectiveCrmProvider(
    args.preferredStored,
    args.teamleaderConnected,
    args.sheetsConnected,
  );

  if (effective === TEAMLEADER_PROVIDER) {
    return { teamleader: args.tlReady, google_sheets: false };
  }
  if (effective === GOOGLE_SHEETS_PROVIDER) {
    return { teamleader: false, google_sheets: args.gsReady };
  }

  if (args.tlReady && !args.gsReady) return { teamleader: true, google_sheets: false };
  if (args.gsReady && !args.tlReady) return { teamleader: false, google_sheets: true };

  return { teamleader: false, google_sheets: false };
}

/**
 * Bepaalt welke CRM-sync(s) na leadtoewijzing mogen draaien.
 * Respecteert `preferred_crm_provider`; voorkomt dubbele export naar Teamleader én Sheets.
 */
export async function resolveIntegrationSyncTargets(
  supabase: SupabaseClient,
  customerId: string,
  customerBranches: string[] = [],
): Promise<IntegrationSyncTargets> {
  const [preferred, teamleaderIntegration, sheetsIntegration] = await Promise.all([
    getPreferredCrmProvider(supabase, customerId),
    getTeamleaderIntegration(supabase, customerId),
    getGoogleSheetsIntegrationPublic(supabase, customerId),
  ]);

  const tlReady = isTeamleaderSyncReady(teamleaderIntegration);
  const gsReady = isGoogleSheetsSyncReady(sheetsIntegration, customerBranches);

  return resolveIntegrationSyncTargetsFromState({
    preferredStored: preferred,
    teamleaderConnected: Boolean(teamleaderIntegration?.connected_at),
    sheetsConnected: Boolean(sheetsIntegration?.connected_at),
    tlReady,
    gsReady,
  });
}

/** Of een mislukte sync-log voor deze provider opnieuw geprobeerd mag worden. */
export async function shouldRetryIntegrationSync(
  supabase: SupabaseClient,
  customerId: string,
  provider: string,
  customerBranches: string[] = [],
): Promise<boolean> {
  if (provider === OUTBOUND_WEBHOOK_PROVIDER) {
    return isOutboundWebhookReadyForCustomer(supabase, customerId);
  }
  const targets = await resolveIntegrationSyncTargets(supabase, customerId, customerBranches);
  if (provider === TEAMLEADER_PROVIDER) return targets.teamleader;
  if (provider === GOOGLE_SHEETS_PROVIDER) return targets.google_sheets;
  return false;
}
