import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

const BUCKET = 'avatars';
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function forbidden() {
  return NextResponse.json({ error: 'Onvoldoende rechten' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  const supabase = createServerClient();
  const formData = await request.formData();

  const file = formData.get('file') as File | null;
  const userId = formData.get('user_id') as string | null;

  if (!file || !userId) {
    return NextResponse.json({ error: 'Bestand en user_id zijn verplicht' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Alleen JPEG, PNG of WebP afbeeldingen zijn toegestaan' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Afbeelding mag maximaal 2MB zijn' }, { status: 400 });
  }

  const { data: user } = await supabase
    .from('admin_users')
    .select('id, avatar_url')
    .eq('id', userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });
  }

  // Remove old avatar if exists
  if (user.avatar_url) {
    const oldPath = extractStoragePath(user.avatar_url);
    if (oldPath) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }
  }

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${userId}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: `Upload mislukt: ${uploadErr.message}` }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const avatarUrl = publicUrlData.publicUrl;

  const { error: updateErr } = await supabase
    .from('admin_users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (updateErr) {
    return NextResponse.json({ error: `Database bijwerken mislukt: ${updateErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ avatar_url: avatarUrl });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  const supabase = createServerClient();
  const { user_id } = await request.json();

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is verplicht' }, { status: 400 });
  }

  const { data: user } = await supabase
    .from('admin_users')
    .select('avatar_url')
    .eq('id', user_id)
    .single();

  if (!user?.avatar_url) {
    return NextResponse.json({ error: 'Geen profielfoto gevonden' }, { status: 404 });
  }

  const storagePath = extractStoragePath(user.avatar_url);
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  await supabase
    .from('admin_users')
    .update({ avatar_url: null })
    .eq('id', user_id);

  return NextResponse.json({ ok: true });
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}
