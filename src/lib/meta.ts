import { createServerClient } from '@/lib/supabase';

export const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

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

/** Lookback voor leads-scan in fase 2 (CPL toewijzing). Houd ruim genoeg voor late attributie. */
const META_LEAD_LOOKBACK_DAYS = 90;
/** Hardcap op aantal leads dat we in 1 sync verrijken met CPL. Voorkomt full-table-scan bij groei. */
const META_LEAD_SCAN_MAX = 20_000;
/** Pagina-grootte voor leads-paginatie binnen META_LEAD_SCAN_MAX. */
const META_LEAD_PAGE = 1000;
/** Chunkgrootte voor `meta_ad_spend` batch-upserts. */
const META_UPSERT_CHUNK = 200;
/** Chunkgrootte voor `leads.update(...).in('id', ids)` per unieke CPL-waarde. PostgREST `IN`-filter blijft op proportionele payload. */
const META_LEAD_UPDATE_CHUNK = 500;

export async function syncMetaAdSpend(dateFrom: string, dateTo: string): Promise<{
  synced: number;
  leadsUpdated: number;
  errors: string[];
  truncated?: boolean;
  computeMs?: number;
}> {
  const t0 = Date.now();
  const credentials = await getMetaCredentials();
  if (!credentials) return { synced: 0, leadsUpdated: 0, errors: ['Meta API credentials niet geconfigureerd'] };

  const supabase = createServerClient();
  const errors: string[] = [];
  let synced = 0;
  let upsertChunks = 0;

  let insights: AdInsight[];
  try {
    insights = await fetchAdInsights(credentials, dateFrom, dateTo);
  } catch (e) {
    return { synced: 0, leadsUpdated: 0, errors: [(e as Error).message] };
  }

  /* ── Fase 1: batched upserts naar meta_ad_spend ───────────────── */
  const upsertRows = insights.map(row => {
    const spend = parseFloat(row.spend) || 0;
    const impressions = parseInt(row.impressions) || 0;
    const clicks = parseInt(row.clicks) || 0;
    const leadsCount = extractLeadCount(row.actions);
    const cpl = leadsCount > 0 ? Math.round((spend / leadsCount) * 100) / 100 : null;
    return {
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
    };
  });

  for (let i = 0; i < upsertRows.length; i += META_UPSERT_CHUNK) {
    const chunk = upsertRows.slice(i, i + META_UPSERT_CHUNK);
    const { error } = await supabase.from('meta_ad_spend').upsert(chunk, { onConflict: 'ad_id,date' });
    upsertChunks++;
    if (error) {
      errors.push(`Upsert error chunk ${upsertChunks}: ${error.message}`);
    } else {
      synced += chunk.length;
    }
  }

  /* ── Fase 2: CPL toekennen aan onze leads (gebatcht per unieke CPL) ── */
  let leadsUpdated = 0;
  let truncated = false;

  // Lookback-venster: alleen leads die nog relevant zijn voor CPL-attributie. Bij groei voorkomt dit een full-table-scan.
  const leadCutoff = new Date(Date.now() - META_LEAD_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  type OurLead = { id: string; meta_campaign_id: string | null; wervingsdatum: string | null };
  const ourLeads: OurLead[] = [];
  let from = 0;
  while (ourLeads.length < META_LEAD_SCAN_MAX) {
    const room = META_LEAD_SCAN_MAX - ourLeads.length;
    const take = Math.min(META_LEAD_PAGE, room);
    const { data } = await supabase
      .from('leads')
      .select('id, meta_campaign_id, wervingsdatum')
      .neq('bron', 'excel_import')
      .not('meta_campaign_id', 'is', null)
      .gte('created_at', leadCutoff)
      .order('created_at', { ascending: false })
      .range(from, from + take - 1);
    if (!data?.length) break;
    ourLeads.push(...(data as OurLead[]));
    if (data.length < take) break;
    from += data.length;
  }
  if (ourLeads.length >= META_LEAD_SCAN_MAX) truncated = true;

  const ourLeadsByKey = new Map<string, string[]>();
  const ourLeadsByCampaign = new Map<string, string[]>();
  for (const lead of ourLeads) {
    if (!lead.meta_campaign_id) continue;
    const dayKey = `${lead.meta_campaign_id}__${lead.wervingsdatum}`;
    if (!ourLeadsByKey.has(dayKey)) ourLeadsByKey.set(dayKey, []);
    ourLeadsByKey.get(dayKey)!.push(lead.id);

    if (!ourLeadsByCampaign.has(lead.meta_campaign_id)) ourLeadsByCampaign.set(lead.meta_campaign_id, []);
    ourLeadsByCampaign.get(lead.meta_campaign_id)!.push(lead.id);
  }

  const { data: spendRows } = await supabase
    .from('meta_ad_spend')
    .select('campaign_id, date, spend')
    .gte('date', dateFrom)
    .lte('date', dateTo);

  let leadUpdateChunks = 0;

  if (spendRows && spendRows.length > 0) {
    const campaignDaySpend = new Map<string, number>();
    const campaignTotalSpend = new Map<string, number>();
    for (const sr of spendRows) {
      const key = `${sr.campaign_id}__${sr.date}`;
      campaignDaySpend.set(key, (campaignDaySpend.get(key) || 0) + (parseFloat(sr.spend) || 0));
      campaignTotalSpend.set(sr.campaign_id, (campaignTotalSpend.get(sr.campaign_id) || 0) + (parseFloat(sr.spend) || 0));
    }

    // Groepeer lead-ids per CPL-waarde, vervolgens 1 update-call per unieke CPL met `.in('id', chunk)`.
    // Hierdoor schaalt het aantal DB-roundtrips met het aantal unieke CPL's (klein) i.p.v. het aantal leads (groot).
    const idsByCpl = new Map<number, string[]>();
    const updatedLeadIds = new Set<string>();

    for (const [key, spend] of campaignDaySpend) {
      const leadIds = ourLeadsByKey.get(key);
      if (!leadIds || leadIds.length === 0 || spend === 0) continue;
      const cpl = Math.round((spend / leadIds.length) * 100) / 100;
      const bucket = idsByCpl.get(cpl) || [];
      for (const id of leadIds) {
        if (!updatedLeadIds.has(id)) {
          bucket.push(id);
          updatedLeadIds.add(id);
        }
      }
      idsByCpl.set(cpl, bucket);
    }

    for (const [campaignId, leadIds] of ourLeadsByCampaign) {
      const uncosted = leadIds.filter(id => !updatedLeadIds.has(id));
      if (uncosted.length === 0) continue;
      const totalSpend = campaignTotalSpend.get(campaignId);
      const totalOurLeads = leadIds.length;
      if (!totalSpend || totalOurLeads === 0) continue;
      const avgCpl = Math.round((totalSpend / totalOurLeads) * 100) / 100;
      const bucket = idsByCpl.get(avgCpl) || [];
      for (const id of uncosted) {
        bucket.push(id);
        updatedLeadIds.add(id);
      }
      idsByCpl.set(avgCpl, bucket);
    }

    for (const [cpl, ids] of idsByCpl) {
      for (let i = 0; i < ids.length; i += META_LEAD_UPDATE_CHUNK) {
        const chunk = ids.slice(i, i + META_LEAD_UPDATE_CHUNK);
        const { error } = await supabase.from('leads').update({ lead_cost: cpl }).in('id', chunk);
        leadUpdateChunks++;
        if (error) {
          errors.push(`Lead update chunk error (cpl=${cpl}): ${error.message}`);
        } else {
          leadsUpdated += chunk.length;
        }
      }
    }
  }

  const computeMs = Date.now() - t0;
  console.info('[meta-sync]', {
    computeMs,
    insightsCount: insights.length,
    upsertChunks,
    synced,
    leadsScanned: ourLeads.length,
    leadsScanTruncated: truncated,
    leadUpdateChunks,
    leadsUpdated,
    errorCount: errors.length,
  });

  return { synced, leadsUpdated, errors, truncated, computeMs };
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
