import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const url = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(url.get('page') || '1'));
  const limit = Math.min(parseInt(url.get('limit') || '25'), 100);
  const action = url.get('action');
  const entityType = url.get('entity_type');
  const adminId = url.get('admin_id');
  const search = url.get('search');
  const dateFrom = url.get('date_from');
  const dateTo = url.get('date_to');

  const supabase = createServerClient();

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' });

  if (action && action !== 'all') query = query.eq('action', action);
  if (entityType && entityType !== 'all') query = query.eq('entity_type', entityType);
  if (adminId && adminId !== 'all') query = query.eq('admin_id', adminId);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
  if (search) query = query.ilike('details', `%${search}%`);

  query = query.order('created_at', { ascending: false });

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json(
      { error: 'Audit log ophalen mislukt' },
      { status: 500 },
    );
  }

  const total = count || 0;

  return NextResponse.json({
    logs: data || [],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
