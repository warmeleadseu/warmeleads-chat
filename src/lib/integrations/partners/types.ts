/**
 * Partnerkoppelingen: vaste, kant-en-klare koppelingen met partijen die leads
 * van onze klanten verder opvolgen (eerste partner: Snelraak).
 *
 * Verschil met de algemene uitgaande webhook: daar bepaalt de klant de URL en
 * elk veld. Hier ligt alles vast bij de partner; de klant of admin plakt alleen
 * het geheime adres dat de partner aanlevert. Een partner kost één definitie in
 * het register (registry.ts), geen eigen code door de hele applicatie heen.
 */

/** Wat we van een lead nodig hebben om hem af te leveren. */
export type PartnerLead = {
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
  created_at: string | null;
  custom_fields: Record<string, unknown> | null;
};

export type PartnerPayloadContext = {
  /** Straatnaam, opgeslagen of afgeleid uit postcode + huisnummer. */
  straat: string | null;
  /** Leesbare branchenaam, bijvoorbeeld "Thuisbatterij". */
  brancheNaam: string | null;
  /** Sleutels van de branchevragen die mee mogen; de rest van custom_fields niet. */
  toegestaneVelden: { key: string; label: string }[];
};

/** Hoe een antwoord van de partner moet worden opgevat. */
export type PartnerUitslag =
  | { soort: 'gelukt' }
  /** Later opnieuw proberen: tijdelijk probleem aan hun kant of onderweg. */
  | { soort: 'tijdelijk'; melding: string; wachtSeconden?: number | null }
  /** Opnieuw proberen heeft geen zin (verkeerde URL, geweigerde inhoud). */
  | { soort: 'blijvend'; melding: string };

export type PartnerAntwoord = {
  /** HTTP-status; 0 als er geen antwoord kwam. */
  status: number;
  body: string;
  timeout: boolean;
  netwerkfout: boolean;
  retryAfter: string | null;
};

export type PartnerDefinitie = {
  /** Sleutel in URL's en het register, bijvoorbeeld 'snelraak'. */
  id: string;
  /** Waarde in customer_integrations.provider en integration_sync_log.provider. */
  provider: string;
  naam: string;
  /** Eén regel uitleg voor op de kaart. */
  tagline: string;
  /** Uitleg bij het invoerveld: waar komt de URL vandaan. */
  urlUitleg: string;
  /**
   * Haalt het geheime deel uit een geplakte URL, of null als de URL niet van
   * deze partner is. Alleen dat deel wordt (versleuteld) opgeslagen; de URL
   * zelf bouwen we bij elke levering opnieuw op, zodat hij nergens anders
   * heen kan wijzen dan naar de partner.
   */
  leesToken: (url: string) => string | null;
  bouwUrl: (token: string) => string;
  /** Wat de gebruiker te zien krijgt in plaats van de URL. */
  urlHint: (token: string) => string;
  bouwPayload: (lead: PartnerLead, ctx: PartnerPayloadContext) => Record<string, unknown>;
  /**
   * Testlevering met vaste nepgegevens; nooit een echte lead. Een admin mag er
   * zijn eigen nummer in zetten om te zien wat de klant ontvangt.
   */
  bouwTestPayload: (opties?: { telefoon?: string | null }) => Record<string, unknown>;
  beoordeel: (antwoord: PartnerAntwoord) => PartnerUitslag;
  /** Hoe lang we op een antwoord wachten. */
  timeoutMs: number;
  /** Minimale tijd tussen twee leveringen in één ronde (rate limit partner). */
  pauzeMs: number;
  /**
   * Toewijzingen ouder dan dit gaan nooit meer naar de partner, ook niet na
   * een storing. Voor opvolging binnen een minuut heeft een lead van dagen
   * oud geen zin meer, en de consument verwacht dan geen bericht meer.
   */
  maxLeeftijdUren: number;
};

export type PartnerSettings = {
  enabled?: boolean;
  /** Branchefilter; leeg = alle branches van de klant. */
  branches?: string[];
  /**
   * Leveringen vanaf dit moment. De veegronde van de retry-cron pakt
   * toewijzingen van de laatste 72 uur op die nooit verstuurd zijn; zonder
   * deze grens zou een nieuwe koppeling ongevraagd drie dagen aan oude leads
   * nasturen, en een partner als Snelraak stuurt die mensen dan echt een
   * WhatsApp-bericht, dagen nadat ze iets invulden.
   */
  leveren_vanaf?: string | null;
};
