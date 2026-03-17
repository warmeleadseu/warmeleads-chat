import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customer.id);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: newThisWeek } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .gte('created_at', weekAgo.toISOString());

  const { count: contacted } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('status', 'gecontacteerd');

  const { count: sold } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('status', 'verkocht');

  const { data: statusBreakdown } = await supabase
    .from('leads')
    .select('status')
    .eq('customer_id', customer.id);

  const statusCounts: Record<string, number> = {};
  (statusBreakdown || []).forEach((l: { status: string }) => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });

  const { data: branchBreakdown } = await supabase
    .from('leads')
    .select('branch')
    .eq('customer_id', customer.id);

  const branchCounts: Record<string, number> = {};
  (branchBreakdown || []).forEach((l: { branch: string }) => {
    branchCounts[l.branch] = (branchCounts[l.branch] || 0) + 1;
  });

  return NextResponse.json({
    totalLeads: totalLeads || 0,
    newThisWeek: newThisWeek || 0,
    contacted: contacted || 0,
    sold: sold || 0,
    statusBreakdown: statusCounts,
    branchBreakdown: branchCounts,
  });
}
