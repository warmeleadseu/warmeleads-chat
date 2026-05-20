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
import {
  ensureBranchAudiencePack,
  buildBranchAudiencePack,
  getBranchAudiencePack,
  countBranchLeads,
  type LookalikeBuildResult,
} from '@/lib/metaCustomAudiences';
import { BRANCH_HINTS } from '@/lib/aiCampaignStrategist';
import { isAiCampaignsEnabled, reserveOpenAIBudget } from '@/lib/aiCampaignBudget';
import { getBranchDemand } from '@/lib/aiCampaignDemand';
import {
  VISUAL_STYLES,
  AUDIENCE_LOOKS,
  SETTINGS,
  MOODS,
  COLOR_FOCUSES,
  OVERLAY_FREQUENCIES,
  buildDefaultVisualDNA,
  validateVisualDNA,
  type VisualDNA,
} from '@/lib/aiVisualDNA';

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
    // Backward-compat: oudere clients sturen dit nog. Wordt genegeerd —
    // strategize bouwt nu altijd automatisch op als use_lookalike/exclusion
    // aan staat en er nog geen pakket is.
    build_lookalike_now: z.boolean().optional(),
    /** force=true rebuild een bestaand pakket vers (hash-refresh + nieuwe LAL). */
    force_rebuild_audience: z.boolean().default(false),
  }).default({
    angles: 3,
    adsets_per_angle: 2,
    creatives_per_adset: 3,
    use_lookalike: false,
    use_exclusion: true,
    force_rebuild_audience: false,
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
  /**
   * Visueel DNA (admin-chips + vrije velden). Optioneel: zonder DNA
   * vallen we terug op de branche-defaults uit `aiVisualDNA.ts`.
   * Validatie is licht (lijsten mogen leeg zijn — dan kiest strategist
   * vrij — maar overlay_frequency moet wel een geldige enum-waarde zijn).
   */
  visual_dna: z.object({
    audience_looks: z.array(z.enum(AUDIENCE_LOOKS)).default([]),
    settings: z.array(z.enum(SETTINGS)).default([]),
    moods: z.array(z.enum(MOODS)).default([]),
    color_focuses: z.array(z.enum(COLOR_FOCUSES)).default([]),
    styles_enabled: z.array(z.enum(VISUAL_STYLES)).default([]),
    overlay_frequency: z.enum(OVERLAY_FREQUENCIES).default('ai_decides'),
    must_include: z.array(z.string().max(120)).max(20).default([]),
    must_avoid: z.array(z.string().max(120)).max(20).default([]),
    brand_identity: z.string().max(500).optional(),
    example_overlays: z.array(z.string().max(60)).max(20).default([]),
  }).optional(),
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

  // ── Audience pipeline (auto-build) ──
  //
  // Semantiek:
  //  - use_lookalike=true  → ensureBranchAudiencePack: gebruik bestaand
  //    pakket als 'ready' én vers (<14d), anders bouw nu vers.
  //  - use_exclusion=true  → idem (zelfde pakket bevat beide audiences).
  //  - force_rebuild_audience=true → bouw alles opnieuw, ook bij vers
  //    bestaand pakket.
  //
  // Faalt het bouwen (geen credentials, te weinig seeds, Meta-rate-limit),
  // dan loggen we dat en sturen we de strategist op pad zonder lookalike.
  // De UI laat het in de "audiences"-veld terugkomen zodat de admin
  // direct ziet dat 'm wel gevraagd maar niet beschikbaar is.
  let lookalikeId: string | null = null;
  let exclusionId: string | null = null;
  let seedSize = 0;
  let audiencePack: LookalikeBuildResult | null = null;
  const primaryCountry = body.targeting_spec.countries[0];
  if (body.strategy_params.use_lookalike || body.strategy_params.use_exclusion) {
    seedSize = await countBranchLeads(body.branch, primaryCountry);
    if (seedSize < 100 && !body.strategy_params.force_rebuild_audience) {
      // Te weinig leads om überhaupt een LAL te kunnen seeden — sla
      // bouwen over en log richting UI.
      audiencePack = {
        ok: false,
        reason: 'insufficient_seed',
        seedSize,
        status: 'failed',
      };
    } else if (body.strategy_params.force_rebuild_audience) {
      audiencePack = await buildBranchAudiencePack(body.branch, primaryCountry, 0.01, { force: true });
    } else {
      audiencePack = await ensureBranchAudiencePack(body.branch, primaryCountry, 0.01);
    }
    if (audiencePack?.ok) {
      if (body.strategy_params.use_lookalike) lookalikeId = audiencePack.lookalikeAudienceId ?? null;
      if (body.strategy_params.use_exclusion) exclusionId = audiencePack.exclusionAudienceId ?? null;
      seedSize = audiencePack.seedSize ?? seedSize;
    } else if (audiencePack?.reason === 'lookalike_disabled') {
      // Master-kill staat aan — fall back op stille modus
      console.warn('[strategize] lookalike pipeline staat uit via AI_LOOKALIKE_ENABLED=false');
    } else if (audiencePack?.reason && audiencePack.reason !== 'insufficient_seed') {
      console.warn('[strategize] audience build/ensure faalde', audiencePack);
      // Probeer bestaand pakket alsnog te lezen — als build halverwege
      // crashte hebben we mogelijk wel een seed/exclusion liggen.
      const cached = await getBranchAudiencePack(body.branch, primaryCountry, 0.01);
      if (cached?.status === 'ready') {
        if (body.strategy_params.use_lookalike) lookalikeId = cached.lookalikeAudienceId ?? null;
        if (body.strategy_params.use_exclusion) exclusionId = cached.exclusionAudienceId ?? null;
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

  // ── Visueel DNA: gebruik body of val terug op branche-defaults ──
  const effectiveVisualDNA: VisualDNA = body.visual_dna
    ? {
        audience_looks: body.visual_dna.audience_looks,
        settings: body.visual_dna.settings,
        moods: body.visual_dna.moods,
        color_focuses: body.visual_dna.color_focuses,
        styles_enabled: body.visual_dna.styles_enabled,
        overlay_frequency: body.visual_dna.overlay_frequency,
        must_include: body.visual_dna.must_include,
        must_avoid: body.visual_dna.must_avoid,
        brand_identity: body.visual_dna.brand_identity,
        example_overlays: body.visual_dna.example_overlays,
      }
    : buildDefaultVisualDNA(body.branch);
  const dnaIssues = validateVisualDNA(effectiveVisualDNA);
  if (dnaIssues.length > 0) {
    // Niet hard fatal — laat de admin zien dat we naar defaults vallen.
    console.warn('[strategize] visual_dna validatie:', dnaIssues);
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
      visual_dna_json: effectiveVisualDNA,
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
      visual_dna: effectiveVisualDNA,
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
      // Detail-info voor UI: was het pakket vers gebouwd of hergebruikt?
      freshly_built: audiencePack?.freshlyBuilt ?? false,
      reused_existing: audiencePack?.reusedExisting ?? false,
      status: audiencePack?.status ?? (lookalikeId || exclusionId ? 'ready' : 'unknown'),
      build_reason: audiencePack?.ok ? null : audiencePack?.reason ?? null,
    },
  });
}
