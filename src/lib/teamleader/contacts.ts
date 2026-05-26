import { teamleaderRequest } from './client';
import { WARME_LEADS_CONTACT_TAG } from './config';
import { normalizePhone, splitContactName } from './mapping';
import type { TlCustomFieldPayload } from './fieldMappingLogic';

type TlContact = { id: string; emails?: Array<{ type: string; email: string }> };

export type TeamleaderContactLeadInput = {
  naam_klant: string;
  email?: string | null;
  telefoonnummer?: string | null;
  postcode?: string | null;
  huisnummer?: string | null;
  plaatsnaam?: string | null;
  remarks?: string | null;
};

function buildAddressPayload(lead: TeamleaderContactLeadInput): Record<string, unknown>[] | undefined {
  if (!lead.postcode && !lead.plaatsnaam) return undefined;
  return [
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
      filter: {
        email: {
          type: 'primary',
          email: normalized,
        },
      },
      page: { size: 1, number: 1 },
    },
  );

  const list = Array.isArray(data) ? data : [];
  const first = list[0] as TlContact | undefined;
  return first?.id ?? null;
}

export async function tagContact(
  accessToken: string,
  contactId: string,
  tags: string[] = [WARME_LEADS_CONTACT_TAG],
): Promise<void> {
  const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (!unique.length) return;
  await teamleaderRequest(accessToken, 'contacts.tag', { id: contactId, tags: unique });
}

export async function updateContact(
  accessToken: string,
  contactId: string,
  lead: TeamleaderContactLeadInput,
  customFields?: TlCustomFieldPayload[],
): Promise<void> {
  const body: Record<string, unknown> = { id: contactId };
  const phone = normalizePhone(lead.telefoonnummer);
  if (phone) body.telephones = [{ type: 'phone', number: phone }];
  const addresses = buildAddressPayload(lead);
  if (addresses) body.addresses = addresses;
  if (lead.remarks?.trim()) body.remarks = lead.remarks.trim();
  if (customFields?.length) {
    body.custom_fields = customFields;
    body.custom_fields_update_strategy = 'partial';
  }
  await teamleaderRequest(accessToken, 'contacts.update', body);
}

export async function createContact(
  accessToken: string,
  lead: TeamleaderContactLeadInput,
  customFields?: TlCustomFieldPayload[],
): Promise<string> {
  const { firstName, lastName } = splitContactName(lead.naam_klant || '');
  const body: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    tags: [WARME_LEADS_CONTACT_TAG],
  };
  if (lead.email?.trim()) {
    body.emails = [{ type: 'primary', email: lead.email.trim() }];
  }
  const phone = normalizePhone(lead.telefoonnummer);
  if (phone) body.telephones = [{ type: 'phone', number: phone }];
  const addresses = buildAddressPayload(lead);
  if (addresses) body.addresses = addresses;
  if (lead.remarks?.trim()) body.remarks = lead.remarks.trim();
  if (customFields?.length) {
    body.custom_fields = customFields;
  }

  const created = await teamleaderRequest<{ id: string }>(accessToken, 'contacts.add', body);
  if (!created?.id) throw new Error('contacts.add returned no id');
  return created.id;
}

export async function findOrCreateContact(
  accessToken: string,
  lead: TeamleaderContactLeadInput,
  customFields?: TlCustomFieldPayload[],
): Promise<string> {
  if (lead.email?.trim()) {
    const existing = await findContactByEmail(accessToken, lead.email);
    if (existing) {
      await updateContact(accessToken, existing, lead, customFields);
      await tagContact(accessToken, existing);
      return existing;
    }
  }
  const id = await createContact(accessToken, lead, customFields);
  await tagContact(accessToken, id);
  return id;
}
