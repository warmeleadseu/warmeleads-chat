/**
 * Meta Custom Audiences + Lookalike pipeline
 * -------------------------------------------
 * Pipeline:
 *  1. Verzamel leads uit onze database voor de gegeven branche
 *     (phone_valid=true, niet ouder dan refresh-window)
 *  2. Normaliseer + SHA-256 hash per Meta's customer-list-API
 *  3. Upload als Custom Audience (subtype=CUSTOM)
 *  4. Build 1% Lookalike per land
 *  5. Build exclusion audience van laatste 90 dagen leads (om
 *     bestaande contacten niet opnieuw te targeten)
 *
 * Idempotent: per (branch, country, ratio) bewaren we IDs in
 * `ai_campaign_lookalikes`. Wekelijkse cron refresht.
 *
 * Achter `AI_LOOKALIKE_ENABLED=true` ENV-flag zodat we per default
 * geen Custom List upload doen zonder expliciete opt-in.
 */
import { createHash } from 'crypto';
import { createServerClient } from '@/lib/supabase';
import { getMetaCredentials, META_GRAPH_URL } from '@/lib/meta';
import { normalizePhoneForCapi } from '@/lib/metaConversionApi';

const MIN_SEED_LEADS = 100; // Meta accepteert pas >=100 voor lookalike
const LEAD_WINDOW_DAYS = 365; // voor seed-audience
const EXCLUSION_WINDOW_DAYS = 90; // voor exclusion-audience

export interface LookalikeBuildResult {
  ok: boolean;
  reason?: string;
  branch?: string;
  country?: string;
  seedAudienceId?: string;
  lookalikeAudienceId?: string;
  exclusionAudienceId?: string;
  seedSize?: number;
}

function isEnabled(): boolean {
  return (process.env.AI_LOOKALIKE_ENABLED || '').toLowerCase() === 'true';
}

function sha256Lower(input: string): string {
  return createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
}

function actAccount(adAccountId: string): string {
  return adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
}

interface LeadHashPair { em: string | null; ph: string | null }

function hashLead(lead: { email?: string | null; phone?: string | null }): LeadHashPair {
  const em = lead.email && lead.email.includes('@') ? sha256Lower(lead.email) : null;
  const norm = lead.phone ? normalizePhoneForCapi(lead.phone) : null;
  const ph = norm ? sha256Lower(norm) : null;
  return { em, ph };
}

async function fetchLeadsForSeed(branch: string, country: string, windowDays: number): Promise<LeadHashPair[]> {
  const supabase = createServerClient();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  // Meta's customer-list ondersteunt email OR phone OR beide; we kiezen alleen leads met phone_valid=true.
  // Onze leads-tabel gebruikt Nederlandse veldnamen (telefoonnummer, land).
  const { data } = await supabase
    .from('leads')
    .select('email, telefoonnummer, land')
    .eq('branch', branch)
    .eq('phone_valid', true)
    .gte('created_at', since);
  const hashes: LeadHashPair[] = [];
  for (const r of data || []) {
    const c = ((r.land as string | null) || '').toUpperCase();
    if (country && c && c !== country.toUpperCase()) continue;
    const pair = hashLead({
      email: r.email as string | null,
      phone: r.telefoonnummer as string | null,
    });
    if (pair.em || pair.ph) hashes.push(pair);
  }
  return hashes;
}

/** Maak een Custom Audience aan (subtype=CUSTOM). Returns audience_id. */
async function createCustomAudience(name: string, description: string): Promise<string> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const acc = actAccount(creds.adAccountId);
  const body = new URLSearchParams();
  body.append('name', name);
  body.append('subtype', 'CUSTOM');
  body.append('description', description);
  body.append('customer_file_source', 'USER_PROVIDED_ONLY');
  body.append('access_token', creds.accessToken);
  const res = await fetch(`${META_GRAPH_URL}/${acc}/customaudiences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.id) {
    const msg = (json.error as Record<string, unknown> | undefined)?.message || `HTTP ${res.status}`;
    throw new Error(`createCustomAudience faalde: ${msg}`);
  }
  return String(json.id);
}

/** Upload gehashte rows naar een audience. */
async function uploadAudienceData(audienceId: string, hashes: LeadHashPair[]): Promise<{ received: number }> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');

  const schema = ['EMAIL', 'PHONE'] as const;
  const data: Array<[string, string]> = [];
  for (const h of hashes) {
    data.push([h.em || '', h.ph || '']);
  }
  // Meta accepteert max 10k per call; chunk
  const CHUNK = 10000;
  let received = 0;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    const payload = {
      payload: {
        schema,
        data: slice,
      },
    };
    const body = new URLSearchParams();
    body.append('payload', JSON.stringify(payload.payload));
    body.append('access_token', creds.accessToken);
    const res = await fetch(`${META_GRAPH_URL}/${audienceId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.error) {
      const msg = (json.error as Record<string, unknown> | undefined)?.message || `HTTP ${res.status}`;
      throw new Error(`uploadAudienceData faalde: ${msg}`);
    }
    received += typeof json.num_received === 'number' ? (json.num_received as number) : slice.length;
  }
  return { received };
}

/** Maak een Lookalike Audience op basis van een seed Custom Audience. */
async function createLookalikeAudience(seedId: string, country: string, ratio: number): Promise<string> {
  const creds = await getMetaCredentials();
  if (!creds) throw new Error('Meta credentials niet geconfigureerd');
  const acc = actAccount(creds.adAccountId);
  const lookalikeSpec = {
    starting_ratio: 0,
    ratio,
    country,
    type: 'similarity' as const,
  };
  const body = new URLSearchParams();
  body.append('name', `WL-LAL-${country}-${Math.round(ratio * 100)}pct`);
  body.append('subtype', 'LOOKALIKE');
  body.append('origin_audience_id', seedId);
  body.append('lookalike_spec', JSON.stringify(lookalikeSpec));
  body.append('access_token', creds.accessToken);
  const res = await fetch(`${META_GRAPH_URL}/${acc}/customaudiences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.id) {
    const msg = (json.error as Record<string, unknown> | undefined)?.message || `HTTP ${res.status}`;
    throw new Error(`createLookalikeAudience faalde: ${msg}`);
  }
  return String(json.id);
}

/**
 * Build (of refresh) een complete (seed + lookalike + exclusion) set
 * voor één branche + land.
 */
export async function buildBranchAudiencePack(branch: string, country: string, ratio = 0.01): Promise<LookalikeBuildResult> {
  if (!isEnabled()) {
    return { ok: false, reason: 'lookalike_disabled' };
  }
  const creds = await getMetaCredentials();
  if (!creds) return { ok: false, reason: 'no_meta_credentials' };

  const seedHashes = await fetchLeadsForSeed(branch, country, LEAD_WINDOW_DAYS);
  if (seedHashes.length < MIN_SEED_LEADS) {
    return { ok: false, reason: 'insufficient_seed', seedSize: seedHashes.length };
  }
  const exclusionHashes = await fetchLeadsForSeed(branch, country, EXCLUSION_WINDOW_DAYS);

  const supabase = createServerClient();

  // Bestaande row?
  const { data: existing } = await supabase
    .from('ai_campaign_lookalikes')
    .select('*')
    .eq('branch', branch)
    .eq('country', country)
    .eq('ratio', ratio)
    .maybeSingle();

  let seedId = existing?.seed_audience_id as string | null;
  let lookalikeId = existing?.lookalike_audience_id as string | null;
  let exclusionId = existing?.exclusion_audience_id as string | null;

  await supabase.from('ai_campaign_lookalikes').upsert(
    {
      branch,
      country,
      ratio,
      source_lead_count: seedHashes.length,
      status: 'building',
    },
    { onConflict: 'branch,country,ratio' },
  );

  try {
    if (!seedId) {
      seedId = await createCustomAudience(
        `WL-${branch}-leads-${country}`,
        `Auto-generated seed van WarmeLeads ${branch} leads (${country}, ${LEAD_WINDOW_DAYS}d, phone_valid=true)`,
      );
    }
    await uploadAudienceData(seedId, seedHashes);

    if (!exclusionId) {
      exclusionId = await createCustomAudience(
        `WL-${branch}-exclude-${country}-90d`,
        `Bestaande ${branch} leads laatste ${EXCLUSION_WINDOW_DAYS}d — niet opnieuw targeten`,
      );
    }
    if (exclusionHashes.length > 0) {
      await uploadAudienceData(exclusionId, exclusionHashes);
    }

    if (!lookalikeId) {
      // Meta vereist dat de seed eerst "ready" is. In de praktijk werkt
      // create direct na upload meestal — Meta queue't intern. Bij faal
      // retryen we niet hier; cron pakt de volgende keer.
      lookalikeId = await createLookalikeAudience(seedId, country, ratio);
    }

    await supabase
      .from('ai_campaign_lookalikes')
      .update({
        seed_audience_id: seedId,
        lookalike_audience_id: lookalikeId,
        exclusion_audience_id: exclusionId,
        source_lead_count: seedHashes.length,
        last_refreshed_at: new Date().toISOString(),
        status: 'ready',
      })
      .eq('branch', branch)
      .eq('country', country)
      .eq('ratio', ratio);

    return {
      ok: true,
      branch,
      country,
      seedAudienceId: seedId,
      lookalikeAudienceId: lookalikeId,
      exclusionAudienceId: exclusionId,
      seedSize: seedHashes.length,
    };
  } catch (e) {
    const msg = (e as Error).message || 'unknown';
    await supabase
      .from('ai_campaign_lookalikes')
      .update({ status: 'failed', notes: msg })
      .eq('branch', branch)
      .eq('country', country)
      .eq('ratio', ratio);
    return { ok: false, reason: msg };
  }
}

/** Lees bestaande audience-IDs voor (branch, country). Geen Meta-call. */
export async function getBranchAudiencePack(branch: string, country: string, ratio = 0.01): Promise<{
  seedAudienceId: string | null;
  lookalikeAudienceId: string | null;
  exclusionAudienceId: string | null;
  sourceLeadCount: number;
  status: string | null;
} | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('ai_campaign_lookalikes')
    .select('seed_audience_id, lookalike_audience_id, exclusion_audience_id, source_lead_count, status')
    .eq('branch', branch)
    .eq('country', country)
    .eq('ratio', ratio)
    .maybeSingle();
  if (!data) return null;
  return {
    seedAudienceId: (data.seed_audience_id as string | null) ?? null,
    lookalikeAudienceId: (data.lookalike_audience_id as string | null) ?? null,
    exclusionAudienceId: (data.exclusion_audience_id as string | null) ?? null,
    sourceLeadCount: (data.source_lead_count as number) ?? 0,
    status: (data.status as string | null) ?? null,
  };
}

/** Tel hoeveel valid leads er in een branche zitten (voor de UI-warning). */
export async function countBranchLeads(branch: string, country?: string): Promise<number> {
  const supabase = createServerClient();
  let query = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('branch', branch)
    .eq('phone_valid', true);
  if (country) query = query.eq('land', country.toUpperCase());
  const { count } = await query;
  return count || 0;
}

export const __internal = {
  isEnabled,
  sha256Lower,
  hashLead,
  MIN_SEED_LEADS,
  LEAD_WINDOW_DAYS,
  EXCLUSION_WINDOW_DAYS,
};
