import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, phone, title, celebration_video_url, created_at, last_login')
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
    const allowed = ['celebration_video_url'];
    const updates: Record<string, unknown> = {};

    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key] || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Geen wijzigingen' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('admin_users')
      .update(updates)
      .eq('id', admin.id)
      .select('id, email, name, role, phone, title, celebration_video_url')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
