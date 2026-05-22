import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  ensureValidGoogleAccessToken,
  getGoogleSheetsIntegration,
  updateGoogleSheetsSettings,
} from '@/lib/googleSheets/integrationRepo';
import {
  fetchSpreadsheetTabs,
  parseSpreadsheetUrl,
  quoteSheetName,
} from '@/lib/googleSheets/spreadsheet';

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json()) as {
    spreadsheet_url?: string;
    sheet_gid?: number | null;
    sheet_name?: string | null;
    enabled?: boolean;
  };

  const supabase = createServerClient();
  const integration = await getGoogleSheetsIntegration(supabase, session.customer.id);
  if (!integration?.connected_at) {
    return NextResponse.json({ error: 'Koppel eerst je Google-account' }, { status: 400 });
  }

  const patch: Parameters<typeof updateGoogleSheetsSettings>[2] = {};

  if (body.enabled !== undefined) patch.enabled = body.enabled;

  if (body.spreadsheet_url?.trim()) {
    const parsed = parseSpreadsheetUrl(body.spreadsheet_url.trim());
    if (!parsed) {
      return NextResponse.json({ error: 'Ongeldige Google Spreadsheet-URL' }, { status: 400 });
    }
    patch.spreadsheet_id = parsed.spreadsheetId;
    patch.spreadsheet_url = body.spreadsheet_url.trim();
    if (parsed.gid != null) patch.sheet_gid = parsed.gid;
  }

  if (body.sheet_name !== undefined) {
    patch.sheet_name = body.sheet_name;
  }

  if (body.sheet_gid != null && body.spreadsheet_url?.trim()) {
    try {
      const accessToken = await ensureValidGoogleAccessToken(supabase, integration);
      const spreadsheetId = patch.spreadsheet_id ?? integration.settings.spreadsheet_id;
      if (spreadsheetId) {
        const tabs = await fetchSpreadsheetTabs(accessToken, spreadsheetId);
        const tab = tabs.find((t) => t.sheetId === body.sheet_gid);
        if (tab) patch.sheet_name = tab.title;
      }
    } catch {
      /* sheet_name kan handmatig worden gezet */
    }
  }

  if (patch.spreadsheet_id && !patch.sheet_name && integration.settings.sheet_name) {
    patch.sheet_name = integration.settings.sheet_name;
  }

  if (patch.spreadsheet_id && !patch.sheet_name) {
    try {
      const accessToken = await ensureValidGoogleAccessToken(supabase, integration);
      const tabs = await fetchSpreadsheetTabs(accessToken, patch.spreadsheet_id);
      const preferred =
        patch.sheet_gid != null
          ? tabs.find((t) => t.sheetId === patch.sheet_gid)
          : tabs[0];
      if (preferred) patch.sheet_name = preferred.title;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spreadsheet niet bereikbaar';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const settings = await updateGoogleSheetsSettings(supabase, session.customer.id, patch);
  return NextResponse.json({ settings });
}
