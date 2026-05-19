/**
 * Meta Targeting Search API
 * --------------------------
 * Wrappers rond Meta's `/search?type=adinterest` en
 * `/{id}/adinterestsuggestions` endpoints. Resultaten worden 24u
 * gecached in `meta_targeting_cache` om herhaalde dezelfde queries
 * goedkoop af te handelen (de search API telt mee voor rate-limits).
 */
import { createServerClient } from '@/lib/supabase';
import { getMetaCredentials, META_GRAPH_URL } from '@/lib/meta';

export interface InterestHit {
  id: string;
  name: string;
  topic?: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  path?: string[];
}

export interface BehaviorHit {
  id: string;
  name: string;
  type?: string;
  description?: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(kind: string, query: string): string {
  return `${kind}:${query.toLowerCase().trim()}`;
}

async function getCached<T>(key: string): Promise<T | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('meta_targeting_cache')
    .select('result, expires_at')
    .eq('cache_key', key)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.result as T;
}

async function setCached(key: string, kind: 'interest_search' | 'interest_suggestions' | 'behavior_search', query: string, result: unknown): Promise<void> {
  const supabase = createServerClient();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  await supabase.from('meta_targeting_cache').upsert(
    {
      cache_key: key,
      kind,
      query,
      result: result as Record<string, unknown>,
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
}

async function metaSearch(path: string): Promise<unknown> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${META_GRAPH_URL}/${path}${sep}access_token=${encodeURIComponent(creds.accessToken)}`);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = (json.error as Record<string, unknown> | undefined)?.message || `HTTP ${res.status}`;
    throw new Error(`Meta targeting-search faalde: ${err}`);
  }
  return json.data ?? [];
}

/** Zoek interests op één keyword. Resultaten ≤ 25 stuks, gesorteerd op relevantie. */
export async function searchInterests(query: string): Promise<InterestHit[]> {
  const key = cacheKey('interest_search', query);
  const cached = await getCached<InterestHit[]>(key);
  if (cached) return cached;

  const url =
    `search?type=adinterest&q=${encodeURIComponent(query)}` +
    `&limit=25&fields=id,name,topic,audience_size_lower_bound,audience_size_upper_bound,path`;
  const data = (await metaSearch(url)) as Array<Record<string, unknown>>;
  const hits: InterestHit[] = data.map(d => ({
    id: String(d.id),
    name: String(d.name),
    topic: typeof d.topic === 'string' ? d.topic : undefined,
    audience_size_lower_bound: typeof d.audience_size_lower_bound === 'number' ? d.audience_size_lower_bound : undefined,
    audience_size_upper_bound: typeof d.audience_size_upper_bound === 'number' ? d.audience_size_upper_bound : undefined,
    path: Array.isArray(d.path) ? (d.path as string[]) : undefined,
  }));
  await setCached(key, 'interest_search', query, hits);
  return hits;
}

/** Verbreed interests: geef seed-IDs en krijg gerelateerde interests. */
export async function getInterestSuggestions(seedIds: string[]): Promise<InterestHit[]> {
  if (seedIds.length === 0) return [];
  const sorted = [...seedIds].sort();
  const key = cacheKey('interest_suggestions', sorted.join(','));
  const cached = await getCached<InterestHit[]>(key);
  if (cached) return cached;

  const ids = encodeURIComponent(JSON.stringify(sorted));
  const url = `search?type=adinterestsuggestion&interest_list=${ids}&limit=20&fields=id,name,audience_size_lower_bound,audience_size_upper_bound,path`;
  const data = (await metaSearch(url)) as Array<Record<string, unknown>>;
  const hits: InterestHit[] = data.map(d => ({
    id: String(d.id),
    name: String(d.name),
    audience_size_lower_bound: typeof d.audience_size_lower_bound === 'number' ? d.audience_size_lower_bound : undefined,
    audience_size_upper_bound: typeof d.audience_size_upper_bound === 'number' ? d.audience_size_upper_bound : undefined,
    path: Array.isArray(d.path) ? (d.path as string[]) : undefined,
  }));
  await setCached(key, 'interest_suggestions', sorted.join(','), hits);
  return hits;
}

/** Zoek behaviors (Meta heeft hier een vaste lijst, paginerend). */
export async function searchBehaviors(query: string): Promise<BehaviorHit[]> {
  const key = cacheKey('behavior_search', query);
  const cached = await getCached<BehaviorHit[]>(key);
  if (cached) return cached;

  // /act_{id}/targetingbrowse?type=behaviors levert lijst; we filteren client-side.
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const account = creds.adAccountId.startsWith('act_') ? creds.adAccountId : `act_${creds.adAccountId}`;
  const url =
    `${account}/targetingsearch?q=${encodeURIComponent(query)}&type=behaviors&limit=25` +
    `&fields=id,name,type,description,audience_size_lower_bound,audience_size_upper_bound`;
  const data = (await metaSearch(url)) as Array<Record<string, unknown>>;
  const hits: BehaviorHit[] = data.map(d => ({
    id: String(d.id),
    name: String(d.name),
    type: typeof d.type === 'string' ? d.type : undefined,
    description: typeof d.description === 'string' ? d.description : undefined,
    audience_size_lower_bound: typeof d.audience_size_lower_bound === 'number' ? d.audience_size_lower_bound : undefined,
    audience_size_upper_bound: typeof d.audience_size_upper_bound === 'number' ? d.audience_size_upper_bound : undefined,
  }));
  await setCached(key, 'behavior_search', query, hits);
  return hits;
}

/** Zoek interests voor een lijst keywords (sequentieel, gecached). */
export async function searchInterestsForKeywords(keywords: string[]): Promise<InterestHit[]> {
  const out: InterestHit[] = [];
  const seen = new Set<string>();
  for (const kw of keywords) {
    try {
      const hits = await searchInterests(kw);
      for (const h of hits.slice(0, 3)) {
        if (!seen.has(h.id)) {
          seen.add(h.id);
          out.push(h);
        }
      }
    } catch (e) {
      console.warn('[metaTargetingSearch] keyword failed', kw, (e as Error).message);
    }
  }
  return out;
}
