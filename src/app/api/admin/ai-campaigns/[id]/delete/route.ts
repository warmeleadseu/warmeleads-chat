/**
 * Verwijder een AI-experiment volledig:
 * - alle ads + ad sets + campagnes (zowel uit nieuwe tree-tabellen als
 *   legacy `meta_*_id` op het experiment) worden in Meta op DELETED
 *   gezet (= verbergt ze permanent uit Ads Manager)
 * - lokale rijen krijgen `deleted_at = now()` (soft-delete) zodat de
 *   audit-trail behouden blijft maar de UI ze niet meer toont
 *
 * Idempotent: kan veilig dubbel aangeroepen worden.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { setEntityStatus } from '@/lib/metaMarketingApi';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const { id: experimentId } = await context.params;
  const supabase = createServerClient();

  const { data: exp } = await supabase
    .from('ai_campaign_experiments')
    .select('id, brief_id, meta_campaign_id, meta_adset_id, deleted_at, phase')
    .eq('id', experimentId)
    .maybeSingle();
  if (!exp) return NextResponse.json({ error: 'Experiment niet gevonden' }, { status: 404 });
  if (exp.deleted_at) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  // ── Verzamel alle Meta-IDs die we moeten archiveren ──
  const adIds: string[] = [];
  const adsetIds: string[] = [];
  const campaignIds: string[] = [];

  // Variants -> ad-ids
  const { data: variants } = await supabase
    .from('ai_campaign_variants')
    .select('meta_ad_id')
    .eq('experiment_id', experimentId);
  for (const v of variants || []) {
    if (v.meta_ad_id) adIds.push(v.meta_ad_id);
  }

  // Tree-tabellen
  const { data: metaCampaigns } = await supabase
    .from('ai_campaign_meta_campaigns')
    .select('id, meta_campaign_id')
    .eq('experiment_id', experimentId);
  const campaignRowIds: string[] = [];
  for (const c of metaCampaigns || []) {
    if (c.meta_campaign_id) campaignIds.push(c.meta_campaign_id);
    campaignRowIds.push(c.id);
  }
  if (campaignRowIds.length > 0) {
    const { data: metaAdsets } = await supabase
      .from('ai_campaign_meta_adsets')
      .select('meta_adset_id')
      .in('meta_campaign_row_id', campaignRowIds);
    for (const a of metaAdsets || []) {
      if (a.meta_adset_id) adsetIds.push(a.meta_adset_id);
    }
  }

  // Legacy IDs op het experiment zelf (oude launches voor migratie)
  if (exp.meta_adset_id && !adsetIds.includes(exp.meta_adset_id)) adsetIds.push(exp.meta_adset_id);
  if (exp.meta_campaign_id && !campaignIds.includes(exp.meta_campaign_id)) campaignIds.push(exp.meta_campaign_id);

  // ── Archiveer in Meta (best-effort) ──
  // Volgorde: ads -> adsets -> campaigns zodat Meta geen integriteit-errors gooit.
  const metaErrors: Array<{ id: string; level: string; message: string }> = [];
  const archive = async (id: string, level: 'ad' | 'adset' | 'campaign') => {
    try {
      await setEntityStatus(id, 'DELETED');
    } catch (e) {
      const msg = (e as Error).message || 'unknown';
      // 'Object cannot be deleted' (code 100) als hij al weg is = oké
      if (!/cannot be deleted|does not exist|already deleted/i.test(msg)) {
        metaErrors.push({ id, level, message: msg });
      }
    }
  };
  for (const id of adIds) await archive(id, 'ad');
  for (const id of adsetIds) await archive(id, 'adset');
  for (const id of campaignIds) await archive(id, 'campaign');

  // ── Lokaal soft-delete ──
  const now = new Date().toISOString();
  await supabase
    .from('ai_campaign_experiments')
    .update({ deleted_at: now, phase: 'deleted', ended_at: now, stop_reason: 'manual_delete' })
    .eq('id', experimentId);

  await supabase
    .from('ai_campaign_briefs')
    .update({ deleted_at: now, status: 'deleted' })
    .eq('id', exp.brief_id);

  await supabase
    .from('ai_campaign_meta_campaigns')
    .update({ status: 'archived', archived_at: now })
    .eq('experiment_id', experimentId);

  if (campaignRowIds.length > 0) {
    await supabase
      .from('ai_campaign_meta_adsets')
      .update({ status: 'archived', archived_at: now })
      .in('meta_campaign_row_id', campaignRowIds);
  }

  await supabase.from('ai_campaign_decisions').insert({
    experiment_id: experimentId,
    action: 'manual_delete',
    reason: 'admin_delete_button',
    metrics_snapshot: { adIds, adsetIds, campaignIds, metaErrors },
  });

  return NextResponse.json({
    ok: true,
    archived: { ads: adIds.length, adsets: adsetIds.length, campaigns: campaignIds.length },
    meta_errors: metaErrors,
  });
}
