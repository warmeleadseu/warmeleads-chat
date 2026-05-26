import {
  getPortalFieldsForBranch,
  getLeadFieldValue,
  normalizeLabel,
  type PortalFieldOption,
} from '@/lib/teamleader/fieldMappingLogic';
import type { GoogleSheetsFieldMappings, SheetBranchFieldMapping } from './types';
import type { SheetColumn } from './spreadsheet';
import { columnLetterToIndex, sheetColumnCount } from './spreadsheet';

export { getPortalFieldsForBranch, getLeadFieldValue, sheetColumnCount };

export function mergeSheetMappings(
  saved: GoogleSheetsFieldMappings | undefined,
  branchSlug: string,
): SheetBranchFieldMapping {
  return saved?.[branchSlug] ?? {};
}

export function sheetMappingIsEmpty(mapping: SheetBranchFieldMapping): boolean {
  return Object.keys(mapping).length === 0;
}

export function hasSavedSheetMappings(
  saved: GoogleSheetsFieldMappings | undefined,
  branchSlugs: string[],
): boolean {
  if (!saved || branchSlugs.length === 0) return false;
  return branchSlugs.some((slug) => !sheetMappingIsEmpty(mergeSheetMappings(saved, slug)));
}

const FIELD_ALIASES: Record<string, string[]> = {
  naam_klant: ['naam', 'name', 'klant', 'contact', 'volledigenaam'],
  email: ['email', 'mail', 'emailadres'],
  telefoonnummer: ['telefoon', 'phone', 'gsm', 'mobiel', 'tel'],
  postcode: ['postcode', 'zip', 'postal'],
  huisnummer: ['huisnummer', 'huisnr', 'number'],
  plaatsnaam: ['plaats', 'stad', 'city', 'woonplaats'],
  provincie: ['provincie', 'province', 'regio'],
  wervingsdatum: ['datum', 'date', 'aanvraag', 'werving'],
  notities: ['notities', 'opmerking', 'notes', 'remarks'],
};

function getAliases(key: string): string[] {
  return (FIELD_ALIASES[key] || []).map(normalizeLabel);
}

export function suggestSheetColumnMapping(
  portalFields: PortalFieldOption[],
  sheetColumns: SheetColumn[],
): SheetBranchFieldMapping {
  const mapping: SheetBranchFieldMapping = {};
  const used = new Set<number>();

  for (const pf of portalFields) {
    const normLabel = normalizeLabel(pf.label);
    const normKey = normalizeLabel(pf.key);
    const aliases = getAliases(pf.key);

    let best: { index: number; score: number } | null = null;
    for (const col of sheetColumns) {
      if (used.has(col.index)) continue;
      const colNorm = normalizeLabel(col.label);
      let score = 0;
      if (colNorm === normLabel || colNorm === normKey) score = 100;
      else if (colNorm.includes(normLabel) || normLabel.includes(colNorm)) score = 70;
      else if (aliases.some((a) => colNorm === a || colNorm.includes(a))) score = 85;
      if (score > 0 && (!best || score > best.score)) best = { index: col.index, score };
    }

    if (best && best.score >= 65) {
      mapping[pf.key] = String(best.index);
      used.add(best.index);
    }
  }

  return mapping;
}

/** Zet opgeslagen kolomverwijzing om naar 0-based sheet-kolomindex. */
export function resolveSheetColumnIndex(colRef: string): number | null {
  const trimmed = colRef.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (/^[A-Za-z]+$/.test(trimmed)) {
    const idx = columnLetterToIndex(trimmed);
    return idx >= 0 ? idx : null;
  }
  return null;
}

/**
 * Migreert veldkoppelingen die met oude (relatieve) kolomindices zijn opgeslagen
 * naar absolute sheet-kolomindices zodra koppen niet in kolom A beginnen.
 */
export function remapLegacyColumnIndices(
  mapping: SheetBranchFieldMapping,
  columns: SheetColumn[],
): SheetBranchFieldMapping {
  if (columns.length === 0) return mapping;

  const startCol = columns[0]?.index ?? 0;
  if (startCol === 0) return mapping;

  const indices = Object.values(mapping)
    .map((ref) => resolveSheetColumnIndex(ref))
    .filter((idx): idx is number => idx != null);

  if (indices.length === 0) return mapping;

  const minMapped = Math.min(...indices);
  const maxMapped = Math.max(...indices);

  // Al opgeslagen als absolute indices (na fix + opnieuw mappen)
  if (minMapped >= startCol) return mapping;

  // Oude opslag: indices 0..n-1 terwijl fysieke kolommen bij startCol beginnen.
  if (maxMapped < columns.length) {
    const remapped: SheetBranchFieldMapping = {};
    for (const [key, ref] of Object.entries(mapping)) {
      const idx = resolveSheetColumnIndex(ref);
      if (idx != null && idx >= 0 && idx < columns.length) {
        remapped[key] = String(columns[idx].index);
      } else if (ref) {
        remapped[key] = ref;
      }
    }
    return remapped;
  }

  return mapping;
}

/** Bouw een rij-array voor append op basis van kolom-mapping (absolute kolomindices). */
export function buildSheetRowValues(
  lead: Record<string, unknown>,
  mapping: SheetBranchFieldMapping,
  columnCount: number,
): string[] {
  let maxMappedIndex = -1;
  for (const colRef of Object.values(mapping)) {
    const idx = resolveSheetColumnIndex(colRef);
    if (idx != null && idx > maxMappedIndex) maxMappedIndex = idx;
  }

  const width = Math.max(columnCount, maxMappedIndex + 1, 1);
  const row = Array.from({ length: width }, () => '');

  for (const [portalKey, colRef] of Object.entries(mapping)) {
    const colIndex = resolveSheetColumnIndex(colRef);
    if (colIndex == null || colIndex < 0 || colIndex >= width) continue;
    const value = getLeadFieldValue(lead, portalKey);
    if (!value) continue;
    row[colIndex] = value;
  }

  return row;
}
