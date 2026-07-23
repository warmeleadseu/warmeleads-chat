import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized, logImpersonatedWrite } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { isValidLeadStatus } from '@/lib/leadStatuses';
import { logLeadActivity } from '@/lib/leadActivities';

/**
 * POST /api/portal/leads/bulk-status
 * Body: { lead_ids: string[], status: string }
 */
export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_EDIT)) {
    return forbidden('Je mag leadstatussen niet wijzigen');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const status = typeof body.status === 'string' ? body.status : '';
  if (!isValidLeadStatus(status)) {
    return NextResponse.json({ error: `Ongeldige status: ${status}` }, { status: 400 });
  }

  const leadIds = Array.isArray(body.lead_ids)
    ? [...new Set(body.lead_ids.filter((v): v is string => typeof v === 'string' && v.length > 0))]
    : [];
  if (leadIds.length === 0) {
    return NextResponse.json({ error: 'lead_ids is verplicht' }, { status: 400 });
  }
  if (leadIds.length > 5_000) {
    return NextResponse.json({ error: 'Maximaal 5.000 leads per keer' }, { status: 400 });
  }

  const supabase = createServerClient();
  const customerId = session.customer.id;
  const agentScoped = !!session.portalUser && !hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL);
  const agentUserId = session.portalUser?.id ?? null;

  const CHUNK = 500;
  let updated = 0;
  let skipped = 0;
  const touchedLeadIds: string[] = [];

  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK);
    const { data: assignments, error } = await supabase
      .from('lead_assignments')
      .select('id, lead_id, portal_user_id')
      .eq('customer_id', customerId)
      .in('lead_id', chunk);
    if (error) {
      console.error('[portal/leads/bulk-status] fetch', error.message);
      return NextResponse.json({ error: 'Status bijwerken mislukt' }, { status: 500 });
    }

    let allowedIds = (assignments || []).map((a) => a.id);
    if (agentScoped) {
      allowedIds = (assignments || [])
        .filter((a) => !a.portal_user_id || a.portal_user_id === agentUserId)
        .map((a) => a.id);
      skipped += (assignments || []).length - allowedIds.length;
    }

    const foundLeadIds = new Set((assignments || []).map((a) => a.lead_id));
    skipped += chunk.filter((id) => !foundLeadIds.has(id)).length;

    if (allowedIds.length === 0) continue;

    const { error: upErr, count } = await supabase
      .from('lead_assignments')
      .update({ status })
      .in('id', allowedIds)
      .eq('customer_id', customerId);
    if (upErr) {
      console.error('[portal/leads/bulk-status] update', upErr.message);
      return NextResponse.json({ error: 'Status bijwerken mislukt', updated }, { status: 500 });
    }
    updated += count ?? allowedIds.length;
    for (const a of assignments || []) {
      if (allowedIds.includes(a.id)) touchedLeadIds.push(a.lead_id);
    }
  }

  const actorId = session.impersonatedByAdminId
    || session.portalUser?.id
    || session.customer.id;
  const actorName = session.portalUser?.name || session.customer.name;
  for (const leadId of touchedLeadIds.slice(0, 100)) {
    await logLeadActivity(supabase, {
      leadId,
      customerId,
      actorType: session.impersonatedByAdminId ? 'admin' : 'portal_user',
      actorId,
      actorName,
      action: 'status_change',
      details: { status, bulk: leadIds.length > 1 },
    });
  }

  await logImpersonatedWrite(session, 'lead_bulk_status', 'lead', null, {
    lead_count: updated,
    status,
  });

  return NextResponse.json({ updated, skipped, status });
}
