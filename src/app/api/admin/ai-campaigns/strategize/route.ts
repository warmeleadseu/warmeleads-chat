/**
 * Strategize: maakt een complete tree-plan (brief + campagnes + adsets)
 * voor een nieuwe launch. Geen Meta-writes, alleen lokale DB.
 *
 * Flow:
 *   1. Body valideren (target, budget, strategy params, targeting overrides)
 *   2. Optioneel: lookalike-audience opbouwen of verifieren
 *   3. Optioneel: interest IDs zoeken op keywords uit BRANCH_HINTS
 *   4. LLM strategist roepen → krijgt tree-plan
 *   5. Brief + experiment + meta_campaigns + meta_adsets opslaan
 *   6. Tree teruggeven naar UI voor preview/goedkeuring
 *
 * De daadwerkelijke copy + images worden via `/generate` per adset
 * gegenereerd en gekoppeld aan deze tree.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { planStrategy } from '@/lib/aiCampaignStrategist';
import { searchInterestsForKeywords } from '@/lib/metaTargetingSearch';
import { buildBranchAudiencePack, getBranchAudiencePack, countBranchLeads } from '@/lib/metaCustomAudiences';
import { BRANCH_HINTS } from '@/lib/aiCampaignStrategist';
import { isAiCampaignsEnabled, reserveOpenAIBudget } from '@/lib/aiCampaignBudget';
import { getBranchDemand } from '@/lib/aiCampaignDemand';

export const runtime = 'nodejs';
export const maxDuration = 180;

const BodySchema = z.object({
  branch: z.string().min(1),
  lead_form_id: z.string().min(1),
  page_id: z.string().min(1),
  target_audience: z.record(z.string(), z.unknown()).default({}),
  daily_budget_cents: z.number().int().min(100),
  max_total_budget_cents: z.number().int().min(100),
  target_cpl_cents: z.number().int().nonnegative().optional(),
  special_ad_category: z.enum(['NONE', 'CREDIT', 'EMPLOYMENT', 'HOUSING', 'ISSUES_ELECTIONS_POLITICS']).default('NONE'),
  is_test_mode: z.boolean().default(true),
  // Strategie-parameters
  strategy_params: z.object({
    angles: z.number().int().min(2).max(5).default(3),
    adsets_per_angle: z.number().int().min(1).max(3).default(2),
    creatives_per_adset: z.number().int().min(2).max(5).default(3),
    use_lookalike: z.boolean().default(false),
    use_exclusion: z.boolean().default(true),
    build_lookalike_now: z.boolean().default(false),
  }).default({
    angles: 3,
    adsets_per_angle: 2,
    creatives_per_adset: 3,
    use_lookalike: false,
    use_exclusion: true,
    build_lookalike_now: false,
  }),
  // Targeting-overrides (anders gebruikt strategist branche-defaults)
  targeting_spec: z.object({
    countries: z.array(z.string()).min(1).default(['NL']),
    regions: z.array(z.object({ key: z.string(), name: z.string() })).optional(),
    age_min: z.number().int().min(18).max(65).optional(),
    age_max: z.number().int().min(18).max(99).optional(),
    genders: z.array(z.number().int()).optional(),
    locales: z.array(z.number().int()).optional(),
  }).default({ countries: ['NL'] }),
});

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

  // ── Branche-check ──
  const { data: branchRow } = await supabase
    .from('branches')
    .select('slug, name, is_active')
    .eq('slug', body.branch)
    .maybeSingle();
  if (!branchRow || branchRow.is_active === false) {
    return NextResponse.json({ error: 'Onbekende of inactieve branche' }, { status: 400 });
  }

  const demand = await getBranchDemand(body.branch);
  if (demand.capacityOpen === 0 && !body.is_test_mode) {
    return NextResponse.json({
      error: 'Geen open klantcapaciteit; advertenties zouden geen klant vinden.',
      demand,
    }, { status: 409 });
  }

  // ── OpenAI budgetreservering (strategist ~50ct) ──
  const guard = await reserveOpenAIBudget(body.branch, 60);
  if (!guard.ok) {
    return NextResponse.json({ error: 'OpenAI-budget bereikt', guard }, { status: 402 });
  }

  // ── Lookalike-audience (best-effort) ──
  let lookalikeId: string | null = null;
  let exclusionId: string | null = null;
  let seedSize = 0;
  const primaryCountry = body.targeting_spec.countries[0];
  if (body.strategy_params.use_lookalike || body.strategy_params.use_exclusion) {
    seedSize = await countBranchLeads(body.branch, primaryCountry);
    if (body.strategy_params.build_lookalike_now && seedSize >= 100) {
      const built = await buildBranchAudiencePack(body.branch, primaryCountry, 0.01);
      if (built.ok) {
        lookalikeId = built.lookalikeAudienceId ?? null;
        exclusionId = built.exclusionAudienceId ?? null;
      }
    } else {
      const existing = await getBranchAudiencePack(body.branch, primaryCountry, 0.01);
      if (existing) {
        lookalikeId = existing.lookalikeAudienceId;
        exclusionId = existing.exclusionAudienceId;
      }
    }
  }

  // ── Interest IDs zoeken op branche-keywords (best-effort) ──
  const hint = BRANCH_HINTS[body.branch];
  let knownInterests: Array<{ id: string; name: string; topic?: string }> = [];
  if (hint) {
    try {
      const hits = await searchInterestsForKeywords(hint.default_interest_keywords);
      knownInterests = hits.slice(0, 30);
    } catch (e) {
      console.warn('[strategize] interest_search_failed', (e as Error).message);
    }
  }

  // ── Brief opslaan (zonder variants) ──
  const { data: brief, error: briefErr } = await supabase
    .from('ai_campaign_briefs')
    .insert({
      branch: body.branch,
      status: 'draft',
      target_audience: body.target_audience,
      geographic_targeting: { countries: body.targeting_spec.countries, regions: body.targeting_spec.regions },
      target_cpl_cents: body.target_cpl_cents ?? null,
      daily_budget_cents: body.daily_budget_cents,
      max_total_budget_cents: body.max_total_budget_cents,
      lead_form_id: body.lead_form_id,
      page_id: body.page_id,
      special_ad_category: body.special_ad_category,
      is_test_mode: body.is_test_mode,
      variant_count: body.strategy_params.angles * body.strategy_params.adsets_per_angle * body.strategy_params.creatives_per_adset,
      targeting_spec: body.targeting_spec,
      strategy_params: body.strategy_params,
      created_by: admin.id,
    })
    .select('*')
    .single();
  if (briefErr || !brief) {
    return NextResponse.json({ error: 'Kon brief niet opslaan', details: briefErr?.message }, { status: 500 });
  }

  // ── Strategist aanroepen ──
  let strategy;
  let cost = 0;
  try {
    const result = await planStrategy({
      brief: {
        id: brief.id,
        branch: brief.branch,
        branchName: branchRow.name,
        countries: body.targeting_spec.countries,
        regions: body.targeting_spec.regions,
        daily_budget_cents: brief.daily_budget_cents,
        target_cpl_cents: brief.target_cpl_cents,
        target_audience: body.target_audience,
        form_questions_count: (body.target_audience as { form_questions_count?: number | null }).form_questions_count ?? null,
      },
      params: {
        angles: body.strategy_params.angles,
        adsets_per_angle: body.strategy_params.adsets_per_angle,
        creatives_per_adset: body.strategy_params.creatives_per_adset,
        use_lookalike: body.strategy_params.use_lookalike,
        use_exclusion: body.strategy_params.use_exclusion,
        age_min: body.targeting_spec.age_min,
        age_max: body.targeting_spec.age_max,
        genders: body.targeting_spec.genders,
      },
      available: {
        lookalike_audience_id: lookalikeId,
        exclusion_audience_id: exclusionId,
        branch_lead_count: seedSize,
        known_interests: knownInterests,
      },
    });
    strategy = result.strategy;
    cost = result.costCents;
  } catch (e) {
    await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
    return NextResponse.json({ error: 'Strategist faalde', details: (e as Error).message }, { status: 502 });
  }

  // ── Strategie-plan opslaan op brief ──
  await supabase
    .from('ai_campaign_briefs')
    .update({ strategy_plan: strategy, status: 'generated' })
    .eq('id', brief.id);

  // ── Experiment-rij + tree opslaan ──
  const { data: experiment, error: expErr } = await supabase
    .from('ai_campaign_experiments')
    .insert({
      brief_id: brief.id,
      phase: 'pending',
      tree_summary: {
        campaigns: strategy.campaigns.length,
        adsets: strategy.campaigns.reduce((s, c) => s + c.adsets.length, 0),
        predicted_avg_cpl_cents: strategy.predicted_avg_cpl_cents,
      },
    })
    .select('*')
    .single();
  if (expErr || !experiment) {
    return NextResponse.json({ error: 'Kon experiment niet opslaan', details: expErr?.message }, { status: 500 });
  }

  // Per campagne: budget = share * daily_budget
  const totalBudget = brief.daily_budget_cents;
  const treeRows: Array<{ campaignRowId: string; angle: string; adsetRows: Array<{ id: string; strategy_type: string; creative_brief: typeof strategy.campaigns[0]['adsets'][0]['creative_brief']; targeting: typeof strategy.campaigns[0]['adsets'][0]['targeting'] }> }> = [];

  for (const cmp of strategy.campaigns) {
    const cmpBudget = Math.round(totalBudget * cmp.daily_budget_share);
    const { data: cmpRow, error: cmpErr } = await supabase
      .from('ai_campaign_meta_campaigns')
      .insert({
        experiment_id: experiment.id,
        angle: cmp.angle,
        rationale: cmp.rationale,
        daily_budget_cents: cmpBudget,
        daily_budget_share: cmp.daily_budget_share,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        status: 'pending',
      })
      .select('id')
      .single();
    if (cmpErr || !cmpRow) {
      console.warn('[strategize] campaign insert failed', cmpErr?.message);
      continue;
    }

    const adsetRowsForCmp: Array<{ id: string; strategy_type: string; creative_brief: typeof cmp['adsets'][0]['creative_brief']; targeting: typeof cmp['adsets'][0]['targeting'] }> = [];
    for (const adset of cmp.adsets) {
      // Custom audience IDs uit lookalike pack injecten waar relevant
      const targeting = { ...adset.targeting };
      if (adset.strategy_type === 'lookalike' && lookalikeId) {
        targeting.custom_audiences = [{ id: lookalikeId, name: 'WL-lookalike' }];
      }
      if (body.strategy_params.use_exclusion && exclusionId) {
        targeting.excluded_custom_audiences = [{ id: exclusionId, name: 'WL-recent-leads' }];
      }
      // Countries van targeting_spec inheriten als strategist niets specificeert
      if (!targeting.regions && body.targeting_spec.regions) {
        targeting.regions = body.targeting_spec.regions;
      }
      const targetingSummary: Record<string, unknown> = {
        ...targeting,
        countries: body.targeting_spec.countries,
      };

      const { data: adsetRow, error: adsetErr } = await supabase
        .from('ai_campaign_meta_adsets')
        .insert({
          meta_campaign_row_id: cmpRow.id,
          name: adset.name,
          strategy_type: adset.strategy_type,
          targeting_summary: targetingSummary,
          predicted_cpl_cents: adset.predicted_cpl_cents,
          status: 'pending',
        })
        .select('id')
        .single();
      if (adsetErr || !adsetRow) {
        console.warn('[strategize] adset insert failed', adsetErr?.message);
        continue;
      }
      adsetRowsForCmp.push({
        id: adsetRow.id,
        strategy_type: adset.strategy_type,
        creative_brief: adset.creative_brief,
        targeting: targeting,
      });
    }
    treeRows.push({ campaignRowId: cmpRow.id, angle: cmp.angle, adsetRows: adsetRowsForCmp });
  }

  await supabase.from('ai_campaign_decisions').insert({
    experiment_id: experiment.id,
    action: 'strategize',
    reason: 'admin_strategize',
    metrics_snapshot: {
      campaigns: strategy.campaigns.length,
      predicted_avg_cpl_cents: strategy.predicted_avg_cpl_cents,
      cost_cents: cost,
    },
  });

  return NextResponse.json({
    ok: true,
    brief,
    experiment,
    strategy,
    tree: treeRows,
    cost_cents: cost,
    audiences: {
      lookalike_id: lookalikeId,
      exclusion_id: exclusionId,
      seed_lead_count: seedSize,
    },
  });
}
