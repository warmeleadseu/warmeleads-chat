import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { ensureLatestSheetInSettings } from '@/lib/googleSheets/activeSheet';
import { resolveGoogleSheetsAccessToken } from '@/lib/googleSheets/access';
import { mapGoogleSheetsHttpError } from '@/lib/googleSheets/errors';
import {
  ensureGoogleSheetsIntegrationRow,
  getGoogleSheetsIntegrationPublic,
  markGoogleSheetsConnected,
  updateGoogleSheetsSettings,
} from '@/lib/googleSheets/integrationRepo';
import { parseSpreadsheetUrl } from '@/lib/googleSheets/spreadsheet';

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  let body: {
    spreadsheet_url?: string;
    sheet_gid?: number | null;
    enabled?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 });
  }

  const supabase = createServerClient();
  const customerId = session.customer.id;
  await ensureGoogleSheetsIntegrationRow(supabase, customerId);

  const patch: Parameters<typeof updateGoogleSheetsSettings>[2] = {};

  if (body.enabled !== undefined) patch.enabled = body.enabled;

  if (body.spreadsheet_url?.trim()) {
    const parsed = parseSpreadsheetUrl(body.spreadsheet_url.trim());
    if (!parsed) {
      return NextResponse.json({ error: 'Ongeldige Google Spreadsheet-URL' }, { status: 400 });
    }
    patch.spreadsheet_id = parsed.spreadsheetId;
    patch.spreadsheet_url = body.spreadsheet_url.trim();
  }

  try {
    let settings = await updateGoogleSheetsSettings(supabase, customerId, patch);

    if (settings.spreadsheet_id) {
      const integration = await getGoogleSheetsIntegrationPublic(supabase, customerId);
      if (integration) {
        const accessToken = await resolveGoogleSheetsAccessToken(supabase, customerId);
        const resolved = await ensureLatestSheetInSettings(
          supabase,
          customerId,
          integration,
          accessToken,
        );
        settings = {
          ...settings,
          sheet_name: resolved.sheetName,
          sheet_gid: resolved.sheetGid,
        };
      }
      await markGoogleSheetsConnected(supabase, customerId);
    }

    return NextResponse.json({ settings });
  } catch (err) {
    const { message, status } = mapGoogleSheetsHttpError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
