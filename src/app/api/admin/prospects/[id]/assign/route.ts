import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { isAccountManagerScope, loadAccessibleProspect } from '@/lib/prospects';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (isAccountManagerScope(admin)) return forbidden();

  let body: { account_manager_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const newAmId =
    body.account_manager_id === null || body.account_manager_id === ''
      ? null
      : typeof body.account_manager_id === 'string'
        ? body.account_manager_id
        : undefined;

  if (newAmId === undefined) {
    return NextResponse.json({ error: 'account_manager_id ontbreekt' }, { status: 400 });
  }

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok || !access.prospect) {
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  let amName: string | null = null;
  if (newAmId) {
    const { data: amRow } = await supabase
      .from('admin_users')
      .select('id, name, is_active')
      .eq('id', newAmId)
      .single();
    if (!amRow || !amRow.is_active) {
      return NextResponse.json({ error: 'Account manager niet gevonden of inactief' }, { status: 400 });
    }
    amName = amRow.name;
  }

  const { data, error } = await supabase
    .from('prospects')
    .update({
      account_manager_id: newAmId,
      assigned_at: newAmId ? new Date().toISOString() : null,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Toewijzen mislukt' }, { status: 500 });
  }

  await supabase.from('prospect_activities').insert({
    prospect_id: params.id,
    admin_user_id: admin.id,
    type: 'assignment',
    title: newAmId
      ? `Toegewezen aan ${amName ?? 'account manager'}`
      : 'Toewijzing verwijderd',
    metadata: {
      from: access.prospect.account_manager_id,
      to: newAmId,
    },
  });

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect.assigned',
    entityType: 'prospect',
    entityId: params.id,
    details: {
      from: access.prospect.account_manager_id,
      to: newAmId,
    },
  });

  return NextResponse.json({ success: true, prospect: data });
}
