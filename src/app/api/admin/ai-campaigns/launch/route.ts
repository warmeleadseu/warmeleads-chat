/**
 * Launch een AI-gegenereerde brief naar Meta als complete tree:
 *   1 experiment -> N campagnes (één per angle) -> M ad sets (één per
 *   targeting-strategie) -> K creatives per ad set.
 *
 * Vereist dat `/strategize` al gedraaid is voor deze brief (tree-rijen
 * in ai_campaign_meta_campaigns/adsets + variants gelinkt aan adsets).
 * Voor oudere briefs zonder strategist-output valt deze route terug op
 * de legacy "1 campagne, 1 adset" gedrag.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import {
  createAd,
  createAdSet,
  createCampaign,
  createLeadAdCreative,
  setEntityStatus,
  type AdSetTargetingSpec,
} from '@/lib/metaMarketingApi';
import { isAiCampaignsEnabled, reserveBranchBudget } from '@/lib/aiCampaignBudget';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  brief_id: z.string().uuid(),
  go_live: z.boolean().default(false),
});

interface MetaCampaignRow {
  id: string;
  experiment_id: string;
  meta_campaign_id: string | null;
  angle: string;
  rationale: string | null;
  daily_budget_cents: number;
  daily_budget_share: number;
  bid_strategy: string;
  status: string;
}

interface MetaAdsetRow {
  id: string;
  meta_campaign_row_id: string;
  meta_adset_id: string | null;
  name: string;
  strategy_type: string;
  targeting_summary: Record<string, unknown>;
  daily_budget_cents: number | null;
  status: string;
}

interface VariantRow {
  id: string;
  brief_id: string;
  experiment_id: string | null;
  meta_adset_row_id: string | null;
  headline: string;
  primary_text: string;
  description: string | null;
  cta: string;
  meta_image_hash: string | null;
  status: string;
}

interface LaunchError {
  level: 'campaign' | 'adset' | 'creative' | 'ad';
  ref: string;
  message: string;
}

function toTargetingSpec(summary: Record<string, unknown>, fallbackCountries: string[]): AdSetTargetingSpec {
  const s = summary as {
    age_min?: number; age_max?: number; genders?: number[];
    interests?: Array<{ id: string; name?: string }>;
    behaviors?: Array<{ id: string; name?: string }>;
    custom_audiences?: Array<{ id: string }>;
    excluded_custom_audiences?: Array<{ id: string }>;
    locales?: number[];
    regions?: Array<{ key: string }>;
    countries?: string[];
    advantage_audience?: boolean;
  };
  const flexible: { interests?: Array<{ id: string; name?: string }>; behaviors?: Array<{ id: string; name?: string }> }[] = [];
  const interestBehaviorBlock: { interests?: Array<{ id: string; name?: string }>; behaviors?: Array<{ id: string; name?: string }> } = {};
  if (s.interests && s.interests.length > 0) interestBehaviorBlock.interests = s.interests;
  if (s.behaviors && s.behaviors.length > 0) interestBehaviorBlock.behaviors = s.behaviors;
  if (Object.keys(interestBehaviorBlock).length > 0) flexible.push(interestBehaviorBlock);

  return {
    countries: (s.countries && s.countries.length > 0 ? s.countries : fallbackCountries) || ['NL'],
    regions: s.regions,
    ageMin: s.age_min,
    ageMax: s.age_max,
    genders: s.genders,
    flexibleSpec: flexible.length > 0 ? flexible : undefined,
    customAudienceIds: s.custom_audiences?.map(c => c.id),
    excludedCustomAudienceIds: s.excluded_custom_audiences?.map(c => c.id),
    locales: s.locales,
    advantageAudience: s.advantage_audience,
  };
}

export async function POST(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  if (!(await isAiCampaignsEnabled())) {
    return NextResponse.json({ error: 'AI campaigns master switch staat uit.' }, { status: 409 });
  }

  const parse = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parse.success) {
    return NextResponse.json({ error: 'Ongeldige input', details: parse.error.issues }, { status: 400 });
  }
  const body = parse.data;

  const supabase = createServerClient();

  const { data: brief } = await supabase
    .from('ai_campaign_briefs')
    .select('*')
    .eq('id', body.brief_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!brief) return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 });
  if (brief.status === 'killed') return NextResponse.json({ error: 'Brief is gekild; resume eerst.' }, { status: 409 });

  // ── Idempotency: bestaat al een actief experiment met ads voor deze brief? ──
  const { data: existingExps } = await supabase
    .from('ai_campaign_experiments')
    .select('id, phase')
    .eq('brief_id', brief.id)
    .is('deleted_at', null);
  if (existingExps && existingExps.length > 0) {
    const liveExpIds = existingExps.filter(e => e.phase !== 'killed' && e.phase !== 'deleted').map(e => e.id);
    if (liveExpIds.length > 0) {
      const { data: liveAds } = await supabase
        .from('ai_campaign_variants')
        .select('id')
        .in('experiment_id', liveExpIds)
        .not('meta_ad_id', 'is', null)
        .limit(1);
      if (liveAds && liveAds.length > 0) {
        const { data: existingExp } = await supabase
          .from('ai_campaign_experiments')
          .select('*')
          .eq('id', liveExpIds[0])
          .single();
        return NextResponse.json({ ok: true, idempotent: true, experiment: existingExp });
      }
    }
    // Geen ads in eerdere experimenten — reset orphans
    await supabase
      .from('ai_campaign_variants')
      .update({ status: 'draft', experiment_id: null })
      .eq('brief_id', brief.id)
      .in('status', ['failed', 'paused']);
  }

  const { data: allVariants } = await supabase
    .from('ai_campaign_variants')
    .select('id, brief_id, experiment_id, meta_adset_row_id, headline, primary_text, description, cta, meta_image_hash, status')
    .eq('brief_id', brief.id)
    .eq('status', 'draft')
    .order('created_at');
  const variants = (allVariants || []) as VariantRow[];
  const variantsWithImages = variants.filter(v => v.meta_image_hash);
  if (variantsWithImages.length === 0) {
    return NextResponse.json({ error: 'Geen draft-varianten met Meta image_hash' }, { status: 409 });
  }

  // ── Strategist-tree opzoeken: campagnes + adsets gekoppeld via varianten ──
  // We zoeken naar pre-bestaande meta_campaign-rijen waarvan adsets bestaan
  // die nog NIET in Meta zijn gepushed (meta_adset_id IS NULL) en gerelateerd
  // zijn aan deze brief via variants.meta_adset_row_id.
  const adsetRowIds = Array.from(new Set(variantsWithImages.map(v => v.meta_adset_row_id).filter((x): x is string => !!x)));

  let plannedCampaigns: MetaCampaignRow[] = [];
  let plannedAdsets: MetaAdsetRow[] = [];

  if (adsetRowIds.length > 0) {
    const { data: ads } = await supabase
      .from('ai_campaign_meta_adsets')
      .select('id, meta_campaign_row_id, meta_adset_id, name, strategy_type, targeting_summary, daily_budget_cents, status')
      .in('id', adsetRowIds)
      .order('created_at', { ascending: true });
    plannedAdsets = (ads || []) as MetaAdsetRow[];
    const campaignRowIds = Array.from(new Set(plannedAdsets.map(a => a.meta_campaign_row_id)));
    if (campaignRowIds.length > 0) {
      const { data: cmps } = await supabase
        .from('ai_campaign_meta_campaigns')
        .select('id, experiment_id, meta_campaign_id, angle, rationale, daily_budget_cents, daily_budget_share, bid_strategy, status')
        .in('id', campaignRowIds)
        .order('created_at', { ascending: true });
      plannedCampaigns = (cmps || []) as MetaCampaignRow[];
    }
  }

  // ── Budget reservering bij echte launch ──
  const initialStatus: 'PAUSED' | 'ACTIVE' = body.go_live && !brief.is_test_mode ? 'ACTIVE' : 'PAUSED';
  if (initialStatus === 'ACTIVE') {
    const reserve = await reserveBranchBudget(brief.branch, brief.daily_budget_cents);
    if (!reserve.ok) {
      return NextResponse.json({ error: 'Branche-budget bereikt of niet geconfigureerd', reserve }, { status: 402 });
    }
  }

  const naming = `AIwl-${brief.branch}-${brief.id.slice(0, 8)}`;
  const startTime = brief.is_test_mode
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : new Date().toISOString();
  const errors: LaunchError[] = [];

  // ── Maak experiment-rij vooraf (anchor voor alle decisions) ──
  let experimentRowId: string;
  if (plannedCampaigns.length > 0) {
    experimentRowId = plannedCampaigns[0].experiment_id;
  } else {
    const { data: newExp, error: newExpErr } = await supabase
      .from('ai_campaign_experiments')
      .insert({
        brief_id: brief.id,
        phase: 'pending',
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (newExpErr || !newExp) {
      return NextResponse.json({ error: 'Kon experiment niet opslaan', details: newExpErr?.message }, { status: 500 });
    }
    experimentRowId = newExp.id;
  }

  // ── Tree opbouwen / legacy fallback ──
  if (plannedCampaigns.length === 0) {
    // Legacy: één campagne + één adset met brief-default targeting
    try {
      const cmp = await createCampaign({
        name: `${naming}-CMP`,
        objective: 'OUTCOME_LEADS',
        specialAdCategory: brief.special_ad_category,
        status: 'PAUSED',
      });
      const adset = await createAdSet({
        campaignId: cmp.id,
        name: `${naming}-AS`,
        pageId: brief.page_id,
        dailyBudgetCents: brief.daily_budget_cents,
        targeting: { countries: brief.geographic_targeting.countries || ['NL'] },
        destinationType: 'ON_AD',
        status: 'PAUSED',
        startTime,
      });
      const { data: cmpRow } = await supabase
        .from('ai_campaign_meta_campaigns')
        .insert({
          experiment_id: experimentRowId,
          meta_campaign_id: cmp.id,
          angle: 'legacy',
          daily_budget_cents: brief.daily_budget_cents,
          daily_budget_share: 1,
          status: 'paused',
        })
        .select('id')
        .single();
      const { data: adRow } = await supabase
        .from('ai_campaign_meta_adsets')
        .insert({
          meta_campaign_row_id: cmpRow!.id,
          meta_adset_id: adset.id,
          name: `${naming}-AS`,
          strategy_type: 'broad',
          targeting_summary: { countries: brief.geographic_targeting.countries || ['NL'] },
          status: 'paused',
        })
        .select('id')
        .single();
      plannedCampaigns = [{
        id: cmpRow!.id,
        experiment_id: experimentRowId,
        meta_campaign_id: cmp.id,
        angle: 'legacy',
        rationale: null,
        daily_budget_cents: brief.daily_budget_cents,
        daily_budget_share: 1,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        status: 'paused',
      }];
      plannedAdsets = [{
        id: adRow!.id,
        meta_campaign_row_id: cmpRow!.id,
        meta_adset_id: adset.id,
        name: `${naming}-AS`,
        strategy_type: 'broad',
        targeting_summary: { countries: brief.geographic_targeting.countries || ['NL'] },
        daily_budget_cents: null,
        status: 'paused',
      }];
      // Koppel alle variants aan de legacy adset
      await supabase
        .from('ai_campaign_variants')
        .update({ meta_adset_row_id: adRow!.id })
        .eq('brief_id', brief.id)
        .is('meta_adset_row_id', null);
      for (const v of variantsWithImages) v.meta_adset_row_id = adRow!.id;
    } catch (e) {
      await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
      return NextResponse.json({ error: 'Meta campaign/adset aanmaken faalde', details: (e as Error).message }, { status: 502 });
    }
  } else {
    // Strategist-tree: maak per row de Meta-entiteiten aan (alleen waar nog geen meta_*_id is)
    for (const cmp of plannedCampaigns) {
      if (cmp.meta_campaign_id) continue;
      try {
        const created = await createCampaign({
          name: `${naming}-${cmp.angle.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 12)}`,
          objective: 'OUTCOME_LEADS',
          specialAdCategory: brief.special_ad_category,
          status: 'PAUSED',
          dailyBudgetCents: cmp.daily_budget_cents,
          bidStrategy: cmp.bid_strategy as 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'LOWEST_COST_WITH_BID_CAP',
        });
        cmp.meta_campaign_id = created.id;
        await supabase
          .from('ai_campaign_meta_campaigns')
          .update({ meta_campaign_id: created.id, status: 'paused' })
          .eq('id', cmp.id);
      } catch (e) {
        const msg = (e as Error).message || 'unknown';
        console.warn('[launch] campaign_failed', { angle: cmp.angle, msg });
        errors.push({ level: 'campaign', ref: cmp.angle, message: msg });
        await supabase
          .from('ai_campaign_meta_campaigns')
          .update({ status: 'failed' })
          .eq('id', cmp.id);
      }
    }

    for (const adset of plannedAdsets) {
      if (adset.meta_adset_id) continue;
      const cmp = plannedCampaigns.find(c => c.id === adset.meta_campaign_row_id);
      if (!cmp || !cmp.meta_campaign_id) {
        errors.push({ level: 'adset', ref: adset.name, message: 'parent campaign missing' });
        await supabase.from('ai_campaign_meta_adsets').update({ status: 'failed' }).eq('id', adset.id);
        continue;
      }
      try {
        const created = await createAdSet({
          campaignId: cmp.meta_campaign_id,
          name: `${naming}-${adset.strategy_type}-${adset.id.slice(0, 6)}`,
          pageId: brief.page_id,
          dailyBudgetCents: adset.daily_budget_cents ?? 0, // 0 = inherit van CBO
          targeting: toTargetingSpec(adset.targeting_summary, brief.geographic_targeting.countries),
          destinationType: 'ON_AD',
          status: 'PAUSED',
          startTime,
        });
        adset.meta_adset_id = created.id;
        await supabase
          .from('ai_campaign_meta_adsets')
          .update({ meta_adset_id: created.id, status: 'paused' })
          .eq('id', adset.id);
      } catch (e) {
        const msg = (e as Error).message || 'unknown';
        console.warn('[launch] adset_failed', { name: adset.name, msg });
        errors.push({ level: 'adset', ref: adset.name, message: msg });
        await supabase.from('ai_campaign_meta_adsets').update({ status: 'failed' }).eq('id', adset.id);
      }
    }
  }

  // ── Update experiment met legacy meta_campaign_id/meta_adset_id (alleen 1e) ──
  await supabase
    .from('ai_campaign_experiments')
    .update({
      meta_campaign_id: plannedCampaigns[0]?.meta_campaign_id ?? null,
      meta_adset_id: plannedAdsets[0]?.meta_adset_id ?? null,
      tree_summary: {
        campaigns: plannedCampaigns.length,
        adsets: plannedAdsets.length,
        variants: variantsWithImages.length,
      },
    })
    .eq('id', experimentRowId);

  // ── Per variant: creative + ad in juiste adset ──
  let createdAds = 0;
  for (const v of variantsWithImages) {
    if (!v.meta_adset_row_id) {
      errors.push({ level: 'ad', ref: v.id, message: 'variant heeft geen meta_adset_row_id' });
      continue;
    }
    const adsetRow = plannedAdsets.find(a => a.id === v.meta_adset_row_id);
    if (!adsetRow || !adsetRow.meta_adset_id) {
      errors.push({ level: 'ad', ref: v.id, message: 'parent adset niet beschikbaar in Meta' });
      await supabase.from('ai_campaign_variants').update({ status: 'failed' }).eq('id', v.id);
      continue;
    }

    let creativeId: string | null = null;
    try {
      const creative = await createLeadAdCreative({
        pageId: brief.page_id,
        formId: brief.lead_form_id,
        name: `${naming}-CR-${v.id.slice(0, 6)}`,
        imageHash: v.meta_image_hash!,
        message: v.primary_text,
        headline: v.headline,
        description: v.description ?? undefined,
        cta: v.cta as 'LEARN_MORE',
      });
      creativeId = creative.id;
    } catch (e) {
      const msg = (e as Error).message || 'unknown';
      console.warn('[launch] creative_failed', { variant_id: v.id, msg });
      errors.push({ level: 'creative', ref: v.id, message: msg });
      await supabase.from('ai_campaign_variants').update({ status: 'failed' }).eq('id', v.id);
      continue;
    }

    try {
      const ad = await createAd({
        name: `${naming}-AD-${v.id.slice(0, 6)}`,
        adsetId: adsetRow.meta_adset_id,
        creativeId,
        status: 'PAUSED',
      });
      await supabase
        .from('ai_campaign_variants')
        .update({
          experiment_id: experimentRowId,
          meta_creative_id: creativeId,
          meta_ad_id: ad.id,
          status: 'paused',
        })
        .eq('id', v.id);
      createdAds++;
    } catch (e) {
      const msg = (e as Error).message || 'unknown';
      console.warn('[launch] ad_failed', { variant_id: v.id, creative_id: creativeId, msg });
      errors.push({ level: 'ad', ref: v.id, message: msg });
      await supabase
        .from('ai_campaign_variants')
        .update({ status: 'failed', meta_creative_id: creativeId })
        .eq('id', v.id);
    }
  }

  if (createdAds === 0) {
    const firstErr = errors[0]?.message || 'onbekende Meta-fout';
    await supabase
      .from('ai_campaign_experiments')
      .update({
        phase: 'killed',
        ended_at: new Date().toISOString(),
        stop_reason: `no_ads_created: ${firstErr.slice(0, 180)}`,
      })
      .eq('id', experimentRowId);
    return NextResponse.json({ error: `Geen ads aangemaakt: ${firstErr}`, errors }, { status: 502 });
  }

  // ── Optioneel direct ACTIVE ──
  if (initialStatus === 'ACTIVE') {
    try {
      for (const adset of plannedAdsets) {
        if (adset.meta_adset_id && adset.status !== 'failed') {
          try { await setEntityStatus(adset.meta_adset_id, 'ACTIVE'); } catch (e) {
            errors.push({ level: 'adset', ref: adset.name, message: `activate_failed: ${(e as Error).message}` });
          }
        }
      }
      for (const cmp of plannedCampaigns) {
        if (cmp.meta_campaign_id && cmp.status !== 'failed') {
          try { await setEntityStatus(cmp.meta_campaign_id, 'ACTIVE'); } catch (e) {
            errors.push({ level: 'campaign', ref: cmp.angle, message: `activate_failed: ${(e as Error).message}` });
          }
        }
      }
      await supabase
        .from('ai_campaign_variants')
        .update({ status: 'live' })
        .eq('experiment_id', experimentRowId)
        .eq('status', 'paused');
      await supabase
        .from('ai_campaign_meta_campaigns')
        .update({ status: 'active' })
        .eq('experiment_id', experimentRowId)
        .neq('status', 'failed');
      const liveAdsetRowIds = plannedAdsets.filter(a => a.meta_adset_id && a.status !== 'failed').map(a => a.id);
      if (liveAdsetRowIds.length > 0) {
        await supabase
          .from('ai_campaign_meta_adsets')
          .update({ status: 'active' })
          .in('id', liveAdsetRowIds);
      }
      await supabase
        .from('ai_campaign_experiments')
        .update({ phase: 'running' })
        .eq('id', experimentRowId);
    } catch (e) {
      errors.push({ level: 'campaign', ref: 'experiment', message: `bulk_activate_failed: ${(e as Error).message}` });
    }
  }

  await supabase.from('ai_campaign_briefs').update({ status: 'launched' }).eq('id', brief.id);

  await supabase.from('ai_campaign_decisions').insert({
    experiment_id: experimentRowId,
    action: 'launch',
    reason: initialStatus === 'ACTIVE' ? 'go_live_immediate' : 'paused_for_review',
    metrics_snapshot: {
      created_ads: createdAds,
      campaigns: plannedCampaigns.length,
      adsets: plannedAdsets.length,
      errors,
    },
    dry_run: false,
  });

  const { data: refreshedExp } = await supabase
    .from('ai_campaign_experiments')
    .select('*')
    .eq('id', experimentRowId)
    .single();

  return NextResponse.json({
    ok: true,
    experiment: refreshedExp,
    created_ads: createdAds,
    created_campaigns: plannedCampaigns.length,
    created_adsets: plannedAdsets.length,
    initial_status: initialStatus,
    errors,
  });
}
