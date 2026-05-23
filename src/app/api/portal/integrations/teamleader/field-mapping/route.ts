import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { listGroupedCustomFieldDefinitions } from '@/lib/teamleader/customFieldDefinitions';
import {
  branchMappingIsEmpty,
  getPortalFieldsForBranch,
  hasSavedFieldMappings,
  mergeMappings,
  suggestDefaultFieldMapping,
  suggestFieldMapping,
  type BranchFieldMapping,
  type TeamleaderFieldMappings,
} from '@/lib/teamleader/fieldMappingLogic';
import {
  ensureValidAccessToken,
  getTeamleaderIntegration,
  updateTeamleaderSettings,
} from '@/lib/teamleader/integrationRepo';
import { FIELD_MAP_NATIVE } from '@/lib/teamleader/standardFields';

async function loadCustomerBranches(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
): Promise<string[]> {
  const { data } = await supabase.from('customers').select('branches').eq('id', customerId).single();
  return (data?.branches as string[] | null) ?? [];
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const integration = await getTeamleaderIntegration(supabase, session.customer.id);
  if (!integration) {
    return NextResponse.json({ error: 'Teamleader niet gekoppeld' }, { status: 400 });
  }

  const suggest = request.nextUrl.searchParams.get('suggest') === '1';
  const branchFilter = request.nextUrl.searchParams.get('branch');

  let accessToken: string;
  try {
    accessToken = await ensureValidAccessToken(supabase, integration);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kon Teamleader niet bereiken';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const customerBranches = await loadCustomerBranches(supabase, session.customer.id);

  let tlContact: Awaited<
    ReturnType<typeof listGroupedCustomFieldDefinitions>
  >['contact'] = [];
  let tlDeal: Awaited<ReturnType<typeof listGroupedCustomFieldDefinitions>>['deal'] = [];
  let teamleaderFieldsWarning: string | null = null;
  try {
    ({ contact: tlContact, deal: tlDeal } = await listGroupedCustomFieldDefinitions(accessToken));
  } catch (err) {
    teamleaderFieldsWarning =
      err instanceof Error ? err.message : 'Kon Teamleader-velden niet ophalen';
  }

  const slugs = branchFilter ? [branchFilter] : customerBranches;
  const { data: branchRows } = await supabase
    .from('branches')
    .select('id, slug, name, branch_fields(key, label, sort_order)')
    .in('slug', slugs.length > 0 ? slugs : ['__none__'])
    .eq('is_active', true);

  const savedMappings = integration.settings.field_mappings ?? {};

  const branchSlugs = (branchRows || []).map((b) => b.slug as string);
  const tlHasCustomFields = tlContact.length > 0 || tlDeal.length > 0;

  const branches = (branchRows || []).map((b) => {
    const fields = (b.branch_fields || [])
      .sort(
        (a: { sort_order: number }, c: { sort_order: number }) => a.sort_order - c.sort_order,
      )
      .map((f: { key: string; label: string }) => ({ key: f.key, label: f.label }));
    const portalFields = getPortalFieldsForBranch(fields);
    const saved = mergeMappings(savedMappings, b.slug);
    const useSuggest = suggest || branchMappingIsEmpty(saved);
    const mapping = useSuggest
      ? tlHasCustomFields
        ? suggestFieldMapping(portalFields, tlContact, tlDeal)
        : suggestDefaultFieldMapping(portalFields)
      : saved;
    return {
      slug: b.slug,
      name: b.name,
      portal_fields: portalFields,
      mapping,
      mapping_source: useSuggest && branchMappingIsEmpty(saved) ? 'suggested' : 'saved',
    };
  });

  return NextResponse.json({
    has_saved_mappings: hasSavedFieldMappings(savedMappings, branchSlugs),
    teamleader_fields_warning: teamleaderFieldsWarning,
    teamleader_fields: {
      contact: tlContact.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        options: f.options,
      })),
      deal: tlDeal.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        options: f.options,
      })),
    },
    branches,
  });
}

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json()) as {
    branch: string;
    mapping: BranchFieldMapping;
    field_mappings?: TeamleaderFieldMappings;
  };

  const supabase = createServerClient();
  const integration = await getTeamleaderIntegration(supabase, session.customer.id);
  if (!integration) {
    return NextResponse.json({ error: 'Teamleader niet gekoppeld' }, { status: 400 });
  }

  let nextMappings: TeamleaderFieldMappings = { ...(integration.settings.field_mappings ?? {}) };

  if (body.field_mappings) {
    nextMappings = body.field_mappings;
  } else if (body.branch && body.mapping) {
    const clean = (m: Record<string, string>) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(m)) {
        if (v && v !== FIELD_MAP_NATIVE) out[k] = v;
      }
      return out;
    };
    nextMappings[body.branch] = {
      contact: clean(body.mapping.contact ?? {}),
      deal: clean(body.mapping.deal ?? {}),
    };
  } else {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 });
  }

  const settings = await updateTeamleaderSettings(supabase, session.customer.id, {
    field_mappings: nextMappings,
  });

  return NextResponse.json({ settings: { field_mappings: settings.field_mappings } });
}
