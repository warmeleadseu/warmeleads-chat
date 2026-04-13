import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import bcrypt from 'bcryptjs';

function forbidden() {
  return NextResponse.json({ error: 'Onvoldoende rechten' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') return forbidden();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, is_active, is_account_manager, last_login, created_at, phone, title, avatar_url, celebration_video_url, celebration_video_start, celebration_video_end')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Gebruikers ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  try {
    const { email, password, name, role, phone, title, is_account_manager } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'E-mail, wachtwoord en naam zijn verplicht' }, { status: 400 });
    }
    if (!['admin', 'superadmin', 'accountmanager'].includes(role)) {
      return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const supabase = createServerClient();

    const isAM = role === 'accountmanager' ? true : !!is_account_manager;
    const insertData: Record<string, unknown> = { email, password_hash, name, role, is_account_manager: isAM };
    if (phone !== undefined) insertData.phone = phone || null;
    if (title !== undefined) insertData.title = title || null;

    const { data, error } = await supabase
      .from('admin_users')
      .insert(insertData)
      .select('id, email, name, role, is_active, is_account_manager, created_at, phone, title')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Gebruiker aanmaken mislukt', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  try {
    const { id, password, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    if (updates.role && !['admin', 'superadmin', 'accountmanager'].includes(updates.role)) {
      return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 });
    }

    if (password) {
      updates.password_hash = await bcrypt.hash(password, 12);
    }

    if (updates.role === 'accountmanager') updates.is_account_manager = true;
    const allowed = ['name', 'email', 'role', 'is_active', 'password_hash', 'phone', 'title', 'is_account_manager'];
    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('admin_users')
      .update(safeUpdates)
      .eq('id', id)
      .select('id, email, name, role, is_active, is_account_manager, last_login, created_at, phone, title')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Bijwerken mislukt', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    if (id === admin.id) {
      return NextResponse.json({ error: 'U kunt uzelf niet deactiveren' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('admin_users')
      .update({ is_active: false })
      .eq('id', id)
      .select('id, email, name, role, is_active')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Deactiveren mislukt' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
