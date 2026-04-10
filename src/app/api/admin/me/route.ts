import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, phone, title, celebration_video_url, celebration_video_start, celebration_video_end, created_at, last_login')
    .eq('id', admin.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Profiel ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.celebration_video_url !== undefined) updates.celebration_video_url = body.celebration_video_url || null;
    if (body.celebration_video_start !== undefined) updates.celebration_video_start = typeof body.celebration_video_start === 'number' ? body.celebration_video_start : 0;
    if (body.celebration_video_end !== undefined) updates.celebration_video_end = typeof body.celebration_video_end === 'number' ? body.celebration_video_end : null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Geen wijzigingen' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('admin_users')
      .update(updates)
      .eq('id', admin.id)
      .select('id, email, name, role, phone, title, celebration_video_url, celebration_video_start, celebration_video_end')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
