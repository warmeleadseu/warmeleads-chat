/**
 * Meta Marketing API write-helpers (v21.0).
 *
 * Bewuste keuzes:
 * - PAUSED-by-default: alle nieuwe campaigns/adsets/ads gaan eerst op PAUSED zodat
 *   we kunnen valideren voor live gaan.
 * - Rate-limit-aware: 429/Too-Many = exponentiele backoff met jitter (max 4 pogingen).
 * - Geen DELETE: we pauzeren altijd, en archiveren via status zodat IDs traceerbaar blijven.
 * - Idempotency is callerverantwoordelijkheid: bewaar de teruggegeven Meta-IDs en
 *   her-launch alleen wanneer onze DB nog geen `meta_campaign_id` voor de brief heeft.
 */
import { getMetaCredentials, META_GRAPH_URL } from '@/lib/meta';

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1500;

function normActId(id: string): string {
  const t = id.trim();
  return t.startsWith('act_') ? t : `act_${t}`;
}

export interface MetaApiError extends Error {
  status?: number;
  code?: number;
  subcode?: number;
  isUserError?: boolean;
  fbErrorType?: string;
}

function makeMetaError(status: number, payload: Record<string, unknown>): MetaApiError {
  const err = payload?.error as Record<string, unknown> | undefined;
  const msg = (err?.message as string) || `Meta HTTP ${status}`;
  const e: MetaApiError = Object.assign(new Error(msg), {
    status,
    code: typeof err?.code === 'number' ? (err.code as number) : undefined,
    subcode: typeof err?.error_subcode === 'number' ? (err.error_subcode as number) : undefined,
    fbErrorType: typeof err?.type === 'string' ? (err.type as string) : undefined,
    isUserError: typeof err?.type === 'string' && (err.type as string).includes('OAuthException'),
  });
  return e;
}

function isRetryable(err: MetaApiError | undefined): boolean {
  if (!err) return false;
  if (typeof err.status === 'number' && err.status >= 500) return true;
  if (err.code === 4 || err.code === 17 || err.code === 32 || err.code === 613) return true;
  if (err.code === 80004 || err.code === 80014) return true;
  return false;
}

async function metaWrite(
  path: string,
  params: Record<string, unknown>,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const url = `${META_GRAPH_URL}/${path}`;
  let lastErr: MetaApiError | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      body.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    body.append('access_token', accessToken);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && !json.error) return json;

    const err = makeMetaError(res.status, json);
    lastErr = err;
    if (!isRetryable(err) || attempt === MAX_ATTEMPTS - 1) throw err;
    const wait = BASE_DELAY_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 400);
    await new Promise(r => setTimeout(r, wait));
  }
  throw lastErr ?? new Error('Meta write failed');
}

async function metaGet(
  path: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${META_GRAPH_URL}/${path}${sep}access_token=${encodeURIComponent(accessToken)}`);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.error) throw makeMetaError(res.status, json);
  return json;
}

// ── Ad images ────────────────────────────────────────────────
export interface UploadAdImageResult {
  hash: string;
  url: string;
}

/** Upload een base64 of remote image naar Meta Ad Account → `images` endpoint. */
export async function uploadAdImage(buffer: Buffer, filename = 'creative.png'): Promise<UploadAdImageResult> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const account = normActId(creds.adAccountId);

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: 'image/png' });
  form.append(filename, blob, filename);
  form.append('access_token', creds.accessToken);

  let lastErr: MetaApiError | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${META_GRAPH_URL}/${account}/adimages`, { method: 'POST', body: form });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && !json.error) {
      const images = json.images as Record<string, { hash: string; url: string }> | undefined;
      if (images) {
        const first = Object.values(images)[0];
        if (first?.hash && first?.url) return { hash: first.hash, url: first.url };
      }
      throw new Error('Meta uploadAdImage: onverwacht antwoord');
    }
    const err = makeMetaError(res.status, json);
    lastErr = err;
    if (!isRetryable(err) || attempt === MAX_ATTEMPTS - 1) throw err;
    await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
  }
  throw lastErr ?? new Error('uploadAdImage failed');
}

// ── Campaign ─────────────────────────────────────────────────
export interface CreateCampaignInput {
  name: string;
  objective?: 'OUTCOME_LEADS';
  specialAdCategory: 'NONE' | 'CREDIT' | 'EMPLOYMENT' | 'HOUSING' | 'ISSUES_ELECTIONS_POLITICS';
  status?: 'PAUSED' | 'ACTIVE';
}

export async function createCampaign(input: CreateCampaignInput): Promise<{ id: string }> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const account = normActId(creds.adAccountId);

  const specialAdCategories =
    input.specialAdCategory && input.specialAdCategory !== 'NONE'
      ? [input.specialAdCategory]
      : [];

  const res = await metaWrite(`${account}/campaigns`, {
    name: input.name,
    objective: input.objective || 'OUTCOME_LEADS',
    status: input.status || 'PAUSED',
    special_ad_categories: JSON.stringify(specialAdCategories),
    buying_type: 'AUCTION',
  }, creds.accessToken);

  if (typeof res.id !== 'string') throw new Error('Meta createCampaign: geen id');
  return { id: res.id };
}

// ── Adset ────────────────────────────────────────────────────
export interface CreateAdSetInput {
  campaignId: string;
  name: string;
  pageId: string;
  dailyBudgetCents: number;
  geo: { countries: string[]; regions?: { key: string }[] };
  ageMin?: number;
  ageMax?: number;
  status?: 'PAUSED' | 'ACTIVE';
  startTime?: string;
  /**
   * Conversie-locatie. Voor Meta Lead Ads (Instant Form binnen Facebook/Instagram)
   * MOET dit `ON_AD` zijn, anders defaultet Meta naar 'website' en worden de
   * Lead-form CTA's op de ads geweigerd → 'no_ads_created'.
   */
  destinationType?: 'ON_AD' | 'WEBSITE' | 'MESSENGER' | 'INSTAGRAM_DIRECT' | 'WHATSAPP';
}

export async function createAdSet(input: CreateAdSetInput): Promise<{ id: string }> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const account = normActId(creds.adAccountId);

  const targeting: Record<string, unknown> = {
    geo_locations: input.geo,
    age_min: input.ageMin || 25,
    age_max: input.ageMax || 65,
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed', 'video_feeds', 'instant_article', 'marketplace'],
    instagram_positions: ['stream', 'story', 'reels'],
    device_platforms: ['mobile', 'desktop'],
  };

  const res = await metaWrite(`${account}/adsets`, {
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: String(Math.max(100, input.dailyBudgetCents)),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LEAD_GENERATION',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    destination_type: input.destinationType || 'ON_AD',
    promoted_object: JSON.stringify({ page_id: input.pageId }),
    targeting: JSON.stringify(targeting),
    status: input.status || 'PAUSED',
    start_time: input.startTime,
  }, creds.accessToken);

  if (typeof res.id !== 'string') throw new Error('Meta createAdSet: geen id');
  return { id: res.id };
}

// ── AdCreative ───────────────────────────────────────────────
export interface CreateLeadAdCreativeInput {
  pageId: string;
  formId: string;
  name: string;
  imageHash: string;
  message: string;
  headline: string;
  description?: string;
  cta?: 'LEARN_MORE' | 'SIGN_UP' | 'GET_QUOTE' | 'APPLY_NOW' | 'CONTACT_US' | 'SUBSCRIBE';
  linkUrl?: string;
}

export async function createLeadAdCreative(input: CreateLeadAdCreativeInput): Promise<{ id: string }> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const account = normActId(creds.adAccountId);

  const cta = input.cta || 'SIGN_UP';
  // Voor Lead Ads is `link` verplicht in link_data maar wordt nooit gebruikt
  // (Meta vervangt het door het ingebedde formulier). De page-URL is een
  // veilige default zodat Meta de creative niet weigert.
  const linkUrl = input.linkUrl || `https://www.facebook.com/${input.pageId}`;

  const objectStorySpec = {
    page_id: input.pageId,
    link_data: {
      image_hash: input.imageHash,
      link: linkUrl,
      message: input.message,
      name: input.headline,
      description: input.description,
      call_to_action: {
        type: cta,
        value: { lead_gen_form_id: input.formId },
      },
    },
  };

  const res = await metaWrite(`${account}/adcreatives`, {
    name: input.name,
    object_story_spec: JSON.stringify(objectStorySpec),
  }, creds.accessToken);

  if (typeof res.id !== 'string') throw new Error('Meta createLeadAdCreative: geen id');
  return { id: res.id };
}

// ── Ad ───────────────────────────────────────────────────────
export interface CreateAdInput {
  name: string;
  adsetId: string;
  creativeId: string;
  status?: 'PAUSED' | 'ACTIVE';
}

export async function createAd(input: CreateAdInput): Promise<{ id: string }> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const account = normActId(creds.adAccountId);

  const res = await metaWrite(`${account}/ads`, {
    name: input.name,
    adset_id: input.adsetId,
    creative: JSON.stringify({ creative_id: input.creativeId }),
    status: input.status || 'PAUSED',
  }, creds.accessToken);

  if (typeof res.id !== 'string') throw new Error('Meta createAd: geen id');
  return { id: res.id };
}

// ── Status updates ───────────────────────────────────────────
export async function setEntityStatus(entityId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  await metaWrite(entityId, { status }, creds.accessToken);
}

export async function updateAdSetDailyBudget(adsetId: string, dailyBudgetCents: number): Promise<void> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  await metaWrite(adsetId, { daily_budget: String(Math.max(100, dailyBudgetCents)) }, creds.accessToken);
}

// ── Insights (specifiek voor experimenten, naast bestaande meta.ts) ──
export interface AdInsightRow {
  ad_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
  ctr: number | null;
}

export async function fetchAdLevelInsightsForAds(adIds: string[]): Promise<AdInsightRow[]> {
  if (adIds.length === 0) return [];
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');

  const out: AdInsightRow[] = [];
  for (const adId of adIds) {
    try {
      const json = await metaGet(
        `${adId}/insights?fields=spend,impressions,clicks,actions&date_preset=maximum`,
        creds.accessToken,
      );
      const data = (json.data as Array<Record<string, unknown>> | undefined) || [];
      const first = data[0] || {};
      const spend = parseFloat(String(first.spend ?? '0')) || 0;
      const impressions = parseInt(String(first.impressions ?? '0'), 10) || 0;
      const clicks = parseInt(String(first.clicks ?? '0'), 10) || 0;
      const actions = (first.actions as Array<{ action_type: string; value: string }>) || [];
      const leads = actions
        .filter(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')
        .reduce((s, a) => s + (parseInt(a.value, 10) || 0), 0);
      out.push({
        ad_id: adId,
        spend,
        impressions,
        clicks,
        leads,
        cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : null,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : null,
      });
    } catch (e) {
      console.warn('[metaMarketingApi] insights fetch failed for', adId, (e as Error).message);
    }
  }
  return out;
}

// ── Internal exports voor tests ──────────────────────────────
export const __internal = {
  normActId,
  isRetryable,
  makeMetaError,
};
