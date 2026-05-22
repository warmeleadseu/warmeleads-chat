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

export function isMappableTeamleaderFieldType(type: string): boolean {
  return MAPPABLE_TYPES.has(type);
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
    const list = (Array.isArray(batch) ? batch : []) as RawRow[];
    for (const row of list) {
      if (!isMappableTeamleaderFieldType(row.type)) continue;
      all.push({
        id: row.id,
        label: row.label,
        type: row.type,
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
