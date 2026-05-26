import { describe, expect, it } from 'vitest';
import {
  columnIndexToLetter,
  parseSpreadsheetUrl,
  pickDefaultSheetTab,
  quoteSheetName,
  type SheetTab,
} from '@/lib/googleSheets/spreadsheet';
import {
  buildSheetRowValues,
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
  it('matches email column', () => {
    const portal = getPortalFieldsForBranch([]);
    const mapping = suggestSheetColumnMapping(portal, [
      { index: 0, letter: 'A', label: 'E-mail' },
    ]);
    expect(mapping.email).toBe('0');
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
});
