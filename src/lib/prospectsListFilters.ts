/**
 * Gedeelde filterlogica voor de prospects-lijst en de prospects-export.
 *
 * Laat de twee API-routes (`GET /api/admin/prospects` en
 * `POST /api/admin/prospects/export`) dezelfde set filters delen, zodat een
 * gebruiker er per definitie zeker van kan zijn dat de export *exact* het
 * lijstje is dat ze in de UI zien -- inclusief tekstzoekopdracht over telefoon-
 * varianten via de `prospect_ids_by_phone_digits`-RPC.
 *
 * De helper bouwt een "filter-applicator" voor de huidige admin/filter-set en
 * geeft die als functie terug. Roep `applyTo(query)` aan om dezelfde filters
 * op meerdere querybuilders toe te passen (count + data + ...).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyAmScope,
  isAccountManagerScope,
  isValidSource,
  isValidStatus,
  type AdminContext,
} from './prospects';
import {
  buildPhoneSearchIlikeClauses,
  phoneSearchDigitVariants,
  sanitizePostgrestIlike,
} from './phoneSearch';

export interface ProspectListFilterInput {
  search?: string | null;
  status?: string | null;
  account_manager_id?: string | null;
  branch?: string | null;
  source?: string | null;
  has_open_tasks?: string | boolean | null;
}

export function readProspectListFiltersFromUrl(
  searchParams: URLSearchParams,
): ProspectListFilterInput {
  return {
    search: (searchParams.get('search') || '').trim() || null,
    status: searchParams.get('status'),
    account_manager_id: searchParams.get('account_manager_id'),
    branch: searchParams.get('branch'),
    source: searchParams.get('source'),
    has_open_tasks: searchParams.get('has_open_tasks'),
  };
}

/**
 * PostgREST `.or()` filter: bedrijf, contact, e-mail, plaats, KVK, telefoon
 * (NL-varianten 06/316/0031). Returnt een lege string als er niets te zoeken
 * is.
 */
function buildProspectTextSearchOrFilter(searchRaw: string): string {
  const trimmed = searchRaw.trim();
  if (!trimmed) return '';

  const sanitized = sanitizePostgrestIlike(trimmed);
  return [
    `company_name.ilike.%${sanitized}%`,
    `contact_person.ilike.%${sanitized}%`,
    `email.ilike.%${sanitized}%`,
    `city.ilike.%${sanitized}%`,
    `kvk_nummer.ilike.%${sanitized}%`,
    ...buildPhoneSearchIlikeClauses('phone', trimmed),
  ].join(',');
}

function asUuidStringArray(raw: unknown): string[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0];
  if (typeof first === 'string') return (raw as string[]).filter(Boolean);
  if (typeof first === 'object' && first !== null) {
    const key = 'prospect_ids_by_phone_digits';
    return (raw as Record<string, string>[])
      .map(row =>
        typeof row[key] === 'string'
          ? row[key]
          : Object.values(row).find(v => typeof v === 'string'),
      )
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  return [];
}

/**
 * Bereidt alle filters voor (incl. async phone-RPC-zoekactie) en geeft een
 * functie terug die de filters toepast op een willekeurige Supabase-query-
 * builder voor de `prospects`-tabel. Behoudt de generieke return-type van de
 * builder zodat downstream methodes als `.order(...).range(...).select(...)`
 * direct beschikbaar blijven.
 */
export async function buildProspectFilterApplicator(
  supabase: SupabaseClient,
  admin: AdminContext,
  filters: ProspectListFilterInput,
): Promise<<Q>(query: Q) => Q> {
  const search = (filters.search || '').trim();
  let orFilter = '';

  if (search) {
    const textFilter = buildProspectTextSearchOrFilter(search);
    orFilter = textFilter;

    const digitIdSet = new Set<string>();
    for (const variant of phoneSearchDigitVariants(search)) {
      if (variant.length < 3) continue;
      const { data: digitIdRows, error: rpcErr } = await supabase.rpc(
        'prospect_ids_by_phone_digits',
        {
          digits: variant,
          p_am_id: isAccountManagerScope(admin) ? admin.id : null,
        },
      );
      if (rpcErr) {
        console.warn('[prospects] prospect_ids_by_phone_digits RPC:', rpcErr.message);
      } else {
        for (const id of asUuidStringArray(digitIdRows)) {
          digitIdSet.add(id);
        }
      }
    }
    if (digitIdSet.size > 0) {
      const maxIds = 800;
      const capped = [...digitIdSet].slice(0, maxIds);
      orFilter = `${textFilter},id.in.(${capped.join(',')})`;
    }
  }

  const hasOpenTasksRaw = filters.has_open_tasks;
  const hasOpenTasks =
    hasOpenTasksRaw === '1' || hasOpenTasksRaw === true || hasOpenTasksRaw === 'true';

  const status =
    filters.status && filters.status !== 'all' && isValidStatus(filters.status)
      ? filters.status
      : null;
  const branch = filters.branch || null;
  const source = filters.source && isValidSource(filters.source) ? filters.source : null;
  const amId = !isAccountManagerScope(admin) ? filters.account_manager_id : null;

  return function applyFilters<Q>(query: Q): Q {
    let q = applyAmScope(query as never, admin) as Q;

    if (orFilter) {
      q = (q as unknown as { or: (s: string) => Q }).or(orFilter);
    }
    if (status) {
      q = (q as unknown as { eq: (c: string, v: string) => Q }).eq('status', status);
    }
    if (amId) {
      if (amId === 'unassigned') {
        q = (q as unknown as { is: (c: string, v: null) => Q }).is('account_manager_id', null);
      } else {
        q = (q as unknown as { eq: (c: string, v: string) => Q }).eq('account_manager_id', amId);
      }
    }
    if (branch) {
      q = (q as unknown as { contains: (c: string, v: string[]) => Q }).contains('branches', [branch]);
    }
    if (source) {
      q = (q as unknown as { eq: (c: string, v: string) => Q }).eq('source', source);
    }
    if (hasOpenTasks) {
      q = (q as unknown as { not: (c: string, op: string, v: null) => Q }).not(
        'next_action_at',
        'is',
        null,
      );
    }
    return q;
  };
}
