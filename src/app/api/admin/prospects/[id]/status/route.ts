import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import {
  isValidStatus,
  loadAccessibleProspect,
  PROSPECT_STATUS_LABELS,
} from '@/lib/prospects';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: { status?: unknown; lost_reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  if (!isValidStatus(body.status)) {
    return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 });
  }

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok || !access.prospect) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  if (body.status === 'verloren') {
    const reason = typeof body.lost_reason === 'string' ? body.lost_reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'Geef een reden bij status "verloren"' }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = {
    status: body.status,
    lost_reason: body.status === 'verloren' ? body.lost_reason : null,
  };

  const { data, error } = await supabase
    .from('prospects')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Status wijzigen mislukt' }, { status: 500 });
  }

  await supabase.from('prospect_activities').insert({
    prospect_id: params.id,
    admin_user_id: admin.id,
    type: 'status_change',
    title: `Status: ${PROSPECT_STATUS_LABELS[access.prospect.status] ?? access.prospect.status} \u2192 ${PROSPECT_STATUS_LABELS[body.status]}`,
    body: body.status === 'verloren' && typeof body.lost_reason === 'string' ? body.lost_reason : null,
    metadata: { from: access.prospect.status, to: body.status },
  });

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect.status_changed',
    entityType: 'prospect',
    entityId: params.id,
    details: { from: access.prospect.status, to: body.status, lost_reason: body.lost_reason ?? null },
  });

  return NextResponse.json({ success: true, prospect: data });
}
