import type { SupabaseClient } from '@supabase/supabase-js';
import { getMetaCredentials, META_GRAPH_URL } from '@/lib/meta';
import { isPipelineBatchKind } from '@/lib/batchKind';

export type MetaBatchCampaignSyncTrigger = 'finalize' | 'batch_sync' | 'admin' | 'cron';

export type BatchMetaSyncRow = {
  id: string;
  batch_kind?: string | null;
  is_paid: boolean | null;
  status: string | null;
  batch_size: number | null;
  leads_delivered: number | null;
  starts_at?: string | null;
  meta_campaign_ids: string[] | null;
  meta_campaign_sync_enabled: boolean | null;
};

const MAX_CAMPAIGNS_PER_BATCH = 10;
const ERROR_MAX_LEN = 480;

/** Zelfde semantiek als distributie: geen leads (en geen Meta ACTIVE) vóór `starts_at`. */
export function hasBatchAdvertisingWindowStarted(startsAt: string | null | undefined): boolean {
  if (startsAt == null || String(startsAt).trim() === '') return true;
  const t = new Date(startsAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

/**
 * Gewenste Meta campaign status voor alle gekoppelde campagnes van deze batch.
 * PAUSED = veilig default (onbetaald, niet actief, vol, pauze, sync uit, bulk/niche, vóór starts_at).
 */
export function getDesiredMetaCampaignStatus(row: BatchMetaSyncRow): 'ACTIVE' | 'PAUSED' {
  const ids = normalizeCampaignIds(row.meta_campaign_ids);
  if (ids.length === 0) return 'PAUSED';
  if (row.meta_campaign_sync_enabled === false) return 'PAUSED';
  if (!isPipelineBatchKind(row.batch_kind)) return 'PAUSED';
  if (row.is_paid !== true) return 'PAUSED';
  if (row.status !== 'active') return 'PAUSED';

  const size = Number(row.batch_size) || 0;
  const delivered = Number(row.leads_delivered) || 0;
  if (size > 0 && delivered >= size) return 'PAUSED';

  if (!hasBatchAdvertisingWindowStarted(row.starts_at)) return 'PAUSED';

  return 'ACTIVE';
}

export function normalizeCampaignIds(raw: string[] | null | undefined): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const s = String(x).trim();
    if (!/^\d+$/.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_CAMPAIGNS_PER_BATCH) break;
  }
  return out;
}

function normActId(id: string): string {
  const t = id.trim();
  return t.startsWith('act_') ? t : `act_${t}`;
}

async function graphGetCampaign(
  campaignId: string,
  accessToken: string,
): Promise<{ ok: true; account_id: string; name?: string; status?: string } | { ok: false; message: string }> {
  const url = `${META_GRAPH_URL}/${campaignId}?fields=id,account_id,name,status&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || (json as { error?: { message?: string } }).error) {
    const msg = (json as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`;
    return { ok: false, message: msg };
  }
  const account_id = (json as { account_id?: string }).account_id;
  if (!account_id) return { ok: false, message: 'Geen account_id op campagne' };
  return {
    ok: true,
    account_id,
    name: (json as { name?: string }).name,
    status: (json as { status?: string }).status,
  };
}

async function graphPostCampaignStatus(
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED',
  accessToken: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = new URLSearchParams({
    status,
    access_token: accessToken,
  });
  const res = await fetch(`${META_GRAPH_URL}/${campaignId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
  if (!res.ok || json.error) {
    return { ok: false, message: json.error?.message || `HTTP ${res.status}` };
  }
  if (json.success === false) {
    return { ok: false, message: 'Meta weigerde de wijziging (success=false)' };
  }
  return { ok: true };
}

function truncateErr(s: string): string {
  const t = s.trim();
  return t.length <= ERROR_MAX_LEN ? t : `${t.slice(0, ERROR_MAX_LEN)}…`;
}

/**
 * Zet alle gekoppelde Meta-campagnes naar de gewenste status (ACTIVE/PAUSED) op basis van
 * batch state inclusief `starts_at` (geen ACTIVE vóór geplande start, ook na vroege betaling).
 */
export async function reconcileBatchMetaCampaigns(
  supabase: SupabaseClient,
  batchId: string,
  _trigger: MetaBatchCampaignSyncTrigger,
): Promise<void> {
  const nowIso = new Date().toISOString();

  const { data: row, error: fetchErr } = await supabase
    .from('customer_batches')
    .select(
      'id, batch_kind, is_paid, status, batch_size, leads_delivered, starts_at, meta_campaign_ids, meta_campaign_sync_enabled',
    )
    .eq('id', batchId)
    .single();

  if (fetchErr || !row) return;

  const batch = row as BatchMetaSyncRow;
  const ids = normalizeCampaignIds(batch.meta_campaign_ids);

  if (ids.length === 0) {
    await supabase
      .from('customer_batches')
      .update({
        meta_sync_last_attempt_at: nowIso,
        meta_sync_last_error: null,
      })
      .eq('id', batchId);
    return;
  }

  const desired = getDesiredMetaCampaignStatus(batch);
  const credentials = await getMetaCredentials();

  if (!credentials?.accessToken || !credentials?.adAccountId) {
    await supabase
      .from('customer_batches')
      .update({
        meta_sync_last_attempt_at: nowIso,
        meta_sync_last_error: truncateErr('Meta API niet geconfigureerd (token / ad account)'),
      })
      .eq('id', batchId);
    return;
  }

  const expectedAccount = normActId(credentials.adAccountId);
  const errors: string[] = [];
  let okCount = 0;

  for (const campaignId of ids) {
    const info = await graphGetCampaign(campaignId, credentials.accessToken);
    if (!info.ok) {
      errors.push(`${campaignId}: ${info.message}`);
      continue;
    }
    if (normActId(info.account_id) !== expectedAccount) {
      errors.push(`${campaignId}: campagne hoort niet bij ad account ${expectedAccount}`);
      continue;
    }

    const current = (info.status || '').toUpperCase();
    if (current === desired) {
      okCount++;
      continue;
    }

    const post = await graphPostCampaignStatus(campaignId, desired, credentials.accessToken);
    if (!post.ok) {
      errors.push(`${campaignId}: ${post.message}`);
      continue;
    }
    okCount++;
  }

  const payload: Record<string, unknown> = {
    meta_sync_last_attempt_at: nowIso,
  };
  if (okCount === ids.length) {
    payload.meta_sync_last_success_at = nowIso;
    payload.meta_sync_last_error = null;
  } else if (okCount > 0) {
    payload.meta_sync_last_success_at = nowIso;
    payload.meta_sync_last_error = truncateErr(errors.join(' | '));
  } else {
    payload.meta_sync_last_error = truncateErr(errors.join(' | ') || 'Meta sync mislukt');
  }

  await supabase.from('customer_batches').update(payload).eq('id', batchId);
}

/** Cron: batches met Meta-koppeling (pipeline) — idempotente reconcile. */
export async function reconcileMetaCampaignsForCron(supabase: SupabaseClient, limit = 60): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const { data: rows, error } = await supabase
    .from('customer_batches')
    .select('id, meta_campaign_ids, batch_kind')
    .order('updated_at', { ascending: false })
    .limit(300);

  if (error) {
    errors.push(error.message);
    return { processed: 0, errors };
  }

  const candidateIds = (rows || [])
    .filter(r => {
      const mids = r.meta_campaign_ids as string[] | null;
      return (
        isPipelineBatchKind((r as { batch_kind?: string }).batch_kind) &&
        Array.isArray(mids) &&
        mids.length > 0
      );
    })
    .slice(0, limit)
    .map(r => r.id as string);

  let processed = 0;
  for (const id of candidateIds) {
    try {
      await reconcileBatchMetaCampaigns(supabase, id, 'cron');
      processed++;
    } catch (e) {
      errors.push(`${id}: ${(e as Error).message}`);
    }
  }

  return { processed, errors };
}
