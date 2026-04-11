import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('celebration_events')
    .select('*')
    .is('displayed_at', null)
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('celebration_events')
      .update({ displayed_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
