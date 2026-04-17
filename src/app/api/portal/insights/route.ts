import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

const IN_CHUNK = 500;

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.STATISTICS_VIEW)) return forbidden();

  const { customer } = session;

  const supabase = createServerClient();

  const { data: custData } = await supabase
    .from('customers')
    .select('demo_mode')
    .eq('id', customer.id)
    .single();
  const demoMode = custData?.demo_mode ?? false;

  const directLeads = demoMode
    ? []
    : ((await supabase.from('leads').select('id').eq('customer_id', customer.id)).data || []);

  let assignQuery = supabase.from('lead_assignments').select('lead_id, status').eq('customer_id', customer.id).order('assigned_at', { ascending: false });
  if (demoMode) {
    assignQuery = assignQuery.eq('source', 'demo');
  } else {
    assignQuery = assignQuery.neq('source', 'demo');
  }
  const { data: assignedLeads } = await assignQuery;

  const leadIds = new Set<string>();
  const assignmentStatusMap: Record<string, string> = {};
  (directLeads || []).forEach((l: { id: string }) => leadIds.add(l.id));
  (assignedLeads || []).forEach(a => {
    leadIds.add(a.lead_id);
    if (!assignmentStatusMap[a.lead_id]) {
      assignmentStatusMap[a.lead_id] = a.status || 'nieuw';
    }
  });

  const allIds = Array.from(leadIds);

  if (allIds.length === 0) {
    return NextResponse.json({
      conversionFunnel: {
        nieuw: 0, gecontacteerd: 0, geen_gehoor: 0, offerte: 0, verkocht: 0, afgewezen: 0, conversionRate: 0,
      },
      quality: { averageScore: 0, phoneValidPct: 0, totalWithScore: 0 },
      responseSpeed: { averageHours: null },
      topLocations: [],
      topProvinces: [],
      periodComparison: { thisWeek: 0, lastWeek: 0, thisMonth: 0, lastMonth: 0 },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allLeads: any[] = [];
  for (let i = 0; i < allIds.length; i += IN_CHUNK) {
    const chunk = allIds.slice(i, i + IN_CHUNK);
    const { data } = await supabase
      .from('leads')
      .select('id, status, branch, plaatsnaam, provincie, quality_score, phone_valid, created_at, updated_at')
      .in('id', chunk);
    if (data) allLeads.push(...data);
  }

  const leads = allLeads.map(l => ({
    ...l,
    status: assignmentStatusMap[l.id] ?? l.status,
  }));
  const total = leads.length;

  // Conversion funnel
  const nieuw = leads.filter(l => l.status === 'nieuw').length;
  const gecontacteerd = leads.filter(l => l.status === 'gecontacteerd').length;
  const geen_gehoor = leads.filter(l => l.status === 'geen_gehoor').length;
  const offerte = leads.filter(l => l.status === 'offerte').length;
  const verkocht = leads.filter(l => l.status === 'verkocht').length;
  const afgewezen = leads.filter(l => l.status === 'afgewezen').length;
  const conversionRate = total > 0 ? Math.round((verkocht / total) * 10000) / 100 : 0;

  // Quality metrics
  const withScore = leads.filter(l => l.quality_score != null);
  const averageScore = withScore.length > 0
    ? Math.round(withScore.reduce((sum, l) => sum + l.quality_score, 0) / withScore.length * 10) / 10
    : 0;
  const phoneValidCount = leads.filter(l => l.phone_valid === true).length;
  const phoneValidPct = total > 0 ? Math.round((phoneValidCount / total) * 10000) / 100 : 0;

  // Response speed: average hours between created_at and updated_at for non-'nieuw' leads
  const respondedLeads = leads.filter(l => l.status !== 'nieuw' && l.updated_at && l.created_at);
  let averageHours: number | null = null;
  if (respondedLeads.length > 0) {
    const totalHours = respondedLeads.reduce((sum, l) => {
      const diff = new Date(l.updated_at).getTime() - new Date(l.created_at).getTime();
      return sum + diff / (1000 * 60 * 60);
    }, 0);
    averageHours = Math.round((totalHours / respondedLeads.length) * 10) / 10;
  }

  // Top locations
  const cityCounts: Record<string, number> = {};
  leads.forEach(l => {
    if (l.plaatsnaam) {
      cityCounts[l.plaatsnaam] = (cityCounts[l.plaatsnaam] || 0) + 1;
    }
  });
  const topLocations = Object.entries(cityCounts)
    .map(([plaatsnaam, count]) => ({ plaatsnaam, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Province breakdown
  const provinceCounts: Record<string, number> = {};
  leads.forEach(l => {
    if (l.provincie) {
      provinceCounts[l.provincie] = (provinceCounts[l.provincie] || 0) + 1;
    }
  });
  const topProvinces = Object.entries(provinceCounts)
    .map(([provincie, count]) => ({ provincie, count }))
    .sort((a, b) => b.count - a.count);

  // Period comparison
  const now = new Date();
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  thisMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);

  const thisWeek = leads.filter(l => new Date(l.created_at) >= thisMonday).length;
  const lastWeek = leads.filter(l => {
    const d = new Date(l.created_at);
    return d >= lastMonday && d < thisMonday;
  }).length;
  const thisMonth = leads.filter(l => new Date(l.created_at) >= thisMonthStart).length;
  const lastMonth = leads.filter(l => {
    const d = new Date(l.created_at);
    return d >= lastMonthStart && d <= lastMonthEnd;
  }).length;

  return NextResponse.json({
    conversionFunnel: {
      nieuw, gecontacteerd, geen_gehoor, offerte, verkocht, afgewezen, conversionRate,
    },
    quality: { averageScore, phoneValidPct, totalWithScore: withScore.length },
    responseSpeed: { averageHours },
    topLocations,
    topProvinces,
    periodComparison: { thisWeek, lastWeek, thisMonth, lastMonth },
  });
}
