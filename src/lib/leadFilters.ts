import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPhoneSearchIlikeClauses, sanitizePostgrestIlike } from '@/lib/phoneSearch';
import { PARTNER_PROSPECT_BRANCH_SLUGS } from '@/lib/partnerProspectConstants';

/**
 * Beschrijft de set filters die zowel `GET /api/admin/leads`,
 * `GET /api/admin/leads/count` als `POST /api/admin/leads/export` accepteren.
 * Houdt de filter-logica in één helper zodat list, count en export
 * gegarandeerd dezelfde resultaten geven.
 */
export type LeadFilterParams = {
  branch?: string | null;
  customer_id?: string | null;
  exclude_customer_id?: string | null;
  assignment?: string | null;
  status?: string | null;
  province?: string | null;
  source?: string | null;
  phone_valid?: string | boolean | null;
  date_from?: string | null;
  date_to?: string | null;
  include_unknown_date?: string | boolean | null;
  search?: string | null;
  bulk_status?: string | null;
};

export function readLeadFilterParams(url: URLSearchParams): LeadFilterParams {
  return {
    branch: url.get('branch'),
    customer_id: url.get('customer_id'),
    exclude_customer_id: url.get('exclude_customer_id'),
    assignment: url.get('assignment'),
    status: url.get('status'),
    province: url.get('province'),
    source: url.get('source'),
    phone_valid: url.get('phone_valid'),
    date_from: url.get('date_from'),
    date_to: url.get('date_to'),
    include_unknown_date: url.get('include_unknown_date'),
    search: url.get('search'),
    bulk_status: url.get('bulk_status'),
  };
}

/**
 * Minimale chainable interface over PostgREST-filter-methodes die we hier
 * gebruiken. We typecast intern naar dit type zodat `applyLeadFilters` niet
 * gebonden is aan een specifiek `PostgrestFilterBuilder<...>`-generic, en
 * tegelijkertijd `any` vermeden wordt.
 */
type ChainableFilter = {
  eq(col: string, val: unknown): ChainableFilter;
  in(col: string, vals: readonly unknown[]): ChainableFilter;
  not(col: string, op: string, val: string): ChainableFilter;
  or(filter: string): ChainableFilter;
  gte(col: string, val: unknown): ChainableFilter;
  lte(col: string, val: unknown): ChainableFilter;
  overlaps(col: string, vals: readonly unknown[] | string): ChainableFilter;
};

/**
 * Past alle lead-filters toe op een PostgREST-query. Wordt door zowel het
 * leads-list-endpoint, het count-endpoint als de export-route gebruikt.
 *
 * `excludePartnerBranchesWhenNoBranchFilter`: standaard false (voor o.a.
 * export). De admin-lijst zet dit op true om partner-prospect-branches te
 * verbergen als er geen expliciet branche-filter is.
 */
export function applyLeadFilters<T>(
  query: T,
  filters: LeadFilterParams,
  options: { excludePartnerBranchesWhenNoBranchFilter?: boolean } = {},
): T {
  const { excludePartnerBranchesWhenNoBranchFilter = false } = options;
  let q = query as unknown as ChainableFilter;

  if (excludePartnerBranchesWhenNoBranchFilter && !filters.branch) {
    q = q.not(
      'branch',
      'in',
      `(${PARTNER_PROSPECT_BRANCH_SLUGS.map(s => `"${s}"`).join(',')})`,
    );
  }

  if (filters.branch) {
    const vals = String(filters.branch).split(',').filter(Boolean);
    if (vals.length === 1) q = q.eq('branch', vals[0]);
    else if (vals.length > 1) q = q.in('branch', vals);
  }
  if (filters.customer_id) {
    const vals = String(filters.customer_id).split(',').filter(Boolean);
    if (vals.length > 0) q = q.overlaps('assigned_customer_ids', vals);
  }
  if (filters.exclude_customer_id) {
    const vals = String(filters.exclude_customer_id).split(',').filter(Boolean);
    if (vals.length > 0) {
      q = q.not('assigned_customer_ids', 'ov', `{${vals.join(',')}}`);
    }
  }
  if (filters.assignment === 'assigned') q = q.eq('is_assigned', true);
  else if (filters.assignment === 'unassigned') q = q.eq('is_assigned', false);

  if (filters.status) {
    const vals = String(filters.status).split(',').filter(Boolean);
    if (vals.length === 1) q = q.eq('status', vals[0]);
    else if (vals.length > 1) q = q.in('status', vals);
  }
  if (filters.province) {
    const vals = String(filters.province).split(',').filter(Boolean);
    if (vals.length === 1) q = q.eq('provincie', vals[0]);
    else if (vals.length > 1) q = q.in('provincie', vals);
  }
  if (filters.source) {
    const vals = String(filters.source).split(',').filter(Boolean);
    if (vals.length === 1) q = q.eq('bron', vals[0]);
    else if (vals.length > 1) q = q.in('bron', vals);
  }

  if (filters.phone_valid === 'false' || filters.phone_valid === false) q = q.eq('phone_valid', false);
  if (filters.phone_valid === 'true' || filters.phone_valid === true) q = q.eq('phone_valid', true);

  const includeUnknownDate =
    filters.include_unknown_date !== false && filters.include_unknown_date !== 'false';

  if (filters.date_from || filters.date_to) {
    if (includeUnknownDate) {
      const conds: string[] = [];
      if (filters.date_from && filters.date_to) {
        conds.push(`and(wervingsdatum.gte.${String(filters.date_from)},wervingsdatum.lte.${String(filters.date_to)})`);
      } else if (filters.date_from) {
        conds.push(`wervingsdatum.gte.${String(filters.date_from)}`);
      } else if (filters.date_to) {
        conds.push(`wervingsdatum.lte.${String(filters.date_to)}`);
      }
      conds.push('wervingsdatum_unknown.eq.true');
      q = q.or(conds.join(','));
    } else {
      if (filters.date_from) q = q.gte('wervingsdatum', String(filters.date_from));
      if (filters.date_to) q = q.lte('wervingsdatum', String(filters.date_to));
    }
  }

  if (filters.search) {
    const s = sanitizePostgrestIlike(String(filters.search));
    const parts = [
      `naam_klant.ilike.%${s}%`,
      `email.ilike.%${s}%`,
      ...buildPhoneSearchIlikeClauses('telefoonnummer', String(filters.search)),
      `postcode.ilike.%${s}%`,
    ];
    q = q.or(parts.join(','));
  }

  if (filters.bulk_status === 'never') q = q.eq('bulk_export_count', 0);
  else if (filters.bulk_status === 'once') q = q.eq('bulk_export_count', 1);
  else if (filters.bulk_status === 'multiple') q = q.gte('bulk_export_count', 2);

  return q as unknown as T;
}

/**
 * Beperk de query tot leads die zijn toegewezen aan klanten van deze
 * accountmanager. Komt voor in zowel list als export.
 */
export async function applyAccountManagerScope<T>(
  supabase: SupabaseClient,
  query: T,
  accountManagerId: string,
): Promise<{ query: T; allowed: boolean }> {
  const { data: myCustomers } = await supabase
    .from('customers')
    .select('id')
    .eq('account_manager_id', accountManagerId);
  const ids = (myCustomers || []).map((c: { id: string }) => c.id);
  if (ids.length === 0) return { query, allowed: false };
  const overlapped = (query as unknown as ChainableFilter).overlaps('assigned_customer_ids', ids);
  return { query: overlapped as unknown as T, allowed: true };
}
