import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

function periodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '3days': return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'year': return new Date(now.getFullYear(), 0, 1);
    default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

function prevPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    case '3days': return new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1) - 7);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month': return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
    case 'year': return new Date(now.getFullYear() - 1, 0, 1);
    default: return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const [
    totalLeadsRes,
    customersRes,
    batchesRes,
    recentLeadsRes,
    assignmentsRes,
  ] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import'),
    supabase.from('customers').select('id, name, is_active'),
    supabase.from('customer_batches').select('*, customers(name)').order('created_at', { ascending: false }),
    supabase.from('leads').select('id, naam_klant, branch, plaatsnaam, provincie, created_at').neq('bron', 'excel_import').order('created_at', { ascending: false }).limit(12),
    supabase.from('lead_assignments').select('id, lead_id, customer_id, batch_id, assigned_at, customers(name)').order('assigned_at', { ascending: false }).limit(500),
  ]);

  const batches = batchesRes.data || [];
  const activeBatches = batches.filter(b => b.status === 'active');
  const completedBatches = batches.filter(b => b.status === 'completed');
  const activeCustomers = (customersRes.data || []).filter(c => c.is_active);

  const totalRevenue = completedBatches.reduce((s, b) => s + (b.total_price || 0), 0);
  const activeRevenue = activeBatches.reduce((s, b) => {
    if (b.price_per_lead && b.leads_delivered) return s + b.price_per_lead * b.leads_delivered;
    return s;
  }, 0);

  const periods = ['day', '3days', 'week', 'month', 'quarter', 'year'] as const;
  const periodStats: Record<string, { leads: number; prevLeads: number; assigned: number; prevAssigned: number }> = {};

  for (const p of periods) {
    const start = periodStart(p).toISOString();
    const prev = prevPeriodStart(p).toISOString();

    const [leadsNow, leadsPrev, assignNow, assignPrev] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', start),
      supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', prev).lt('created_at', start),
      supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', start),
      supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', prev).lt('assigned_at', start),
    ]);

    periodStats[p] = {
      leads: leadsNow.count || 0,
      prevLeads: leadsPrev.count || 0,
      assigned: assignNow.count || 0,
      prevAssigned: assignPrev.count || 0,
    };
  }

  return NextResponse.json({
    totalLeads: totalLeadsRes.count || 0,
    activeCustomers: activeCustomers.length,
    totalCustomers: (customersRes.data || []).length,
    activeBatches: activeBatches.map(b => ({
      id: b.id,
      customer: b.customers?.name || '—',
      branch: b.branch,
      batchSize: b.batch_size,
      delivered: b.leads_delivered,
      pricePerLead: b.price_per_lead,
      leadsPerWeek: b.leads_per_week,
      notes: b.notes,
    })),
    completedBatchCount: completedBatches.length,
    totalRevenue: totalRevenue + activeRevenue,
    completedRevenue: totalRevenue,
    recentLeads: (recentLeadsRes.data || []).map(l => ({
      id: l.id,
      name: l.naam_klant,
      branch: l.branch,
      city: l.plaatsnaam,
      province: l.provincie,
      createdAt: l.created_at,
    })),
    periodStats,
    timestamp: new Date().toISOString(),
  });
}
