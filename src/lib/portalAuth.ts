import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';
import type { PortalSession } from './portalPermissions';

export type { PortalSession };

/**
 * Verifies the portal bearer token.
 * Checks customers table first (owner login), then portal_users table (agent login).
 * Returns a PortalSession with the customer + optional portalUser info.
 */
export async function verifyCustomer(request: NextRequest): Promise<PortalSession | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7);
  const supabase = createServerClient();

  // 1. Check customers table (owner login — token = customer.id)
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, branches, portal_active')
    .eq('id', token)
    .eq('is_active', true)
    .eq('portal_active', true)
    .single();

  if (customer) {
    return { customer, portalUser: undefined, isOwner: true };
  }

  // 2. Check portal_users table (agent/manager login — token = portal_user.id)
  const { data: portalUser } = await supabase
    .from('portal_users')
    .select('id, customer_id, name, email, role, is_active, permissions, assignment_rules, last_login_at, last_seen_at, login_count, phone, created_at')
    .eq('id', token)
    .eq('is_active', true)
    .single();

  if (!portalUser) return null;

  // Fetch the parent customer
  const { data: parentCustomer } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, branches, portal_active')
    .eq('id', portalUser.customer_id)
    .eq('is_active', true)
    .eq('portal_active', true)
    .single();

  if (!parentCustomer) return null;

  return {
    customer: parentCustomer,
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
    if (!raw) return {};
    const { token } = JSON.parse(raw);
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  } catch {
    return {};
  }
}

export async function portalFetch(url: string, options: RequestInit = {}) {
  const headers = { ...portalHeaders(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });

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
