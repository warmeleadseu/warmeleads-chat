import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { isAccountManagerScope } from '@/lib/prospects';

const MAX = 150;

/**
 * Recente prospect-activiteiten (timeline) over meerdere prospects heen.
 * AM: alleen activiteiten op eigen prospects. Admin/superadmin: alles.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const limit = Math.min(MAX, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '80', 10)));

  const supabase = createServerClient();

  let prospectIds: string[] | null = null;
  if (isAccountManagerScope(admin)) {
    const { data: rows } = await supabase.from('prospects').select('id').eq('account_manager_id', admin.id);
    prospectIds = (rows || []).map(r => r.id);
    if (prospectIds.length === 0) {
      return NextResponse.json({ activities: [] });
    }
  }

  let q = supabase
    .from('prospect_activities')
    .select('id, prospect_id, type, title, body, metadata, created_at, admin_user_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (prospectIds) {
    q = q.in('prospect_id', prospectIds);
  }

  const { data: activities, error } = await q;

  if (error) {
    return NextResponse.json({ error: 'Activiteiten ophalen mislukt' }, { status: 500 });
  }

  const rows = activities || [];
  const pids = [...new Set(rows.map(a => a.prospect_id))];
  const adminIds = [...new Set(rows.map(a => a.admin_user_id).filter(Boolean))] as string[];

  const [{ data: prospects }, { data: admins }] = await Promise.all([
    pids.length
      ? supabase.from('prospects').select('id, company_name, status').in('id', pids)
      : Promise.resolve({ data: [] as { id: string; company_name: string; status: string }[] }),
    adminIds.length
      ? supabase.from('admin_users').select('id, name').in('id', adminIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const prospectMap = new Map((prospects || []).map(p => [p.id, p]));
  const adminMap = new Map((admins || []).map(a => [a.id, a.name]));

  const enriched = rows.map(a => ({
    ...a,
    prospect: prospectMap.get(a.prospect_id) || null,
    actor_name: a.admin_user_id ? adminMap.get(a.admin_user_id) || null : null,
  }));

  return NextResponse.json({ activities: enriched });
}
