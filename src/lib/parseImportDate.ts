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
 * - DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY  (Europees, default)
 * - MM/DD/YYYY  (Amerikaans, automatisch gedetecteerd zodra de DMY-
 *   interpretatie ongeldig is óf de cel een `am`/`pm`-suffix draagt)
 * - DD-MM-YY (twee-cijferig jaar; >= 70 → 19xx, anders 20xx — gangbaar
 *   in oudere CRM-exports)
 * - YYYY-MM-DD (ISO date) en YYYY-MM-DDTHH:MM(:SS)(Z|+offset)
 * - Excel-serial datum (getal; integer of decimaal, met 1900-epoch)
 * - JavaScript `Date`-object (XLSX `cellDates: true` levert die direct)
 * - Optioneel achterliggende tijd-suffix: `HH:MM`, `HH:MM:SS` of
 *   `H[:MM] am/pm` — wordt gestript voor parsing.
 */
export function parseImportDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  // XLSX kan met `cellDates: true` rauwe Date-objecten teruggeven; we
  // formatteren die direct in UTC zodat tijdzone-shifts niet stilletjes een
  // dag wegvegen.
  if (raw instanceof Date) {
    return formatDateUtc(raw);
  }

  let str = String(raw).trim();
  if (!str) return null;

  // Detecteer een tijd-suffix en strip die. We onthouden of er `am`/`pm`
  // in zat want dat is een sterk Amerikaans signaal en weegt later mee in
  // de DMY/MDY-keuze.
  let amPmDetected = false;
  const amPmMatch = str.match(/\b(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)\b/i);
  if (amPmMatch) {
    amPmDetected = true;
    str = str.replace(amPmMatch[0], '').trim();
  } else {
    // 24-uurs tijd-suffix: "10:14" of "10:14:40", optioneel met 'Z'/offset.
    str = str.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+\-]\d{2}:?\d{2})?$/i, '').trim();
  }

  if (!str) return null;

  if (/^-?\d+(?:[.,]\d+)?$/.test(str)) {
    const num = Number(str.replace(',', '.'));
    if (!isNaN(num) && num > 1 && num < 100000) {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + Math.floor(num) * 86400000;
      const d = new Date(ms);
      const yyyy = d.getUTCFullYear();
      if (yyyy >= 1970 && yyyy <= 2100) {
        return `${yyyy}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
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
    const a = +dmy4[1];
    const b = +dmy4[2];
    const y = +dmy4[3];

    // Onambigueus DMY: eerste getal > 12 (ze kan geen maand zijn).
    if (a > 12 && validDate(y, b, a)) return `${y}-${pad(b)}-${pad(a)}`;
    // Onambigueus MDY: tweede getal > 12 (kan geen maand zijn).
    if (b > 12 && validDate(y, a, b)) return `${y}-${pad(a)}-${pad(b)}`;

    // Ambigu (beide ≤ 12). Default DMY (Europees), tenzij am/pm gespot is
    // — dan kiezen we MDY want am/pm is sterk Amerikaans.
    if (amPmDetected && validDate(y, a, b)) return `${y}-${pad(a)}-${pad(b)}`;
    if (validDate(y, b, a)) return `${y}-${pad(b)}-${pad(a)}`;

    // DMY ongeldig → laatste poging MDY.
    if (validDate(y, a, b)) return `${y}-${pad(a)}-${pad(b)}`;
    return null;
  }

  const dmy2 = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (dmy2) {
    const a = +dmy2[1];
    const b = +dmy2[2];
    const yy = +dmy2[3];
    const fullYear = yy >= 70 ? 1900 + yy : 2000 + yy;

    if (a > 12 && validDate(fullYear, b, a)) return `${fullYear}-${pad(b)}-${pad(a)}`;
    if (b > 12 && validDate(fullYear, a, b)) return `${fullYear}-${pad(a)}-${pad(b)}`;
    if (amPmDetected && validDate(fullYear, a, b)) return `${fullYear}-${pad(a)}-${pad(b)}`;
    if (validDate(fullYear, b, a)) return `${fullYear}-${pad(b)}-${pad(a)}`;
    if (validDate(fullYear, a, b)) return `${fullYear}-${pad(a)}-${pad(b)}`;
    return null;
  }

  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateUtc(d: Date): string | null {
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1970 || y > 2100) return null;
  return `${y}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1970 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}
