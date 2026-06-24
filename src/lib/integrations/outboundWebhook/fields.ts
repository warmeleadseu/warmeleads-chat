import type { OutboundWebhookFieldMapping } from './types';

export type WebhookSourceField = {
  /** Vaste interne sleutel. Branche-specifieke velden krijgen het prefix 'custom:'. */
  key: string;
  /** Standaard JSON-key in de uitgaande payload. */
  defaultTarget: string;
  /** Label voor in het portaal. */
  label: string;
};

/** Prefix voor branche-specifieke velden uit lead.custom_fields. */
export const CUSTOM_FIELD_PREFIX = 'custom:';

/**
 * Vaste basisvelden die voor elke lead beschikbaar zijn. Branche-specifieke
 * velden (uit branch_fields) worden hier dynamisch aan toegevoegd per klant.
 */
export const WEBHOOK_BASE_FIELDS: WebhookSourceField[] = [
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

export type DynamicField = { key: string; label: string };

/**
 * Bouwt de volledige veld-catalogus: basisvelden + branche-specifieke velden
 * (uit branch_fields) onder het 'custom:'-prefix. Dedupliceert op sleutel.
 */
export function buildSourceFieldCatalog(dynamic: DynamicField[] = []): WebhookSourceField[] {
  const out = [...WEBHOOK_BASE_FIELDS];
  const seen = new Set(out.map((f) => f.key));
  for (const d of dynamic) {
    if (!d?.key) continue;
    const key = `${CUSTOM_FIELD_PREFIX}${d.key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, defaultTarget: d.key, label: d.label?.trim() || d.key });
  }
  return out;
}

/** Standaardmapping voor een catalogus: alle velden aan, met standaard JSON-key. */
export function defaultFieldMappings(
  catalog: WebhookSourceField[] = WEBHOOK_BASE_FIELDS,
): OutboundWebhookFieldMapping[] {
  return catalog.map((f) => ({ source: f.key, target: f.defaultTarget, enabled: true }));
}

/**
 * Combineert een opgeslagen mapping met de catalogus, in catalogusvolgorde.
 * - Geen opgeslagen mapping -> volledige standaardmapping (alles aan).
 * - Wel opgeslagen mapping -> velden die er niet in staan worden uitgezet
 *   (de klant heeft die bewust niet gekozen / het is een nieuw veld).
 */
export function resolveFieldMappings(
  stored: OutboundWebhookFieldMapping[] | null | undefined,
  catalog: WebhookSourceField[] = WEBHOOK_BASE_FIELDS,
): OutboundWebhookFieldMapping[] {
  if (!stored || stored.length === 0) return defaultFieldMappings(catalog);

  const validKeys = new Set(catalog.map((f) => f.key));
  const byKey = new Map(
    stored.filter((m) => validKeys.has(m.source)).map((m) => [m.source, m]),
  );

  return catalog.map((f) => {
    const m = byKey.get(f.key);
    if (!m) return { source: f.key, target: f.defaultTarget, enabled: false };
    return {
      source: f.key,
      target: m.target?.trim() || f.defaultTarget,
      enabled: m.enabled !== false,
    };
  });
}

/** Saneert binnenkomende mapping uit een portal-request tegen de geldige sleutels. */
export function sanitizeFieldMappings(
  input: unknown,
  validKeys: Set<string>,
): OutboundWebhookFieldMapping[] {
  if (!Array.isArray(input)) return [];
  const out: OutboundWebhookFieldMapping[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const m = raw as { source?: unknown; target?: unknown; enabled?: unknown };
    if (typeof m.source !== 'string' || !validKeys.has(m.source)) continue;
    const target = typeof m.target === 'string' ? m.target.trim().slice(0, 100) : '';
    out.push({ source: m.source, target, enabled: m.enabled !== false });
  }
  return out;
}
