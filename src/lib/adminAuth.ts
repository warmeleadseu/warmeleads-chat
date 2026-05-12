import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionJwt,
} from '@/lib/adminSession';
import { looksLikeJwt } from '@/lib/jwtFormat';
import {
  adminAuthDebugClient,
  adminAuthDebugClientEnabled,
  adminAuthDebugServer,
  adminAuthDebugServerEnabled,
  redactEmail,
} from '@/lib/adminAuthDebug';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  let bearer: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    bearer = authHeader.slice(7).trim();
  }

  const cookieToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;

  if (adminAuthDebugServerEnabled()) {
    adminAuthDebugServer('verifyAdmin: inkomend verzoek', {
      path: request.nextUrl?.pathname ?? '(onbekend)',
      hasAuthHeader: !!authHeader,
      hasBearerJwtShape: !!(bearer && looksLikeJwt(bearer)),
      hasBearerUuidShape: !!(bearer && UUID_RE.test(bearer)),
      hasSessionCookie: !!cookieToken,
      cookieTokenLength: cookieToken?.length ?? 0,
    });
  }

  let adminId: string | null = null;

  const jwtCandidate =
    cookieToken ||
    (bearer && looksLikeJwt(bearer) ? bearer : null);

  if (jwtCandidate) {
    adminId = await verifyAdminSessionJwt(jwtCandidate);
    if (adminAuthDebugServerEnabled()) {
      adminAuthDebugServer('verifyAdmin: JWT geverifieerd', {
        ok: !!adminId,
        subPrefix: adminId ? `${adminId.slice(0, 8)}…` : null,
      });
    }
  }

  if (!adminId && bearer && UUID_RE.test(bearer)) {
    adminId = bearer;
    if (adminAuthDebugServerEnabled()) {
      adminAuthDebugServer('verifyAdmin: bearer UUID als admin-id gebruikt', {
        idPrefix: `${bearer.slice(0, 8)}…`,
      });
    }
  }

  if (!adminId) {
    if (adminAuthDebugServerEnabled()) {
      adminAuthDebugServer('verifyAdmin: geen geldige sessie (null adminId)');
    }
    return null;
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, is_active, is_account_manager')
    .eq('id', adminId)
    .single();

  if (error || !data || !data.is_active) {
    if (adminAuthDebugServerEnabled()) {
      adminAuthDebugServer('verifyAdmin: Supabase of inactive', {
        supabaseError: error?.message ?? null,
        hasRow: !!data,
        isActive: data?.is_active ?? null,
      });
    }
    return null;
  }

  if (adminAuthDebugServerEnabled()) {
    adminAuthDebugServer('verifyAdmin: OK', {
      id: data.id,
      role: data.role,
      email: redactEmail(data.email),
    });
  }

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
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const hasAuthHeader = !!(headers as Record<string, string>)['Authorization'];

  if (adminAuthDebugClientEnabled()) {
    adminAuthDebugClient('adminFetch → start', {
      url,
      method: fetchOpts.method ?? 'GET',
      hasAuthorizationHeader: hasAuthHeader,
      raw: !!raw,
    });
  }

  let res: Response;
  try {
    res = await fetch(url, { ...fetchOpts, headers, credentials: 'include' });
  } catch (err) {
    if (adminAuthDebugClientEnabled()) {
      adminAuthDebugClient('adminFetch → netwerkfout', {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }

  const ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null;
  if (adminAuthDebugClientEnabled()) {
    adminAuthDebugClient('adminFetch → response', {
      url,
      status: res.status,
      ok: res.ok,
      durationMs: ms,
    });
  }

  if (res.status === 401 && typeof window !== 'undefined') {
    if (adminAuthDebugClientEnabled()) {
      adminAuthDebugClient('adminFetch → 401, localStorage auth gewist en redirect /admin', { url });
    }
    try {
      localStorage.removeItem('warmeleads-admin-auth');
    } catch {
      /* noop */
    }
    window.location.assign('/admin');
  }

  return res;
}
