import * as XLSX from 'xlsx';

/**
 * Een Excel-werkboek met één blad "Leads", kolombreedte naar inhoud.
 * Gedeeld door de export van het Leads CRM en die van Restleads, zodat beide
 * bestanden er hetzelfde uitzien.
 */
export function leadExportWerkboek(headers: string[], rows: string[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
