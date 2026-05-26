/**
 * Demand-check per branche: hebben we klantbatches die nog leads kunnen ontvangen?
 *
 * Wordt door de generate/launch/optimizer-routes gebruikt om te voorkomen
 * dat we Meta-budget verbranden voor leads die geen klant zoekt.
 *
 * Heuristiek:
 *   capacity_open = SUM(batch_size − leads_delivered) over actieve, betaalde,
 *                   pipeline batches in deze branche met (geen-of-bereikt)
 *                   `starts_at` en met `meta_campaign_sync_enabled` of
 *                   `is_paused = false`.
 *   leads_last_7d = aantal leads in branche van afgelopen 7 dagen.
 *
 *   open_ratio    = capacity_open / max(1, leads_last_7d)
 *
 *   need_more_volume = open_ratio > 1.0 (we leveren minder dan klanten willen)
 */
import { createServerClient } from '@/lib/supabase';
import { isPipelineBatchKind } from '@/lib/batchKind';
import { isCappedDeliveryModel } from '@/lib/batchDeliveryModel';

export interface BranchDemand {
  branch: string;
  capacityOpen: number;
  activeBatches: number;
  leadsLast7d: number;
  needMoreVolume: boolean;
  openRatio: number;
}

export async function getBranchDemand(branch: string): Promise<BranchDemand> {
  const supabase = createServerClient();

  const { data: batches } = await supabase
    .from('customer_batches')
    .select('id, batch_size, leads_delivered, status, is_paid, starts_at, batch_kind, delivery_model, branch')
    .eq('branch', branch)
    .eq('status', 'active')
    .eq('is_paid', true);

  let capacityOpen = 0;
  let activeBatches = 0;
  const now = Date.now();
  for (const b of batches || []) {
    const row = b as { batch_kind?: string; delivery_model?: string };
    if (!isPipelineBatchKind(row.batch_kind)) continue;
    if (!isCappedDeliveryModel(row.delivery_model, row.batch_kind)) continue;
    const startsAt = (b as { starts_at?: string | null }).starts_at;
    if (startsAt && new Date(startsAt).getTime() > now) continue;
    const size = Number(b.batch_size) || 0;
    const delivered = Number(b.leads_delivered) || 0;
    const room = Math.max(0, size - delivered);
    if (room > 0) {
      capacityOpen += room;
      activeBatches += 1;
    }
  }

  const sinceIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: leadsLast7dRaw } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('branch', branch)
    .gte('created_at', sinceIso);

  const leadsLast7d = leadsLast7dRaw || 0;
  const openRatio = capacityOpen / Math.max(1, leadsLast7d);
  const needMoreVolume = openRatio > 1.0;

  return { branch, capacityOpen, activeBatches, leadsLast7d, needMoreVolume, openRatio };
}

export async function getAllBranchDemand(): Promise<BranchDemand[]> {
  const supabase = createServerClient();
  const { data: branches } = await supabase
    .from('branches')
    .select('slug')
    .eq('is_active', true)
    .order('sort_order');
  const out: BranchDemand[] = [];
  for (const b of branches || []) {
    out.push(await getBranchDemand(b.slug));
  }
  return out;
}
