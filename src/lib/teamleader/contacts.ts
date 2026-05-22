import { teamleaderRequest } from './client';
import { normalizePhone, splitContactName } from './mapping';
import type { TlCustomFieldPayload } from './fieldMappingLogic';

type TlContact = { id: string; emails?: Array<{ type: string; email: string }> };

export async function findContactByEmail(
  accessToken: string,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const data = await teamleaderRequest<{ id: string }[] | TlContact[]>(
    accessToken,
    'contacts.list',
    {
      filter: { email: normalized },
      page: { size: 1, number: 1 },
    },
  );

  const list = Array.isArray(data) ? data : [];
  const first = list[0] as TlContact | undefined;
  return first?.id ?? null;
}

export async function createContact(
  accessToken: string,
  lead: {
    naam_klant: string;
    email?: string | null;
    telefoonnummer?: string | null;
    postcode?: string | null;
    huisnummer?: string | null;
    plaatsnaam?: string | null;
  },
  customFields?: TlCustomFieldPayload[],
): Promise<string> {
  const { firstName, lastName } = splitContactName(lead.naam_klant || '');
  const body: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
  };
  if (lead.email?.trim()) {
    body.emails = [{ type: 'primary', email: lead.email.trim() }];
  }
  const phone = normalizePhone(lead.telefoonnummer);
  if (phone) body.telephones = [{ type: 'phone', number: phone }];
  if (lead.postcode || lead.plaatsnaam) {
    body.addresses = [
      {
        type: 'primary',
        address: {
          line_1: [lead.postcode, lead.huisnummer].filter(Boolean).join(' ').trim() || undefined,
          city: lead.plaatsnaam || undefined,
          country: 'NL',
        },
      },
    ];
  }
  if (customFields?.length) {
    body.custom_fields = customFields;
  }

  const created = await teamleaderRequest<{ id: string }>(accessToken, 'contacts.add', body);
  if (!created?.id) throw new Error('contacts.add returned no id');
  return created.id;
}

export async function findOrCreateContact(
  accessToken: string,
  lead: Parameters<typeof createContact>[1],
  customFields?: TlCustomFieldPayload[],
): Promise<string> {
  if (lead.email?.trim()) {
    const existing = await findContactByEmail(accessToken, lead.email);
    if (existing) return existing;
  }
  return createContact(accessToken, lead, customFields);
}
