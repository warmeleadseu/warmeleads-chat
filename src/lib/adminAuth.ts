import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionJwt,
} from '@/lib/adminSession';
import { looksLikeJwt } from '@/lib/jwtFormat';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  let bearer: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    bearer = authHeader.slice(7).trim();
  }

  const cookieToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;

  let adminId: string | null = null;

  const jwtCandidate =
    cookieToken ||
    (bearer && looksLikeJwt(bearer) ? bearer : null);

  if (jwtCandidate) {
    adminId = await verifyAdminSessionJwt(jwtCandidate);
  }

  if (!adminId && bearer && UUID_RE.test(bearer)) {
    adminId = bearer;
  }

  if (!adminId) return null;

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, is_active, is_account_manager')
    .eq('id', adminId)
    .single();

  if (error || !data || !data.is_active) return null;
  return data;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Onvoldoende rechten' }, { status: 403 });
}

export async function requireSuperAdmin(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return { admin: null, error: unauthorized() };
  if (admin.role !== 'superadmin') return { admin: null, error: forbidden() };
  return { admin, error: null };
}

export function adminHeaders(skipContentType = false): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('warmeleads-admin-auth');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const h: Record<string, string> = {};
    if (parsed.token && typeof parsed.token === 'string') {
      h.Authorization = `Bearer ${parsed.token}`;
    }
    if (!skipContentType) h['Content-Type'] = 'application/json';
    return h;
  } catch {
    return {};
  }
}

export async function adminFetch(url: string, options: RequestInit & { raw?: boolean } = {}) {
  const { raw, ...fetchOpts } = options;
  const headers = { ...adminHeaders(raw), ...(fetchOpts.headers || {}) };
  const res = await fetch(url, { ...fetchOpts, headers, credentials: 'include' });

  if (res.status === 401 && typeof window !== 'undefined') {
    try {
      localStorage.removeItem('warmeleads-admin-auth');
    } catch {
      /* noop */
    }
    window.location.assign('/admin');
  }

  return res;
}
