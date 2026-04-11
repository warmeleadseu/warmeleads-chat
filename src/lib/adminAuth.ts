import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';

export async function verifyAdmin(request: NextRequest) {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7);
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, is_active')
    .eq('id', token)
    .single();

  if (error || !data || !data.is_active) return null;
  return data;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
}

export function adminHeaders(skipContentType = false): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('warmeleads-admin-auth');
    if (!raw) return {};
    const { token } = JSON.parse(raw);
    const h: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (!skipContentType) h['Content-Type'] = 'application/json';
    return h;
  } catch {
    return {};
  }
}

export async function adminFetch(url: string, options: RequestInit & { raw?: boolean } = {}) {
  const { raw, ...fetchOpts } = options;
  const headers = { ...adminHeaders(raw), ...(fetchOpts.headers || {}) };
  return fetch(url, { ...fetchOpts, headers });
}
