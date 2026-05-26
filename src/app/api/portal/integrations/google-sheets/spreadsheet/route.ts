import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { resolveSheetTabForSetup } from '@/lib/googleSheets/activeSheet';
import { resolveGoogleSheetsAccessToken } from '@/lib/googleSheets/access';
import { mapGoogleSheetsHttpError } from '@/lib/googleSheets/errors';
import {
  ensureGoogleSheetsIntegrationRow,
  getGoogleSheetsIntegrationPublic,
  markGoogleSheetsConnected,
  updateGoogleSheetsSettings,
} from '@/lib/googleSheets/integrationRepo';
import {
  columnIndexToLetter,
  fetchSheetHeaderColumns,
  fetchSpreadsheetTabs,
  parseSpreadsheetUrl,
  quoteSheetName,
} from '@/lib/googleSheets/spreadsheet';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json()) as {
    spreadsheet_url?: string;
    sheet_gid?: number | null;
  };

  const url = body.spreadsheet_url?.trim();
  if (!url) {
    return NextResponse.json({ error: 'Vul een spreadsheet-URL in' }, { status: 400 });
  }

  const parsed = parseSpreadsheetUrl(url);
  if (!parsed) {
    return NextResponse.json({ error: 'Ongeldige Google Spreadsheet-URL' }, { status: 400 });
  }

  const supabase = createServerClient();
  const customerId = session.customer.id;

  try {
    await ensureGoogleSheetsIntegrationRow(supabase, customerId);
    const accessToken = await resolveGoogleSheetsAccessToken(supabase, customerId);
    const tabs = await fetchSpreadsheetTabs(accessToken, parsed.spreadsheetId);

    const manualGid = body.sheet_gid != null ? body.sheet_gid : null;
    const tab = await resolveSheetTabForSetup(
      accessToken,
      parsed.spreadsheetId,
      manualGid,
    );

    if (!tab) {
      return NextResponse.json({ error: 'Geen werkblad gevonden in deze spreadsheet' }, { status: 400 });
    }

    const columns = await fetchSheetHeaderColumns(
      accessToken,
      parsed.spreadsheetId,
      quoteSheetName(tab.title),
    );

    const prev = await getGoogleSheetsIntegrationPublic(supabase, customerId);
    const tabChanged =
      prev?.settings.sheet_name !== tab.title || prev?.settings.sheet_gid !== tab.sheetId;

    await updateGoogleSheetsSettings(supabase, customerId, {
      spreadsheet_id: parsed.spreadsheetId,
      spreadsheet_url: url,
      sheet_gid: tab.sheetId,
      sheet_name: tab.title,
    });
    await markGoogleSheetsConnected(supabase, customerId);

    return NextResponse.json({
      spreadsheet_id: parsed.spreadsheetId,
      spreadsheet_url: url,
      sheet_gid: tab.sheetId,
      sheet_name: tab.title,
      sheet_tab_changed: tabChanged,
      uses_latest_tab: manualGid == null,
      tabs: tabs.map((t) => ({ sheet_id: t.sheetId, title: t.title })),
      columns: columns.map((c) => ({
        index: c.index,
        letter: c.letter,
        label: c.label,
        id: String(c.index),
        display: `${columnIndexToLetter(c.index)} — ${c.label}`,
      })),
    });
  } catch (err) {
    const { message, status } = mapGoogleSheetsHttpError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
