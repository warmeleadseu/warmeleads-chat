import { PORTAL_STANDARD_FIELDS, FIELD_MAP_SKIP, FIELD_MAP_SUMMARY, FIELD_MAP_NATIVE } from './standardFields';
import type { TeamleaderCustomFieldDefinition } from './customFieldDefinitions';

export type PortalFieldOption = {
  key: string;
  label: string;
  group: 'standard' | 'branch';
};

export type BranchFieldMapping = {
  contact: Record<string, string>;
  deal: Record<string, string>;
};

export type TeamleaderFieldMappings = Record<string, BranchFieldMapping>;

export function normalizeLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getPortalFieldsForBranch(
  branchFields: Array<{ key: string; label: string }>,
): PortalFieldOption[] {
  const standard: PortalFieldOption[] = PORTAL_STANDARD_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    group: 'standard',
  }));
  const branch: PortalFieldOption[] = branchFields.map((f) => ({
    key: f.key,
    label: f.label,
    group: 'branch',
  }));
  return [...standard, ...branch];
}

/**
 * Stel mapping voor op basis van label-gelijkenis (portaal ↔ Teamleader).
 */
export function suggestFieldMapping(
  portalFields: PortalFieldOption[],
  tlContactFields: TeamleaderCustomFieldDefinition[],
  tlDealFields: TeamleaderCustomFieldDefinition[],
): BranchFieldMapping {
  const contact: Record<string, string> = {};
  const deal: Record<string, string> = {};

  const usedContact = new Set<string>();
  const usedDeal = new Set<string>();

  for (const pf of portalFields) {
    const norm = normalizeLabel(pf.label);
    const normKey = normalizeLabel(pf.key);

    const contactMatch = findBestTlMatch(pf, norm, normKey, tlContactFields, usedContact);
    if (contactMatch) {
      contact[pf.key] = contactMatch;
      usedContact.add(contactMatch);
      continue;
    }

    const dealMatch = findBestTlMatch(pf, norm, normKey, tlDealFields, usedDeal);
    if (dealMatch) {
      deal[pf.key] = dealMatch;
      usedDeal.add(dealMatch);
    } else if (pf.group === 'branch') {
      deal[pf.key] = FIELD_MAP_SUMMARY;
    }
  }

  return { contact, deal };
}

/** Standaardkoppeling zonder Teamleader custom fields (native contact + dealomschrijving). */
export function suggestDefaultFieldMapping(
  portalFields: PortalFieldOption[],
): BranchFieldMapping {
  const contact: Record<string, string> = {};
  const deal: Record<string, string> = {};
  const nativeKeys = new Set<string>(
    PORTAL_STANDARD_FIELDS.filter((f) => f.native !== 'none').map((f) => f.key),
  );

  for (const pf of portalFields) {
    if (nativeKeys.has(pf.key)) {
      contact[pf.key] = FIELD_MAP_NATIVE;
    } else {
      deal[pf.key] = FIELD_MAP_SUMMARY;
    }
  }

  return { contact, deal };
}

function findBestTlMatch(
  pf: PortalFieldOption,
  normLabel: string,
  normKey: string,
  tlFields: TeamleaderCustomFieldDefinition[],
  used: Set<string>,
): string | null {
  const aliases = getAliases(pf.key);
  let best: { id: string; score: number } | null = null;

  for (const tf of tlFields) {
    if (used.has(tf.id)) continue;
    const tlNorm = normalizeLabel(tf.label);
    let score = 0;
    if (tlNorm === normLabel || tlNorm === normKey) score = 100;
    else if (tlNorm.includes(normLabel) || normLabel.includes(tlNorm)) score = 70;
    else if (aliases.some((a) => tlNorm === a || tlNorm.includes(a))) score = 85;
    if (score > 0 && (!best || score > best.score)) best = { id: tf.id, score };
  }

  return best && best.score >= 65 ? best.id : null;
}

const FIELD_ALIASES: Record<string, string[]> = {
  naam_klant: ['naam', 'name', 'klant', 'contact', 'volledigenaam'],
  email: ['email', 'mail', 'emailadres'],
  telefoonnummer: ['telefoon', 'phone', 'gsm', 'mobiel', 'tel'],
  postcode: ['postcode', 'zip', 'postal'],
  huisnummer: ['huisnummer', 'huisnr', 'number'],
  plaatsnaam: ['plaats', 'stad', 'city', 'woonplaats'],
  provincie: ['provincie', 'province', 'regio'],
  wervingsdatum: ['datum', 'date', 'aanvraag'],
  notities: ['notities', 'opmerking', 'notes', 'remarks'],
};

function getAliases(key: string): string[] {
  return (FIELD_ALIASES[key] || []).map(normalizeLabel);
}

/** Lees stringwaarde uit lead + custom_fields. */
export function getLeadFieldValue(
  lead: Record<string, unknown>,
  key: string,
): string | null {
  const standard = lead[key];
  if (standard != null && String(standard).trim()) return String(standard).trim();
  const cf = lead.custom_fields;
  if (cf && typeof cf === 'object') {
    const v = (cf as Record<string, unknown>)[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

export type TlCustomFieldPayload = { id: string; value: string | number | boolean | string[] };

export function formatValueForTeamleader(
  raw: string,
  def: TeamleaderCustomFieldDefinition | undefined,
): string | number | boolean | string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (!def) return trimmed;

  switch (def.type) {
    case 'boolean': {
      const lower = trimmed.toLowerCase();
      if (['ja', 'yes', 'true', '1', 'j'].includes(lower)) return true;
      if (['nee', 'no', 'false', '0', 'n'].includes(lower)) return false;
      return true;
    }
    case 'integer':
    case 'number': {
      const n = Number(trimmed.replace(',', '.'));
      return Number.isFinite(n) ? n : trimmed;
    }
    case 'money': {
      const n = Number(trimmed.replace(/[^\d.,-]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : trimmed;
    }
    case 'date': {
      const d = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      if (d) return d[1];
      const nl = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (nl) {
        const [, dd, mm, yyyy] = nl;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
      return trimmed;
    }
    case 'single_select': {
      if (!def.options?.length) return trimmed;
      const norm = normalizeLabel(trimmed);
      const opt =
        def.options.find((o) => normalizeLabel(o.value) === norm) ||
        def.options.find((o) => normalizeLabel(o.id) === norm);
      return opt?.id ?? trimmed;
    }
    case 'multi_select': {
      if (!def.options?.length) return [trimmed];
      const parts = trimmed.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      const ids = parts
        .map((p) => {
          const norm = normalizeLabel(p);
          return def.options!.find((o) => normalizeLabel(o.value) === norm)?.id;
        })
        .filter(Boolean) as string[];
      return ids.length > 0 ? ids : [trimmed];
    }
    default:
      return trimmed;
  }
}

export function buildMappedCustomFields(
  lead: Record<string, unknown>,
  mapping: Record<string, string>,
  tlDefs: TeamleaderCustomFieldDefinition[],
  context: 'contact' | 'deal',
): TlCustomFieldPayload[] {
  const defById = new Map(tlDefs.map((d) => [d.id, d]));
  const out: TlCustomFieldPayload[] = [];
  const seen = new Set<string>();

  for (const [portalKey, tlFieldId] of Object.entries(mapping)) {
    if (
      !tlFieldId ||
      tlFieldId === FIELD_MAP_SKIP ||
      tlFieldId === FIELD_MAP_SUMMARY ||
      tlFieldId === FIELD_MAP_NATIVE
    ) {
      continue;
    }
    const value = getLeadFieldValue(lead, portalKey);
    if (!value) continue;
    const def = defById.get(tlFieldId);
    if (def && def.context !== context) continue;
    const formatted = formatValueForTeamleader(value, def);
    if (formatted == null) continue;
    if (seen.has(tlFieldId)) continue;
    seen.add(tlFieldId);
    out.push({ id: tlFieldId, value: formatted });
  }

  return out;
}

/** Velden die niet naar een TL custom field gaan → deal-samenvatting. */
export function collectSummaryExtras(
  lead: Record<string, unknown>,
  portalFields: PortalFieldOption[],
  mapping: BranchFieldMapping,
): Record<string, string> {
  const extras: Record<string, string> = {};
  const mappedKeys = new Set([
    ...Object.keys(mapping.contact),
    ...Object.keys(mapping.deal),
  ]);

  for (const pf of portalFields) {
    const contactTarget = mapping.contact[pf.key];
    const dealTarget = mapping.deal[pf.key];
    const mappedToTl =
      (contactTarget && contactTarget !== FIELD_MAP_SKIP && contactTarget !== FIELD_MAP_SUMMARY) ||
      (dealTarget && dealTarget !== FIELD_MAP_SKIP && dealTarget !== FIELD_MAP_SUMMARY);
    if (mappedToTl) continue;

    const explicitSummary =
      contactTarget === FIELD_MAP_SUMMARY || dealTarget === FIELD_MAP_SUMMARY;
    const isBranch = pf.group === 'branch';
    if (!explicitSummary && !isBranch) continue;

    const val = getLeadFieldValue(lead, pf.key);
    if (val) extras[pf.label] = val;
  }

  return extras;
}

export function mergeMappings(
  saved: TeamleaderFieldMappings | undefined,
  branchSlug: string,
): BranchFieldMapping {
  return saved?.[branchSlug] ?? { contact: {}, deal: {} };
}

export function branchMappingIsEmpty(mapping: BranchFieldMapping): boolean {
  return (
    Object.keys(mapping.contact).length === 0 && Object.keys(mapping.deal).length === 0
  );
}

export function hasSavedFieldMappings(
  saved: TeamleaderFieldMappings | undefined,
  branchSlugs: string[],
): boolean {
  if (!saved || branchSlugs.length === 0) return false;
  return branchSlugs.some((slug) => !branchMappingIsEmpty(mergeMappings(saved, slug)));
}
