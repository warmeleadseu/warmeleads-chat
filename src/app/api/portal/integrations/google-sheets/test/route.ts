import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  ensureValidGoogleAccessToken,
  getGoogleSheetsIntegration,
} from '@/lib/googleSheets/integrationRepo';
import {
  appendRowToSheet,
  fetchSheetHeaderColumns,
  quoteSheetName,
} from '@/lib/googleSheets/spreadsheet';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const integration = await getGoogleSheetsIntegration(supabase, session.customer.id);
  if (!integration?.connected_at) {
    return NextResponse.json({ error: 'Koppel eerst je Google-account' }, { status: 400 });
  }

  const spreadsheetId = integration.settings.spreadsheet_id;
  const sheetName = integration.settings.sheet_name;
  if (!spreadsheetId || !sheetName) {
    return NextResponse.json({ error: 'Stel eerst een spreadsheet in' }, { status: 400 });
  }

  try {
    const accessToken = await ensureValidGoogleAccessToken(supabase, integration);
    const quoted = quoteSheetName(sheetName);
    const columns = await fetchSheetHeaderColumns(accessToken, spreadsheetId, quoted);
    const stamp = new Date().toLocaleString('nl-NL');
    const row = columns.map((c, i) =>
      i === 0 ? `[TEST Warme Leads ${stamp}]` : i === 1 ? 'test@warmeleads.eu' : '',
    );
    if (row.length === 0) row.push(`[TEST Warme Leads ${stamp}]`);

    const updatedRange = await appendRowToSheet(accessToken, spreadsheetId, quoted, row);
    return NextResponse.json({ ok: true, updated_range: updatedRange });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Test mislukt';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
