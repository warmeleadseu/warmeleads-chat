import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const customerId = request.nextUrl.searchParams.get('customer_id');
  if (!customerId) {
    return NextResponse.json({ error: 'customer_id is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('customer_pricing')
    .select('*')
    .eq('customer_id', customerId)
    .order('branch_slug', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Prijzen ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ pricing: data || [] });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    if (!body.customer_id || !body.branch_slug) {
      return NextResponse.json({ error: 'customer_id en branch_slug zijn verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('customer_pricing')
      .upsert({
        customer_id: body.customer_id,
        branch_slug: body.branch_slug,
        pricing_tiers: Array.isArray(body.pricing_tiers) ? body.pricing_tiers : [],
        nationwide_discount: typeof body.nationwide_discount === 'number' ? body.nationwide_discount : null,
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'customer_id,branch_slug' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Opslaan mislukt', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, pricing: data });
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
    const { error } = await supabase.from('customer_pricing').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
