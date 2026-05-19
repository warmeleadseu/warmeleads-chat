/**
 * Meta Conversions API hook — afgestemd op WarmeLeads' business-model.
 *
 * Wij verkopen leads aan installateurs/aannemers per branche en zijn niet
 * verantwoordelijk voor wat de eindklant met die lead doet (offerte, sale).
 * Kwalificatie van leads gebeurt in het Lead Form zelf (slimme vragen +
 * NAW-validatie). Daarom sturen we alléén een `Lead`-event terug aan Meta:
 *
 *   • bij elke nieuwe lead met phone_valid !== false
 *   • één keer per lead_id, met deterministisch event_id voor deduplicatie
 *   • alleen voor Meta-attributable bronnen (leadgen_id of meta_*_id of zapier-bron)
 *
 * QualifiedLead- en Purchase-events sturen we expliciet NIET. Voor de
 * AI-optimizer is "kwaliteit" geoperationaliseerd als phone_valid + lead in
 * de juiste branche — die filter is aan ónze kant prima en geeft Meta's ML
 * een schoner "this is what a good lead looks like"-signaal.
 */
import { createServerClient } from '@/lib/supabase';
import { sendCapiEvent, getCapiCredentials, type CapiEventName } from '@/lib/metaConversionApi';

/** Bron-URL voor CAPI: helpt bij attribution/koppeling in Events Manager. */
const SOURCE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.nl';

interface LeadRow {
  id: string;
  email?: string | null;
  telefoonnummer?: string | null;
  naam_klant?: string | null;
  postcode?: string | null;
  plaatsnaam?: string | null;
  land?: string | null;
  meta_campaign_id?: string | null;
  meta_ad_id?: string | null;
  meta_adset_id?: string | null;
  /** Meta Lead Ads submission id — cruciaal voor CAPI for Lead Ads attribution. */
  meta_leadgen_id?: string | null;
  branch?: string | null;
  /** Quality-gate: false → CAPI dispatch wordt overgeslagen. */
  phone_valid?: boolean | null;
  lead_cost?: number | null;
  created_at?: string | null;
}

function splitName(full: string | null | undefined): { firstName?: string; lastName?: string } {
  if (!full) return {};
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(-1)[0] };
}

function mapCountry(land: string | null | undefined): string {
  const v = (land || '').toLowerCase();
  if (v.startsWith('be') || v === 'belgië' || v === 'belgie' || v === 'belgium') return 'be';
  return 'nl';
}

/** Lead-row → CAPI user_data input. */
export function buildCapiUserDataFromLead(lead: LeadRow): import('./metaConversionApi').CapiUserData {
  const { firstName, lastName } = splitName(lead.naam_klant);
  return {
    email: lead.email || null,
    phone: lead.telefoonnummer || null,
    firstName,
    lastName,
    city: lead.plaatsnaam || null,
    zip: lead.postcode || null,
    country: mapCountry(lead.land),
    externalId: lead.id,
  };
}

interface SendOpts {
  /** Override event-id (default: `lead:<id>`). */
  eventId?: string;
  /** UNIX-seconds van origineel event; default = nu of created_at. */
  eventTimeUnix?: number;
}

async function sendForLead(
  eventName: CapiEventName,
  lead: LeadRow,
  customData: Record<string, unknown>,
  opts: SendOpts = {},
): Promise<{ ok: boolean; reason?: string }> {
  if (!getCapiCredentials()) return { ok: false, reason: 'capi_not_configured' };
  const user = buildCapiUserDataFromLead(lead);
  const result = await sendCapiEvent({
    eventName,
    eventId: opts.eventId,
    eventTime: opts.eventTimeUnix,
    user,
    customData: {
      branch: lead.branch || undefined,
      // Meta gebruikt `lead_id` (= Lead Ads submission-id) als primaire match-sleutel
      // voor CAPI for Lead Ads. Daarmee koppelt Meta dit event terug aan de
      // oorspronkelijke campagne/adset/ad zonder dat we het zelf hoeven mee te sturen.
      ...(lead.meta_leadgen_id ? { lead_id: lead.meta_leadgen_id } : {}),
      meta_campaign_id: lead.meta_campaign_id || undefined,
      meta_ad_id: lead.meta_ad_id || undefined,
      meta_adset_id: lead.meta_adset_id || undefined,
      ...customData,
    },
    sourceUrl: SOURCE_URL,
  });
  if (!result.ok) return { ok: false, reason: result.error };
  return { ok: true };
}

function isLeadMetaAttributable(lead: { meta_leadgen_id?: string | null; meta_campaign_id?: string | null; meta_ad_id?: string | null; meta_adset_id?: string | null; bron?: string | null }): boolean {
  if (lead.meta_leadgen_id || lead.meta_campaign_id || lead.meta_ad_id || lead.meta_adset_id) return true;
  return ['zapier', 'meta', 'meta_lead_ads', 'facebook'].includes(String(lead.bron || '').toLowerCase());
}

/* ── Public API ─────────────────────────────────────────────── */

export async function sendLeadEvent(leadId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!getCapiCredentials()) return { ok: false, reason: 'capi_not_configured' };
  const supabase = createServerClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, email, telefoonnummer, naam_klant, postcode, plaatsnaam, land, meta_campaign_id, meta_ad_id, meta_adset_id, meta_leadgen_id, branch, phone_valid, lead_cost, created_at, bron')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { ok: false, reason: 'lead_not_found' };
  // Skip leads met expliciet ongeldig telefoonnummer. Dat zijn de leads die we
  // ook niet uitdelen aan klanten — voor Meta's ML willen we daarvoor geen
  // optimization-signaal sturen, anders gaat de optimizer rotzooi-leads opzoeken.
  if (lead.phone_valid === false) return { ok: false, reason: 'phone_invalid' };
  // Alleen Meta-attributable leads: vermijd CAPI-pollutie voor Excel-imports of
  // andere bronnen die nooit door een Meta-ad zijn aangevraagd.
  if (!isLeadMetaAttributable(lead)) return { ok: false, reason: 'not_meta_attributable' };
  const eventTime = lead.created_at ? Math.floor(new Date(lead.created_at).getTime() / 1000) : undefined;
  return sendForLead('Lead', lead as LeadRow, {}, { eventId: `lead:${lead.id}`, eventTimeUnix: eventTime });
}

/** Fire-and-forget Lead-event vanuit een non-blocking context (webhook/admin/portal). */
export function fireLeadCapi(leadId: string): void {
  if (!getCapiCredentials()) return;
  sendLeadEvent(leadId)
    .then(r => { if (!r.ok && r.reason !== 'phone_invalid' && r.reason !== 'not_meta_attributable') console.warn('[capi] lead failed', r.reason); })
    .catch(e => console.warn('[capi] lead threw', (e as Error).message));
}

export const __internal = {
  buildCapiUserDataFromLead,
  mapCountry,
  splitName,
  isLeadMetaAttributable,
};
