import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const [branchRes, leadCountsRes, webhookCountsRes] = await Promise.all([
    supabase
      .from('branches')
      .select('*, branch_fields(*)')
      .eq('hidden_from_admin', false)
      .order('sort_order', { ascending: true }),
    supabase.from('leads').select('branch'),
    supabase.from('webhook_keys').select('branch'),
  ]);

  const { data: branches, error } = branchRes;
  if (error) {
    return NextResponse.json({ error: 'Branches ophalen mislukt' }, { status: 500 });
  }

  const leadCounts = leadCountsRes.data;
  const webhookCounts = webhookCountsRes.data;

  const leadsByBranch: Record<string, number> = {};
  (leadCounts || []).forEach((l: { branch: string }) => {
    leadsByBranch[l.branch] = (leadsByBranch[l.branch] || 0) + 1;
  });

  const webhooksByBranch: Record<string, number> = {};
  (webhookCounts || []).forEach((w: { branch: string }) => {
    webhooksByBranch[w.branch] = (webhooksByBranch[w.branch] || 0) + 1;
  });

  const enriched = (branches || []).map(b => ({
    ...b,
    branch_fields: (b.branch_fields || []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
    lead_count: leadsByBranch[b.slug] || 0,
    webhook_count: webhooksByBranch[b.slug] || 0,
  }));

  return NextResponse.json({ branches: enriched });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    if (!body.name || !body.slug) {
      return NextResponse.json({ error: 'Naam en slug zijn verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('branches')
      .insert({
        slug: body.slug.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
        name: body.name,
        color: body.color || 'slate',
        description: body.description || '',
        is_active: body.is_active ?? true,
        sort_order: body.sort_order ?? 0,
        pricing_tiers: Array.isArray(body.pricing_tiers) ? body.pricing_tiers : [],
        min_batch_size: typeof body.min_batch_size === 'number' ? body.min_batch_size : 10,
        nationwide_discount: typeof body.nationwide_discount === 'number' ? body.nationwide_discount : 0,
        appointment_pricing_tiers: Array.isArray(body.appointment_pricing_tiers) ? body.appointment_pricing_tiers : [],
        appointment_min_batch_size: typeof body.appointment_min_batch_size === 'number' ? body.appointment_min_batch_size : 5,
        appointment_nationwide_discount: typeof body.appointment_nationwide_discount === 'number' ? body.appointment_nationwide_discount : 0,
        default_appointment_duration: typeof body.default_appointment_duration === 'number' ? body.default_appointment_duration : 60,
        default_travel_buffer: typeof body.default_travel_buffer === 'number' ? body.default_travel_buffer : 30,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Deze slug bestaat al' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Branche aanmaken mislukt', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, branch: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    delete updates.slug;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true, branch: data });
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

    const { data: branch, error: fetchErr } = await supabase
      .from('branches')
      .select('slug, hidden_from_admin')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: 'Branche ophalen mislukt' }, { status: 500 });
    }
    if (!branch) {
      return NextResponse.json({ error: 'Branche niet gevonden' }, { status: 404 });
    }

    if (branch.hidden_from_admin) {
      return NextResponse.json({ error: 'Deze branche kan niet worden verwijderd' }, { status: 403 });
    }

    const { error: rpcError } = await supabase.rpc('delete_branch_cascade', { p_slug: branch.slug });
    if (rpcError) {
      return NextResponse.json(
        { error: 'Verwijderen mislukt', details: rpcError.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
