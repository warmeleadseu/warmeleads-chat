import { createServerClient } from '@/lib/supabase';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface MetaCredentials {
  accessToken: string;
  adAccountId: string;
}

interface AdInsight {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  date_start: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: { action_type: string; value: string }[];
}

export async function getMetaCredentials(): Promise<MetaCredentials | null> {
  const envToken = process.env.META_ACCESS_TOKEN;
  const envAccount = process.env.META_AD_ACCOUNT_ID;
  if (envToken && envAccount) {
    return { accessToken: envToken, adAccountId: envAccount };
  }

  const supabase = createServerClient();
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['meta_access_token', 'meta_ad_account_id']);

  if (!data || data.length < 2) return null;

  const settings: Record<string, string> = {};
  for (const row of data) settings[row.key] = row.value;

  if (!settings.meta_access_token || !settings.meta_ad_account_id) return null;
  return { accessToken: settings.meta_access_token, adAccountId: settings.meta_ad_account_id };
}

export async function fetchAdInsights(
  credentials: MetaCredentials,
  dateFrom: string,
  dateTo: string,
): Promise<AdInsight[]> {
  const { accessToken, adAccountId } = credentials;
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  const allInsights: AdInsight[] = [];
  let url: string | null =
    `${META_GRAPH_URL}/${accountId}/insights?` +
    new URLSearchParams({
      fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions',
      level: 'ad',
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      time_increment: '1',
      limit: '500',
      access_token: accessToken,
    }).toString();

  let currentUrl: string | null = url;
  while (currentUrl) {
    const response: Response = await fetch(currentUrl);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[Meta API] Error fetching insights:', response.status, err);
      throw new Error(`Meta API error: ${response.status} ${err?.error?.message || 'Unknown'}`);
    }

    const json = await response.json();
    const data = json.data as AdInsight[];
    if (data && data.length > 0) allInsights.push(...data);

    currentUrl = json.paging?.next || null;
  }

  return allInsights;
}

function extractLeadCount(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  const leadAction = actions.find(
    a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
  );
  return leadAction ? parseInt(leadAction.value, 10) || 0 : 0;
}

export async function syncMetaAdSpend(dateFrom: string, dateTo: string): Promise<{
  synced: number;
  leadsUpdated: number;
  errors: string[];
}> {
  const credentials = await getMetaCredentials();
  if (!credentials) return { synced: 0, leadsUpdated: 0, errors: ['Meta API credentials niet geconfigureerd'] };

  const supabase = createServerClient();
  const errors: string[] = [];
  let synced = 0;

  let insights: AdInsight[];
  try {
    insights = await fetchAdInsights(credentials, dateFrom, dateTo);
  } catch (e) {
    return { synced: 0, leadsUpdated: 0, errors: [(e as Error).message] };
  }

  for (const row of insights) {
    const spend = parseFloat(row.spend) || 0;
    const impressions = parseInt(row.impressions) || 0;
    const clicks = parseInt(row.clicks) || 0;
    const leadsCount = extractLeadCount(row.actions);
    const cpl = leadsCount > 0 ? Math.round((spend / leadsCount) * 100) / 100 : null;

    const { error } = await supabase.from('meta_ad_spend').upsert({
      ad_account_id: credentials.adAccountId,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      adset_id: row.adset_id,
      adset_name: row.adset_name,
      ad_id: row.ad_id,
      ad_name: row.ad_name,
      date: row.date_start,
      spend,
      impressions,
      clicks,
      leads_count: leadsCount,
      cpl,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'ad_id,date' });

    if (error) {
      errors.push(`Upsert error for ad ${row.ad_id} on ${row.date_start}: ${error.message}`);
    } else {
      synced++;
    }
  }

  // Phase 2: Calculate CPL and update lead_cost on individual leads
  let leadsUpdated = 0;

  const { data: spendRows } = await supabase
    .from('meta_ad_spend')
    .select('ad_id, date, cpl')
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .not('cpl', 'is', null);

  if (spendRows && spendRows.length > 0) {
    const cplMap = new Map<string, number>();
    for (const sr of spendRows) {
      cplMap.set(`${sr.ad_id}__${sr.date}`, sr.cpl);
    }

    const { data: leads } = await supabase
      .from('leads')
      .select('id, meta_ad_id, wervingsdatum')
      .not('meta_ad_id', 'is', null)
      .gte('wervingsdatum', dateFrom)
      .lte('wervingsdatum', dateTo);

    for (const lead of leads || []) {
      const key = `${lead.meta_ad_id}__${lead.wervingsdatum}`;
      const cpl = cplMap.get(key);
      if (cpl !== undefined) {
        const { error } = await supabase
          .from('leads')
          .update({ lead_cost: cpl })
          .eq('id', lead.id);
        if (!error) leadsUpdated++;
      }
    }

    // Fallback: leads with ad_id but no exact date match — use ad-level average CPL
    const { data: uncostedLeads } = await supabase
      .from('leads')
      .select('id, meta_ad_id')
      .not('meta_ad_id', 'is', null)
      .is('lead_cost', null)
      .gte('wervingsdatum', dateFrom)
      .lte('wervingsdatum', dateTo);

    if (uncostedLeads && uncostedLeads.length > 0) {
      const adIds = [...new Set(uncostedLeads.map(l => l.meta_ad_id))];
      const { data: avgSpend } = await supabase
        .from('meta_ad_spend')
        .select('ad_id, spend, leads_count')
        .in('ad_id', adIds);

      const adAvgCpl = new Map<string, number>();
      if (avgSpend) {
        const adTotals = new Map<string, { spend: number; leads: number }>();
        for (const s of avgSpend) {
          const existing = adTotals.get(s.ad_id) || { spend: 0, leads: 0 };
          existing.spend += parseFloat(s.spend) || 0;
          existing.leads += s.leads_count || 0;
          adTotals.set(s.ad_id, existing);
        }
        for (const [adId, totals] of adTotals) {
          if (totals.leads > 0) {
            adAvgCpl.set(adId, Math.round((totals.spend / totals.leads) * 100) / 100);
          }
        }
      }

      for (const lead of uncostedLeads) {
        const avgCpl = adAvgCpl.get(lead.meta_ad_id);
        if (avgCpl !== undefined) {
          const { error } = await supabase
            .from('leads')
            .update({ lead_cost: avgCpl })
            .eq('id', lead.id);
          if (!error) leadsUpdated++;
        }
      }
    }
  }

  return { synced, leadsUpdated, errors };
}

export async function verifyMetaToken(accessToken: string): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    const res = await fetch(`${META_GRAPH_URL}/me?access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) return { valid: false, error: data.error.message };
    return { valid: true, name: data.name };
  } catch {
    return { valid: false, error: 'Kon Meta API niet bereiken' };
  }
}
