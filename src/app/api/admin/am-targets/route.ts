import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

async function calculateProgress(
  supabase: ReturnType<typeof createServerClient>,
  adminUserId: string,
  targetType: string,
  periodStart: string,
  periodEnd: string,
) {
  const { data: custRows } = await supabase
    .from('customers')
    .select('id')
    .eq('account_manager_id', adminUserId);
  const custIds = (custRows || []).map((c: any) => c.id);
  if (custIds.length === 0) return 0;

  const endPlusOne = new Date(periodEnd);
  endPlusOne.setDate(endPlusOne.getDate() + 1);
  const endISO = endPlusOne.toISOString();

  switch (targetType) {
    case 'revenue': {
      const { data } = await supabase
        .from('customer_batches')
        .select('total_price')
        .in('customer_id', custIds)
        .gte('created_at', periodStart)
        .lt('created_at', endISO);
      return (data || []).reduce((sum: number, b: any) => sum + (Number(b.total_price) || 0), 0);
    }
    case 'batches': {
      const { count } = await supabase
        .from('customer_batches')
        .select('id', { count: 'exact', head: true })
        .in('customer_id', custIds)
        .gte('created_at', periodStart)
        .lt('created_at', endISO);
      return count || 0;
    }
    case 'new_customers': {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('account_manager_id', adminUserId)
        .gte('created_at', periodStart)
        .lt('created_at', endISO);
      return count || 0;
    }
    case 'leads_delivered': {
      const { count } = await supabase
        .from('lead_assignments')
        .select('id', { count: 'exact', head: true })
        .in('customer_id', custIds)
        .gte('assigned_at', periodStart)
        .lt('assigned_at', endISO);
      return count || 0;
    }
    default:
      return 0;
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  let query = supabase
    .from('am_targets')
    .select('*, admin_users(id, name, email)')
    .order('period_start', { ascending: false });

  if (admin.role === 'accountmanager') {
    query = query.eq('admin_user_id', admin.id);
  } else if (userId) {
    query = query.eq('admin_user_id', userId);
  }

  const { data: targets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = await Promise.all(
    (targets || []).map(async (t: any) => {
      const current = await calculateProgress(supabase, t.admin_user_id, t.target_type, t.period_start, t.period_end);
      const pct = Number(t.target_value) > 0 ? Math.round((current / Number(t.target_value)) * 100) : 0;
      return {
        ...t,
        am_name: t.admin_users?.name || 'Onbekend',
        am_email: t.admin_users?.email || '',
        current_value: current,
        progress_pct: Math.min(pct, 999),
      };
    }),
  );

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan targets aanmaken' }, { status: 403 });
  }

  const body = await request.json();
  const { admin_user_id, label, target_type, target_value, bonus_amount, period_start, period_end, notes } = body;

  if (!admin_user_id || !label || !target_type || !target_value || !period_start || !period_end) {
    return NextResponse.json({ error: 'Vul alle verplichte velden in' }, { status: 400 });
  }

  const validTypes = ['revenue', 'batches', 'new_customers', 'leads_delivered'];
  if (!validTypes.includes(target_type)) {
    return NextResponse.json({ error: 'Ongeldig target type' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('am_targets')
    .insert({
      admin_user_id,
      label,
      target_type,
      target_value: Number(target_value),
      bonus_amount: Number(bonus_amount) || 0,
      period_start,
      period_end,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan targets wijzigen' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  const allowed = ['label', 'target_type', 'target_value', 'bonus_amount', 'period_start', 'period_end', 'notes', 'status'];
  const safe: Record<string, any> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) safe[key] = updates[key];
  }
  if (safe.target_value !== undefined) safe.target_value = Number(safe.target_value);
  if (safe.bonus_amount !== undefined) safe.bonus_amount = Number(safe.bonus_amount);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('am_targets')
    .update(safe)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan targets verwijderen' }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from('am_targets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
