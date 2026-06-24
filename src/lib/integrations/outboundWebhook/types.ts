export const OUTBOUND_WEBHOOK_PROVIDER = 'outbound_webhook' as const;

/** Per-veld instelling: welke bronveld onder welke JSON-key, aan/uit. */
export type OutboundWebhookFieldMapping = {
  /** Vaste interne bronsleutel (zie fields.ts). */
  source: string;
  /** JSON-key in de uitgaande payload (door de klant te bepalen). */
  target: string;
  enabled: boolean;
};

export type OutboundWebhookSettings = {
  enabled?: boolean;
  url?: string | null;
  /** Branche-filter. Lege lijst = alle branches van de klant. */
  branches?: string[];
  /** Veld-mapping; leeg/undefined = standaardmapping (zie fields.ts). */
  field_mappings?: OutboundWebhookFieldMapping[];
};

export type StoredOutboundWebhook = {
  id: string;
  customer_id: string;
  /** Ontsleuteld bearer-token; null als (nog) niet ingesteld. */
  token: string | null;
  settings: OutboundWebhookSettings;
  connected_at: string | null;
};

/** Subset van de leads-kolommen die we naar de klant-webhook sturen. */
export type LeadForWebhook = {
  id: string;
  branch: string | null;
  naam_klant: string | null;
  email: string | null;
  telefoonnummer: string | null;
  postcode: string | null;
  huisnummer: string | null;
  plaatsnaam: string | null;
  provincie: string | null;
  land: string | null;
  bron: string | null;
  created_at: string | null;
  custom_fields: Record<string, unknown> | null;
};
