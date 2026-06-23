export const OUTBOUND_WEBHOOK_PROVIDER = 'outbound_webhook' as const;

export type OutboundWebhookSettings = {
  enabled?: boolean;
  url?: string | null;
  /** Branche-filter. Lege lijst = alle branches van de klant. */
  branches?: string[];
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

export type OutboundWebhookPayload = {
  id: string;
  lead_id: string;
  assignment_id: string;
  branch: string | null;
  categorie: string | null;
  categorieen: string[];
  aanhef: string | null;
  naam: string | null;
  email: string | null;
  telefoonnummer: string | null;
  adres: string | null;
  huisnummer: string | null;
  postcode: string | null;
  plaats: string | null;
  provincie: string | null;
  land: string | null;
  aangemaakt_op: string | null;
};
