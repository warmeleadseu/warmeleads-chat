/**
 * Bouwt de kolommen + rijen voor een lead-export. Naast de vaste kernkolommen
 * worden ALLE branche-specifieke waarden meegenomen: de data zit vrijwel altijd
 * in `custom_fields`, dus die keys worden dynamisch als kolom toegevoegd. Legacy
 * kolommen op de leads-tabel worden alleen meegenomen als ze gevuld zijn en niet
 * al via custom_fields bestaan. Zo wordt élke leadwaarde geëxporteerd, voor elke
 * branche.
 */

export function formatExportDate(value: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('nl-NL');
  } catch {
    return value;
  }
}

/** Vaste kernkolommen die elke lead heeft (los van de branche). */
export const CORE_COLUMNS: { label: string; get: (l: Record<string, unknown>) => string }[] = [
  { label: 'Branche', get: l => String(l.branch ?? '') },
  { label: 'Naam', get: l => String(l.naam_klant ?? '') },
  { label: 'E-mail', get: l => String(l.email ?? '') },
  { label: 'Telefoon', get: l => String(l.telefoonnummer ?? '') },
  { label: 'Postcode', get: l => String(l.postcode ?? '') },
  { label: 'Huisnr.', get: l => String(l.huisnummer ?? '') },
  { label: 'Plaats', get: l => String(l.plaatsnaam ?? '') },
  { label: 'Provincie', get: l => String(l.provincie ?? '') },
  { label: 'Land', get: l => String(l.land ?? '') },
  { label: 'Datum', get: l => formatExportDate(l.wervingsdatum as string | null) },
  { label: 'Status', get: l => String(l.status ?? '') },
  { label: 'Notities', get: l => String(l.notities ?? '') },
  { label: 'Bron', get: l => String(l.bron ?? '') },
  { label: 'CPL', get: l => (l.lead_cost ? `€${Number(l.lead_cost).toFixed(2)}` : '') },
  { label: 'Kwaliteit', get: l => (l.quality_score != null ? String(l.quality_score) : '') },
  { label: 'Telefoon geldig', get: l => (l.phone_valid === true ? 'Ja' : l.phone_valid === false ? 'Nee' : '') },
  { label: 'Klant', get: l => String((l.customers as { name?: string } | null)?.name || '') },
];

/** Interne `custom_fields`-sleutels die geen leadinhoud zijn en we niet exporteren. */
export const INTERNAL_CF_KEYS = new Set(['max_customer_assignments', 'meta_lead_form_id', 'meta_leadgen_id']);

/** Legacy branche-kolommen op de leads-tabel; alleen meenemen als ze gevuld zijn. */
export const DEDICATED_BRANCH_COLUMNS: { key: string; label: string }[] = [
  { key: 'zonnepanelen', label: 'Zonnepanelen' },
  { key: 'dynamisch_contract', label: 'Dynamisch contract' },
  { key: 'stroomverbruik', label: 'Stroomverbruik' },
  { key: 'budget', label: 'Budget' },
  { key: 'reden_thuisbatterij', label: 'Reden thuisbatterij' },
  { key: 'type_airco', label: 'Type airco' },
  { key: 'koelen_verwarmen', label: 'Koelen of verwarmen' },
  { key: 'hoeveel_ruimtes', label: 'Hoeveel ruimtes' },
  { key: 'zakelijk', label: 'Zakelijk' },
  { key: 'koop_of_huur', label: 'Koop of huur' },
  { key: 'boorwerkzaamheden_toegestaan', label: 'Boorwerkzaamheden toegestaan' },
];

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

export function formatCellValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nee';
  if (Array.isArray(v)) return v.map(formatCellValue).filter(s => s !== '').join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function prettifyFieldKey(key: string): string {
  const s = key.replace(/_/g, ' ').replace(/\bkwh\b/gi, 'kWh').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildLeadExportTable(
  leads: Record<string, unknown>[],
): { headers: string[]; rows: string[][] } {
  const cfFill = new Map<string, number>();
  for (const l of leads) {
    const cf = l.custom_fields;
    if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
      for (const [k, v] of Object.entries(cf as Record<string, unknown>)) {
        if (INTERNAL_CF_KEYS.has(k)) continue;
        if (!cfFill.has(k)) cfFill.set(k, 0);
        if (hasValue(v)) cfFill.set(k, (cfFill.get(k) as number) + 1);
      }
    }
  }
  // Meest-gevulde branchevelden eerst, daarna alfabetisch — stabiel en relevant.
  const cfKeys = [...cfFill.keys()].sort((a, b) => {
    const d = (cfFill.get(b) as number) - (cfFill.get(a) as number);
    return d !== 0 ? d : a.localeCompare(b);
  });
  const cfKeySet = new Set(cfKeys);

  const dedicated = DEDICATED_BRANCH_COLUMNS.filter(
    c => !cfKeySet.has(c.key) && leads.some(l => hasValue(l[c.key])),
  );

  const headers = [
    ...CORE_COLUMNS.map(c => c.label),
    ...dedicated.map(c => c.label),
    ...cfKeys.map(prettifyFieldKey),
  ];

  const rows = leads.map(l => {
    const cf =
      l.custom_fields && typeof l.custom_fields === 'object' && !Array.isArray(l.custom_fields)
        ? (l.custom_fields as Record<string, unknown>)
        : {};
    return [
      ...CORE_COLUMNS.map(c => c.get(l)),
      ...dedicated.map(c => formatCellValue(l[c.key])),
      ...cfKeys.map(k => formatCellValue(cf[k])),
    ];
  });

  return { headers, rows };
}
