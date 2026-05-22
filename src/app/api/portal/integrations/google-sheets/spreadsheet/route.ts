import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  ensureValidGoogleAccessToken,
  getGoogleSheetsIntegration,
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
  const integration = await getGoogleSheetsIntegration(supabase, session.customer.id);
  if (!integration?.connected_at) {
    return NextResponse.json({ error: 'Koppel eerst je Google-account' }, { status: 400 });
  }

  try {
    const accessToken = await ensureValidGoogleAccessToken(supabase, integration);
    const tabs = await fetchSpreadsheetTabs(accessToken, parsed.spreadsheetId);

    let sheetName = body.sheet_name ?? null;
    let sheetGid = body.sheet_gid ?? parsed.gid ?? null;

    if (sheetGid != null) {
      const tab = tabs.find((t) => t.sheetId === sheetGid);
      if (tab) sheetName = tab.title;
    }
    if (!sheetName && tabs[0]) {
      sheetName = tabs[0].title;
      sheetGid = tabs[0].sheetId;
    }

    if (!sheetName) {
      return NextResponse.json({ error: 'Geen werkblad gevonden in deze spreadsheet' }, { status: 400 });
    }

    const columns = await fetchSheetHeaderColumns(
      accessToken,
      parsed.spreadsheetId,
      quoteSheetName(sheetName),
    );

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
    const message = err instanceof Error ? err.message : 'Spreadsheet laden mislukt';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
