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
  if (admin.role !== 'superadmin') return forbidden();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, is_active, last_login, created_at')
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
    const { email, password, name, role } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'E-mail, wachtwoord en naam zijn verplicht' }, { status: 400 });
    }
    if (!['admin', 'superadmin', 'accountmanager'].includes(role)) {
      return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('admin_users')
      .insert({ email, password_hash, name, role })
      .select('id, email, name, role, is_active, created_at')
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

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('admin_users')
      .update(updates)
      .eq('id', id)
      .select('id, email, name, role, is_active, last_login, created_at')
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
