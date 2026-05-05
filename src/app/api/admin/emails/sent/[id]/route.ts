import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { isAccountManagerScope } from '@/lib/prospects';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('email_log')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Mail niet gevonden' }, { status: 404 });
  }
  const row = data as Record<string, unknown> & { from_admin_id?: string | null };

  if (isAccountManagerScope(admin) && row.from_admin_id !== admin.id) {
    return forbidden();
  }

  let fromAdmin: { id: string; name: string; email: string } | null = null;
  if (row.from_admin_id) {
    const { data: a } = await supabase
      .from('admin_users')
      .select('id, name, email')
      .eq('id', row.from_admin_id)
      .single();
    fromAdmin = (a as { id: string; name: string; email: string } | null) || null;
  }

  return NextResponse.json({ email: { ...row, from_admin: fromAdmin } });
}
