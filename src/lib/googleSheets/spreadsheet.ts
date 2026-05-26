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

/** 0-based kolomindex uit A1-kolomletter (A → 0, Z → 25, AA → 26). */
export function columnLetterToIndex(letter: string): number {
  const upper = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) return -1;
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Bepaalt de startkolom (0-based) uit een Values API range, bv. "'Blad 1'!G1:W1" → 6.
 * Zonder range valt terug op kolom A (0).
 */
export function parseValuesRangeStartColumn(range: string | undefined): number {
  if (!range) return 0;
  const bang = range.lastIndexOf('!');
  const a1Part = bang >= 0 ? range.slice(bang + 1) : range;
  const startCell = a1Part.split(':')[0] ?? 'A1';
  const colMatch = startCell.match(/^([A-Za-z]+)/);
  if (!colMatch) return 0;
  const idx = columnLetterToIndex(colMatch[1]);
  return idx >= 0 ? idx : 0;
}

/** Berekent het aantal kolommen op basis van de hoogste kolomindex. */
export function sheetColumnCount(columns: SheetColumn[]): number {
  if (columns.length === 0) return 0;
  return Math.max(...columns.map((c) => c.index)) + 1;
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
  const range = encodeURIComponent(`${sheetName}!A1:ZZ1`);
  const data = await sheetsFetch<{ values?: string[][]; range?: string }>(
    accessToken,
    `/spreadsheets/${spreadsheetId}/values/${range}`,
  );
  const row = data.values?.[0] ?? [];
  const startCol = parseValuesRangeStartColumn(data.range);
  return row.map((label, offset) => {
    const index = startCol + offset;
    return {
      index,
      letter: columnIndexToLetter(index),
      label: (label || '').trim() || `Kolom ${columnIndexToLetter(index)}`,
    };
  });
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
