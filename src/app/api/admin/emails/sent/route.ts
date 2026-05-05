import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { isAccountManagerScope } from '@/lib/prospects';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const sp = request.nextUrl.searchParams;
  const prospectId = sp.get('prospect_id');
  const customerId = sp.get('customer_id');
  const limitParam = parseInt(sp.get('limit') || '', 10);
  const limit = Math.min(
    isNaN(limitParam) ? DEFAULT_LIMIT : Math.max(1, limitParam),
    MAX_LIMIT,
  );
  const offsetParam = parseInt(sp.get('offset') || '', 10);
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

  const supabase = createServerClient();
  let query = supabase
    .from('email_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (prospectId) query = query.eq('prospect_id', prospectId);
  if (customerId) query = query.eq('customer_id', customerId);

  // AM-scope: alleen eigen verzonden mails of mails naar eigen
  // prospects/customers. Voor v1 simplificeren we: AM ziet alleen mails
  // waar from_admin_id = admin.id.
  if (isAccountManagerScope(admin)) {
    query = query.eq('from_admin_id', admin.id);
  }

  // Filter op AM-uitgaande mails wanneer expliciet gevraagd (voor de
  // mail-historie tab in drawers willen we alleen 'am_*' types tonen).
  if (sp.get('only_am') === '1') {
    query = query.like('type', 'am_%');
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Mail-historie ophalen mislukt' }, { status: 500 });
  }
  const rows = (data || []) as Array<Record<string, unknown> & { from_admin_id?: string | null }>;

  // Verrijk met from_admin name
  const fromIds = Array.from(
    new Set(rows.map(d => d.from_admin_id).filter((x): x is string => Boolean(x))),
  );
  const adminMap = new Map<string, { id: string; name: string; email: string }>();
  if (fromIds.length > 0) {
    const { data: admins } = await supabase
      .from('admin_users')
      .select('id, name, email')
      .in('id', fromIds);
    for (const a of (admins || []) as { id: string; name: string; email: string }[]) {
      adminMap.set(a.id, a);
    }
  }

  const items = rows.map(m => ({
    ...m,
    from_admin: m.from_admin_id ? adminMap.get(m.from_admin_id) || null : null,
  }));

  return NextResponse.json({ items, total: count ?? items.length, limit, offset });
}
