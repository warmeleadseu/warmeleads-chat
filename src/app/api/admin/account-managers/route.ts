import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

/**
 * Lichtgewicht endpoint dat alle actieve account managers retourneert.
 * Toegankelijk voor elke ingelogde admin (incl. accountmanagers) zodat de UI
 * filters/dropdowns kan vullen zonder dat we /api/admin/users nodig hebben.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, name, email, role, is_account_manager, avatar_url')
    .eq('is_active', true)
    .or('is_account_manager.eq.true,role.eq.accountmanager')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Account managers ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ account_managers: data || [] });
}
