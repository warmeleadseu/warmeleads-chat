import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import {
  isAccountManagerScope,
  isValidSource,
  isValidStatus,
  loadAccessibleProspect,
} from '@/lib/prospects';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok || !access.prospect) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  const [tasksRes, activitiesRes, amRes] = await Promise.all([
    supabase
      .from('prospect_tasks')
      .select('*')
      .eq('prospect_id', params.id)
      .order('completed_at', { ascending: true, nullsFirst: true })
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('prospect_activities')
      .select('id, type, title, body, metadata, created_at, admin_user_id')
      .eq('prospect_id', params.id)
      .order('created_at', { ascending: false })
      .limit(100),
    access.prospect.account_manager_id
      ? supabase.from('admin_users').select('id, name, email, avatar_url').eq('id', access.prospect.account_manager_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return NextResponse.json({
    prospect: access.prospect,
    tasks: tasksRes.data || [],
    activities: activitiesRes.data || [],
    account_manager: amRes.data || null,
  });
}

const EDITABLE_FIELDS = [
  'company_name', 'contact_person', 'email', 'phone', 'website',
  'kvk_nummer', 'vat_id', 'address', 'postcode', 'city', 'country',
  'branches', 'company_size', 'notes', 'last_contacted_at',
] as const;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  // status / source / account_manager_id alleen via dedicated endpoints,
  // maar status mogen we hier wel valideren als hij meekomt (bv. snelle inline edit)
  if ('status' in body) {
    if (!isValidStatus(body.status)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 });
    }
    updates.status = body.status;
  }
  if ('source' in body && !isAccountManagerScope(admin)) {
    if (!isValidSource(body.source)) {
      return NextResponse.json({ error: 'Ongeldige bron' }, { status: 400 });
    }
    updates.source = body.source;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, prospect: access.prospect });
  }

  const { data, error } = await supabase
    .from('prospects')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'KVK-nummer is al in gebruik' }, { status: 409 });
    }
    console.error('[prospects] update error:', error.message);
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
  }

  await supabase.from('prospect_activities').insert({
    prospect_id: params.id,
    admin_user_id: admin.id,
    type: 'updated',
    title: 'Prospect bijgewerkt',
    metadata: { fields: Object.keys(updates) },
  });

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect.updated',
    entityType: 'prospect',
    entityId: params.id,
    details: { fields: Object.keys(updates) },
  });

  return NextResponse.json({ success: true, prospect: data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  if (isAccountManagerScope(admin)) return forbidden();

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('prospects')
    .select('id, company_name')
    .eq('id', params.id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  const { error } = await supabase.from('prospects').delete().eq('id', params.id);
  if (error) {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect.deleted',
    entityType: 'prospect',
    entityId: params.id,
    details: { company_name: existing.company_name },
  });

  return NextResponse.json({ success: true });
}
