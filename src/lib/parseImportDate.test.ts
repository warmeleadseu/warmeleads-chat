import { describe, it, expect } from 'vitest';
import { parseImportDate } from './parseImportDate';

describe('parseImportDate', () => {
  describe('returns null voor leeg/onparseerbaar', () => {
    it.each([
      [''],
      ['   '],
      [null],
      [undefined],
      ['n.v.t.'],
      ['onbekend'],
      ['April 2, 2026'],
      ['2 apr 2026'],
      ['woensdag'],
      ['??-??-????'],
      ['32-13-2025'],
      ['2025-13-01'],
      ['2025-02-30'],
    ])('%s', (input) => {
      expect(parseImportDate(input as unknown)).toBeNull();
    });
  });

  describe('DD-MM-YYYY varianten', () => {
    it('DD-MM-YYYY', () => expect(parseImportDate('02-04-2026')).toBe('2026-04-02'));
    it('D-M-YYYY', () => expect(parseImportDate('2-4-2026')).toBe('2026-04-02'));
    it('DD/MM/YYYY', () => expect(parseImportDate('02/04/2026')).toBe('2026-04-02'));
    it('DD.MM.YYYY', () => expect(parseImportDate('02.04.2026')).toBe('2026-04-02'));
  });

  describe('DD-MM-YY (2-cijferig jaar)', () => {
    it('00-69 → 20xx', () => expect(parseImportDate('15-03-25')).toBe('2025-03-15'));
    it('70-99 → 19xx', () => expect(parseImportDate('15-03-95')).toBe('1995-03-15'));
    it('grenswaarde 70', () => expect(parseImportDate('01-01-70')).toBe('1970-01-01'));
    it('grenswaarde 69', () => expect(parseImportDate('01-01-69')).toBe('2069-01-01'));
  });

  describe('YYYY-MM-DD ISO', () => {
    it('basis ISO', () => expect(parseImportDate('2026-04-02')).toBe('2026-04-02'));
    it('ISO met timestamp', () => expect(parseImportDate('2026-04-02T10:14:40Z')).toBe('2026-04-02'));
    it('ISO met timestamp + offset', () =>
      expect(parseImportDate('2026-04-02T10:14:40+02:00')).toBe('2026-04-02'));
    it('ISO met spatie en time', () => expect(parseImportDate('2026-04-02 10:14:40')).toBe('2026-04-02'));
    it('ISO met milliseconds', () =>
      expect(parseImportDate('2026-04-02T10:14:40.077225Z')).toBe('2026-04-02'));
  });

  describe('Excel serial dates', () => {
    it('Excel 45000 (= 16 mei 2023)', () => expect(parseImportDate('45000')).toBe('2023-03-15'));
    it('Excel decimaal met komma', () => expect(parseImportDate('45000,5')).toBe('2023-03-15'));
    it('Excel decimaal met punt', () => expect(parseImportDate('45000.5')).toBe('2023-03-15'));
    it('Excel-serial buiten range geeft null', () => expect(parseImportDate('100000')).toBeNull());
    it('Excel-serial 0 geeft null', () => expect(parseImportDate('0')).toBeNull());
  });

  describe('robuustheid', () => {
    it('trim whitespace', () => expect(parseImportDate('  02-04-2026  ')).toBe('2026-04-02'));
    it('Date-object', () => expect(parseImportDate('2026-04-02')).toBe('2026-04-02'));
    it('exclusief vandaag-fallback (regressie van bug 2 apr 2026)', () => {
      expect(parseImportDate('')).toBeNull();
      expect(parseImportDate(null)).toBeNull();
      expect(parseImportDate('garbage')).toBeNull();
    });
  });
});
