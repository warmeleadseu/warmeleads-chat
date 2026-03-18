import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const branchId = request.nextUrl.searchParams.get('branch_id');
  const branchSlug = request.nextUrl.searchParams.get('branch_slug');

  const supabase = createServerClient();

  let query = supabase.from('branch_fields').select('*, branches(slug, name)');

  if (branchId) {
    query = query.eq('branch_id', branchId);
  } else if (branchSlug) {
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('slug', branchSlug)
      .single();
    if (!branch) return NextResponse.json({ fields: [] });
    query = query.eq('branch_id', branch.id);
  }

  const { data: fields, error } = await query.order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Velden ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ fields: fields || [] });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    if (!body.branch_id || !body.key || !body.label) {
      return NextResponse.json({ error: 'branch_id, key en label zijn verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('branch_fields')
      .insert({
        branch_id: body.branch_id,
        key: body.key.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        label: body.label,
        field_type: body.field_type || 'text',
        options: body.options || [],
        is_required: body.is_required ?? false,
        sort_order: body.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Deze key bestaat al voor deze branche' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Veld aanmaken mislukt', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, field: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();

    if (body.fields && Array.isArray(body.fields)) {
      const supabase = createServerClient();
      for (const f of body.fields) {
        if (!f.id) continue;
        const { id, ...updates } = f;
        await supabase.from('branch_fields').update(updates).eq('id', id);
      }
      return NextResponse.json({ success: true });
    }

    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('branch_fields')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true, field: data });
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
    const { error } = await supabase.from('branch_fields').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
