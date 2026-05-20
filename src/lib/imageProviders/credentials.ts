/**
 * Credentials voor de multi-provider image-engine.
 *
 * Volgt het bestaande patroon van `getMetaCredentials` in
 * [src/lib/meta.ts](src/lib/meta.ts) lijn 24-44:
 *  1. Lees env-var (process.env.REPLICATE_API_TOKEN / PEXELS_API_KEY).
 *  2. Fall back op `app_settings`-rij (key = `replicate_api_token` /
 *     `pexels_api_key`). Daar kan de admin de waarde later wijzigen
 *     zonder Vercel-deploy.
 *  3. Retourneer `null` als geen van beide gevonden is — de selector
 *     route't dan automatisch weg van die provider.
 */
import { createServerClient } from '@/lib/supabase';
import type { ProviderCapabilities } from './types';

let cachedReplicate: { token: string | null; checkedAt: number } | null = null;
let cachedPexels: { key: string | null; checkedAt: number } | null = null;

/** Cache de credentials 5 minuten zodat we per request niet de DB bevragen. */
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getReplicateToken(): Promise<string | null> {
  if (cachedReplicate && Date.now() - cachedReplicate.checkedAt < CACHE_TTL_MS) {
    return cachedReplicate.token;
  }
  const envToken = process.env.REPLICATE_API_TOKEN?.trim();
  if (envToken) {
    cachedReplicate = { token: envToken, checkedAt: Date.now() };
    return envToken;
  }
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'replicate_api_token')
      .maybeSingle();
    const value = typeof data?.value === 'string' && data.value.trim().length > 0 ? data.value.trim() : null;
    cachedReplicate = { token: value, checkedAt: Date.now() };
    return value;
  } catch {
    cachedReplicate = { token: null, checkedAt: Date.now() };
    return null;
  }
}

export async function getPexelsKey(): Promise<string | null> {
  if (cachedPexels && Date.now() - cachedPexels.checkedAt < CACHE_TTL_MS) {
    return cachedPexels.key;
  }
  const envKey = process.env.PEXELS_API_KEY?.trim();
  if (envKey) {
    cachedPexels = { key: envKey, checkedAt: Date.now() };
    return envKey;
  }
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'pexels_api_key')
      .maybeSingle();
    const value = typeof data?.value === 'string' && data.value.trim().length > 0 ? data.value.trim() : null;
    cachedPexels = { key: value, checkedAt: Date.now() };
    return value;
  } catch {
    cachedPexels = { key: null, checkedAt: Date.now() };
    return null;
  }
}

export function hasOpenAIKey(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

/**
 * Probeert alle providers en retourneert een snapshot van wie er
 * "online" is. Selector gebruikt dit om gracefully terug te vallen
 * op gpt-image-1 als Replicate/Pexels niet geconfigureerd zijn.
 */
export async function getProviderCapabilities(): Promise<ProviderCapabilities> {
  const [replicateToken, pexelsKey] = await Promise.all([
    getReplicateToken(),
    getPexelsKey(),
  ]);
  return {
    openai: hasOpenAIKey(),
    replicate: !!replicateToken,
    pexels: !!pexelsKey,
  };
}

/** Test-only: cache invalidation tussen unit tests. */
export function __resetCredentialsCache(): void {
  cachedReplicate = null;
  cachedPexels = null;
}
