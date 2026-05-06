import type { SupabaseClient } from '@supabase/supabase-js';

export const PROSPECT_STATUSES = [
  'nieuw',
  'voicemail',
  'contact',
  'gekwalificeerd',
  'voorstel',
  'gewonnen',
  'verloren',
  'niet_relevant',
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  nieuw: 'Nieuw',
  voicemail: 'Voicemail',
  contact: 'Contact gelegd',
  gekwalificeerd: 'Gekwalificeerd',
  voorstel: 'Voorstel',
  gewonnen: 'Gewonnen',
  verloren: 'Verloren',
  niet_relevant: 'Niet relevant',
};

export const PROSPECT_STATUS_COLORS: Record<ProspectStatus, { bg: string; text: string; ring: string; dot: string }> = {
  nieuw: { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200', dot: 'bg-slate-400' },
  voicemail: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', dot: 'bg-amber-500' },
  contact: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200', dot: 'bg-sky-500' },
  gekwalificeerd: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200', dot: 'bg-purple-500' },
  voorstel: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', dot: 'bg-orange-500' },
  gewonnen: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  verloren: { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', dot: 'bg-rose-500' },
  niet_relevant: { bg: 'bg-slate-50', text: 'text-slate-500', ring: 'ring-slate-200', dot: 'bg-slate-300' },
};

export const PROSPECT_SOURCES = [
  'manual',
  'csv_import',
  'xlsx_import',
  'website',
  'referral',
  'other',
] as const;

export type ProspectSource = (typeof PROSPECT_SOURCES)[number];

export interface AdminContext {
  id: string;
  role: string;
  name?: string | null;
}

export interface ProspectRow {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  kvk_nummer: string | null;
  vat_id: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  branches: string[] | null;
  company_size: string | null;
  notes: string | null;
  status: ProspectStatus;
  status_changed_at: string | null;
  lost_reason: string | null;
  source: ProspectSource;
  source_metadata: Record<string, unknown> | null;
  account_manager_id: string | null;
  assigned_at: string | null;
  converted_to_customer_id: string | null;
  converted_at: string | null;
  next_action_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_admin_id: string | null;
}

/**
 * Returns true when the admin can only access their own prospects.
 * Superadmin and admin see everything; accountmanager-only role is scoped.
 */
export function isAccountManagerScope(admin: AdminContext): boolean {
  return admin.role === 'accountmanager';
}

/**
 * Apply AM scoping consistently to a Supabase query.
 * Mirrors the pattern in src/app/api/admin/customers/route.ts.
 */
export function applyAmScope<T extends { eq: (col: string, val: unknown) => T }>(
  query: T,
  admin: AdminContext,
): T {
  if (isAccountManagerScope(admin)) {
    return query.eq('account_manager_id', admin.id);
  }
  return query;
}

export interface ProspectAccessResult {
  ok: boolean;
  reason?: 'not_found' | 'forbidden';
  prospect?: ProspectRow;
}

/**
 * Loads a prospect and verifies the admin may access it. Use in [id] routes.
 */
export async function loadAccessibleProspect(
  supabase: SupabaseClient,
  admin: AdminContext,
  prospectId: string,
): Promise<ProspectAccessResult> {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', prospectId)
    .single();

  if (error || !data) return { ok: false, reason: 'not_found' };

  if (isAccountManagerScope(admin) && data.account_manager_id !== admin.id) {
    return { ok: false, reason: 'forbidden' };
  }

  return { ok: true, prospect: data as ProspectRow };
}

export function isValidStatus(s: unknown): s is ProspectStatus {
  return typeof s === 'string' && (PROSPECT_STATUSES as readonly string[]).includes(s);
}

export function isValidSource(s: unknown): s is ProspectSource {
  return typeof s === 'string' && (PROSPECT_SOURCES as readonly string[]).includes(s);
}
