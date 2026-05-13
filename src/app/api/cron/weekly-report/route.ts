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
  const t0 = Date.now();
  const mondayISO = getMondayMidnight();
  const todayISO = getTodayMidnight();

  /** Hardcap voor week-leads scan: voorkomt full-table-fetch in topBranches. Bij groei blijft accuraat want fallback is per-branch count. */
  const WEEK_LEADS_SCAN_CAP = 10_000;

  // --- Gather weekly stats (counts parallel) ---

  const [
    totalLeadsRes,
    newLeadsThisWeekRes,
    assignedThisWeekRes,
    activeCustomersRes,
    activeBatchesRes,
    completedBatchesRes,
  ] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .neq('bron', 'excel_import')
      .gte('created_at', mondayISO),
    supabase
      .from('lead_assignments')
      .select('id', { count: 'exact', head: true })
      .gte('assigned_at', mondayISO),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('customer_batches').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('customer_batches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', mondayISO),
  ]);

  // Bounded scan voor branch-counts; bij overschrijding fallen we terug op per-branch counts (geen full-table-scan).
  const { data: branchData } = await supabase
    .from('leads')
    .select('branch')
    .neq('bron', 'excel_import')
    .gte('created_at', mondayISO)
    .limit(WEEK_LEADS_SCAN_CAP + 1);

  const branchScanTruncated = (branchData?.length || 0) > WEEK_LEADS_SCAN_CAP;
  let topBranches: { name: string; count: number }[];

  if (branchScanTruncated) {
    // Fallback: per actieve branche een head-count. Vast aantal branches → klein vast aantal queries.
    const { data: activeBranchRows } = await supabase
      .from('branches')
      .select('slug')
      .eq('hidden_from_admin', false);
    const slugs = (activeBranchRows || []).map(b => b.slug as string);
    const counts = await Promise.all(
      slugs.map(async slug => {
        const { count } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .neq('bron', 'excel_import')
          .gte('created_at', mondayISO)
          .eq('branch', slug);
        return { name: slug, count: count ?? 0 };
      }),
    );
    topBranches = counts.filter(c => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);
  } else {
    const branchCounts: Record<string, number> = {};
    (branchData || []).forEach(l => {
      if (l.branch) branchCounts[l.branch] = (branchCounts[l.branch] || 0) + 1;
    });
    topBranches = Object.entries(branchCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  const stats = {
    totalLeads: totalLeadsRes.count ?? 0,
    newLeadsThisWeek: newLeadsThisWeekRes.count ?? 0,
    assignedThisWeek: assignedThisWeekRes.count ?? 0,
    activeCustomers: activeCustomersRes.count ?? 0,
    activeBatches: activeBatchesRes.count ?? 0,
    completedBatches: completedBatchesRes.count ?? 0,
    topBranches,
    branchScanTruncated,
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
  // Voorheen N+1 (per klant 2 queries). Nu: 1 bulk-query assignments + 1 bulk-query leads, daarna in JS groeperen.

  const { data: notifyCustomers } = await supabase
    .from('customers')
    .select('id, name, email, contact_person')
    .eq('is_active', true)
    .eq('email_notifications', true)
    .eq('notification_frequency', 'daily');

  let digestsSent = 0;
  const digestCustomers = notifyCustomers || [];

  if (digestCustomers.length > 0) {
    const ASSIGN_IN_CHUNK = 200;
    const LEAD_IN_CHUNK = 500;
    const customerIds = digestCustomers.map(c => c.id);

    // 1) Bulk assignments fetch (gechunkt op customer-ids om PostgREST IN-grootte te respecteren).
    type AssignRow = { customer_id: string; lead_id: string };
    const allAssign: AssignRow[] = [];
    for (let i = 0; i < customerIds.length; i += ASSIGN_IN_CHUNK) {
      const chunk = customerIds.slice(i, i + ASSIGN_IN_CHUNK);
      const { data } = await supabase
        .from('lead_assignments')
        .select('customer_id, lead_id')
        .in('customer_id', chunk)
        .gte('assigned_at', todayISO);
      if (data?.length) allAssign.push(...(data as AssignRow[]));
    }

    // Groepeer lead-ids per klant; verzamel ook de hele uniqueset voor 1 leads-fetch.
    const leadIdsByCustomer = new Map<string, string[]>();
    const allLeadIds = new Set<string>();
    for (const a of allAssign) {
      if (!leadIdsByCustomer.has(a.customer_id)) leadIdsByCustomer.set(a.customer_id, []);
      leadIdsByCustomer.get(a.customer_id)!.push(a.lead_id);
      allLeadIds.add(a.lead_id);
    }

    // 2) Bulk leads fetch (gechunkt). Type loose houden — sendDailyLeadDigest accepteert optionele velden.
    type LeadRow = Record<string, unknown> & { id: string };
    const leadMap = new Map<string, LeadRow>();
    const allLeadIdArr = Array.from(allLeadIds);
    for (let i = 0; i < allLeadIdArr.length; i += LEAD_IN_CHUNK) {
      const chunk = allLeadIdArr.slice(i, i + LEAD_IN_CHUNK);
      const { data } = await supabase
        .from('leads')
        .select('id, naam_klant, email, telefoonnummer, postcode, huisnummer, plaatsnaam, provincie, branch, wervingsdatum, notities')
        .in('id', chunk);
      for (const l of (data || []) as LeadRow[]) leadMap.set(l.id, l);
    }

    // 3) Sequentieel digest sturen per klant (Resend-vriendelijk; voorheen ook sequentieel).
    for (const customer of digestCustomers) {
      const leadIds = leadIdsByCustomer.get(customer.id);
      if (!leadIds?.length) continue;
      const leads = leadIds
        .map(id => leadMap.get(id))
        .filter((l): l is LeadRow => !!l);
      if (leads.length === 0) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ok = await sendDailyLeadDigest(customer, leads as any);
      if (ok) digestsSent++;
    }
  }

  console.info('[cron/weekly-report]', {
    computeMs: Date.now() - t0,
    branchScanTruncated,
    weeklyEmailsSent,
    digestCustomers: digestCustomers.length,
    digestsSent,
  });

  return NextResponse.json({
    ok: true,
    weeklyEmailsSent,
    digestsSent,
    stats,
    truncated: branchScanTruncated,
    timestamp: new Date().toISOString(),
  });
}
