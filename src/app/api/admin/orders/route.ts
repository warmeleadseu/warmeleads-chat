import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const { data: orders, error } = await supabase
    .from('batch_orders')
    .select('*, customers(name, email, contact_person)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Kon bestellingen niet ophalen' }, { status: 500 });
  }

  const branchSlugs = [...new Set((orders || []).map(o => o.branch).filter(Boolean))];
  const { data: branchRows } = branchSlugs.length > 0
    ? await supabase.from('branches').select('slug, name').in('slug', branchSlugs)
    : { data: [] };

  const branchMap: Record<string, string> = {};
  (branchRows || []).forEach(b => { branchMap[b.slug] = b.name; });

  const enriched = (orders || []).map(o => ({
    ...o,
    branch_name: branchMap[o.branch] || o.branch,
    customer_name: o.customers?.name || 'Onbekend',
    customer_email: o.customers?.email || '',
  }));

  return NextResponse.json(enriched);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { order_id } = await request.json();
    if (!order_id) return NextResponse.json({ error: 'order_id is verplicht' }, { status: 400 });

    const supabase = createServerClient();

    const { data: order } = await supabase
      .from('batch_orders')
      .select('id, status')
      .eq('id', order_id)
      .single();

    if (!order) return NextResponse.json({ error: 'Bestelling niet gevonden' }, { status: 404 });

    if (order.status === 'paid') {
      return NextResponse.json({ error: 'Een betaalde bestelling kan niet worden verwijderd' }, { status: 400 });
    }

    await supabase.from('batch_orders').delete().eq('id', order_id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
