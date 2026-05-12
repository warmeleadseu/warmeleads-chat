import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';
import type { PortalSession } from './portalPermissions';
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalSessionJwt,
} from '@/lib/portalSession';
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * Verifies portal session: httpOnly JWT cookie and/or Bearer (JWT or legacy UUID).
 */
export async function verifyCustomer(request: NextRequest): Promise<PortalSession | null> {
  const authHeader = request.headers.get('Authorization');
  let bearer: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    bearer = authHeader.slice(7).trim();
  }

  const cookieJwt = request.cookies.get(PORTAL_SESSION_COOKIE)?.value ?? null;

  const jwtCandidate =
    cookieJwt ||
    (bearer && looksLikeJwt(bearer) ? bearer : null);

  const supabase = createServerClient();
  const customerSelect = await buildCustomerSelectWithCountry(supabase, CUSTOMER_SELECT_BASE);

  if (jwtCandidate) {
    const claims = await verifyPortalSessionJwt(jwtCandidate);
    if (!claims) return null;

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

  // Legacy: Bearer UUID (customer id or portal_user id)
  const raw = bearer;
  if (!raw || looksLikeJwt(raw) || !UUID_RE.test(raw)) return null;

  const { data: customer } = await supabase
    .from('customers')
    .select(customerSelect)
    .eq('id', raw)
    .eq('is_active', true)
    .eq('portal_active', true)
    .returns<SessionCustomerRow>()
    .single();

  if (customer) {
    return {
      customer: mapSessionCustomer(customer),
      portalUser: undefined,
      isOwner: true,
    };
  }

  const { data: portalUser } = await supabase
    .from('portal_users')
    .select(PORTAL_USER_SELECT)
    .eq('id', raw)
    .eq('is_active', true)
    .single();

  if (!portalUser) return null;

  const { data: parentCustomer } = await supabase
    .from('customers')
    .select(customerSelect)
    .eq('id', portalUser.customer_id)
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

export function portalUnauthorized() {
  return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
}

export function portalHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('warmeleads-portal-auth');
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
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
      const raw = localStorage.getItem('warmeleads-portal-auth');
      const isAdmin = raw ? JSON.parse(raw).is_admin_view : false;
      if (!isAdmin) {
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
