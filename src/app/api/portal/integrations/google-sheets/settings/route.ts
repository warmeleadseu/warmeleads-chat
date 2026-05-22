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
} from '@/lib/googleSheets/spreadsheet';

async function resolveSheetNameFromGid(
  accessToken: string,
  spreadsheetId: string,
  sheetGid: number,
): Promise<string | null> {
  const tabs = await fetchSpreadsheetTabs(accessToken, spreadsheetId);
  return tabs.find((t) => t.sheetId === sheetGid)?.title ?? null;
}

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  let body: {
    spreadsheet_url?: string;
    sheet_gid?: number | null;
    sheet_name?: string | null;
    enabled?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 });
  }

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
    // URL-gid alleen als fallback; expliciete sheet_gid uit UI heeft voorrang.
    if (parsed.gid != null && body.sheet_gid == null) {
      patch.sheet_gid = parsed.gid;
    }
  }

  if (body.sheet_gid != null) {
    patch.sheet_gid = body.sheet_gid;
  }

  if (body.sheet_name !== undefined && body.sheet_name !== null) {
    patch.sheet_name = body.sheet_name;
  }

  const spreadsheetId =
    patch.spreadsheet_id ?? integration.settings.spreadsheet_id ?? null;

  if (patch.sheet_gid != null && spreadsheetId && !patch.sheet_name) {
    try {
      const accessToken = await ensureValidGoogleAccessToken(supabase, integration);
      const title = await resolveSheetNameFromGid(
        accessToken,
        spreadsheetId,
        patch.sheet_gid,
      );
      if (title) patch.sheet_name = title;
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
      if (preferred) {
        patch.sheet_name = preferred.title;
        if (patch.sheet_gid == null) patch.sheet_gid = preferred.sheetId;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spreadsheet niet bereikbaar';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  try {
    const settings = await updateGoogleSheetsSettings(supabase, session.customer.id, patch);
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Opslaan mislukt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
