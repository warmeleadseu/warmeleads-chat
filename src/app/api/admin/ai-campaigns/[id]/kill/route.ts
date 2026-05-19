import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { setEntityStatus } from '@/lib/metaMarketingApi';

export const runtime = 'nodejs';

interface Ctx { params: { id: string } }

/**
 * Kill een experiment: pauzeert ALLE Meta-campagnes + adsets in de tree
 * (Studio v2) en zet lokaal phase=killed.
 *
 * Voor experimenten van vóór de tree-migratie (alleen legacy meta_campaign_id /
 * meta_adset_id op het experiment zelf) blijft het gedrag identiek.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const experimentId = ctx.params.id;
  const supabase = createServerClient();

  const { data: exp } = await supabase
    .from('ai_campaign_experiments')
    .select('*')
    .eq('id', experimentId)
    .maybeSingle();
  if (!exp) return NextResponse.json({ error: 'Experiment niet gevonden' }, { status: 404 });

  if (exp.phase === 'killed') {
    return NextResponse.json({ ok: true, idempotent: true, experiment: exp });
  }

  const errors: string[] = [];

  // Tree: alle ad sets + campagnes pauzeren
  const { data: metaCampaigns } = await supabase
    .from('ai_campaign_meta_campaigns')
    .select('id, meta_campaign_id')
    .eq('experiment_id', experimentId);
  const campaignRowIds = (metaCampaigns || []).map(c => c.id);
  const adsetMetaIds: string[] = [];
  if (campaignRowIds.length > 0) {
    const { data: adsets } = await supabase
      .from('ai_campaign_meta_adsets')
      .select('meta_adset_id')
      .in('meta_campaign_row_id', campaignRowIds);
    for (const a of adsets || []) {
      if (a.meta_adset_id) adsetMetaIds.push(a.meta_adset_id);
    }
  }

  // Volgorde: ads -> adsets -> campaigns (Meta API faalt soms als child active is)
  for (const adsetId of adsetMetaIds) {
    try { await setEntityStatus(adsetId, 'PAUSED'); }
    catch (e) { errors.push(`adset ${adsetId}: ${(e as Error).message}`); }
  }
  for (const c of metaCampaigns || []) {
    if (!c.meta_campaign_id) continue;
    try { await setEntityStatus(c.meta_campaign_id, 'PAUSED'); }
    catch (e) { errors.push(`campaign ${c.meta_campaign_id}: ${(e as Error).message}`); }
  }

  // Legacy fallback (vóór tree-backfill)
  if (adsetMetaIds.length === 0 && exp.meta_adset_id) {
    try { await setEntityStatus(exp.meta_adset_id, 'PAUSED'); }
    catch (e) { errors.push(`legacy adset: ${(e as Error).message}`); }
  }
  if (campaignRowIds.length === 0 && exp.meta_campaign_id) {
    try { await setEntityStatus(exp.meta_campaign_id, 'PAUSED'); }
    catch (e) { errors.push(`legacy campaign: ${(e as Error).message}`); }
  }

  const now = new Date().toISOString();
  await supabase
    .from('ai_campaign_experiments')
    .update({ phase: 'killed', ended_at: now, stop_reason: 'manual_kill' })
    .eq('id', experimentId);

  await supabase
    .from('ai_campaign_meta_campaigns')
    .update({ status: 'paused' })
    .eq('experiment_id', experimentId);

  if (campaignRowIds.length > 0) {
    await supabase
      .from('ai_campaign_meta_adsets')
      .update({ status: 'paused' })
      .in('meta_campaign_row_id', campaignRowIds);
  }

  await supabase
    .from('ai_campaign_variants')
    .update({ status: 'paused' })
    .eq('experiment_id', experimentId)
    .in('status', ['live', 'draft', 'paused']);

  await supabase
    .from('ai_campaign_briefs')
    .update({ status: 'killed' })
    .eq('id', exp.brief_id);

  await supabase.from('ai_campaign_decisions').insert({
    experiment_id: experimentId,
    action: 'manual_kill',
    reason: 'admin_kill_button',
    metrics_snapshot: { errors, paused_campaigns: campaignRowIds.length, paused_adsets: adsetMetaIds.length },
  });

  return NextResponse.json({ ok: true, errors });
}
