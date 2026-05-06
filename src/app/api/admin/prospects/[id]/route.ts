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

  // Tekstvelden waarvoor lege strings naar NULL moeten worden genormaliseerd
  // — vooral belangrijk voor velden met een (partiële) unique index zoals
  // kvk_nummer: zonder normalisatie zou een tweede prospect zonder KVK met
  // lege string botsen op de eerste lege string (NULL is daar wél meervoudig
  // toegestaan).
  const NULLABLE_TEXT_FIELDS = new Set([
    'contact_person',
    'email',
    'phone',
    'website',
    'kvk_nummer',
    'vat_id',
    'address',
    'postcode',
    'city',
    'country',
    'company_size',
    'notes',
    'last_contacted_at',
  ]);

  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (!(key in body)) continue;
    let value = body[key];
    if (typeof value === 'string' && NULLABLE_TEXT_FIELDS.has(key)) {
      const trimmed = value.trim();
      value = trimmed === '' ? null : trimmed;
    }
    updates[key] = value;
  }

  // status / source / account_manager_id alleen via dedicated endpoints,
  // maar status mogen we hier wel valideren als hij meekomt (bv. snelle inline edit)
  if ('status' in body) {
    if (!isValidStatus(body.status)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 });
    }
    if (body.status === 'verloren') {
      const reason = typeof body.lost_reason === 'string' ? body.lost_reason.trim() : '';
      if (!reason) {
        return NextResponse.json({ error: 'Geef een reden bij status "verloren"' }, { status: 400 });
      }
      updates.lost_reason = reason;
    } else {
      updates.lost_reason = null;
    }
    updates.status = body.status;
  } else if ('lost_reason' in body) {
    // sta toe om alleen de reden bij te werken zolang status al "verloren" is
    if (access.prospect?.status !== 'verloren') {
      return NextResponse.json({ error: 'lost_reason alleen geldig bij status "verloren"' }, { status: 400 });
    }
    const reason = typeof body.lost_reason === 'string' ? body.lost_reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'Reden mag niet leeg zijn' }, { status: 400 });
    }
    updates.lost_reason = reason;
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
