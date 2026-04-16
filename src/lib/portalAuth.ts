import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';

export async function verifyCustomer(request: NextRequest) {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7);
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, branches, portal_active')
    .eq('id', token)
    .eq('is_active', true)
    .eq('portal_active', true)
    .single();

  if (error || !data) return null;
  return data;
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
