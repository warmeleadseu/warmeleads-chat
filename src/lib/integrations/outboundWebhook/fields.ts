import type { OutboundWebhookFieldMapping } from './types';

export type WebhookSourceField = {
  /** Vaste interne sleutel. */
  key: string;
  /** Standaard JSON-key in de uitgaande payload. */
  defaultTarget: string;
  /** Label voor in het portaal. */
  label: string;
};

/**
 * Catalogus van alle leadgegevens die we naar een klant-webhook kunnen sturen.
 * De klant bepaalt zelf (in het portaal) welke velden meegaan en onder welke
 * JSON-key. Volgorde = volgorde in de UI.
 */
export const WEBHOOK_SOURCE_FIELDS: WebhookSourceField[] = [
  { key: 'categorie', defaultTarget: 'categorie', label: 'Categorie' },
  { key: 'categorieen', defaultTarget: 'categorieen', label: 'Categorieën (lijst)' },
  { key: 'aanhef', defaultTarget: 'aanhef', label: 'Aanhef' },
  { key: 'naam', defaultTarget: 'naam', label: 'Naam' },
  { key: 'email', defaultTarget: 'email', label: 'E-mailadres' },
  { key: 'telefoonnummer', defaultTarget: 'telefoonnummer', label: 'Telefoonnummer' },
  { key: 'adres', defaultTarget: 'adres', label: 'Adres (straat + huisnummer)' },
  { key: 'straat', defaultTarget: 'straat', label: 'Straatnaam' },
  { key: 'huisnummer', defaultTarget: 'huisnummer', label: 'Huisnummer' },
  { key: 'postcode', defaultTarget: 'postcode', label: 'Postcode' },
  { key: 'plaats', defaultTarget: 'plaats', label: 'Plaats' },
  { key: 'provincie', defaultTarget: 'provincie', label: 'Provincie' },
  { key: 'land', defaultTarget: 'land', label: 'Land' },
  { key: 'branch', defaultTarget: 'branch', label: 'Branche' },
  { key: 'lead_id', defaultTarget: 'lead_id', label: 'Lead-ID (uniek)' },
  { key: 'assignment_id', defaultTarget: 'assignment_id', label: 'Toewijzings-ID' },
  { key: 'aangemaakt_op', defaultTarget: 'aangemaakt_op', label: 'Aangemaakt op' },
];

const FIELD_BY_KEY = new Map(WEBHOOK_SOURCE_FIELDS.map((f) => [f.key, f]));

export function isValidSourceFieldKey(key: string): boolean {
  return FIELD_BY_KEY.has(key);
}

/** Standaardmapping: alle velden aan, met hun standaard JSON-key. */
export function defaultFieldMappings(): OutboundWebhookFieldMapping[] {
  return WEBHOOK_SOURCE_FIELDS.map((f) => ({
    source: f.key,
    target: f.defaultTarget,
    enabled: true,
  }));
}

/**
 * Combineert een opgeslagen mapping met de catalogus, in catalogusvolgorde.
 * - Geen opgeslagen mapping -> volledige standaardmapping (alles aan).
 * - Wel opgeslagen mapping -> velden die er niet in staan worden uitgezet
 *   (de klant heeft die bewust niet gekozen / het is een nieuw veld).
 */
export function resolveFieldMappings(
  stored?: OutboundWebhookFieldMapping[] | null,
): OutboundWebhookFieldMapping[] {
  if (!stored || stored.length === 0) return defaultFieldMappings();

  const byKey = new Map(
    stored.filter((m) => isValidSourceFieldKey(m.source)).map((m) => [m.source, m]),
  );

  return WEBHOOK_SOURCE_FIELDS.map((f) => {
    const m = byKey.get(f.key);
    if (!m) return { source: f.key, target: f.defaultTarget, enabled: false };
    return {
      source: f.key,
      target: m.target?.trim() || f.defaultTarget,
      enabled: m.enabled !== false,
    };
  });
}

/** Saneert binnenkomende mapping uit een portal-request. */
export function sanitizeFieldMappings(input: unknown): OutboundWebhookFieldMapping[] {
  if (!Array.isArray(input)) return [];
  const out: OutboundWebhookFieldMapping[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const m = raw as { source?: unknown; target?: unknown; enabled?: unknown };
    if (typeof m.source !== 'string' || !isValidSourceFieldKey(m.source)) continue;
    const target = typeof m.target === 'string' ? m.target.trim().slice(0, 100) : '';
    out.push({ source: m.source, target, enabled: m.enabled !== false });
  }
  return out;
}
