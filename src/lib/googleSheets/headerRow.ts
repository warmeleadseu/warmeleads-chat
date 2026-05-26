import { columnIndexToLetter, type SheetColumn } from './spreadsheet';

const HEADER_SCAN_ROWS = 10;
const HEADER_SCAN_COLS = 702; // A through ZZ

export type SheetHeaderScan = {
  headerRow: number;
  columns: SheetColumn[];
};

type GridCell = { formattedValue?: string } | null | undefined;

function cellText(cell: GridCell): string {
  return (cell?.formattedValue ?? '').trim();
}

/** Score how likely a row is a header row (vs data or title). */
export function scoreHeaderRow(cells: string[]): number {
  const nonEmpty = cells.filter((c) => c.trim()).length;
  if (nonEmpty === 0) return 0;

  let headerLike = 0;
  for (const raw of cells) {
    const t = raw.trim();
    if (!t) continue;
    const lower = t.toLowerCase();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(t)) continue;
    if (t.includes('@')) continue;
    if (/^\+?\d[\d\s\-().]{7,}$/.test(t)) continue;
    if (/^\d{4,}$/.test(t.replace(/\s/g, ''))) continue;
    if (lower.includes('naam') || lower.includes('email') || lower.includes('e-mail')) {
      headerLike += 3;
      continue;
    }
    if (lower.includes('postcode') || lower.includes('telefoon') || lower.includes('datum')) {
      headerLike += 2;
      continue;
    }
    if (t.length <= 40 && /[a-zA-Z]/.test(t)) headerLike += 1;
  }

  return headerLike * 10 + nonEmpty;
}

/** Bouw kolomdefinities van een grid-rij; behoud lege kolommen t/m laatste gevulde cel. */
export function extractHeaderColumnsFromCells(
  cells: string[],
  startColumn = 0,
): SheetColumn[] {
  let lastNonEmpty = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]?.trim()) lastNonEmpty = i;
  }
  if (lastNonEmpty < 0) return [];

  const columns: SheetColumn[] = [];
  for (let i = 0; i <= lastNonEmpty; i++) {
    const index = startColumn + i;
    const label = (cells[i] || '').trim();
    columns.push({
      index,
      letter: columnIndexToLetter(index),
      label: label || `Kolom ${columnIndexToLetter(index)}`,
    });
  }
  return columns;
}

export function pickBestHeaderRow(
  rowTexts: string[][],
  preferredRow?: number | null,
): number {
  let bestRow = 1;
  let bestScore = 0;
  for (let i = 0; i < rowTexts.length; i++) {
    const score = scoreHeaderRow(rowTexts[i] || []);
    if (score > bestScore) {
      bestScore = score;
      bestRow = i + 1;
    }
  }

  if (preferredRow != null && preferredRow >= 1 && preferredRow <= rowTexts.length) {
    const preferredScore = scoreHeaderRow(rowTexts[preferredRow - 1] || []);
    if (preferredScore >= bestScore * 0.85 && preferredScore > 0) {
      return preferredRow;
    }
  }

  return bestRow;
}

export { HEADER_SCAN_ROWS, HEADER_SCAN_COLS };
