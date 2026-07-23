import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';

/**
 * Lightweight team listing for agenda/leads assignment UIs.
 * Returns id, name, role for active portal_users.
 * Available when user can view all appointments, edit appointments, or manage team.
 */
export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const canAccess =
    hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL) ||
    hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT) ||
    hasPermission(session, PERMISSIONS.TEAM_MANAGE) ||
    hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL) ||
    hasPermission(session, PERMISSIONS.LEADS_ASSIGN);

  if (!canAccess) return forbidden();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('portal_users')
    .select('id, name, role, is_active')
    .eq('customer_id', session.customer.id)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Team ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ members: data || [] });
}
