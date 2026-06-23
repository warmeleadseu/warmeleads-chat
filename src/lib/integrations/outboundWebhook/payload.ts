import { resolveCategorieen } from './categoryMap';
import type { LeadForWebhook, OutboundWebhookPayload } from './types';

function nullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

/**
 * Bouwt de JSON-payload voor de klant-webhook. Nederlandse keys conform de
 * door de klant aangeleverde veldenlijst. `lead_id` dient als idempotency-key.
 *
 * Let op: wij slaan geen losse straatnaam op (alleen postcode + huisnummer);
 * `adres` is daarom de combinatie postcode + huisnummer.
 */
export function buildWebhookPayload(
  lead: LeadForWebhook,
  assignmentId: string,
): OutboundWebhookPayload {
  const categorieen = resolveCategorieen(lead.branch, lead.custom_fields ?? null);
  const adres = [nullable(lead.postcode), nullable(lead.huisnummer)]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    id: lead.id,
    lead_id: lead.id,
    assignment_id: assignmentId,
    branch: nullable(lead.branch),
    categorie: categorieen[0] ?? null,
    categorieen,
    aanhef: null,
    naam: nullable(lead.naam_klant),
    email: nullable(lead.email),
    telefoonnummer: nullable(lead.telefoonnummer),
    adres: adres.length > 0 ? adres : null,
    huisnummer: nullable(lead.huisnummer),
    postcode: nullable(lead.postcode),
    plaats: nullable(lead.plaatsnaam),
    provincie: nullable(lead.provincie),
    land: nullable(lead.land) ?? 'NL',
    aangemaakt_op: nullable(lead.created_at),
  };
}

/** Voorbeeld-payload voor de "test"-knop in het portaal. */
export function buildSampleWebhookPayload(): OutboundWebhookPayload {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    lead_id: '00000000-0000-0000-0000-000000000000',
    assignment_id: '00000000-0000-0000-0000-000000000000',
    branch: 'isolatie',
    categorie: 'Spouwmuurisolatie',
    categorieen: ['Spouwmuurisolatie'],
    aanhef: null,
    naam: 'Test Lead',
    email: 'test@voorbeeld.nl',
    telefoonnummer: '0612345678',
    adres: '1234 AB 10',
    huisnummer: '10',
    postcode: '1234 AB',
    plaats: 'Amsterdam',
    provincie: 'Noord-Holland',
    land: 'NL',
    aangemaakt_op: new Date().toISOString(),
  };
}
