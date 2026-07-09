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

/**
 * Normaliseert een ad-account-id naar exact één `act_`-prefix, ongeacht of de
 * geconfigureerde waarde met of zonder `act_` is opgeslagen (bijv. via env of
 * de Koppelingen-UI). Voorkomt zowel ontbrekende als dubbele (`act_act_`) prefixes.
 */
export function normalizeAdAccountId(id: string): string {
  const bare = (id || '').trim().replace(/^act_/i, '');
  return `act_${bare}`;
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
  const accountId = normalizeAdAccountId(adAccountId);

  const allInsights: AdInsight[] = [];
  const url: string =
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

/* ────────────────────────────────────────────────────────────
 * Facebook Pages discovery (voor AI Lead Form Creator)
 *
 * Tot nu toe vonden we pages alleen impliciet (via promoted_object.page_id
 * op bestaande campaigns). Voor branches die nog géén Meta-activiteit hebben,
 * is dat niet bruikbaar. We voegen een directe `/me/accounts`-query toe die
 * alle pages teruggeeft waar onze (system-)user-token toegang toe heeft.
 *
 * - Filtert op pages waar wij MANAGE/CREATE_CONTENT/ADVERTISE permissies
 *   hebben (anders kan onze token sowieso geen leadgen_forms aanmaken).
 * - Geeft per page ook het pagina-specifieke access_token mee. Lead form
 *   creates moeten met die page-token, niet met de user-token.
 * - 5-min in-memory cache zodat herhaalde modal-opens of multi-step wizards
 *   niet steeds de `/me/accounts`-rate-limit raken.
 * ──────────────────────────────────────────────────────────── */

export interface MetaPageSummary {
  id: string;
  name: string;
  category?: string;
  picture_url?: string;
  /**
   * Permissies die ONZE token op deze pagina heeft. Filtering gebeurt al
   * server-side; we exposen ze zodat de UI desnoods detail kan tonen.
   */
  tasks: string[];
  /** Page-specifieke access token (long-lived als user-token long-lived is). */
  access_token: string;
}

interface CachedPages {
  expiresAt: number;
  pages: MetaPageSummary[];
}

const PAGES_CACHE_TTL_MS = 5 * 60 * 1000;
let pagesCache: CachedPages | null = null;
/**
 * Welke `tasks`-waardes betekenen dat onze token leadgen_forms mag aanmaken.
 * Volgens Meta docs: ADVERTISE óf CREATE_CONTENT volstaan, MANAGE is breder.
 * We accepteren alle drie zodat ook beperkter-gerechtigde tokens werken.
 */
const PAGE_TASKS_REQUIRED = new Set(['MANAGE', 'CREATE_CONTENT', 'ADVERTISE']);

/**
 * Lijst alle Facebook-pages waar onze configured Meta-token toegang toe heeft
 * EN waar we permissie hebben om leadgen forms aan te maken. Cached 5 min.
 */
export async function listMetaPages(opts?: { force?: boolean }): Promise<MetaPageSummary[]> {
  if (!opts?.force && pagesCache && pagesCache.expiresAt > Date.now()) {
    return pagesCache.pages;
  }

  const creds = await getMetaCredentials();
  if (!creds) {
    throw new Error('Meta credentials niet geconfigureerd');
  }

  const collected: MetaPageSummary[] = [];
  const fields = 'id,name,category,tasks,access_token,picture{url}';
  let next: string | null =
    `${META_GRAPH_URL}/me/accounts?fields=${encodeURIComponent(fields)}&limit=200&access_token=${encodeURIComponent(creds.accessToken)}`;

  let safety = 0;
  while (next && safety < 8) {
    safety++;
    const res: Response = await fetch(next);
    const json: Record<string, unknown> = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      const errObj = json.error as { message?: string } | undefined;
      const msg = errObj?.message || `HTTP ${res.status}`;
      throw new Error(`Meta /me/accounts faalde: ${msg}`);
    }
    const data = (json.data || []) as Array<{
      id?: string;
      name?: string;
      category?: string;
      tasks?: string[];
      access_token?: string;
      picture?: { data?: { url?: string } };
    }>;
    for (const p of data) {
      if (!p.id || !p.access_token) continue;
      const tasks = (p.tasks || []).filter(t => typeof t === 'string');
      const hasPerm = tasks.some(t => PAGE_TASKS_REQUIRED.has(t));
      if (!hasPerm) continue;
      collected.push({
        id: p.id,
        name: p.name || `Page ${p.id}`,
        category: p.category,
        picture_url: p.picture?.data?.url,
        tasks,
        access_token: p.access_token,
      });
    }
    const paging = json.paging as { next?: string } | undefined;
    next = paging?.next || null;
  }

  collected.sort((a, b) => a.name.localeCompare(b.name));
  pagesCache = { expiresAt: Date.now() + PAGES_CACHE_TTL_MS, pages: collected };
  return collected;
}

/**
 * Resolve het page-specifieke access_token voor een gegeven Facebook Page ID.
 * Returnt null wanneer de page niet in onze toegestane lijst staat — dit is
 * tevens onze ownership-guard voor de create-route.
 */
export async function getPageAccessToken(pageId: string): Promise<string | null> {
  const pages = await listMetaPages();
  const hit = pages.find(p => p.id === pageId);
  return hit?.access_token || null;
}

/** Test-only: maakt de in-memory cache leeg zodat tests vers kunnen vragen. */
export function __resetMetaPagesCacheForTests(): void {
  pagesCache = null;
}
