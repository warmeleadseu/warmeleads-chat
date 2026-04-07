import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Kon facturen niet ophalen' }, { status: 500 });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();

  const { customer_id, description, line_items, subtotal, btw_percentage, paid_at, status } = body;

  if (!customer_id || !description || subtotal == null) {
    return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 });
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, address, vat_id')
    .eq('id', customer_id)
    .single();

  if (!customer) return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });

  const sub = Number(subtotal);
  const btwPct = Number(btw_percentage ?? 21);
  const btwAmount = Math.round(sub * (btwPct / 100) * 100) / 100;
  const totalInclBtw = sub + btwAmount;

  // Generate invoice number via sequence
  const year = new Date().getFullYear();
  const { data: seqVal, error: seqErr } = await supabase.rpc('nextval_invoice');

  let invoiceNumber: string;
  if (!seqErr && seqVal != null && Number(seqVal) > 0) {
    invoiceNumber = `WL-${year}-${String(seqVal).padStart(4, '0')}`;
  } else {
    const { data: latest } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `WL-${year}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latest?.invoice_number) {
      const parts = latest.invoice_number.split('-');
      const lastNum = parseInt(parts[2] || '0', 10);
      invoiceNumber = `WL-${year}-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      invoiceNumber = `WL-${year}-0001`;
    }
  }

  const items = Array.isArray(line_items) && line_items.length > 0
    ? line_items
    : [{ description, quantity: 1, unit_price: sub, total: sub }];

  const { data: invoice, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      customer_id,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_address: customer.address || null,
      customer_vat_id: customer.vat_id || null,
      description,
      line_items: items,
      subtotal: sub,
      btw_percentage: btwPct,
      btw_amount: btwAmount,
      total_incl_btw: totalInclBtw,
      status: status || 'paid',
      paid_at: paid_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json(invoice, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();

  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  // Recalculate BTW when subtotal or btw_percentage changes
  if (updates.subtotal !== undefined || updates.btw_percentage !== undefined) {
    const { data: existing } = await supabase
      .from('invoices')
      .select('subtotal, btw_percentage')
      .eq('id', id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });

    const sub = Number(updates.subtotal ?? existing.subtotal);
    const btwPct = Number(updates.btw_percentage ?? existing.btw_percentage);
    updates.subtotal = sub;
    updates.btw_percentage = btwPct;
    updates.btw_amount = Math.round(sub * (btwPct / 100) * 100) / 100;
    updates.total_incl_btw = sub + updates.btw_amount;
  }

  // Only allow safe fields
  const allowed = [
    'customer_name', 'customer_email', 'customer_address', 'customer_vat_id',
    'description', 'line_items', 'subtotal', 'btw_percentage', 'btw_amount',
    'total_incl_btw', 'status', 'paid_at',
  ];
  const safeUpdates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(safeUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { id } = await request.json();

  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
