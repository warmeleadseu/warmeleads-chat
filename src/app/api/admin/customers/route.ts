import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Klanten ophalen mislukt' }, { status: 500 });
  }

  const { data: leadCounts } = await supabase
    .from('leads')
    .select('customer_id');

  const counts: Record<string, number> = {};
  (leadCounts || []).forEach((l: { customer_id: string }) => {
    if (l.customer_id) counts[l.customer_id] = (counts[l.customer_id] || 0) + 1;
  });

  const enriched = (customers || []).map(c => ({
    ...c,
    lead_count: counts[c.id] || 0,
    has_password: !!c.password_hash,
    password_hash: undefined,
  }));


  return NextResponse.json({ customers: enriched });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Bedrijfsnaam is verplicht' }, { status: 400 });
    }

    const { password, ...rest } = body;

    if (password) {
      rest.password_hash = await bcrypt.hash(password, 12);
      rest.portal_password = password;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from('customers').insert(rest).select().single();

    if (error) {
      return NextResponse.json({ error: 'Klant aanmaken mislukt', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, customer: { ...data, password_hash: undefined } });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { id, password, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    if (password) {
      updates.password_hash = await bcrypt.hash(password, 12);
      updates.portal_password = password;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select().single();

    if (error) {
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true, customer: { ...data, password_hash: undefined } });
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
    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
