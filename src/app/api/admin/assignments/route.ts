import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { syncBatchDelivered } from '@/lib/batchSync';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const leadId = request.nextUrl.searchParams.get('lead_id');
  const customerId = request.nextUrl.searchParams.get('customer_id');
  const batchId = request.nextUrl.searchParams.get('batch_id');

  let query = supabase
    .from('lead_assignments')
    .select('*, customers(name), leads(naam_klant, email, branch, postcode, plaatsnaam)')
    .order('assigned_at', { ascending: false });

  if (leadId) query = query.eq('lead_id', leadId);
  if (customerId) query = query.eq('customer_id', customerId);
  if (batchId) query = query.eq('batch_id', batchId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = data || [];

  if (customerId && !batchId) {
    const assignedLeadIds = new Set(results.map((a: { lead_id: string }) => a.lead_id));

    const { data: directLeads } = await supabase
      .from('leads')
      .select('id, naam_klant, email, branch, postcode, plaatsnaam, created_at')
      .eq('customer_id', customerId);

    const missing = (directLeads || []).filter(l => !assignedLeadIds.has(l.id));

    if (missing.length > 0) {
      const rows = missing.map(l => ({ lead_id: l.id, customer_id: customerId }));
      await supabase
        .from('lead_assignments')
        .upsert(rows, { onConflict: 'lead_id,customer_id' });

      for (const l of missing) {
        results.push({
          id: `synced-${l.id}`,
          lead_id: l.id,
          customer_id: customerId,
          batch_id: null,
          distance_km: null,
          assigned_at: l.created_at,
          customers: null,
          leads: {
            naam_klant: l.naam_klant,
            email: l.email,
            branch: l.branch,
            postcode: l.postcode,
            plaatsnaam: l.plaatsnaam,
          },
        });
      }
    }
  }

  return NextResponse.json(results);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('batch_id')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('lead_assignments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (assignment?.batch_id) {
    await syncBatchDelivered(supabase, assignment.batch_id);
  }

  return NextResponse.json({ ok: true });
}
