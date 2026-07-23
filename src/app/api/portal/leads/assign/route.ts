import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized, logImpersonatedWrite } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { logLeadActivity } from '@/lib/leadActivities';

/**
 * POST /api/portal/leads/assign
 *
 * Wijs één of meer leads handmatig toe aan een teamlid (portal_user),
 * of ontkoppel ze (`portal_user_id: null`).
 *
 * Vereist `leads.assign`, of (backwards-compat) `leads.view_all`.
 */
export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const canAssign =
    hasPermission(session, PERMISSIONS.LEADS_ASSIGN)
    || hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL);
  if (!canAssign) return forbidden('Je mag geen leads toewijzen aan teamleden');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
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

  const rawAssignee = body.portal_user_id;
  let portalUserId: string | null;
  if (rawAssignee === null || rawAssignee === '' || rawAssignee === undefined) {
    portalUserId = null;
  } else if (typeof rawAssignee === 'string') {
    portalUserId = rawAssignee.trim() || null;
  } else {
    return NextResponse.json({ error: 'portal_user_id moet een string of null zijn' }, { status: 400 });
  }

  const supabase = createServerClient();
  const customerId = session.customer.id;

  let assigneeName: string | null = null;
  if (portalUserId) {
    const { data: member, error: memberErr } = await supabase
      .from('portal_users')
      .select('id, name, is_active, customer_id')
      .eq('id', portalUserId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Teamlid niet gevonden' }, { status: 404 });
    }
    if (!member.is_active) {
      return NextResponse.json({ error: 'Dit teamlid is niet actief' }, { status: 400 });
    }
    assigneeName = member.name;
  }

  // Resolve assignments for these leads belonging to this customer
  const assignmentIds: string[] = [];
  const foundLeadIds = new Set<string>();
  const CHUNK = 500;
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('id, lead_id')
      .eq('customer_id', customerId)
      .in('lead_id', chunk);
    if (error) {
      console.error('[portal/leads/assign] fetch failed', error.message);
      return NextResponse.json({ error: 'Toewijzingen ophalen mislukt' }, { status: 500 });
    }
    for (const row of data || []) {
      assignmentIds.push(row.id);
      foundLeadIds.add(row.lead_id);
    }
  }

  // Directe leads (leads.customer_id) zonder assignment-rij: maak er één aan
  // zodat handmatige toewijzing altijd werkt.
  const missingLeadIds = leadIds.filter((id) => !foundLeadIds.has(id));
  if (missingLeadIds.length > 0) {
    const ownedLeadIds: string[] = [];
    for (let i = 0; i < missingLeadIds.length; i += CHUNK) {
      const chunk = missingLeadIds.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('leads')
        .select('id')
        .eq('customer_id', customerId)
        .in('id', chunk);
      if (error) {
        console.error('[portal/leads/assign] lead ownership check failed', error.message);
        return NextResponse.json({ error: 'Leads valideren mislukt' }, { status: 500 });
      }
      for (const row of data || []) ownedLeadIds.push(row.id);
    }

    if (ownedLeadIds.length > 0) {
      const leadStatusById = new Map<string, string | null>();
      for (let i = 0; i < ownedLeadIds.length; i += CHUNK) {
        const chunk = ownedLeadIds.slice(i, i + CHUNK);
        const { data } = await supabase.from('leads').select('id, status').in('id', chunk);
        for (const row of data || []) {
          leadStatusById.set(row.id, row.status ?? 'nieuw');
        }
      }
      const inserts = ownedLeadIds.map((leadId) => ({
        lead_id: leadId,
        customer_id: customerId,
        portal_user_id: portalUserId,
        source: 'distribution',
        status: leadStatusById.get(leadId) || 'nieuw',
      }));
      for (let i = 0; i < inserts.length; i += CHUNK) {
        const chunk = inserts.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('lead_assignments')
          .insert(chunk)
          .select('id, lead_id');
        if (error) {
          console.error('[portal/leads/assign] insert missing assignments failed', error.message);
          return NextResponse.json({ error: 'Toewijzing aanmaken mislukt' }, { status: 500 });
        }
        for (const row of data || []) {
          assignmentIds.push(row.id);
          foundLeadIds.add(row.lead_id);
        }
      }
    }
  }

  if (assignmentIds.length === 0) {
    return NextResponse.json({ error: 'Geen toewijzingen gevonden voor deze leads' }, { status: 404 });
  }

  let updated = 0;
  for (let i = 0; i < assignmentIds.length; i += CHUNK) {
    const chunk = assignmentIds.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from('lead_assignments')
      .update({ portal_user_id: portalUserId })
      .in('id', chunk)
      .eq('customer_id', customerId);
    if (error) {
      console.error('[portal/leads/assign] update failed', error.message);
      return NextResponse.json({
        error: 'Toewijzen mislukt',
        updated,
      }, { status: 500 });
    }
    updated += count ?? chunk.length;
  }

  const actorType = session.impersonatedByAdminId ? 'admin' : (session.portalUser ? 'portal_user' : 'owner');
  const actorId = session.impersonatedByAdminId
    || session.portalUser?.id
    || session.customer.id;
  const actorName = session.portalUser?.name || session.customer.name;

  // Activity log (bounded sample for large batches)
  const activityLeadIds = [...foundLeadIds].slice(0, 100);
  for (const leadId of activityLeadIds) {
    await logLeadActivity(supabase, {
      leadId,
      customerId,
      actorType: actorType === 'admin' ? 'admin' : 'portal_user',
      actorId,
      actorName,
      action: portalUserId ? 'assign_agent' : 'unassign_agent',
      details: {
        portal_user_id: portalUserId,
        portal_user_name: assigneeName,
        bulk: leadIds.length > 1,
      },
    });
  }

  await logImpersonatedWrite(session, 'lead_assign_agent', 'lead', null, {
    lead_count: foundLeadIds.size,
    portal_user_id: portalUserId,
    portal_user_name: assigneeName,
  });

  return NextResponse.json({
    updated: foundLeadIds.size,
    skipped: leadIds.length - foundLeadIds.size,
    portal_user_id: portalUserId,
    portal_user_name: assigneeName,
  });
}
