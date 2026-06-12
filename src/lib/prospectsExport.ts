/**
 * Helpers voor het exporteren van prospects naar CSV en Excel.
 *
 * Single source of truth voor:
 *  - Kolomvolgorde en kolomtitels (ZO houdt CSV en XLSX gegarandeerd dezelfde
 *    structuur en kunnen we onafhankelijk testen wat een rij moet bevatten)
 *  - CSV-escaping (separator-, quote- en newline-veilig)
 *  - XLSX-bouw (auto-breedte per kolom)
 *
 * De API-route en UI tonen alleen de header-titels die hieruit komen, zodat
 * we altijd in sync blijven.
 */

import * as XLSX from 'xlsx';
import {
  PROSPECT_STATUS_LABELS,
  type ProspectRow,
  type ProspectStatus,
} from './prospects';

export const PROSPECT_EXPORT_COLUMNS = [
  'Bedrijfsnaam',
  'Contactpersoon',
  'E-mail',
  'Telefoon',
  'Website',
  'KVK-nummer',
  'BTW-ID',
  'Adres',
  'Postcode',
  'Plaats',
  'Land',
  'Branches',
  'Bedrijfsgrootte',
  'Status',
  'Verloren reden',
  'Bron',
  'Accountmanager',
  'Volgende actie',
  'Status sinds',
  'Aangemaakt',
  'Bijgewerkt',
  'Notities',
] as const;

export type ProspectExportColumn = (typeof PROSPECT_EXPORT_COLUMNS)[number];

export type ProspectExportLookups = {
  /** `admin_users.id` → display-naam (typisch via `getAdminName(account_manager_id)`). */
  accountManagerNames?: Record<string, string>;
  /** `branches.slug` → display-naam (zo zien we 'Thuisbatterij' i.p.v. `thuisbatterij_partners`). */
  branchNames?: Record<string, string>;
};

const PROSPECT_SOURCE_LABELS: Record<string, string> = {
  manual: 'Handmatig',
  csv_import: 'CSV-import',
  xlsx_import: 'Excel-import',
  website: 'Website',
  referral: 'Referral',
  other: 'Overig',
  meta_partner: 'Meta partner',
};

function formatProspectDate(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(value);
  }
}

function formatProspectStatus(status: ProspectStatus | string | null | undefined): string {
  if (!status) return '';
  const key = String(status) as ProspectStatus;
  return PROSPECT_STATUS_LABELS[key] ?? String(status);
}

function formatProspectSource(source: string | null | undefined): string {
  if (!source) return '';
  return PROSPECT_SOURCE_LABELS[source] ?? source;
}

function formatBranches(
  branches: string[] | null | undefined,
  branchNames?: Record<string, string>,
): string {
  if (!Array.isArray(branches) || branches.length === 0) return '';
  return branches
    .map(slug => (branchNames && branchNames[slug] ? branchNames[slug] : slug))
    .join(', ');
}

/**
 * Bouw één rij voor de export. Volgorde matcht `PROSPECT_EXPORT_COLUMNS`.
 *
 * Accepteert losjes getypeerde input zodat we 'm direct met de Supabase-rij
 * kunnen voeden zonder een extra mapping-stap.
 */
export function prospectToExportRow(
  prospect: Partial<ProspectRow> & Record<string, unknown>,
  lookups: ProspectExportLookups = {},
): string[] {
  const amId = (prospect.account_manager_id as string | null) ?? null;
  const amName = amId ? lookups.accountManagerNames?.[amId] ?? '' : '';

  return [
    String(prospect.company_name ?? ''),
    String(prospect.contact_person ?? ''),
    String(prospect.email ?? ''),
    String(prospect.phone ?? ''),
    String(prospect.website ?? ''),
    String(prospect.kvk_nummer ?? ''),
    String(prospect.vat_id ?? ''),
    String(prospect.address ?? ''),
    String(prospect.postcode ?? ''),
    String(prospect.city ?? ''),
    String(prospect.country ?? ''),
    formatBranches(prospect.branches as string[] | null | undefined, lookups.branchNames),
    String(prospect.company_size ?? ''),
    formatProspectStatus(prospect.status as ProspectStatus | null | undefined),
    String(prospect.lost_reason ?? ''),
    formatProspectSource(prospect.source as string | null | undefined),
    amName,
    formatProspectDate(prospect.next_action_at as string | null | undefined),
    formatProspectDate(prospect.status_changed_at as string | null | undefined),
    formatProspectDate(prospect.created_at as string | null | undefined),
    formatProspectDate(prospect.updated_at as string | null | undefined),
    String(prospect.notes ?? ''),
  ];
}

const CSV_BOM = '\uFEFF';

function csvEscape(cell: string): string {
  if (cell.includes(';') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Excel-NL-compatibele CSV: BOM + `;`-separator + CRLF.
 */
export function buildProspectsCsv(rows: string[][]): string {
  const lines: string[] = [];
  lines.push(PROSPECT_EXPORT_COLUMNS.join(';'));
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(';'));
  }
  return CSV_BOM + lines.join('\r\n');
}

/**
 * Excel-bestand met één sheet "Prospects" en automatische kolombreedtes.
 */
export function buildProspectsXlsx(rows: string[][]): Buffer {
  const sheetData = [PROSPECT_EXPORT_COLUMNS as unknown as string[], ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = PROSPECT_EXPORT_COLUMNS.map((header, i) => {
    let maxLen = header.length;
    for (const row of rows) {
      const cell = row[i] ?? '';
      if (cell.length > maxLen) maxLen = cell.length;
    }
    return { wch: Math.min(maxLen + 2, 50) };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Prospects');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer;
}

/** Bestandsnaam-stempel met de huidige (NL) datum, bv. `prospects-export-2026-06-12`. */
export function prospectsExportFilenameBase(date: Date = new Date()): string {
  const stamp = date.toISOString().split('T')[0];
  return `prospects-export-${stamp}`;
}
