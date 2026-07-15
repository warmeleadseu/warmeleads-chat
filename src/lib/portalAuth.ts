import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';
import type { PortalSession } from './portalPermissions';
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalSessionJwtDetailed,
} from '@/lib/portalSession';
import { isPortalSessionRevoked } from '@/lib/portalSessionVersion';
import { looksLikeJwt } from '@/lib/jwtFormat';
import { qualifiesBelgiumReverseCharge } from '@/lib/invoiceVat';
import { buildCustomerSelectWithCountry } from '@/lib/customerCountrySupport';

export type { PortalSession };

/**
 * Basis-velden voor de portaalsessie. `country` wordt dynamisch toegevoegd via
 * `buildCustomerSelectWithCountry()` zodat de query ook werkt op DB's vóór
 * migratie 100 (waar de kolom nog niet bestaat).
 */
const CUSTOMER_SELECT_BASE =
  'id, name, email, contact_person, branches, portal_active, demo_mode, signup_source, is_active, vat_id';

const PORTAL_USER_SELECT =
  'id, customer_id, name, email, role, is_active, permissions, assignment_rules, last_login_at, last_seen_at, login_count, phone, created_at';

type SessionCustomerRow = {
  id: string;
  name: string;
  email: string;
  contact_person: string | null;
  branches: string[] | null;
  portal_active: boolean;
  demo_mode?: boolean | null;
  signup_source?: string | null;
  country?: string | null;
  vat_id?: string | null;
};

function mapSessionCustomer(row: SessionCustomerRow): PortalSession['customer'] {
  const reverse_charge = qualifiesBelgiumReverseCharge({
    country: row.country ?? 'NL',
    vat_id: row.vat_id,
  });
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    contact_person: row.contact_person || '',
    branches: row.branches ?? [],
    portal_active: row.portal_active,
    demo_mode: row.demo_mode ?? undefined,
    signup_source: row.signup_source ?? undefined,
    country: row.country ?? 'NL',
    vat_id: row.vat_id ?? undefined,
    reverse_charge,
  };
}

/**
 * Verifies portal session: httpOnly JWT cookie, per-tab impersonatie-JWT, of een
 * Bearer-JWT. De legacy "UUID-als-Bearer"-route is bewust verwijderd.
 */
export async function verifyCustomer(request: NextRequest): Promise<PortalSession | null> {
  const authHeader = request.headers.get('Authorization');
  let bearer: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    bearer = authHeader.slice(7).trim();
  }

  // Per-tab impersonatie (admin "bekijk als klant"). Dit token wordt in de
  // client per browser-tab (sessionStorage) bewaard en als header meegestuurd,
  // en heeft VOORRANG op de browserbrede sessie-cookie. Zo delen twee gelijktijdig
  // geopende portaal-tabs niet dezelfde sessie (anders "springen" statussen en
  // schrijven bewerkingen naar de verkeerde klant).
  const impersonateHeader = request.headers.get('X-Impersonate-Token');
  const impersonateJwt =
    impersonateHeader && looksLikeJwt(impersonateHeader) ? impersonateHeader : null;

  const cookieJwt = request.cookies.get(PORTAL_SESSION_COOKIE)?.value ?? null;

  const jwtCandidate =
    impersonateJwt ||
    cookieJwt ||
    (bearer && looksLikeJwt(bearer) ? bearer : null);

  const supabase = createServerClient();
  const customerSelect = await buildCustomerSelectWithCountry(supabase, CUSTOMER_SELECT_BASE);

  if (jwtCandidate) {
    const verified = await verifyPortalSessionJwtDetailed(jwtCandidate);
    if (!verified) return null;
    const { claims, iat } = verified;

    if (await isPortalSessionRevoked(supabase, claims, iat)) return null;

    if (claims.typ === 'owner') {
      const { data: customer } = await supabase
        .from('customers')
        .select(customerSelect)
        .eq('id', claims.sub)
        .eq('is_active', true)
        .eq('portal_active', true)
        .returns<SessionCustomerRow>()
        .single();

      if (!customer) return null;

      return {
        customer: mapSessionCustomer(customer),
        portalUser: undefined,
        isOwner: true,
        ...(claims.imp ? { impersonatedByAdminId: claims.imp } : {}),
      };
    }

    if (claims.typ === 'portal_user') {
      const { data: portalUser } = await supabase
        .from('portal_users')
        .select(PORTAL_USER_SELECT)
        .eq('id', claims.sub)
        .eq('customer_id', claims.cid)
        .eq('is_active', true)
        .single();

      if (!portalUser) return null;

      const { data: parentCustomer } = await supabase
        .from('customers')
        .select(customerSelect)
        .eq('id', claims.cid)
        .eq('is_active', true)
        .eq('portal_active', true)
        .returns<SessionCustomerRow>()
        .single();

      if (!parentCustomer) return null;

      return {
        customer: mapSessionCustomer(parentCustomer),
        portalUser,
        isOwner: portalUser.role === 'owner',
      };
    }
  }

  return null;
}

export function portalUnauthorized() {
  return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
}

/**
 * Schrijft een auditlog-regel wanneer een mutatie via een admin-impersonatie-
 * sessie ("bekijk als klant") wordt uitgevoerd. No-op voor echte klant/agent-
 * sessies. Zo blijft traceerbaar welke admin namens welke klant heeft geschreven.
 */
export async function logImpersonatedWrite(
  session: PortalSession,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  if (!session.impersonatedByAdminId) return;
  try {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({
      adminId: session.impersonatedByAdminId,
      action: `impersonation.${action}`,
      entityType,
      entityId: entityId ?? null,
      details: { customer_id: session.customer.id, ...(details ?? {}) },
    });
  } catch {
    /* auditfout mag de mutatie niet blokkeren */
  }
}

/** sessionStorage-sleutel voor per-tab admin-impersonatie (zie verifyCustomer). */
export const PORTAL_IMPERSONATION_KEY = 'warmeleads-portal-impersonation';

export function portalHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    // Per-tab impersonatie heeft voorrang: is deze tab geopend als "bekijk als
    // klant", dan sturen we dat tab-eigen token mee zodat een andere tab (met
    // een andere klant) de sessie niet overschrijft.
    const imp = sessionStorage.getItem(PORTAL_IMPERSONATION_KEY);
    if (imp) {
      const parsedImp = JSON.parse(imp);
      if (parsedImp.token && typeof parsedImp.token === 'string') {
        h['X-Impersonate-Token'] = parsedImp.token;
        return h;
      }
    }
    const raw = localStorage.getItem('warmeleads-portal-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.token && typeof parsed.token === 'string') {
        h.Authorization = `Bearer ${parsed.token}`;
      }
    }
    return h;
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

export async function portalFetch(url: string, options: RequestInit = {}) {
  const headers = { ...portalHeaders(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && typeof window !== 'undefined') {
    try {
      // Impersonatie-tabs (admin) nooit automatisch uitloggen/redirecten.
      const isImpersonating = !!sessionStorage.getItem(PORTAL_IMPERSONATION_KEY);
      const raw = localStorage.getItem('warmeleads-portal-auth');
      const isAdmin = raw ? JSON.parse(raw).is_admin_view : false;
      if (!isImpersonating && !isAdmin) {
        localStorage.removeItem('warmeleads-portal-auth');
        localStorage.removeItem('warmeleads-portal-customer');
        window.location.href = '/portal';
      }
    } catch {
      localStorage.removeItem('warmeleads-portal-auth');
      localStorage.removeItem('warmeleads-portal-customer');
      window.location.href = '/portal';
    }
  }

  return res;
}
