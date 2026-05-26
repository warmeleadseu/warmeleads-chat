import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { ensureLatestSheetInSettings } from '@/lib/googleSheets/activeSheet';
import { resolveGoogleSheetsAccessToken } from '@/lib/googleSheets/access';
import { mapGoogleSheetsHttpError } from '@/lib/googleSheets/errors';
import { getGoogleSheetsIntegrationPublic } from '@/lib/googleSheets/integrationRepo';
import {
  appendRowToSheet,
  fetchSheetHeaderColumns,
  quoteSheetName,
  sheetColumnCount,
} from '@/lib/googleSheets/spreadsheet';

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Stel eerst een spreadsheet in' }, { status: 400 });
  }

  try {
    const accessToken = await resolveGoogleSheetsAccessToken(supabase, session.customer.id);
    const { sheetName } = await ensureLatestSheetInSettings(
      supabase,
      session.customer.id,
      integration,
      accessToken,
    );
    const quoted = quoteSheetName(sheetName);
    const columns = await fetchSheetHeaderColumns(accessToken, spreadsheetId, quoted);
    const stamp = new Date().toLocaleString('nl-NL');
    const width = sheetColumnCount(columns) || 1;
    const row = Array.from({ length: width }, () => '');
    const firstCol = columns[0]?.index ?? 0;
    row[firstCol] = `[TEST Warme Leads ${stamp}]`;
    const secondCol = columns[1]?.index;
    if (secondCol != null) row[secondCol] = 'test@warmeleads.eu';

    const updatedRange = await appendRowToSheet(accessToken, spreadsheetId, quoted, row);
    return NextResponse.json({ ok: true, updated_range: updatedRange, sheet_name: sheetName });
  } catch (err) {
    const { message, status } = mapGoogleSheetsHttpError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
