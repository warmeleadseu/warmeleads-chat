import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { isAccountManagerScope } from '@/lib/prospects';

interface BulkAssignBody {
  prospect_ids: unknown;
  strategy: unknown; // 'specific_am' | 'round_robin' | 'unassign'
  account_manager_id?: unknown;
  account_manager_ids?: unknown;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (isAccountManagerScope(admin)) return forbidden();

  let body: BulkAssignBody;
  try {
    body = (await request.json()) as BulkAssignBody;
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const ids = Array.isArray(body.prospect_ids) ? (body.prospect_ids.filter(x => typeof x === 'string') as string[]) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Geen prospects geselecteerd' }, { status: 400 });
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  if (body.strategy === 'unassign') {
    const { error } = await supabase
      .from('prospects')
      .update({ account_manager_id: null, assigned_at: null })
      .in('id', ids);
    if (error) {
      return NextResponse.json({ error: 'Bulk unassign mislukt' }, { status: 500 });
    }

    await supabase.from('prospect_activities').insert(
      ids.map(pid => ({
        prospect_id: pid,
        admin_user_id: admin.id,
        type: 'assignment',
        title: 'Toewijzing verwijderd (bulk)',
        metadata: { bulk: true },
      })),
    );

    logAudit({
      adminId: admin.id,
      adminName: admin.name,
      action: 'prospect.bulk_unassigned',
      entityType: 'prospect',
      details: { count: ids.length },
    });

    return NextResponse.json({ success: true, updated: ids.length });
  }

  if (body.strategy === 'specific_am') {
    const amId = typeof body.account_manager_id === 'string' ? body.account_manager_id : '';
    if (!amId) {
      return NextResponse.json({ error: 'account_manager_id is verplicht' }, { status: 400 });
    }
    const { data: amRow } = await supabase
      .from('admin_users')
      .select('id, name, is_active')
      .eq('id', amId)
      .single();
    if (!amRow || !amRow.is_active) {
      return NextResponse.json({ error: 'Account manager niet gevonden of inactief' }, { status: 400 });
    }

    const { error } = await supabase
      .from('prospects')
      .update({ account_manager_id: amId, assigned_at: now })
      .in('id', ids);
    if (error) {
      return NextResponse.json({ error: 'Bulk-toewijzen mislukt' }, { status: 500 });
    }

    await supabase.from('prospect_activities').insert(
      ids.map(pid => ({
        prospect_id: pid,
        admin_user_id: admin.id,
        type: 'assignment',
        title: `Toegewezen aan ${amRow.name} (bulk)`,
        metadata: { bulk: true, to: amId },
      })),
    );

    logAudit({
      adminId: admin.id,
      adminName: admin.name,
      action: 'prospect.bulk_assigned',
      entityType: 'prospect',
      details: { count: ids.length, to: amId },
    });

    return NextResponse.json({ success: true, updated: ids.length });
  }

  if (body.strategy === 'round_robin') {
    const amIds = Array.isArray(body.account_manager_ids)
      ? (body.account_manager_ids.filter(x => typeof x === 'string') as string[])
      : [];
    if (amIds.length === 0) {
      return NextResponse.json({ error: 'Selecteer minimaal 1 account manager' }, { status: 400 });
    }

    const { data: ams } = await supabase
      .from('admin_users')
      .select('id, name, is_active')
      .in('id', amIds);
    const validAms = (ams || []).filter(a => a.is_active);
    if (validAms.length === 0) {
      return NextResponse.json({ error: 'Geen actieve AMs gevonden' }, { status: 400 });
    }

    // Update sequentially per chunk grouped by AM (instead of N updates)
    const buckets: Record<string, string[]> = {};
    for (const am of validAms) buckets[am.id] = [];
    ids.forEach((pid, i) => {
      const am = validAms[i % validAms.length];
      buckets[am.id].push(pid);
    });

    let updated = 0;
    for (const am of validAms) {
      const list = buckets[am.id];
      if (list.length === 0) continue;
      const { error } = await supabase
        .from('prospects')
        .update({ account_manager_id: am.id, assigned_at: now })
        .in('id', list);
      if (error) continue;
      updated += list.length;
      await supabase.from('prospect_activities').insert(
        list.map(pid => ({
          prospect_id: pid,
          admin_user_id: admin.id,
          type: 'assignment',
          title: `Toegewezen aan ${am.name} (round-robin)`,
          metadata: { bulk: true, strategy: 'round_robin', to: am.id },
        })),
      );
    }

    logAudit({
      adminId: admin.id,
      adminName: admin.name,
      action: 'prospect.bulk_assigned',
      entityType: 'prospect',
      details: { count: updated, strategy: 'round_robin', am_pool: validAms.map(a => a.id) },
    });

    return NextResponse.json({ success: true, updated });
  }

  return NextResponse.json({ error: 'Onbekende strategie' }, { status: 400 });
}
