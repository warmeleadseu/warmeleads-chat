export const OUTBOUND_WEBHOOK_PROVIDER = 'outbound_webhook' as const;

/** Per-veld instelling: welke bronveld onder welke JSON-key, aan/uit. */
export type OutboundWebhookFieldMapping = {
  /** Vaste interne bronsleutel (zie fields.ts). */
  source: string;
  /** JSON-key in de uitgaande payload (door de klant te bepalen). */
  target: string;
  enabled: boolean;
};

/**
 * Een vaste waarde die altijd meegaat, los van de lead.
 *
 * Sommige ontvangers willen een letterlijke tekst die bij ons nergens als
 * leadveld bestaat: AfsprakenMachine verwacht bijvoorbeeld `bron: "WarmeLeads"`
 * om te zien waar een lead vandaan komt, en `land: "Nederland"` voluit terwijl
 * wij `NL` opslaan. Zonder deze mogelijkheid zou je zoiets per klant in de code
 * moeten zetten, en dat is precies wat je niet wilt.
 */
export type OutboundWebhookConstant = {
  /** JSON-key in de uitgaande payload. */
  target: string;
  /** De letterlijke waarde. */
  value: string;
};

export type OutboundWebhookSettings = {
  enabled?: boolean;
  url?: string | null;
  /** Branche-filter. Lege lijst = alle branches van de klant. */
  branches?: string[];
  /** Veld-mapping; leeg/undefined = standaardmapping (zie fields.ts). */
  field_mappings?: OutboundWebhookFieldMapping[];
  /** Vaste waarden die altijd meegaan, bovenop de veld-mapping. */
  constants?: OutboundWebhookConstant[];
  /**
   * Wat te sturen voor een veld dat leeg is.
   *
   * Standaard `null`, want dat is voor de meeste ontvangers de duidelijkste
   * manier om "niets" te zeggen. Sommige API's accepteren dat niet en willen
   * een lege tekst: AfsprakenMachine antwoordt op een null met
   * "Expected string, received null" en weigert de hele lead. Per koppeling
   * instelbaar, zodat de ene ontvanger de andere niet in de weg zit.
   */
  lege_waarden?: 'null' | 'leeg';
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
