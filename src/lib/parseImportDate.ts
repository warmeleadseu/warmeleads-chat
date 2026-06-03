/**
 * Parseert een datumcel uit een geüploade spreadsheet naar `YYYY-MM-DD`.
 *
 * Wordt zowel server-side gebruikt door `/api/admin/import` als client-side
 * door de admin import-UI om vóór bevestiging een waarschuwing te tonen
 * over het aantal onparseerbare cellen.
 *
 * Returnt `null` wanneer de cel leeg is of niet betrouwbaar herkend wordt.
 * Bewust GEEN fallback naar `new Date()`, omdat dat eerder een grote
 * verzameling leads onterecht de import-dag als wervingsdatum gaf — wat
 * zowel rapportages als datum-range exports volledig verstoorde.
 *
 * Herkende formats:
 * - DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
 * - DD-MM-YY (twee-cijferig jaar; >= 70 → 19xx, anders 20xx — gangbaar in oudere CRM-exports)
 * - YYYY-MM-DD (ISO date)
 * - YYYY-MM-DDTHH:MM(:SS)(Z|+offset) (ISO timestamp; alleen het datum-deel wordt gebruikt)
 * - Excel-serial datum (getal; integer of decimaal, met 1900-epoch)
 */
export function parseImportDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  if (/^-?\d+(?:[.,]\d+)?$/.test(str)) {
    const num = Number(str.replace(',', '.'));
    if (!isNaN(num) && num > 1 && num < 100000) {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + Math.floor(num) * 86400000;
      const d = new Date(ms);
      const yyyy = d.getUTCFullYear();
      if (yyyy >= 1970 && yyyy <= 2100) {
        return `${yyyy}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
    }
    return null;
  }

  const isoTs = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+\-]\d{2}:?\d{2})?)?$/);
  if (isoTs) {
    const [, y, m, d] = isoTs;
    if (validDate(+y, +m, +d)) return `${y}-${m}-${d}`;
    return null;
  }

  const dmy4 = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy4) {
    const [, d, m, y] = dmy4;
    if (validDate(+y, +m, +d)) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
  }

  const dmy2 = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (dmy2) {
    const [, d, m, yy] = dmy2;
    const fullYear = Number(yy) >= 70 ? 1900 + Number(yy) : 2000 + Number(yy);
    if (validDate(fullYear, +m, +d)) {
      return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
  }

  return null;
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1970 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}
