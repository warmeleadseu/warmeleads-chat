import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  ensureValidAccessToken,
  getTeamleaderIntegration,
  resolvePhaseIdForPipeline,
} from '@/lib/teamleader/integrationRepo';
import { syncLeadRecordToTeamleader } from '@/lib/teamleader/syncLeadRecord';
import { buildTeamleaderTestLead, pickTestBranchSlug } from '@/lib/teamleader/testLead';

async function getBranchFieldKeys(
  supabase: ReturnType<typeof createServerClient>,
  branchSlug: string,
): Promise<string[]> {
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('slug', branchSlug)
    .maybeSingle();
  if (!branch?.id) return [];
  const { data: fields } = await supabase
    .from('branch_fields')
    .select('key')
    .eq('branch_id', branch.id)
    .order('sort_order', { ascending: true });
  return (fields || []).map((f) => f.key as string);
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const integration = await getTeamleaderIntegration(supabase, session.customer.id);
  if (!integration?.settings.pipeline_id) {
    return NextResponse.json(
      { error: 'Kies en bewaar eerst een pipeline.' },
      { status: 400 },
    );
  }

  try {
    const accessToken = await ensureValidAccessToken(supabase, integration);
    const phaseId = await resolvePhaseIdForPipeline(
      supabase,
      integration,
      accessToken,
      integration.settings.pipeline_id,
    );
    if (!phaseId) {
      return NextResponse.json(
        { error: 'Geen deal-fase gevonden voor deze pipeline.' },
        { status: 400 },
      );
    }

    const branchSlug = pickTestBranchSlug(session.customer.branches);
    const branchFieldKeys = await getBranchFieldKeys(supabase, branchSlug);
    const testLead = buildTeamleaderTestLead(branchSlug, session.customer.id, branchFieldKeys);

    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const assignmentId = `test-${session.customer.id}`;
    const leadId = testLead.id || assignmentId;

    const { contactId, dealId, branchName } = await syncLeadRecordToTeamleader({
      supabase,
      accessToken,
      pipelineId: integration.settings.pipeline_id,
      phaseId,
      settings: integration.settings,
      lead: testLead,
      assignmentId,
      leadId,
      dealTitlePrefix: `[TEST ${stamp}] `,
      summaryPreamble:
        'Testdeal aangemaakt vanuit het Warme Leads portaal om de Teamleader-koppeling te verifiëren. Je kunt deze deal en bijbehorend contact veilig verwijderen.\n\n',
    });

    return NextResponse.json({
      ok: true,
      branch: branchSlug,
      branch_name: branchName,
      teamleader_contact_id: contactId,
      teamleader_deal_id: dealId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Test mislukt';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
