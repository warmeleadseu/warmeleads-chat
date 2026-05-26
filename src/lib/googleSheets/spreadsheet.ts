import { appendGoogleSheetsApiKey, GOOGLE_SHEETS_API_BASE } from './config';

export type SheetTab = {
  sheetId: number;
  title: string;
};

export type SheetColumn = {
  index: number;
  letter: string;
  label: string;
};

/** Kolomletter uit 0-based index (0 → A, 25 → Z, 26 → AA). */
export function columnIndexToLetter(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Standaard het laatste tabblad (zoals gevraagd in portaal-setup), tenzij gid expliciet is gezet.
 */
export function pickDefaultSheetTab(
  tabs: SheetTab[],
  preferredGid?: number | null,
): SheetTab | null {
  if (tabs.length === 0) return null;
  if (preferredGid != null) {
    const match = tabs.find((t) => t.sheetId === preferredGid);
    if (match) return match;
  }
  return tabs[tabs.length - 1];
}

export function parseSpreadsheetUrl(url: string): { spreadsheetId: string; gid?: number } | null {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = trimmed.match(/[#&?]gid=(\d+)/);
  return {
    spreadsheetId: idMatch[1],
    gid: gidMatch ? Number(gidMatch[1]) : undefined,
  };
}

async function sheetsFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiPath = appendGoogleSheetsApiKey(path);
  const res = await fetch(`${GOOGLE_SHEETS_API_BASE}${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string>),
    },
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } }).error?.message;
    throw new Error(msg || `Google Sheets API fout (${res.status})`);
  }
  return json;
}

export async function fetchSpreadsheetTabs(
  accessToken: string,
  spreadsheetId: string,
): Promise<SheetTab[]> {
  const data = await sheetsFetch<{
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(accessToken, `/spreadsheets/${spreadsheetId}?fields=sheets.properties`);

  return (data.sheets || [])
    .map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? 'Blad',
    }))
    .filter((t) => t.sheetId != null);
}

export async function fetchSheetHeaderColumns(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
): Promise<SheetColumn[]> {
  const range = encodeURIComponent(`${sheetName}!1:1`);
  const data = await sheetsFetch<{ values?: string[][] }>(
    accessToken,
    `/spreadsheets/${spreadsheetId}/values/${range}`,
  );
  const row = data.values?.[0] ?? [];
  return row.map((label, index) => ({
    index,
    letter: columnIndexToLetter(index),
    label: (label || '').trim() || `Kolom ${columnIndexToLetter(index)}`,
  }));
}

export async function appendRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: string[],
): Promise<string> {
  const range = encodeURIComponent(`${sheetName}!A:ZZ`);
  const data = await sheetsFetch<{
    updates?: { updatedRange?: string };
  }>(accessToken, `/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [values] }),
  });
  return data.updates?.updatedRange ?? 'ok';
}

/** Escape sheet name voor A1-notatie (apostrofs in tabnamen). */
export function quoteSheetName(name: string): string {
  if (/^[A-Za-z0-9_]+$/.test(name)) return name;
  return `'${name.replace(/'/g, "''")}'`;
}
