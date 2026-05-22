import {
  getPortalFieldsForBranch,
  getLeadFieldValue,
  normalizeLabel,
  type PortalFieldOption,
} from '@/lib/teamleader/fieldMappingLogic';
import type { GoogleSheetsFieldMappings, SheetBranchFieldMapping } from './types';
import type { SheetColumn } from './spreadsheet';

export { getPortalFieldsForBranch, getLeadFieldValue };

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

/** Bouw een rij-array voor append op basis van kolom-mapping. */
export function buildSheetRowValues(
  lead: Record<string, unknown>,
  mapping: SheetBranchFieldMapping,
  columnCount: number,
): string[] {
  const row = Array.from({ length: Math.max(columnCount, 1) }, () => '');
  let maxIndex = columnCount - 1;

  for (const [portalKey, colIndexStr] of Object.entries(mapping)) {
    const colIndex = Number(colIndexStr);
    if (!Number.isFinite(colIndex) || colIndex < 0) continue;
    const value = getLeadFieldValue(lead, portalKey);
    if (!value) continue;
    row[colIndex] = value;
    if (colIndex > maxIndex) maxIndex = colIndex;
  }

  return row.slice(0, maxIndex + 1);
}
