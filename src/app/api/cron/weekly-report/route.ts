import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendWeeklyReport, sendDailyLeadDigest } from '@/lib/email';

function getMondayMidnight(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday.toISOString();
}

function getTodayMidnight(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const mondayISO = getMondayMidnight();
  const todayISO = getTodayMidnight();

  // --- Gather weekly stats ---

  const { count: totalLeads } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true });

  const { count: newLeadsThisWeek } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', mondayISO);

  const { count: assignedThisWeek } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .gte('assigned_at', mondayISO);

  const { count: activeCustomers } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const { count: activeBatches } = await supabase
    .from('batches')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: completedBatches } = await supabase
    .from('batches')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', mondayISO);

  const { data: branchData } = await supabase
    .from('leads')
    .select('branch')
    .gte('created_at', mondayISO);

  const branchCounts: Record<string, number> = {};
  (branchData || []).forEach(l => {
    if (l.branch) branchCounts[l.branch] = (branchCounts[l.branch] || 0) + 1;
  });
  const topBranches = Object.entries(branchCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const stats = {
    totalLeads: totalLeads ?? 0,
    newLeadsThisWeek: newLeadsThisWeek ?? 0,
    assignedThisWeek: assignedThisWeek ?? 0,
    activeCustomers: activeCustomers ?? 0,
    activeBatches: activeBatches ?? 0,
    completedBatches: completedBatches ?? 0,
    topBranches,
  };

  // --- Send weekly report to all active admins ---

  const { data: admins } = await supabase
    .from('admin_users')
    .select('email')
    .eq('is_active', true);

  let weeklyEmailsSent = 0;
  for (const admin of admins || []) {
    const ok = await sendWeeklyReport(admin.email, stats);
    if (ok) weeklyEmailsSent++;
  }

  // --- Send daily lead digests ---

  const { data: notifyCustomers } = await supabase
    .from('customers')
    .select('id, name, email, contact_person')
    .eq('is_active', true)
    .eq('email_notifications', true)
    .eq('notification_frequency', 'daily');

  let digestsSent = 0;
  for (const customer of notifyCustomers || []) {
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .eq('customer_id', customer.id)
      .gte('assigned_at', todayISO);

    const leadIds = (assignments || []).map(a => a.lead_id);
    if (leadIds.length === 0) continue;

    const { data: leads } = await supabase
      .from('leads')
      .select('naam_klant, email, telefoonnummer, postcode, huisnummer, plaatsnaam, provincie, branch, wervingsdatum, notities')
      .in('id', leadIds);

    if (leads && leads.length > 0) {
      const ok = await sendDailyLeadDigest(customer, leads);
      if (ok) digestsSent++;
    }
  }

  return NextResponse.json({
    ok: true,
    weeklyEmailsSent,
    digestsSent,
    stats,
    timestamp: new Date().toISOString(),
  });
}
