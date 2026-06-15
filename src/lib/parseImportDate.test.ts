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

  describe('JavaScript Date instances (XLSX cellDates)', () => {
    it('Date object → ISO datum (UTC)', () => {
      expect(parseImportDate(new Date(Date.UTC(2026, 3, 2, 10, 0, 0)))).toBe('2026-04-02');
    });
    it('Ongeldig Date object → null', () => {
      expect(parseImportDate(new Date('invalid'))).toBeNull();
    });
    it('Date buiten range → null', () => {
      expect(parseImportDate(new Date(Date.UTC(1800, 0, 1)))).toBeNull();
    });
  });

  describe('MM/DD/YYYY (Amerikaans formaat)', () => {
    it('onambigu MDY (tweede > 12)', () =>
      expect(parseImportDate('06/15/2026')).toBe('2026-06-15'));
    it('onambigu DMY (eerste > 12) blijft DMY', () =>
      expect(parseImportDate('15/06/2026')).toBe('2026-06-15'));
    it('ambigu zonder am/pm → DMY (Europees default)', () =>
      expect(parseImportDate('06/05/2026')).toBe('2026-05-06'));
  });

  describe('Datum + tijd-suffix', () => {
    it('US datum + 12u am-suffix → MDY', () =>
      expect(parseImportDate('06/15/2026 12:32am')).toBe('2026-06-15'));
    it('US datum + 12u pm-suffix → MDY', () =>
      expect(parseImportDate('06/14/2026 11:26pm')).toBe('2026-06-14'));
    it('NL datum + 24u tijd', () =>
      expect(parseImportDate('15-06-2026 14:32')).toBe('2026-06-15'));
    it('NL datum + 24u tijd met seconden', () =>
      expect(parseImportDate('15-06-2026 14:32:10')).toBe('2026-06-15'));
    it('ISO datum + spatie + tijd', () =>
      expect(parseImportDate('2026-04-02 10:14:40')).toBe('2026-04-02'));
    it('Ambigue datum + am/pm → kies MDY', () =>
      expect(parseImportDate('05/06/2026 9:00am')).toBe('2026-05-06'));
    it('DMY ongeldig → fallback naar MDY (geen am/pm nodig)', () =>
      expect(parseImportDate('06/15/2026')).toBe('2026-06-15'));
  });
});
