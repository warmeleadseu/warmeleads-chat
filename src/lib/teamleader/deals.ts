import { teamleaderRequest } from './client';
import type { TlCustomFieldPayload } from './fieldMappingLogic';
import type { TeamleaderPipeline } from './types';

export async function listDealPipelines(accessToken: string): Promise<TeamleaderPipeline[]> {
  const data = await teamleaderRequest<Array<{ id: string; name: string; is_default?: boolean }>>(
    accessToken,
    'dealPipelines.list',
    { page: { size: 100, number: 1 } },
  );
  const list = Array.isArray(data) ? data : [];
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.is_default,
  }));
}

/** First phase of pipeline (for deals.create phase_id). */
export async function getFirstPhaseId(
  accessToken: string,
  pipelineId: string,
): Promise<string | null> {
  const data = await teamleaderRequest<Array<{ id: string; order?: number }>>(
    accessToken,
    'dealPhases.list',
    {
      filter: { deal_pipeline_id: pipelineId },
      page: { size: 50, number: 1 },
    },
  );
  const phases = Array.isArray(data) ? data : [];
  if (phases.length === 0) return null;
  const sorted = [...phases].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted[0]?.id ?? null;
}

export async function createDeal(
  accessToken: string,
  args: {
    contactId: string;
    title: string;
    summary: string;
    phaseId: string;
    customFields?: TlCustomFieldPayload[];
  },
): Promise<string> {
  const body: Record<string, unknown> = {
    title: args.title,
    summary: args.summary,
    phase_id: args.phaseId,
    lead: {
      customer: {
        type: 'contact',
        id: args.contactId,
      },
    },
  };
  if (args.customFields?.length) {
    body.custom_fields = args.customFields;
  }

  const created = await teamleaderRequest<{ id: string }>(accessToken, 'deals.create', body);
  if (!created?.id) throw new Error('deals.create returned no id');
  return created.id;
}
