import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/adminAuth';
import {
  PARTNER_PROSPECT_AM_CONFIG_KEY,
  defaultPartnerProspectAmConfigDoc,
  parsePartnerProspectAmConfigDoc,
  type PartnerProspectAmConfigDoc,
} from '@/lib/partnerProspectAssignment';

export async function GET(_request: NextRequest) {
  const { error } = await requireSuperAdmin(_request);
  if (error) return error;

  const supabase = createServerClient();
  const [{ data: row }, { data: users }] = await Promise.all([
    supabase.from('app_settings').select('value, updated_at').eq('key', PARTNER_PROSPECT_AM_CONFIG_KEY).maybeSingle(),
    supabase
      .from('admin_users')
      .select('id, name, email, role, is_active, is_account_manager')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  const parsed = parsePartnerProspectAmConfigDoc(row?.value ?? null);
  const config: PartnerProspectAmConfigDoc = parsed ?? defaultPartnerProspectAmConfigDoc();

  return NextResponse.json({
    config,
    updated_at: row?.updated_at ?? null,
    users: users || [],
  });
}

export async function PUT(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error || !admin) return error!;

  let body: { config?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const raw = JSON.stringify(body.config ?? {});
  const parsed = parsePartnerProspectAmConfigDoc(raw);
  if (!parsed || Object.keys(parsed).length === 0) {
    return NextResponse.json(
      { error: 'Ongeldige config: minimaal één branch met strategy en assignees (geldige admin UUIDs).' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const allIds = new Set<string>();
  for (const [branch, bc] of Object.entries(parsed)) {
    if (bc.strategy === 'single' && bc.assignees.length !== 1) {
      return NextResponse.json(
        { error: `Branch "${branch}": bij strategie "Vaste AM" mag er precies één AM in de pool staan.` },
        { status: 400 },
      );
    }
    for (const a of bc.assignees) allIds.add(a.admin_user_id);
  }
  const { data: found, error: uerr } = await supabase
    .from('admin_users')
    .select('id')
    .in('id', [...allIds])
    .eq('is_active', true);

  if (uerr) {
    return NextResponse.json({ error: 'Kon gebruikers niet valideren' }, { status: 500 });
  }
  const okIds = new Set((found || []).map(r => r.id as string));
  for (const id of allIds) {
    if (!okIds.has(id)) {
      return NextResponse.json(
        { error: `Accountmanager-ID onbekend of inactief: ${id}` },
        { status: 400 },
      );
    }
  }

  const { error: serr } = await supabase.from('app_settings').upsert(
    {
      key: PARTNER_PROSPECT_AM_CONFIG_KEY,
      value: JSON.stringify(parsed),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );

  if (serr) {
    return NextResponse.json({ error: serr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, config: parsed });
}
