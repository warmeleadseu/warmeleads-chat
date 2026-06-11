import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePartnerProspectAccountManagerId } from '@/lib/partnerProspectAssignment';
import {
  DEFAULT_PARTNER_PROSPECT_AM_ID,
  humanizePartnerBranchLabel,
  isPartnerBranchSlugDynamic,
  isPartnerProspectBranchSlug,
  type PartnerProspectBranchSlug,
} from '@/lib/partnerProspectConstants';

/** @deprecated Gebruik `resolvePartnerProspectAccountManagerId`; blijft als alias voor oude imports. */
export const PARTNER_PROSPECT_ACCOUNT_MANAGER_ID = DEFAULT_PARTNER_PROSPECT_AM_ID;

/**
 * Synchrone check tegen de hardcoded well-known slugs. Voor runtime-routing
 * (webhook/backfill) waar ook DB-gevlagde partner-branches mee moeten doen,
 * gebruik je `isPartnerProspectBranchAsync(supabase, slug)`.
 */
export function isPartnerProspectBranch(branch: string | undefined | null): boolean {
  return isPartnerProspectBranchSlug(branch);
}

/** True als de slug een partner-branche is via DB-vlag of hardcoded lijst. */
export async function isPartnerProspectBranchAsync(
  supabase: SupabaseClient,
  branch: string | undefined | null,
): Promise<boolean> {
  return isPartnerBranchSlugDynamic(supabase, branch);
}

export type PartnerProspectPayload = {
  naam_klant?: string;
  name?: string;
  email?: string;
  telefoonnummer?: string;
  phone?: string;
  postcode?: string;
  huisnummer?: string;
  plaatsnaam?: string;
  city?: string;
  provincie?: string;
  land?: string;
  bedrijfsnaam?: string;
  company_name?: string;
  notities?: string;
  meta_campaign_id?: string;
  meta_adset_id?: string;
  meta_ad_id?: string;
  custom_fields?: Record<string, unknown>;
  /** Lead / webhook context (wordt in source_metadata.lead_ingest_snapshot gezet). */
  wervingsdatum?: string;
  bron?: string;
  lat?: number;
  lng?: number;
  phone_valid?: boolean;
  quality_score?: number | null;
  /** Waarde van `leads.status` vóór conversie. */
  lead_status?: string;
  /** Waarde van `leads.customer_id` vóór conversie (UUID-string). */
  lead_customer_id?: string;
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1') return true;
  if (v === 0 || v === '0') return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 'ja', 'yes'].includes(s)) return true;
    if (['false', 'nee', 'no'].includes(s)) return false;
  }
  return undefined;
}

/** Verwijdert lege waarden; behoudt `false` en `0`. */
function stripEmptyEntries(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (v === '') continue;
    out[k] = v;
  }
  return out;
}

/**
 * Bouwt een `prospects`-insert-record uit webhook/Meta/spreadsheet-achtige velden.
 * `enriched` optioneel: output van enrichLeadAddress (plaats/prov/land/postcode).
 */
export function buildPartnerProspectInsertRow(
  branchSlug: PartnerProspectBranchSlug,
  body: PartnerProspectPayload,
  customFields: Record<string, string>,
  enriched: { plaatsnaam?: string; provincie?: string; postcode?: string; land?: string } | null | undefined,
  accountManagerId: string,
): Record<string, unknown> {
  const cf = { ...customFields };
  const bedrijf = str(body.bedrijfsnaam || body.company_name || cf.bedrijfsnaam || cf.company_name);
  const naam = str(body.naam_klant || body.name);
  const company_name = bedrijf || naam || 'Onbekend';
  const contact_person =
    bedrijf && naam && naam.toLowerCase() !== bedrijf.toLowerCase() ? naam : null;

  const emailRaw = str(body.email);
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const phone = str(body.telefoonnummer || body.phone) || null;
  const postcode = str(body.postcode) || str(enriched?.postcode) || null;
  const city = str(enriched?.plaatsnaam || body.plaatsnaam || body.city) || null;
  const country = str(enriched?.land || body.land) || 'NL';

  const prov = str(enriched?.provincie || body.provincie);
  const notesBase = str(body.notities);
  const notes = notesBase || null;

  const straat = str(cf.straat || cf.street || cf.adres);
  const huisn = str(body.huisnummer);
  let address: string | null = null;
  if (straat && huisn) address = `${straat} ${huisn}`;
  else if (straat) address = straat;
  else if (huisn) address = `Huisnr. ${huisn}`;

  const metaCamp = str(body.meta_campaign_id);
  const metaSet = str(body.meta_adset_id);
  const metaAd = str(body.meta_ad_id);

  const lead_ingest_snapshot = stripEmptyEntries({
    huisnummer: huisn || undefined,
    straat: straat || undefined,
    provincie: prov || undefined,
    wervingsdatum: str(body.wervingsdatum) || undefined,
    bron: str(body.bron) || undefined,
    lat: num(body.lat),
    lng: num(body.lng),
    phone_valid: bool(body.phone_valid),
    quality_score: num(body.quality_score),
    lead_status: str(body.lead_status) || undefined,
    lead_customer_id: str(body.lead_customer_id) || undefined,
    meta_campaign_id: metaCamp || undefined,
    meta_adset_id: metaSet || undefined,
    meta_ad_id: metaAd || undefined,
  });

  const source_metadata: Record<string, unknown> = {
    partner_branch: branchSlug,
    meta_campaign_id: metaCamp || null,
    meta_adset_id: metaSet || null,
    meta_ad_id: metaAd || null,
    custom_fields_snapshot: Object.keys(cf).length ? cf : null,
    lead_ingest_snapshot: Object.keys(lead_ingest_snapshot).length ? lead_ingest_snapshot : null,
  };

  const row: Record<string, unknown> = {
    company_name,
    contact_person,
    email,
    phone,
    postcode,
    city,
    country,
    branches: [branchSlug],
    status: 'nieuw',
    source: 'meta_partner',
    source_metadata,
    account_manager_id: accountManagerId,
    notes,
  };
  if (address) row.address = address;
  return row;
}

export async function findRecentPartnerProspectByEmail(
  supabase: SupabaseClient,
  email: string,
  branchSlug: PartnerProspectBranchSlug,
  days = 30,
): Promise<{ id: string } | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await supabase
    .from('prospects')
    .select('id')
    .eq('email', e)
    .contains('branches', [branchSlug])
    .gte('created_at', since)
    .maybeSingle();
  return data;
}

export function partnerProspectIngestLabel(branchSlug: PartnerProspectBranchSlug): string {
  return humanizePartnerBranchLabel(branchSlug);
}

export async function insertPartnerProspect(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  activity: { title: string; body?: string; type?: string; adminUserId?: string | null },
): Promise<{ id: string } | null> {
  const { data, error } = await supabase.from('prospects').insert(row).select('id').single();
  if (error || !data) {
    console.error('[partnerProspectIngest] insert failed:', error?.message);
    return null;
  }
  const pid = data.id as string;
  await supabase.from('prospect_activities').insert({
    prospect_id: pid,
    admin_user_id: activity.adminUserId ?? null,
    type: activity.type || 'created',
    title: activity.title,
    body: activity.body || null,
    metadata: { source: 'partner_prospect_ingest' },
  });
  return { id: pid };
}

export async function insertPartnerProspectFromEnrichedLeadRow(
  supabase: SupabaseClient,
  leadRow: Record<string, unknown>,
  customFields: Record<string, string>,
  activity: { title: string; body?: string; type?: string; adminUserId?: string | null },
): Promise<{ id: string } | null> {
  const lr = leadRow;
  const branchSlug = str(lr.branch);
  if (!branchSlug) {
    console.error('[partnerProspectIngest] missing branch on lead row');
    return null;
  }
  const accountManagerId = await resolvePartnerProspectAccountManagerId(supabase, branchSlug);
  const payload: PartnerProspectPayload = {
    ...(lr as unknown as PartnerProspectPayload),
    wervingsdatum: str(lr.wervingsdatum),
    bron: str(lr.bron),
    lat: num(lr.lat),
    lng: num(lr.lng),
    phone_valid: bool(lr.phone_valid),
    quality_score: lr.quality_score != null && lr.quality_score !== '' ? num(lr.quality_score) : undefined,
    lead_status: str(lr.status),
    lead_customer_id: lr.customer_id != null ? String(lr.customer_id) : undefined,
  };
  const row = buildPartnerProspectInsertRow(
    branchSlug,
    payload,
    customFields,
    {
      plaatsnaam: lr.plaatsnaam as string | undefined,
      provincie: lr.provincie as string | undefined,
      postcode: lr.postcode as string | undefined,
      land: lr.land as string | undefined,
    },
    accountManagerId,
  );
  return insertPartnerProspect(supabase, row, activity);
}
