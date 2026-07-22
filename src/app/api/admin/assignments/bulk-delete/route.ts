import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { adminCanAccessCustomer } from '@/lib/permissions';
import { syncBatchDelivered } from '@/lib/batchSync';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();
  const { customer_id, lead_ids, all, filters } = body;

  if (!customer_id) {
    return NextResponse.json({ error: 'customer_id is verplicht' }, { status: 400 });
  }

  // AM-scoping: alleen toewijzingen van eigen klanten mogen verwijderd worden.
  if (!(await adminCanAccessCustomer(admin, customer_id))) return forbidden();

  let assignmentsToDelete: { id: string; lead_id: string; batch_id: string | null }[] = [];

  if (all) {
    let query = supabase
      .from('lead_assignments')
      .select('id, lead_id, batch_id, leads!inner(naam_klant, email, branch, postcode, plaatsnaam)')
      .eq('customer_id', customer_id);

    if (filters?.branch) {
      query = query.eq('leads.branch', filters.branch);
    }
    if (filters?.search) {
      query = query.or(
        `leads.naam_klant.ilike.%${filters.search}%,leads.email.ilike.%${filters.search}%,leads.postcode.ilike.%${filters.search}%,leads.plaatsnaam.ilike.%${filters.search}%`,
        { foreignTable: 'leads' }
      );
    }
    if (filters?.batch_id) {
      query = query.eq('batch_id', filters.batch_id);
    }
    if (filters?.status) {
      const statuses = String(filters.status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) query = query.eq('status', statuses[0]);
      else if (statuses.length > 1) query = query.in('status', statuses);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    assignmentsToDelete = (data || []).map(a => ({ id: a.id, lead_id: a.lead_id, batch_id: a.batch_id }));
  } else if (Array.isArray(lead_ids) && lead_ids.length > 0) {
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('id, lead_id, batch_id')
      .eq('customer_id', customer_id)
      .in('lead_id', lead_ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    assignmentsToDelete = data || [];
  } else {
    return NextResponse.json({ error: 'lead_ids of all=true is verplicht' }, { status: 400 });
  }

  if (assignmentsToDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const assignmentIds = assignmentsToDelete.map(a => a.id);
  const affectedBatchIds = [...new Set(
    assignmentsToDelete.map(a => a.batch_id).filter((id): id is string => id !== null)
  )];
  const affectedLeadIds = assignmentsToDelete.map(a => a.lead_id);

  // Delete assignments in chunks of 100 to stay within Supabase limits
  const chunkSize = 100;
  for (let i = 0; i < assignmentIds.length; i += chunkSize) {
    const chunk = assignmentIds.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('lead_assignments')
      .delete()
      .in('id', chunk);

    if (error) {
      return NextResponse.json({
        error: `Verwijderen mislukt bij batch ${Math.floor(i / chunkSize) + 1}: ${error.message}`,
        deleted: i,
      }, { status: 500 });
    }
  }

  // Also clear legacy leads.customer_id for these leads
  if (affectedLeadIds.length > 0) {
    for (let i = 0; i < affectedLeadIds.length; i += chunkSize) {
      const chunk = affectedLeadIds.slice(i, i + chunkSize);
      await supabase
        .from('leads')
        .update({ customer_id: null })
        .eq('customer_id', customer_id)
        .in('id', chunk);
    }
  }

  // Sync all affected batches so leads_delivered and status are correct
  for (const batchId of affectedBatchIds) {
    await syncBatchDelivered(supabase, batchId);
  }

  return NextResponse.json({
    deleted: assignmentsToDelete.length,
    batches_synced: affectedBatchIds.length,
  });
}
