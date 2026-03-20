import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('webhook_keys')
    .select('*, customers(id, name)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Keys ophalen mislukt' }, { status: 500 });
  }
  return NextResponse.json({ keys: data || [] });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { label, branch, customer_id } = await request.json();
    if (!label || !branch) {
      return NextResponse.json({ error: 'Label en branche zijn verplicht' }, { status: 400 });
    }

    const key = `wl_${crypto.randomBytes(24).toString('hex')}`;

    const supabase = createServerClient();
    const insert: Record<string, unknown> = { key, label, branch };
    if (customer_id) insert.customer_id = customer_id;

    const { data, error } = await supabase
      .from('webhook_keys')
      .insert(insert)
      .select('*, customers(id, name)')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Key aanmaken mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true, webhook_key: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    const supabase = createServerClient();
    const { error } = await supabase.from('webhook_keys').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Key verwijderen mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
