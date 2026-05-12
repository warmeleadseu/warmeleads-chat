import type { SupabaseClient } from '@supabase/supabase-js';

/** Zelfde slug als `branches.slug` voor Meta/Zapier partner-acquisitie. */
export const PARTNER_PROSPECT_BRANCH_SLUG = 'thuisbatterij_partners' as const;

/** Standaard AM voor partner-prospects (Rick Schlimback — superadmin). */
export const PARTNER_PROSPECT_ACCOUNT_MANAGER_ID = '64cad239-1eaf-497e-9c2b-d2ea60cb0512';

export function isPartnerProspectBranch(branch: string | undefined | null): boolean {
  return (branch || '').trim() === PARTNER_PROSPECT_BRANCH_SLUG;
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
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
}

/**
 * Bouwt een `prospects`-insert-record uit webhook/Meta/spreadsheet-achtige velden.
 * `enriched` optioneel: output van enrichLeadAddress (plaats/prov/land/postcode).
 */
export function buildPartnerProspectInsertRow(
  body: PartnerProspectPayload,
  customFields: Record<string, string>,
  enriched?: { plaatsnaam?: string; provincie?: string; postcode?: string; land?: string } | null,
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
  const notes =
    [notesBase, prov ? `Provincie (formulier): ${prov}` : ''].filter(Boolean).join('\n') || null;

  const source_metadata: Record<string, unknown> = {
    partner_branch: PARTNER_PROSPECT_BRANCH_SLUG,
    meta_campaign_id: str(body.meta_campaign_id) || null,
    meta_adset_id: str(body.meta_adset_id) || null,
    meta_ad_id: str(body.meta_ad_id) || null,
    custom_fields_snapshot: Object.keys(cf).length ? cf : null,
  };

  return {
    company_name,
    contact_person,
    email,
    phone,
    postcode,
    city,
    country,
    branches: [PARTNER_PROSPECT_BRANCH_SLUG],
    status: 'nieuw',
    source: 'meta_partner',
    source_metadata,
    account_manager_id: PARTNER_PROSPECT_ACCOUNT_MANAGER_ID,
    notes,
  };
}

export async function findRecentPartnerProspectByEmail(
  supabase: SupabaseClient,
  email: string,
  days = 30,
): Promise<{ id: string } | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await supabase
    .from('prospects')
    .select('id')
    .eq('email', e)
    .contains('branches', [PARTNER_PROSPECT_BRANCH_SLUG])
    .gte('created_at', since)
    .maybeSingle();
  return data;
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
  const row = buildPartnerProspectInsertRow(
    leadRow as unknown as PartnerProspectPayload,
    customFields,
    {
      plaatsnaam: leadRow.plaatsnaam as string | undefined,
      provincie: leadRow.provincie as string | undefined,
      postcode: leadRow.postcode as string | undefined,
      land: leadRow.land as string | undefined,
    },
  );
  return insertPartnerProspect(supabase, row, activity);
}
