/**
 * High-level hooks rond de Meta Conversions API.
 *
 * Doel: Meta's optimizer voorzien van échte funnel-feedback zodat de AI-campagnes
 * leren welke leads kwalificeren en verkocht worden.
 *
 * Event-naming:
 *  - "Lead"           bij elke nieuwe lead in onze database (één keer per lead_id).
 *  - "QualifiedLead"  bij eerste status-overgang naar gecontacteerd of offerte
 *                     (één per assignment_id; trigger zet terminal_status_at niet,
 *                     dus we sturen direct vanuit de PUT-route).
 *  - "Purchase"       bij status verkocht (één per assignment_id) met value =
 *                     price_per_lead × 1 (de waarde van een verkochte lead).
 *
 * Event-id is deterministisch zodat Meta dedupliceert binnen 48u (en wij idempotent
 * kunnen retryen). Alle CAPI-calls zijn fire-and-forget: nooit blokkeren wij een
 * webhook of admin/portal-actie op een Meta-fout.
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
  branch?: string | null;
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
  /** Override event-id (defaults: lead:/qlead:/purchase:<id>). */
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

/* ── Public API ─────────────────────────────────────────────── */

export async function sendLeadEvent(leadId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!getCapiCredentials()) return { ok: false, reason: 'capi_not_configured' };
  const supabase = createServerClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, email, telefoonnummer, naam_klant, postcode, plaatsnaam, land, meta_campaign_id, meta_ad_id, meta_adset_id, branch, lead_cost, created_at, bron')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { ok: false, reason: 'lead_not_found' };
  // Alleen Meta-attributable leads: vermijd CAPI-pollutie voor Excel-imports of
  // andere bronnen die nooit door een Meta-ad zijn aangevraagd.
  const isMetaAttributable = !!(lead.meta_campaign_id || lead.meta_ad_id || lead.meta_adset_id)
    || ['zapier', 'meta', 'meta_lead_ads', 'facebook'].includes(String(lead.bron || '').toLowerCase());
  if (!isMetaAttributable) return { ok: false, reason: 'not_meta_attributable' };
  const eventTime = lead.created_at ? Math.floor(new Date(lead.created_at).getTime() / 1000) : undefined;
  return sendForLead('Lead', lead as LeadRow, {}, { eventId: `lead:${lead.id}`, eventTimeUnix: eventTime });
}

interface AssignmentJoinRow {
  id: string;
  lead_id: string;
  customer_id: string;
  status: string;
  assigned_at: string | null;
  terminal_status_at: string | null;
  batch:
    | { id: string; price_per_lead: number | null }
    | { id: string; price_per_lead: number | null }[]
    | null;
}

function priceFromBatch(batch: AssignmentJoinRow['batch']): number | null {
  if (!batch) return null;
  const single = Array.isArray(batch) ? batch[0] : batch;
  if (!single) return null;
  return typeof single.price_per_lead === 'number' ? single.price_per_lead : null;
}

function isLeadMetaAttributable(lead: { meta_campaign_id?: string | null; meta_ad_id?: string | null; meta_adset_id?: string | null; bron?: string | null }): boolean {
  if (lead.meta_campaign_id || lead.meta_ad_id || lead.meta_adset_id) return true;
  return ['zapier', 'meta', 'meta_lead_ads', 'facebook'].includes(String(lead.bron || '').toLowerCase());
}

export async function sendQualifiedLeadEventForAssignment(assignmentId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!getCapiCredentials()) return { ok: false, reason: 'capi_not_configured' };
  const supabase = createServerClient();
  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, customer_id, status, assigned_at, terminal_status_at, batch:customer_batches!batch_id(id, price_per_lead)')
    .eq('id', assignmentId)
    .maybeSingle();
  if (!assignment) return { ok: false, reason: 'assignment_not_found' };
  const { data: lead } = await supabase
    .from('leads')
    .select('id, email, telefoonnummer, naam_klant, postcode, plaatsnaam, land, meta_campaign_id, meta_ad_id, meta_adset_id, branch, lead_cost, bron')
    .eq('id', assignment.lead_id)
    .maybeSingle();
  if (!lead) return { ok: false, reason: 'lead_not_found' };
  if (!isLeadMetaAttributable(lead)) return { ok: false, reason: 'not_meta_attributable' };
  const value = priceFromBatch((assignment as AssignmentJoinRow).batch) || lead.lead_cost || undefined;
  return sendForLead('QualifiedLead', lead as LeadRow, {
    assignment_id: assignment.id,
    customer_id: assignment.customer_id,
    status: assignment.status,
    ...(value != null ? { value, currency: 'EUR' } : {}),
  }, { eventId: `qlead:${assignment.id}` });
}

export async function sendPurchaseEventForAssignment(assignmentId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!getCapiCredentials()) return { ok: false, reason: 'capi_not_configured' };
  const supabase = createServerClient();
  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, customer_id, status, assigned_at, terminal_status_at, batch:customer_batches!batch_id(id, price_per_lead)')
    .eq('id', assignmentId)
    .maybeSingle();
  if (!assignment) return { ok: false, reason: 'assignment_not_found' };
  const { data: lead } = await supabase
    .from('leads')
    .select('id, email, telefoonnummer, naam_klant, postcode, plaatsnaam, land, meta_campaign_id, meta_ad_id, meta_adset_id, branch, lead_cost, bron')
    .eq('id', assignment.lead_id)
    .maybeSingle();
  if (!lead) return { ok: false, reason: 'lead_not_found' };
  if (!isLeadMetaAttributable(lead)) return { ok: false, reason: 'not_meta_attributable' };
  const value = priceFromBatch((assignment as AssignmentJoinRow).batch) || lead.lead_cost || 0;
  const eventTime = (assignment as AssignmentJoinRow).terminal_status_at
    ? Math.floor(new Date((assignment as AssignmentJoinRow).terminal_status_at!).getTime() / 1000)
    : undefined;
  return sendForLead('Purchase', lead as LeadRow, {
    assignment_id: assignment.id,
    customer_id: assignment.customer_id,
    value,
    currency: 'EUR',
  }, { eventId: `purchase:${assignment.id}`, eventTimeUnix: eventTime });
}

/**
 * Convenience-helper: bepaal op basis van statusovergang welk event te sturen
 * en vuur fire-and-forget af. Mag in elke route na een PUT op lead_assignments.
 */
export function dispatchCapiForAssignmentStatus(
  assignmentId: string,
  previousStatus: string | null,
  newStatus: string,
): void {
  if (!getCapiCredentials()) return;
  if (previousStatus === newStatus) return;

  if (newStatus === 'gecontacteerd' || newStatus === 'offerte') {
    sendQualifiedLeadEventForAssignment(assignmentId)
      .then(r => { if (!r.ok) console.warn('[capi] qlead failed', r.reason); })
      .catch(e => console.warn('[capi] qlead threw', (e as Error).message));
  } else if (newStatus === 'verkocht') {
    sendPurchaseEventForAssignment(assignmentId)
      .then(r => { if (!r.ok) console.warn('[capi] purchase failed', r.reason); })
      .catch(e => console.warn('[capi] purchase threw', (e as Error).message));
  }
}

export function fireLeadCapi(leadId: string): void {
  if (!getCapiCredentials()) return;
  sendLeadEvent(leadId)
    .then(r => { if (!r.ok) console.warn('[capi] lead failed', r.reason); })
    .catch(e => console.warn('[capi] lead threw', (e as Error).message));
}

export const __internal = {
  buildCapiUserDataFromLead,
  mapCountry,
  splitName,
  priceFromBatch,
};
