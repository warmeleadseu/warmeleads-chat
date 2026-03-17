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

export function adminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('warmeleads-admin-auth');
    if (!raw) return {};
    const { token } = JSON.parse(raw);
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  } catch {
    return {};
  }
}

export async function adminFetch(url: string, options: RequestInit = {}) {
  const headers = { ...adminHeaders(), ...(options.headers || {}) };
  return fetch(url, { ...options, headers });
}
