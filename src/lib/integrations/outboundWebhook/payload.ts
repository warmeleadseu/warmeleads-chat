import { resolveCategorieen } from './categoryMap';
import { resolveFieldMappings } from './fields';
import type { LeadForWebhook, OutboundWebhookFieldMapping } from './types';

function nullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

/**
 * Alle beschikbare bronwaarden voor een lead, gekeyd op de interne veldsleutel
 * (zie fields.ts). De mapping bepaalt vervolgens welke hiervan, onder welke
 * JSON-key, daadwerkelijk verstuurd worden.
 *
 * Straatnaam slaan we zelf niet op; die wordt bij aflevering afgeleid uit
 * postcode + huisnummer (PDOK/Nominatim) en hier als `straat` meegegeven.
 * `adres` = straat + huisnummer; lukt de straat-lookup niet, dan valt `adres`
 * terug op postcode + huisnummer.
 */
export function buildLeadSourceValues(
  lead: LeadForWebhook,
  assignmentId: string,
  straat?: string | null,
): Record<string, unknown> {
  const categorieen = resolveCategorieen(lead.branch, lead.custom_fields ?? null);
  const straatnaam = nullable(straat);
  const huisnummer = nullable(lead.huisnummer);
  const adres = straatnaam
    ? [straatnaam, huisnummer].filter(Boolean).join(' ').trim()
    : [nullable(lead.postcode), huisnummer].filter(Boolean).join(' ').trim();

  return {
    categorie: categorieen[0] ?? null,
    categorieen,
    aanhef: null,
    naam: nullable(lead.naam_klant),
    email: nullable(lead.email),
    telefoonnummer: nullable(lead.telefoonnummer),
    adres: adres.length > 0 ? adres : null,
    straat: straatnaam,
    huisnummer,
    postcode: nullable(lead.postcode),
    plaats: nullable(lead.plaatsnaam),
    provincie: nullable(lead.provincie),
    land: nullable(lead.land) ?? 'NL',
    branch: nullable(lead.branch),
    lead_id: lead.id,
    assignment_id: assignmentId,
    aangemaakt_op: nullable(lead.created_at),
  };
}

/** Past de veld-mapping toe op een set bronwaarden. */
export function applyFieldMappings(
  values: Record<string, unknown>,
  mappings: OutboundWebhookFieldMapping[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of mappings) {
    if (m.enabled === false) continue;
    const target = m.target?.trim();
    if (!target) continue;
    out[target] = values[m.source] ?? null;
  }
  return out;
}

/** Bouwt de uiteindelijke payload voor een lead volgens de (opgeslagen) mapping. */
export function buildWebhookPayload(
  lead: LeadForWebhook,
  assignmentId: string,
  mappings?: OutboundWebhookFieldMapping[] | null,
  straat?: string | null,
): Record<string, unknown> {
  const values = buildLeadSourceValues(lead, assignmentId, straat);
  return applyFieldMappings(values, resolveFieldMappings(mappings));
}

function sampleSourceValues(): Record<string, unknown> {
  return {
    categorie: 'Spouwmuurisolatie',
    categorieen: ['Spouwmuurisolatie'],
    aanhef: null,
    naam: 'Test Lead',
    email: 'test@voorbeeld.nl',
    telefoonnummer: '0612345678',
    adres: 'Dorpsstraat 10',
    straat: 'Dorpsstraat',
    huisnummer: '10',
    postcode: '1234 AB',
    plaats: 'Amsterdam',
    provincie: 'Noord-Holland',
    land: 'NL',
    branch: 'isolatie',
    lead_id: '00000000-0000-0000-0000-000000000000',
    assignment_id: '00000000-0000-0000-0000-000000000000',
    aangemaakt_op: new Date().toISOString(),
  };
}

/** Voorbeeld-payload voor de "test"-knop, volgens dezelfde mapping. */
export function buildSampleWebhookPayload(
  mappings?: OutboundWebhookFieldMapping[] | null,
): Record<string, unknown> {
  return applyFieldMappings(sampleSourceValues(), resolveFieldMappings(mappings));
}
