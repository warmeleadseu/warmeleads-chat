import { describe, expect, it } from 'vitest';
import {
  extractHeaderColumnsFromCells,
  pickBestHeaderRow,
  scoreHeaderRow,
} from '@/lib/googleSheets/headerRow';

describe('scoreHeaderRow', () => {
  it('prefers header-like row over title or data', () => {
    const titleRow = ['Mediabink - Thuisbatterij Leads'];
    const headerRow = [
      'Naam klant',
      '',
      'Datum interesse klant',
      'Postcode',
      'Huisnummer',
      'Plaatsnaam',
      'Telefoonnummer',
      'E-mail',
    ];
    const dataRow = ['Jan Jansen', '', '2024-05-28', '9298VD', '9', 'Snakkerburen', '31615470893', 'jan@x.nl'];

    expect(scoreHeaderRow(headerRow)).toBeGreaterThan(scoreHeaderRow(titleRow));
    expect(scoreHeaderRow(headerRow)).toBeGreaterThan(scoreHeaderRow(dataRow));
  });
});

describe('pickBestHeaderRow', () => {
  it('picks row 2 when headers are on row 2 (Mediabink layout)', () => {
    const rows = [
      ['Mediabink - Thuisbatterij Leads'],
      [
        'Naam klant',
        '',
        'Datum interesse klant',
        'Postcode',
        'Huisnummer',
        'Plaatsnaam',
        'Telefoonnummer',
        'E-mail',
      ],
      ['Jan', '', '2024-01-01', '1234AB', '1', 'Amsterdam', '0612345678', 'a@b.nl'],
    ];
    expect(pickBestHeaderRow(rows)).toBe(2);
  });

  it('ignores weak preferred row when another row scores much higher', () => {
    const rows = [
      ['Reden Thuisbatterij', 'Koopintentie?', '', 'Naam Accountmanager'],
      [
        'Naam klant',
        'Datum interesse klant',
        'Postcode',
        'Huisnummer',
        'Plaatsnaam',
        'Telefoonnummer',
        'E-mail',
      ],
    ];
    expect(pickBestHeaderRow(rows, 1)).toBe(2);
  });
});

describe('extractHeaderColumnsFromCells', () => {
  it('preserves empty column B between A and C', () => {
    const cols = extractHeaderColumnsFromCells(
      ['Naam klant', '', 'Datum interesse klant', 'Postcode'],
      0,
    );
    expect(cols.map((c) => c.index)).toEqual([0, 1, 2, 3]);
    expect(cols[0].letter).toBe('A');
    expect(cols[1].letter).toBe('B');
    expect(cols[2].letter).toBe('C');
  });
});
