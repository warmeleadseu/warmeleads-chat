import { createServerClient } from './supabase';

export type AdminRole = 'superadmin' | 'admin' | 'accountmanager';

export interface AdminInfo {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

const MENU_ACCESS: Record<string, AdminRole[]> = {
  '/admin':             ['superadmin', 'admin', 'accountmanager'],
  '/admin/leads':       ['superadmin', 'admin', 'accountmanager'],
  '/admin/reclamaties': ['superadmin', 'admin', 'accountmanager'],
  '/admin/verdeling':   ['superadmin'],
  '/admin/import':      ['superadmin'],
  '/admin/customers':   ['superadmin', 'admin', 'accountmanager'],
  '/admin/batches':     ['superadmin', 'admin', 'accountmanager'],
  '/admin/orders':      ['superadmin', 'admin', 'accountmanager'],
  '/admin/invoices':    ['superadmin', 'admin', 'accountmanager'],
  '/admin/branches':    ['superadmin', 'admin'],
  '/admin/agenda':      ['superadmin', 'admin', 'accountmanager'],
  '/admin/bedrijf':     ['superadmin'],
  '/admin/koppelingen': ['superadmin'],
  '/admin/live':        ['superadmin', 'admin', 'accountmanager'],
  '/admin/audit':       ['superadmin'],
  '/admin/users':       ['superadmin'],
  '/admin/am-targets':  ['superadmin'],
  '/admin/am-leaderboard': ['superadmin'],
};

export function canAccess(role: AdminRole, path: string): boolean {
  const roles = MENU_ACCESS[path];
  if (!roles) return role === 'superadmin';
  return roles.includes(role);
}

export function getMenuAccess(): Record<string, AdminRole[]> {
  return MENU_ACCESS;
}

export type CustomerScope =
  | { scoped: false }
  | { scoped: true; customerIds: string[] };

/** Sentinel in admin-UI/API: klant delen met alle accountmanagers. */
export const ALL_ACCOUNT_MANAGERS = '__all__';

/**
 * PostgREST `.or(...)` filter: eigen toegewezen klanten óf gedeeld met alle AMs.
 * Gebruik op queries tegen `customers`.
 */
export function amCustomerAccessOrFilter(adminId: string): string {
  return `account_manager_id.eq.${adminId},shared_with_all_ams.eq.true`;
}

type OrFilterable = { or: (filter: string) => OrFilterable };

/** Scope een customers-query voor een accountmanager. */
export function applyAmCustomerFilter<T extends OrFilterable>(query: T, adminId: string): T {
  return query.or(amCustomerAccessOrFilter(adminId)) as T;
}

/** In-memory check: AM mag deze klant zien (eigen of gedeeld). */
export function customerVisibleToAm(
  customer: { account_manager_id?: string | null; shared_with_all_ams?: boolean | null },
  adminId: string,
): boolean {
  if (customer.shared_with_all_ams) return true;
  return customer.account_manager_id === adminId;
}

/**
 * Normaliseer AM-toewijzing bij create/update:
 * - `__all__` / shared_with_all_ams=true → gedeeld, geen vaste AM
 * - expliciete AM / leeg → shared uit
 */
export function normalizeCustomerAmAssignment(updates: Record<string, unknown>): void {
  if (updates.account_manager_id === ALL_ACCOUNT_MANAGERS) {
    updates.account_manager_id = null;
    updates.shared_with_all_ams = true;
    return;
  }
  if (updates.shared_with_all_ams === true) {
    updates.account_manager_id = null;
    updates.shared_with_all_ams = true;
    return;
  }
  if ('account_manager_id' in updates) {
    const id = updates.account_manager_id;
    updates.account_manager_id = typeof id === 'string' && id.length > 0 ? id : null;
    if (!('shared_with_all_ams' in updates)) {
      updates.shared_with_all_ams = false;
    }
  }
}

export async function getCustomerScope(admin: Pick<AdminInfo, 'id' | 'role'>): Promise<CustomerScope> {
  if (admin.role !== 'accountmanager') return { scoped: false };

  const supabase = createServerClient();
  const { data } = await supabase
    .from('customers')
    .select('id')
    .or(amCustomerAccessOrFilter(admin.id));

  return { scoped: true, customerIds: (data || []).map(c => c.id) };
}

/**
 * Bepaalt of een admin een specifieke klant mag zien/bewerken. Superadmin en
 * gewone admin hebben altijd toegang; accountmanagers tot hun eigen toegewezen
 * klanten én klanten die met alle AMs gedeeld zijn.
 */
export async function adminCanAccessCustomer(
  admin: Pick<AdminInfo, 'id' | 'role'>,
  customerId: string,
): Promise<boolean> {
  if (admin.role !== 'accountmanager') return true;
  if (!customerId) return false;

  const supabase = createServerClient();
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .or(amCustomerAccessOrFilter(admin.id))
    .maybeSingle();

  return !!data;
}
