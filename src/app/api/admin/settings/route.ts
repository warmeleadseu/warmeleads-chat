import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { admin, error: authError } = await requireSuperAdmin(request);
  if (authError) return authError;

  const supabase = createServerClient();
  const { data } = await supabase.from('app_settings').select('key, value, updated_at');

  const settings: Record<string, { value: string; updated_at: string }> = {};
  for (const row of data || []) {
    const isSensitive = row.key.includes('token') || row.key.includes('secret');
    settings[row.key] = {
      value: isSensitive ? `${row.value.slice(0, 8)}${'•'.repeat(20)}` : row.value,
      updated_at: row.updated_at,
    };
  }

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireSuperAdmin(request);
  if (authError) return authError;

  const supabase = createServerClient();
  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key en value zijn verplicht' }, { status: 400 });
  }

  let normalized = String(value);
  if (
    key.includes('token') ||
    key.includes('secret') ||
    key.startsWith('teamleader_')
  ) {
    normalized = normalized.replace(/[\r\n\u2028\u2029]+/g, '').trim();
  }

  const { error } = await supabase.from('app_settings').upsert(
    { key, value: normalized, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
