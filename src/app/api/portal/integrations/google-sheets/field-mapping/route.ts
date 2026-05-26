import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  getPortalFieldsForBranch,
  hasSavedSheetMappings,
  mergeSheetMappings,
  sheetMappingIsEmpty,
  suggestSheetColumnMapping,
} from '@/lib/googleSheets/fieldMappingLogic';
import type { GoogleSheetsFieldMappings, SheetBranchFieldMapping } from '@/lib/googleSheets/types';
import { ensureLatestSheetInSettings } from '@/lib/googleSheets/activeSheet';
import { resolveGoogleSheetsAccessToken } from '@/lib/googleSheets/access';
import {
  getGoogleSheetsIntegrationPublic,
  updateGoogleSheetsSettings,
} from '@/lib/googleSheets/integrationRepo';
import {
  columnIndexToLetter,
  fetchSheetHeaderColumns,
  quoteSheetName,
} from '@/lib/googleSheets/spreadsheet';
import { loadCustomerBranchSlugs, isCustomerBranch } from '@/lib/integrations/customerBranches';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const integration = await getGoogleSheetsIntegrationPublic(supabase, session.customer.id);
  if (!integration?.connected_at) {
    return NextResponse.json({ error: 'Stel eerst je spreadsheet in' }, { status: 400 });
  }

  const spreadsheetId = integration.settings.spreadsheet_id;
  if (!spreadsheetId) {
    return NextResponse.json(
      { error: 'Kies eerst een spreadsheet en werkblad' },
      { status: 400 },
    );
  }

  const suggest = request.nextUrl.searchParams.get('suggest') === '1';
  const branchFilter = request.nextUrl.searchParams.get('branch');

  let accessToken: string;
  let sheetName: string;
  let sheetColumns: Awaited<ReturnType<typeof fetchSheetHeaderColumns>>;
  try {
    accessToken = await resolveGoogleSheetsAccessToken(supabase, session.customer.id);
    sheetName = await ensureLatestSheetInSettings(
      supabase,
      session.customer.id,
      integration,
      accessToken,
    );
    sheetColumns = await fetchSheetHeaderColumns(
      accessToken,
      spreadsheetId,
      quoteSheetName(sheetName),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kon spreadsheet niet bereiken';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const customerBranches = await loadCustomerBranchSlugs(supabase, session.customer.id);
  const slugs = branchFilter ? [branchFilter] : customerBranches;

  const { data: branchRows } = await supabase
    .from('branches')
    .select('id, slug, name, branch_fields(key, label, sort_order)')
    .in('slug', slugs.length > 0 ? slugs : ['__none__'])
    .eq('is_active', true);

  const savedMappings = integration.settings.field_mappings ?? {};
  const branchSlugs = (branchRows || []).map((b) => b.slug as string);
  const hasColumns = sheetColumns.length > 0;

  const sheetFields = sheetColumns.map((c) => ({
    id: String(c.index),
    label: c.label,
    letter: c.letter,
    display: `${columnIndexToLetter(c.index)} — ${c.label}`,
  }));

  const branches = (branchRows || []).map((b) => {
    const fields = (b.branch_fields || [])
      .sort(
        (a: { sort_order: number }, c: { sort_order: number }) => a.sort_order - c.sort_order,
      )
      .map((f: { key: string; label: string }) => ({ key: f.key, label: f.label }));
    const portalFields = getPortalFieldsForBranch(fields);
    const saved = mergeSheetMappings(savedMappings, b.slug);
    const useSuggest = suggest || (sheetMappingIsEmpty(saved) && hasColumns);
    const mapping = useSuggest ? suggestSheetColumnMapping(portalFields, sheetColumns) : saved;
    return {
      slug: b.slug,
      name: b.name,
      portal_fields: portalFields,
      mapping,
      mapping_source: useSuggest && sheetMappingIsEmpty(saved) ? 'suggested' : 'saved',
    };
  });

  return NextResponse.json({
    has_saved_mappings: hasSavedSheetMappings(savedMappings, branchSlugs),
    sheet_columns: sheetFields,
    spreadsheet: {
      url: integration.settings.spreadsheet_url,
      sheet_name: sheetName,
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
    mapping: SheetBranchFieldMapping;
    field_mappings?: GoogleSheetsFieldMappings;
  };

  const supabase = createServerClient();
  const integration = await getGoogleSheetsIntegrationPublic(supabase, session.customer.id);
  if (!integration) {
    return NextResponse.json({ error: 'Stel eerst je spreadsheet in' }, { status: 400 });
  }

  let nextMappings: GoogleSheetsFieldMappings = {
    ...(integration.settings.field_mappings ?? {}),
  };

  if (body.field_mappings) {
    nextMappings = body.field_mappings;
  } else if (body.branch && body.mapping) {
    if (!(await isCustomerBranch(supabase, session.customer.id, body.branch))) {
      return NextResponse.json({ error: 'Ongeldige branche' }, { status: 400 });
    }
    const clean: SheetBranchFieldMapping = {};
    for (const [k, v] of Object.entries(body.mapping)) {
      if (v !== '' && v != null) clean[k] = v;
    }
    nextMappings[body.branch] = clean;
  } else {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 });
  }

  const settings = await updateGoogleSheetsSettings(supabase, session.customer.id, {
    field_mappings: nextMappings,
  });

  return NextResponse.json({ settings: { field_mappings: settings.field_mappings } });
}
