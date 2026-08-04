/* ─── Portal permission system ─── */

export const PERMISSIONS = {
  LEADS_VIEW: 'leads.view',
  LEADS_VIEW_ALL: 'leads.view_all',
  LEADS_EDIT: 'leads.edit',
  LEADS_EXPORT: 'leads.export',
  /** Leads handmatig toewijzen aan teamleden (agents). */
  LEADS_ASSIGN: 'leads.assign',
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  RECLAMATIONS_CREATE: 'reclamations.create',
  STATISTICS_VIEW: 'statistics.view',
  INTEGRATIONS_VIEW: 'integrations.view',
  INVOICES_VIEW: 'invoices.view',
  ACCOUNT_EDIT: 'account.edit',
  TEAM_MANAGE: 'team.manage',
  APPOINTMENTS_VIEW: 'appointments.view',
  APPOINTMENTS_VIEW_ALL: 'appointments.view_all',
  APPOINTMENTS_EDIT: 'appointments.edit',
  APPOINTMENTS_ORDER: 'appointments.order',
  AVAILABILITY_MANAGE: 'availability.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/**
 * Filtert een (client-)permissielijst naar alleen bekende permissies uit
 * ALL_PERMISSIONS. Voorkomt dat willekeurige/onbekende permissie-strings in de
 * database belanden of dat een teambeheerder onbekende rechten toekent.
 */
export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(ALL_PERMISSIONS);
  const seen = new Set<string>();
  const out: Permission[] = [];
  for (const p of input) {
    if (typeof p === 'string' && allowed.has(p) && !seen.has(p)) {
      seen.add(p);
      out.push(p as Permission);
    }
  }
  return out;
}

export const ROLE_DEFAULTS: Record<string, Permission[]> = {
  owner: [...ALL_PERMISSIONS],
  manager: [
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_VIEW_ALL,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.LEADS_EXPORT,
    PERMISSIONS.LEADS_ASSIGN,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.RECLAMATIONS_CREATE,
    PERMISSIONS.STATISTICS_VIEW,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.INTEGRATIONS_VIEW,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_VIEW_ALL,
    PERMISSIONS.APPOINTMENTS_EDIT,
    PERMISSIONS.AVAILABILITY_MANAGE,
  ],
  agent: [
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.RECLAMATIONS_CREATE,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_EDIT,
  ],
};

export const PERMISSION_GROUPS: { label: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    label: 'Leads',
    permissions: [
      { key: PERMISSIONS.LEADS_VIEW, label: 'Leads bekijken' },
      { key: PERMISSIONS.LEADS_VIEW_ALL, label: 'Alle leads zien (niet alleen eigen)' },
      { key: PERMISSIONS.LEADS_EDIT, label: 'Status en notities bewerken' },
      { key: PERMISSIONS.LEADS_ASSIGN, label: 'Leads toewijzen aan teamleden' },
      { key: PERMISSIONS.LEADS_EXPORT, label: 'Leads exporteren' },
    ],
  },
  {
    label: 'Bestellingen',
    permissions: [
      { key: PERMISSIONS.ORDERS_VIEW, label: 'Batches en bestellingen bekijken' },
      { key: PERMISSIONS.ORDERS_CREATE, label: 'Nieuwe batches bestellen' },
      { key: PERMISSIONS.APPOINTMENTS_ORDER, label: 'Afspraken-batches bestellen' },
    ],
  },
  {
    label: 'Afspraken',
    permissions: [
      { key: PERMISSIONS.APPOINTMENTS_VIEW, label: 'Afspraken bekijken' },
      { key: PERMISSIONS.APPOINTMENTS_VIEW_ALL, label: 'Alle afspraken zien (niet alleen eigen)' },
      { key: PERMISSIONS.APPOINTMENTS_EDIT, label: 'Afspraken aanmaken en bewerken' },
      { key: PERMISSIONS.AVAILABILITY_MANAGE, label: 'Beschikbaarheid adviseurs beheren' },
    ],
  },
  {
    label: 'Overig',
    permissions: [
      { key: PERMISSIONS.RECLAMATIONS_CREATE, label: 'Reclamaties indienen' },
      { key: PERMISSIONS.STATISTICS_VIEW, label: 'Statistieken en insights bekijken' },
      { key: PERMISSIONS.INTEGRATIONS_VIEW, label: 'Integraties en koppelingen bekijken' },
      { key: PERMISSIONS.INVOICES_VIEW, label: 'Facturen bekijken' },
      { key: PERMISSIONS.ACCOUNT_EDIT, label: 'Accountinstellingen wijzigen' },
      { key: PERMISSIONS.TEAM_MANAGE, label: 'Teamleden beheren' },
    ],
  },
];

export interface PortalUser {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'agent';
  is_active: boolean;
  permissions: string[];
  assignment_rules: AssignmentRules;
  last_login_at: string | null;
  last_seen_at: string | null;
  login_count: number;
  phone: string | null;
  created_at: string;
}

export interface AssignmentRules {
  mode?: 'auto' | 'manual' | 'all';
  branches?: string[];
  regions?: { type: 'provinces' | 'postcodes'; values: string[] };
  max_leads_per_day?: number;
  max_leads_per_week?: number;
  max_appointments_per_day?: number;
  max_appointments_per_week?: number;
  round_robin_weight?: number;
}

export interface PortalSession {
  customer: {
    id: string;
    name: string;
    email: string;
    contact_person: string;
    branches: string[];
    portal_active: boolean;
    demo_mode?: boolean;
    signup_source?: string | null;
    /** Facturatie-land (NL/BE); default NL. */
    country?: string;
    vat_id?: string | null;
    /** BE + geldig BE-BTW-nummer: intracommunautair, geen NL-BTW op factuur. */
    reverse_charge?: boolean;
    /**
     * Als false: agents zonder leads.view_all zien alleen leads die aan hen
     * zijn toegewezen (niet de open pool). Default true.
     */
    agents_see_unassigned_leads?: boolean;
  };
  portalUser?: PortalUser;
  isOwner: boolean;
  /** Gezet wanneer dit een admin-impersonatiesessie is: het admin-id dat "bekijkt als klant". */
  impersonatedByAdminId?: string;
}

export function hasPermission(session: PortalSession, permission: Permission | string): boolean {
  if (session.isOwner) return true;
  if (!session.portalUser) return true;
  if (session.portalUser.role === 'owner') return true;
  return session.portalUser.permissions.includes(permission);
}

export function forbidden(message = 'Je hebt geen toegang tot deze functie') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
