import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { googleSheetsAccessDeniedMessage, resolveGoogleSheetsAccessToken } from '@/lib/googleSheets/access';
import {
  ensureGoogleSheetsIntegrationRow,
  markGoogleSheetsConnected,
  updateGoogleSheetsSettings,
} from '@/lib/googleSheets/integrationRepo';
import {
  columnIndexToLetter,
  fetchSheetHeaderColumns,
  fetchSpreadsheetTabs,
  parseSpreadsheetUrl,
  pickDefaultSheetTab,
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
    sheet_name?: string | null;
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

    const preferredGid = body.sheet_gid ?? parsed.gid ?? null;
    const tab = pickDefaultSheetTab(tabs, preferredGid);
    const sheetName = body.sheet_name ?? tab?.title ?? null;
    const sheetGid = tab?.sheetId ?? preferredGid ?? null;

    if (!sheetName) {
      return NextResponse.json({ error: 'Geen werkblad gevonden in deze spreadsheet' }, { status: 400 });
    }

    const columns = await fetchSheetHeaderColumns(
      accessToken,
      parsed.spreadsheetId,
      quoteSheetName(sheetName),
    );

    await updateGoogleSheetsSettings(supabase, customerId, {
      spreadsheet_id: parsed.spreadsheetId,
      spreadsheet_url: url,
      sheet_gid: sheetGid,
      sheet_name: sheetName,
    });
    await markGoogleSheetsConnected(supabase, customerId);

    return NextResponse.json({
      spreadsheet_id: parsed.spreadsheetId,
      spreadsheet_url: url,
      sheet_gid: sheetGid,
      sheet_name: sheetName,
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
    const raw = err instanceof Error ? err.message : 'Spreadsheet laden mislukt';
    const status = raw.includes('permission') || raw.includes('403') ? 403 : 502;
    const message =
      status === 403 ? googleSheetsAccessDeniedMessage() : raw;
    return NextResponse.json({ error: message }, { status });
  }
}
