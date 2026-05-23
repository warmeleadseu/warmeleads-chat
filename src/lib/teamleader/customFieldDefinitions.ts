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

/** Haal alle custom field definities op voor een context (gepagineerd). */
export async function listCustomFieldDefinitions(
  accessToken: string,
  context: 'contact' | 'deal',
): Promise<TeamleaderCustomFieldDefinition[]> {
  const all: TeamleaderCustomFieldDefinition[] = [];
  let page = 1;
  const pageSize = 100;

  for (;;) {
    const batch = await teamleaderRequest<ListResponse>(accessToken, 'customFieldDefinitions.list', {
      filter: { context },
      page: { size: pageSize, number: page },
    });
    type RawRow = TeamleaderCustomFieldDefinition & {
      configuration?: { options?: Array<{ id: string; value: string }> };
    };
    const list = unwrapTeamleaderList<RawRow>(batch);
    for (const row of list) {
      const normalizedType = normalizeTeamleaderFieldType(row.type);
      if (!isMappableTeamleaderFieldType(normalizedType)) continue;
      all.push({
        id: row.id,
        label: row.label,
        type: normalizedType,
        context: row.context,
        required: row.required,
        options: row.configuration?.options,
      });
    }
    if (list.length < pageSize) break;
    page += 1;
    if (page > 20) break;
  }

  return all.sort((a, b) => a.label.localeCompare(b.label, 'nl'));
}
