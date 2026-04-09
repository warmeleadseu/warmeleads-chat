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

export async function getCustomerScope(admin: AdminInfo): Promise<CustomerScope> {
  if (admin.role !== 'accountmanager') return { scoped: false };

  const supabase = createServerClient();
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('account_manager_id', admin.id);

  return { scoped: true, customerIds: (data || []).map(c => c.id) };
}
