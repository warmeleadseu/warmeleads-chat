/**
 * Leidt het "soort prospect" af zodat je in het overzicht in één oogopslag ziet
 * hoe een prospect is binnengekomen. Dit is een presentatie-helper: de bron van
 * waarheid blijft `source` + `branches` + `source_metadata.partner_branch`.
 *
 * De drie partner-koppelingen (source = 'meta_partner') vertalen we naar de
 * types die het salesteam hanteert:
 *   - Afspraken            (branche `afspraken_partners`)
 *   - Bulk                 (branche `bulk`)
 *   - Verse lead-interesse (overige *_partners branches / niche-campagnes)
 *
 * Alle andere prospects (spreadsheet-import, handmatig, website, etc.) zijn geen
 * koppeling-type en krijgen een neutraal label zodat elke rij herkenbaar blijft.
 */

export type ProspectTypeKey =
  | 'afspraken'
  | 'bulk'
  | 'verse_lead'
  | 'import'
  | 'handmatig'
  | 'overig';

export interface ProspectTypeMeta {
  key: ProspectTypeKey;
  /** Volledige weergavenaam, bv. in filters. */
  label: string;
  /** Compacte naam voor badges in tabellen/kaarten. */
  short: string;
  /** Korte uitleg voor tooltips. */
  description: string;
  /** Tailwind-klassen voor de badge (achtergrond + tekst + ring). */
  badge: string;
  /** Tailwind-klasse voor het stip-icoon. */
  dot: string;
}

export const PROSPECT_TYPE_META: Record<ProspectTypeKey, ProspectTypeMeta> = {
  afspraken: {
    key: 'afspraken',
    label: 'Afspraken',
    short: 'Afspraken',
    description: 'Binnengekomen via de afspraken-partnerkoppeling',
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
  },
  bulk: {
    key: 'bulk',
    label: 'Bulk',
    short: 'Bulk',
    description: 'Binnengekomen via de bulk-partnerkoppeling',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
  },
  verse_lead: {
    key: 'verse_lead',
    label: 'Verse lead-interesse',
    short: 'Verse lead',
    description: 'Partner die via een niche-campagne interesse toonde in verse leads',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  import: {
    key: 'import',
    label: 'Import',
    short: 'Import',
    description: 'Geïmporteerd via een spreadsheet (CSV/Excel)',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200',
    dot: 'bg-violet-500',
  },
  handmatig: {
    key: 'handmatig',
    label: 'Handmatig',
    short: 'Handmatig',
    description: 'Handmatig toegevoegd',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
  },
  overig: {
    key: 'overig',
    label: 'Overig',
    short: 'Overig',
    description: 'Overige bron (website, referral, etc.)',
    badge: 'bg-slate-100 text-slate-500 ring-slate-200',
    dot: 'bg-slate-300',
  },
};

/** Volgorde voor filters/legendes: eerst de drie partner-koppelingen. */
export const PROSPECT_TYPE_ORDER: ProspectTypeKey[] = [
  'afspraken',
  'bulk',
  'verse_lead',
  'import',
  'handmatig',
  'overig',
];

export interface ProspectTypeInput {
  branches?: string[] | null;
  source?: string | null;
  source_metadata?: Record<string, unknown> | null;
}

function partnerBranchFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const pb = (meta as { partner_branch?: unknown }).partner_branch;
  return typeof pb === 'string' && pb.trim() ? pb.trim() : null;
}

/**
 * Bepaalt het prospect-type op basis van bron + branches. Client-safe (geen DB).
 */
export function resolveProspectTypeKey(input: ProspectTypeInput): ProspectTypeKey {
  const branches = Array.isArray(input.branches) ? input.branches.filter(Boolean) : [];
  const source = (input.source || '').trim();
  const partnerBranch = partnerBranchFromMetadata(input.source_metadata);

  const has = (slug: string) => branches.includes(slug) || partnerBranch === slug;

  if (has('afspraken_partners')) return 'afspraken';
  if (has('bulk')) return 'bulk';

  const isPartner =
    source === 'meta_partner' ||
    branches.some(b => b.endsWith('_partners')) ||
    (partnerBranch != null && partnerBranch.endsWith('_partners'));
  if (isPartner) return 'verse_lead';

  if (source === 'manual') return 'handmatig';
  if (source === 'csv_import' || source === 'xlsx_import') return 'import';

  return 'overig';
}

export function resolveProspectType(input: ProspectTypeInput): ProspectTypeMeta {
  return PROSPECT_TYPE_META[resolveProspectTypeKey(input)];
}
