import { describe, expect, it } from 'vitest';
import {
  columnIndexToLetter,
  columnLetterToIndex,
  parseSpreadsheetUrl,
  parseValuesRangeStartColumn,
  pickDefaultSheetTab,
  quoteSheetName,
  sheetColumnCount,
  type SheetColumn,
  type SheetTab,
} from '@/lib/googleSheets/spreadsheet';
import {
  buildSheetRowValues,
  remapLegacyColumnIndices,
  resolveSheetColumnIndex,
  suggestSheetColumnMapping,
} from '@/lib/googleSheets/fieldMappingLogic';
import { getPortalFieldsForBranch } from '@/lib/teamleader/fieldMappingLogic';

describe('parseSpreadsheetUrl', () => {
  it('extracts spreadsheet id and gid', () => {
    const r = parseSpreadsheetUrl(
      'https://docs.google.com/spreadsheets/d/abc123/edit#gid=456',
    );
    expect(r?.spreadsheetId).toBe('abc123');
    expect(r?.gid).toBe(456);
  });
});

describe('columnIndexToLetter', () => {
  it('maps indices to letters', () => {
    expect(columnIndexToLetter(0)).toBe('A');
    expect(columnIndexToLetter(25)).toBe('Z');
    expect(columnIndexToLetter(26)).toBe('AA');
  });
});

describe('columnLetterToIndex', () => {
  it('maps letters to indices', () => {
    expect(columnLetterToIndex('A')).toBe(0);
    expect(columnLetterToIndex('G')).toBe(6);
    expect(columnLetterToIndex('AA')).toBe(26);
  });
});

describe('parseValuesRangeStartColumn', () => {
  it('parses start column from API range', () => {
    expect(parseValuesRangeStartColumn("'Blad 1'!G1:W1")).toBe(6);
    expect(parseValuesRangeStartColumn('Sheet1!A1:Z1')).toBe(0);
  });
});

describe('sheetColumnCount', () => {
  it('uses highest column index', () => {
    const cols: SheetColumn[] = [
      { index: 6, letter: 'G', label: 'Naam' },
      { index: 15, letter: 'P', label: 'Manager' },
    ];
    expect(sheetColumnCount(cols)).toBe(16);
  });
});

describe('pickDefaultSheetTab', () => {
  const tabs: SheetTab[] = [
    { sheetId: 0, title: 'Eerste' },
    { sheetId: 111, title: 'Midden' },
    { sheetId: 222, title: 'Laatste' },
  ];

  it('picks last tab when no gid', () => {
    expect(pickDefaultSheetTab(tabs)?.title).toBe('Laatste');
  });

  it('respects gid when present', () => {
    expect(pickDefaultSheetTab(tabs, 111)?.title).toBe('Midden');
  });

  it('falls back to last tab when gid unknown', () => {
    expect(pickDefaultSheetTab(tabs, 999)?.title).toBe('Laatste');
  });
});

describe('quoteSheetName', () => {
  it('quotes names with spaces', () => {
    expect(quoteSheetName('Blad 1')).toBe("'Blad 1'");
    expect(quoteSheetName('Blad1')).toBe('Blad1');
  });
});

describe('suggestSheetColumnMapping', () => {
  it('matches email column with absolute index', () => {
    const portal = getPortalFieldsForBranch([]);
    const mapping = suggestSheetColumnMapping(portal, [
      { index: 6, letter: 'G', label: 'E-mail' },
    ]);
    expect(mapping.email).toBe('6');
  });
});

describe('resolveSheetColumnIndex', () => {
  it('accepts numeric and letter refs', () => {
    expect(resolveSheetColumnIndex('6')).toBe(6);
    expect(resolveSheetColumnIndex('G')).toBe(6);
  });
});

describe('remapLegacyColumnIndices', () => {
  it('shifts relative indices when headers start at G', () => {
    const columns: SheetColumn[] = [
      { index: 6, letter: 'G', label: 'Naam klant' },
      { index: 7, letter: 'H', label: 'E-mail' },
    ];
    const remapped = remapLegacyColumnIndices({ naam_klant: '0', email: '1' }, columns);
    expect(remapped.naam_klant).toBe('6');
    expect(remapped.email).toBe('7');
  });
});

describe('buildSheetRowValues', () => {
  it('places values at mapped indices', () => {
    const row = buildSheetRowValues(
      { email: 'a@b.nl', naam_klant: 'Jan' },
      { email: '1', naam_klant: '0' },
      3,
    );
    expect(row[0]).toBe('Jan');
    expect(row[1]).toBe('a@b.nl');
  });

  it('preserves leading empty columns for offset headers', () => {
    const row = buildSheetRowValues(
      { naam_klant: 'Jan', email: 'a@b.nl' },
      { naam_klant: '6', email: '7' },
      16,
    );
    expect(row[0]).toBe('');
    expect(row[6]).toBe('Jan');
    expect(row[7]).toBe('a@b.nl');
    expect(row.length).toBe(16);
  });
});
