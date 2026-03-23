import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

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
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key en value zijn verplicht' }, { status: 400 });
  }

  const { error } = await supabase.from('app_settings').upsert(
    { key, value: String(value), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
