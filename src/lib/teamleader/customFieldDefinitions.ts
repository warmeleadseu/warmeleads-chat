import { teamleaderRequest } from './client';

export type TeamleaderCustomFieldDefinition = {
  id: string;
  label: string;
  type: string;
  context: 'contact' | 'deal' | 'company' | string;
  required?: boolean;
  options?: Array<{ id: string; value: string }>;
};

type ListResponse = TeamleaderCustomFieldDefinition[];

const MAPPABLE_TYPES = new Set([
  'single_line',
  'multi_line',
  'single_select',
  'multi_select',
  'date',
  'money',
  'integer',
  'number',
  'boolean',
  'email',
  'telephone',
  'url',
]);

/** Contexts accepted by customFieldDefinitions.list filter (deal is excluded in current API). */
const FILTERABLE_CONTEXTS = new Set(['contact', 'company', 'product', 'project', 'milestone']);

export function normalizeTeamleaderFieldType(type: unknown): string {
  return String(type ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

export function isMappableTeamleaderFieldType(type: string): boolean {
  return MAPPABLE_TYPES.has(normalizeTeamleaderFieldType(type));
}

/** Teamleader list-endpoints return `data` as array; guard against unexpected shapes. */
export function unwrapTeamleaderList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: T[] }).data;
  }
  return [];
}

type RawRow = TeamleaderCustomFieldDefinition & {
  configuration?: { options?: Array<{ id: string; value: string }> };
};

function parseMappableRow(row: RawRow): TeamleaderCustomFieldDefinition | null {
  const normalizedType = normalizeTeamleaderFieldType(row.type);
  if (!isMappableTeamleaderFieldType(normalizedType)) return null;
  return {
    id: row.id,
    label: row.label,
    type: normalizedType,
    context: row.context,
    required: row.required,
    options: row.configuration?.options,
  };
}

async function fetchPaginatedDefinitions(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<TeamleaderCustomFieldDefinition[]> {
  const all: TeamleaderCustomFieldDefinition[] = [];
  let page = 1;
  const pageSize = 100;

  for (;;) {
    const batch = await teamleaderRequest<ListResponse>(accessToken, 'customFieldDefinitions.list', {
      ...body,
      page: { size: pageSize, number: page },
    });
    const list = unwrapTeamleaderList<RawRow>(batch);
    for (const row of list) {
      const parsed = parseMappableRow(row);
      if (parsed) all.push(parsed);
    }
    if (list.length < pageSize) break;
    page += 1;
    if (page > 20) break;
  }

  return all.sort((a, b) => a.label.localeCompare(b.label, 'nl'));
}

/** Haal contact- en deal-custom fields op (één gedeelde unfiltered fetch voor deal). */
export async function listGroupedCustomFieldDefinitions(
  accessToken: string,
): Promise<{ contact: TeamleaderCustomFieldDefinition[]; deal: TeamleaderCustomFieldDefinition[] }> {
  const [contactFiltered, unfiltered] = await Promise.all([
    FILTERABLE_CONTEXTS.has('contact')
      ? fetchPaginatedDefinitions(accessToken, { filter: { context: 'contact' } }).catch(
          () => [] as TeamleaderCustomFieldDefinition[],
        )
      : Promise.resolve([] as TeamleaderCustomFieldDefinition[]),
    fetchPaginatedDefinitions(accessToken, {}),
  ]);

  const contactFromAll = unfiltered.filter((f) => f.context === 'contact');
  const deal = unfiltered.filter((f) => f.context === 'deal');

  const contact = contactFiltered.length > 0 ? contactFiltered : contactFromAll;

  return {
    contact: [...contact].sort((a, b) => a.label.localeCompare(b.label, 'nl')),
    deal: [...deal].sort((a, b) => a.label.localeCompare(b.label, 'nl')),
  };
}

/** Haal custom field definities op voor één context. */
export async function listCustomFieldDefinitions(
  accessToken: string,
  context: 'contact' | 'deal',
): Promise<TeamleaderCustomFieldDefinition[]> {
  const grouped = await listGroupedCustomFieldDefinitions(accessToken);
  return grouped[context];
}
