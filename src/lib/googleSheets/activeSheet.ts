import type { SupabaseClient } from '@supabase/supabase-js';
import { updateGoogleSheetsSettings } from './integrationRepo';
import { fetchSpreadsheetTabs, pickDefaultSheetTab } from './spreadsheet';
import type { GoogleSheetsIntegrationPublic } from './types';

/**
 * Het laatste tabblad in de spreadsheet (klanten voegen vaak rechts een nieuw blad toe).
 * Ignores opgeslagen sheet_gid — die kan verouderd zijn.
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

/** Werkt sheet_name/sheet_gid bij naar het nieuwste tabblad; retourneert de actieve titel. */
export async function ensureLatestSheetInSettings(
  supabase: SupabaseClient,
  customerId: string,
  integration: GoogleSheetsIntegrationPublic,
  accessToken: string,
): Promise<string> {
  const spreadsheetId = integration.settings.spreadsheet_id;
  if (!spreadsheetId) {
    throw new Error('Geen spreadsheet gekoppeld');
  }

  const tab = await fetchLatestSheetTab(accessToken, spreadsheetId);
  if (!tab) {
    throw new Error('Geen werkblad gevonden in deze spreadsheet');
  }

  const changed =
    integration.settings.sheet_name !== tab.title ||
    integration.settings.sheet_gid !== tab.sheetId;

  if (changed) {
    await updateGoogleSheetsSettings(supabase, customerId, {
      sheet_name: tab.title,
      sheet_gid: tab.sheetId,
    });
  }

  return tab.title;
}
