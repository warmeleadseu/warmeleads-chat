import type { SupabaseClient } from '@supabase/supabase-js';
import { updateGoogleSheetsSettings } from './integrationRepo';
import { fetchSpreadsheetTabs, pickDefaultSheetTab } from './spreadsheet';
import type { GoogleSheetsIntegrationPublic } from './types';

export type ResolvedSheetTab = {
  sheetName: string;
  sheetGid: number;
  tabChanged: boolean;
};

/**
 * Het laatste tabblad in de spreadsheet (klanten voegen vaak rechts een nieuw blad toe).
 * Negeert opgeslagen sheet_gid en gid uit de URL — alleen expliciete UI-keuze telt bij setup.
 */
export async function fetchLatestSheetTab(
  accessToken: string,
  spreadsheetId: string,
): Promise<{ sheetId: number; title: string } | null> {
  const tabs = await fetchSpreadsheetTabs(accessToken, spreadsheetId);
  const tab = pickDefaultSheetTab(tabs, null);
  if (!tab) return null;
  return { sheetId: tab.sheetId, title: tab.title };
}

/** Werkblad uit tablijst; `preferredGid` alleen bij handmatige keuze in portaal. */
export async function resolveSheetTabForSetup(
  accessToken: string,
  spreadsheetId: string,
  preferredGid?: number | null,
): Promise<{ sheetId: number; title: string } | null> {
  const tabs = await fetchSpreadsheetTabs(accessToken, spreadsheetId);
  const tab = pickDefaultSheetTab(tabs, preferredGid ?? null);
  if (!tab) return null;
  return { sheetId: tab.sheetId, title: tab.title };
}

/** Werkt sheet_name/sheet_gid bij naar het nieuwste tabblad. */
export async function ensureLatestSheetInSettings(
  supabase: SupabaseClient,
  customerId: string,
  integration: GoogleSheetsIntegrationPublic,
  accessToken: string,
): Promise<ResolvedSheetTab> {
  const spreadsheetId = integration.settings.spreadsheet_id;
  if (!spreadsheetId) {
    throw new Error('Geen spreadsheet gekoppeld');
  }

  const tab = await fetchLatestSheetTab(accessToken, spreadsheetId);
  if (!tab) {
    throw new Error('Geen werkblad gevonden in deze spreadsheet');
  }

  const tabChanged =
    integration.settings.sheet_name !== tab.title ||
    integration.settings.sheet_gid !== tab.sheetId;

  if (tabChanged) {
    await updateGoogleSheetsSettings(supabase, customerId, {
      sheet_name: tab.title,
      sheet_gid: tab.sheetId,
    });
  }

  return {
    sheetName: tab.title,
    sheetGid: tab.sheetId,
    tabChanged,
  };
}
