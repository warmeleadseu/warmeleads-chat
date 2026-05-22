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
export type BidStrategy = 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'LOWEST_COST_WITH_BID_CAP';

export interface CreateCampaignInput {
  name: string;
  objective?: 'OUTCOME_LEADS';
  specialAdCategory: 'NONE' | 'CREDIT' | 'EMPLOYMENT' | 'HOUSING' | 'ISSUES_ELECTIONS_POLITICS';
  status?: 'PAUSED' | 'ACTIVE';
  /** Daily budget op campaign-niveau (= CBO/Advantage Budget). Aanbevolen voor Lead Ads met multi-adset. */
  dailyBudgetCents?: number;
  bidStrategy?: BidStrategy;
}

export async function createCampaign(input: CreateCampaignInput): Promise<{ id: string }> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const account = normActId(creds.adAccountId);

  const specialAdCategories =
    input.specialAdCategory && input.specialAdCategory !== 'NONE'
      ? [input.specialAdCategory]
      : [];

  const params: Record<string, unknown> = {
    name: input.name,
    objective: input.objective || 'OUTCOME_LEADS',
    status: input.status || 'PAUSED',
    special_ad_categories: JSON.stringify(specialAdCategories),
    buying_type: 'AUCTION',
    bid_strategy: input.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
  };
  if (input.dailyBudgetCents && input.dailyBudgetCents > 0) {
    params.daily_budget = String(Math.max(100, input.dailyBudgetCents));
  }

  const res = await metaWrite(`${account}/campaigns`, params, creds.accessToken);
  if (typeof res.id !== 'string') throw new Error('Meta createCampaign: geen id');
  return { id: res.id };
}

// ── Adset ────────────────────────────────────────────────────
export interface FlexibleSpecBlock {
  interests?: Array<{ id: string; name?: string }>;
  behaviors?: Array<{ id: string; name?: string }>;
}

export interface AdSetTargetingSpec {
  countries: string[];
  regions?: Array<{ key: string }>;
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  flexibleSpec?: FlexibleSpecBlock[];
  customAudienceIds?: string[];
  excludedCustomAudienceIds?: string[];
  locales?: number[];
  /**
   * Meta Advantage+ Audience: laat Meta op basis van onze suggesties verbreden.
   * Niet samen gebruiken met heel beperkte targeting.
   */
  advantageAudience?: boolean;
}

export interface CreateAdSetInput {
  campaignId: string;
  name: string;
  pageId: string;
  /** Daily budget per ad set. Mag 0 zijn als campagne CBO heeft (campaign-level budget). */
  dailyBudgetCents?: number;
  targeting: AdSetTargetingSpec;
  status?: 'PAUSED' | 'ACTIVE';
  startTime?: string;
  /**
   * Conversie-locatie. Voor Meta Lead Ads (Instant Form binnen Facebook/Instagram)
   * MOET dit `ON_AD` zijn, anders defaultet Meta naar 'website' en worden de
   * Lead-form CTA's op de ads geweigerd → 'no_ads_created'.
   */
  destinationType?: 'ON_AD' | 'WEBSITE' | 'MESSENGER' | 'INSTAGRAM_DIRECT' | 'WHATSAPP';
  /** Override bij niet-CBO campagnes. Wordt verder geërfd van de campagne. */
  bidStrategy?: BidStrategy;
}

export async function createAdSet(input: CreateAdSetInput): Promise<{ id: string }> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const account = normActId(creds.adAccountId);

  const t = input.targeting;
  const targeting: Record<string, unknown> = {
    geo_locations: {
      countries: t.countries,
      ...(t.regions && t.regions.length > 0 ? { regions: t.regions } : {}),
    },
    age_min: t.ageMin || 25,
    age_max: t.ageMax || 65,
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed', 'video_feeds', 'instant_article', 'marketplace'],
    instagram_positions: ['stream', 'story', 'reels'],
    device_platforms: ['mobile', 'desktop'],
  };
  if (t.genders && t.genders.length > 0) targeting.genders = t.genders;
  if (t.flexibleSpec && t.flexibleSpec.length > 0) targeting.flexible_spec = t.flexibleSpec;
  if (t.customAudienceIds && t.customAudienceIds.length > 0) {
    targeting.custom_audiences = t.customAudienceIds.map(id => ({ id }));
  }
  if (t.excludedCustomAudienceIds && t.excludedCustomAudienceIds.length > 0) {
    targeting.excluded_custom_audiences = t.excludedCustomAudienceIds.map(id => ({ id }));
  }
  if (t.locales && t.locales.length > 0) targeting.locales = t.locales;
  if (t.advantageAudience) {
    targeting.targeting_automation = { advantage_audience: 1 };
  }

  const params: Record<string, unknown> = {
    name: input.name,
    campaign_id: input.campaignId,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LEAD_GENERATION',
    destination_type: input.destinationType || 'ON_AD',
    promoted_object: JSON.stringify({ page_id: input.pageId }),
    targeting: JSON.stringify(targeting),
    status: input.status || 'PAUSED',
    start_time: input.startTime,
  };
  if (input.dailyBudgetCents && input.dailyBudgetCents > 0) {
    params.daily_budget = String(Math.max(100, input.dailyBudgetCents));
  }
  if (input.bidStrategy) {
    params.bid_strategy = input.bidStrategy;
  }

  const res = await metaWrite(`${account}/adsets`, params, creds.accessToken);
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
export type EntityStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';

export async function setEntityStatus(entityId: string, status: EntityStatus): Promise<void> {
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

// ── Lead Forms (Lead Ads instant forms) ──────────────────────
/**
 * Eén vraag in een Meta Lead Form.
 *
 * Meta accepteert twee soorten "ingest"-velden:
 *   - Prefilled (`PHONE`, `EMAIL`, `FULL_NAME`, `ZIP`, etc.): worden uit het
 *     Facebook-profiel ingevuld. Bouw je als `{ type: 'PHONE' }` (geen key/label).
 *   - Custom: free-text of multiple-choice (`type: 'CUSTOM'`). MOET een `key`,
 *     `label` en (voor multi-choice) `options` met value+label hebben.
 *
 * We typen alleen de unie die wij effectief gebruiken vanuit de AI designer.
 */
export type LeadgenPrefilledType =
  | 'EMAIL' | 'PHONE' | 'FULL_NAME' | 'FIRST_NAME' | 'LAST_NAME'
  | 'STREET_ADDRESS' | 'CITY' | 'STATE' | 'ZIP' | 'COUNTRY'
  | 'POST_CODE' | 'DATE_OF_BIRTH' | 'GENDER';

export interface LeadgenCustomQuestion {
  type: 'CUSTOM';
  key: string;
  label: string;
  /** Bij multiple-choice: lijst opties met label+value. Leeg/undefined = vrije tekst. */
  options?: Array<{ value: string; label: string }>;
  /** Optioneel: korte zin onder het label voor extra context. */
  inline_context?: string;
}

export interface LeadgenPrefilledQuestion {
  type: LeadgenPrefilledType;
}

export type LeadgenQuestion = LeadgenCustomQuestion | LeadgenPrefilledQuestion;

export interface LeadgenContextCard {
  title: string;
  /**
   * Body-content. Meta accepteert array van strings (paragraphs). We
   * accepteren beide; mappen naar array bij verzenden.
   */
  content: string | string[];
  button_text?: string;
  style?: 'PARAGRAPH_STYLE' | 'LIST_STYLE';
}

export interface LeadgenThankYouPage {
  title: string;
  body: string;
  /**
   * VIEW_WEBSITE = link naar URL, CALL_BUSINESS = "Bel ons", DOWNLOAD = file URL.
   * NONE = geen knop (gewoon bedanktekst).
   */
  button_type?: 'VIEW_WEBSITE' | 'CALL_BUSINESS' | 'DOWNLOAD' | 'NONE';
  button_text?: string;
  website_url?: string;
  /** Voor CALL_BUSINESS: telefoonnummer in E.164 (+31...). */
  business_phone_number?: string;
}

export interface LeadgenPrivacyPolicy {
  url: string;
  link_text?: string;
}

export interface CreateLeadgenFormInput {
  /** Naam van het formulier zoals zichtbaar in Meta Ads Manager. */
  name: string;
  /**
   * `MORE_VOLUME` = geen review-screen (sneller, hogere submit-rate, mindere
   * kwaliteit). `HIGHER_INTENT` = verplicht review-scherm voor submit. Voor
   * WarmeLeads default = HIGHER_INTENT omdat we kwaliteit boven volume willen.
   */
  form_type?: 'MORE_VOLUME' | 'HIGHER_INTENT';
  /** Meta locale-code, bv. `nl_NL`, `nl_BE`, `fr_BE`. Default nl_NL. */
  locale?: string;
  /** Custom + prefilled vragen in de getoonde volgorde. */
  questions: LeadgenQuestion[];
  /** Optionele intro-card voor de submit. */
  context_card?: LeadgenContextCard;
  /** Bedank-pagina ná submit. */
  thank_you_page?: LeadgenThankYouPage;
  /** Verplicht volgens Meta voor lead ads: privacy policy URL + link-tekst. */
  privacy_policy: LeadgenPrivacyPolicy;
  /** Optioneel: redirect-URL na klik op de thank-you knop (als type VIEW_WEBSITE). */
  follow_up_action_url?: string;
}

/**
 * Maak een nieuw Lead Form aan op een Facebook Page.
 *
 * BELANGRIJK: gebruikt het PAGE-specifieke access_token (verkrijgbaar via
 * `getPageAccessToken(pageId)`). De system-user/ads-token werkt hier niet —
 * Meta vereist een page-scoped token met `leads_retrieval` + `pages_manage_ads`.
 */
export async function createLeadgenForm(
  pageId: string,
  pageAccessToken: string,
  input: CreateLeadgenFormInput,
): Promise<{ id: string }> {
  if (!pageId || !pageAccessToken) {
    throw new Error('createLeadgenForm: pageId + pageAccessToken vereist');
  }
  if (!input.questions || input.questions.length === 0) {
    throw new Error('createLeadgenForm: minimaal 1 vraag vereist');
  }
  if (!input.privacy_policy?.url) {
    throw new Error('createLeadgenForm: privacy_policy.url is verplicht');
  }

  /**
   * Meta verwacht `questions` als JSON-array. Custom-vragen krijgen options
   * als `[{ value, label }]`. Prefilled vragen alleen `{ type }`.
   */
  const questionsPayload = input.questions.map(q => {
    if (q.type === 'CUSTOM') {
      const out: Record<string, unknown> = {
        type: 'CUSTOM',
        key: q.key,
        label: q.label,
      };
      if (q.options && q.options.length > 0) {
        out.options = q.options.map(o => ({ value: o.value, label: o.label }));
      }
      if (q.inline_context) out.inline_context = q.inline_context;
      return out;
    }
    return { type: q.type };
  });

  const params: Record<string, unknown> = {
    name: input.name,
    follow_up_action_url:
      input.follow_up_action_url || input.privacy_policy.url,
    privacy_policy: {
      url: input.privacy_policy.url,
      link_text: input.privacy_policy.link_text || 'Privacybeleid WarmeLeads',
    },
    questions: questionsPayload,
    locale: input.locale || 'nl_NL',
    form_type: input.form_type || 'HIGHER_INTENT',
  };

  if (input.context_card) {
    const contentArr = Array.isArray(input.context_card.content)
      ? input.context_card.content
      : [input.context_card.content];
    params.context_card = {
      title: input.context_card.title,
      content: contentArr,
      button_text: input.context_card.button_text || 'Verder',
      style: input.context_card.style || 'PARAGRAPH_STYLE',
    };
  }

  if (input.thank_you_page) {
    const tp: Record<string, unknown> = {
      title: input.thank_you_page.title,
      body: input.thank_you_page.body,
      button_type: input.thank_you_page.button_type || 'VIEW_WEBSITE',
    };
    if (input.thank_you_page.button_text) tp.button_text = input.thank_you_page.button_text;
    if (input.thank_you_page.website_url) tp.website_url = input.thank_you_page.website_url;
    if (input.thank_you_page.business_phone_number) tp.business_phone_number = input.thank_you_page.business_phone_number;
    params.thank_you_page = tp;
  }

  const res = await metaWrite(`${pageId}/leadgen_forms`, params, pageAccessToken);
  if (typeof res.id !== 'string') {
    throw new Error('Meta createLeadgenForm: geen id terug');
  }
  return { id: res.id };
}

/**
 * Vertaal Meta-fouten bij POST /{page_id}/leadgen_forms naar actionable NL-tekst.
 * Wordt gebruikt door /api/admin/meta-forms/create en de AI-wizard UI.
 */
export function formatMetaLeadFormCreateError(rawMessage: string, metaCode?: number): {
  error: string;
  hint?: string;
} {
  const msg = rawMessage || '';

  // (#3) = de Facebook-app zelf mag deze API-call niet (niet alleen ontbrekende scope).
  // Komt vaak voor bij third-party apps (bv. Zapier Automation) terwijl ads/leads-read wél werkt.
  if (metaCode === 3 || /does not have the capability/i.test(msg)) {
    return {
      error:
        'Jullie Meta-app mag geen Lead Forms programmatisch aanmaken (Meta fout #3).',
      hint:
        'De access token hoort waarschijnlijk bij een externe app (zoals Zapier), niet bij een eigen Facebook-app met Marketing API. ' +
        'Oplossing A: maak een eigen app op developers.facebook.com → voeg product “Marketing API” toe → ' +
        'vraag Advanced Access aan voor pages_manage_ads + leads_retrieval → genereer een nieuwe System User-token → plak in Koppelingen. ' +
        'Oplossing B (nu meteen): maak het formulier handmatig in Meta Ads Manager op de gekozen page, ' +
        'en kies het daarna in AI Campagnes bij “Lead Form”.',
    };
  }

  if (/pages_manage_ads|leads_retrieval|#190|#200|access_token/i.test(msg)) {
    return {
      error: 'Meta token mist de juiste page-scopes voor Lead Form aanmaken.',
      hint: 'Genereer een nieuwe System User-token met pages_manage_ads, leads_retrieval en pages_show_list, en update Koppelingen.',
    };
  }

  if (/#100|Invalid parameter|questions|context_card|thank_you_page/i.test(msg)) {
    return {
      error: 'Meta weigerde de formulier-payload (ongeldige vraag of te lange tekst).',
      hint: 'Controleer labels, opties en het privacy-URL in stap 3.',
    };
  }

  return {
    error: 'Meta API-fout bij aanmaken van het formulier.',
    hint: msg.length > 0 ? msg : undefined,
  };
}

// ── Internal exports voor tests ──────────────────────────────
export const __internal = {
  normActId,
  isRetryable,
  makeMetaError,
};
