import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl.searchParams;
  const status = url.get('status');
  const search = url.get('search');
  const countOnly = url.get('count_only') === 'true';

  const supabase = createServerClient();

  if (countOnly) {
    const { count } = await supabase
      .from('lead_reclamations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return NextResponse.json({ pending_count: count || 0 });
  }

  let query = supabase
    .from('lead_reclamations')
    .select('*, customers(name, email), leads(naam_klant, telefoonnummer, email, postcode, plaatsnaam, provincie, branch)')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    const s = search.toLowerCase();
    query = query.or(`reason.ilike.%${s}%,description.ilike.%${s}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[admin/reclamations GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reclamations = data || [];

  if (search) {
    const s = search.toLowerCase();
    const filtered = reclamations.filter(r => {
      const custName = (r.customers as { name?: string })?.name?.toLowerCase() || '';
      const leadName = (r.leads as { naam_klant?: string })?.naam_klant?.toLowerCase() || '';
      const leadPhone = (r.leads as { telefoonnummer?: string })?.telefoonnummer || '';
      return (
        custName.includes(s) ||
        leadName.includes(s) ||
        leadPhone.includes(s) ||
        (r.reason || '').toLowerCase().includes(s) ||
        (r.description || '').toLowerCase().includes(s)
      );
    });
    return NextResponse.json(filtered);
  }

  return NextResponse.json(reclamations);
}

const REASON_LABELS: Record<string, string> = {
  foutief_telefoonnummer: 'Foutief telefoonnummer',
  dubbele_lead: 'Dubbele lead binnen 30 dagen',
  buiten_doelgebied: 'Buiten afgesproken gebied',
};

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const body = await request.json();
  const { id, status, admin_notes } = body;

  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });
  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status moet approved of rejected zijn' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('lead_reclamations')
    .update({
      status,
      admin_notes: admin_notes || null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, customers(name, email), leads(naam_klant, telefoonnummer, email, postcode, plaatsnaam, provincie, branch)')
    .single();

  if (error) {
    console.error('[admin/reclamations PUT]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let batchUpdated = false;

  if (status === 'approved' && data.customer_id) {
    const { data: activeBatch } = await supabase
      .from('customer_batches')
      .select('*')
      .eq('customer_id', data.customer_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activeBatch) {
      const existingComps = Array.isArray(activeBatch.compensations) ? activeBatch.compensations : [];
      const newComps = [
        ...existingComps,
        {
          amount: 1,
          reason: `Reclamatie: ${REASON_LABELS[data.reason] || data.reason}`,
          date: new Date().toISOString(),
          reclamation_id: data.id,
        },
      ];
      const newBatchSize = activeBatch.batch_size + 1;
      const totalComps = newComps.reduce((s: number, c: { amount: number }) => s + (c.amount || 0), 0);
      const paidLeads = newBatchSize - totalComps;
      const newTotalPrice = activeBatch.price_per_lead
        ? activeBatch.price_per_lead * Math.max(0, paidLeads)
        : activeBatch.total_price;

      const { error: batchErr } = await supabase
        .from('customer_batches')
        .update({
          batch_size: newBatchSize,
          compensations: newComps,
          total_price: newTotalPrice,
        })
        .eq('id', activeBatch.id);

      if (batchErr) {
        console.error('[admin/reclamations] batch compensation error:', batchErr.message);
      } else {
        batchUpdated = true;
      }
    }
  }

  return NextResponse.json({ ...data, batch_updated: batchUpdated });
}
