import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS, sanitizePermissions } from '@/lib/portalPermissions';
import bcrypt from 'bcryptjs';
import { escapeForIlikeExact, pickEmailRow } from '@/lib/emailDbLookup';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.TEAM_MANAGE)) return forbidden();

  const { customer } = session;
  const { id } = await params;

  try {
    const body = await request.json();
    const supabase = createServerClient();

    // Verify the user belongs to this customer
    const { data: existing } = await supabase
      .from('portal_users')
      .select('id, role')
      .eq('id', id)
      .eq('customer_id', customer.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Teamlid niet gevonden' }, { status: 404 });
    }

    // Prevent modifying owner accounts (they can only be managed by the owner themselves)
    if (existing.role === 'owner' && session.portalUser?.id !== existing.id) {
      return NextResponse.json({ error: 'Eigenaar accounts kunnen niet worden gewijzigd' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.phone !== undefined) updates.phone = body.phone || null;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.role !== undefined && ['manager', 'agent'].includes(body.role)) {
      updates.role = body.role;
    }
    if (Array.isArray(body.permissions)) updates.permissions = sanitizePermissions(body.permissions);
    if (body.assignment_rules !== undefined) updates.assignment_rules = body.assignment_rules;

    if (body.password && body.password.length >= 8) {
      updates.password_hash = await bcrypt.hash(body.password, 12);
    }

    // Validate email uniqueness if changed
    if (body.email !== undefined) {
      const normalizedEmail = body.email.toLowerCase().trim();
      const emailPattern = escapeForIlikeExact(normalizedEmail);

      const { data: takenRows } = await supabase
        .from('portal_users')
        .select('id, email')
        .ilike('email', emailPattern)
        .neq('id', id)
        .limit(5);

      if (pickEmailRow(takenRows || [], normalizedEmail)) {
        return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 });
      }

      const { data: custRows } = await supabase
        .from('customers')
        .select('id, email')
        .ilike('email', emailPattern)
        .limit(5);

      if (pickEmailRow(custRows || [], normalizedEmail)) {
        return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 });
      }

      updates.email = normalizedEmail;
    }

    const { data: updated, error } = await supabase
      .from('portal_users')
      .update(updates)
      .eq('id', id)
      .select('id, name, email, role, is_active, permissions, assignment_rules, last_login_at, last_seen_at, login_count, phone, created_at')
      .single();

    if (error) {
      console.error('[team/[id] PUT]', error);
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }

    // Log activity
    if (session.portalUser || session.isOwner) {
      await supabase.from('portal_user_activity_log').insert({
        portal_user_id: session.portalUser?.id || id,
        customer_id: customer.id,
        action: 'team_member_updated',
        details: { target_id: id, changes: Object.keys(updates).filter(k => k !== 'updated_at' && k !== 'password_hash') },
      }).then(() => {});
    }

    return NextResponse.json({ member: updated });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.TEAM_MANAGE)) return forbidden();

  const { customer } = session;
  const { id } = await params;
  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from('portal_users')
    .select('id, role, name')
    .eq('id', id)
    .eq('customer_id', customer.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Teamlid niet gevonden' }, { status: 404 });
  }

  if (existing.role === 'owner') {
    return NextResponse.json({ error: 'Eigenaar accounts kunnen niet worden verwijderd' }, { status: 403 });
  }

  // Handle reassignment query param
  const reassignTo = request.nextUrl.searchParams.get('reassign_to');
  if (reassignTo && reassignTo !== 'unassign') {
    // Voorkom herverdelen naar een gebruiker van een andere klant.
    const { data: target } = await supabase
      .from('portal_users')
      .select('id')
      .eq('id', reassignTo)
      .eq('customer_id', customer.id)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: 'Ongeldige ontvanger voor herverdeling' }, { status: 400 });
    }
    await supabase
      .from('lead_assignments')
      .update({ portal_user_id: reassignTo })
      .eq('portal_user_id', id)
      .eq('customer_id', customer.id);
  } else if (reassignTo === 'unassign') {
    await supabase
      .from('lead_assignments')
      .update({ portal_user_id: null })
      .eq('portal_user_id', id)
      .eq('customer_id', customer.id);
  } else {
    // Default: unassign all leads
    await supabase
      .from('lead_assignments')
      .update({ portal_user_id: null })
      .eq('portal_user_id', id)
      .eq('customer_id', customer.id);
  }

  const { error } = await supabase
    .from('portal_users')
    .delete()
    .eq('id', id)
    .eq('customer_id', customer.id);

  if (error) {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
