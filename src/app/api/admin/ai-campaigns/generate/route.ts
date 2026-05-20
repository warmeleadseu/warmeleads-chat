/**
 * Genereer creative-varianten voor een eerder gestrategie'd brief.
 *
 * Vereist dat `/strategize` al gedraaid is (brief.strategy_plan + tree
 * van campagnes/adsets staat in de DB). Per ad set genereert deze
 * route `creatives_per_adset` copy-varianten op basis van de creative
 * brief van de strategist. Images worden NIET hier gegenereerd —
 * dat gaat via `/variants/[id]/generate-image` zodat de UI per kaart
 * progressief feedback krijgt.
 *
 * Backwards compat: als de brief GEEN strategy_plan heeft (oude flow),
 * valt de route terug op de klassieke `generateCopyVariants` met
 * `variant_count` totale varianten in één batch.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import {
  generateCopyVariants,
  generateVariantImage,
  generateVariantsForAdSet,
  judgeVariantPolicy,
  type AdSetCreativeContext,
  type Brief,
} from '@/lib/aiCreativeGenerator';
import { uploadAdImage } from '@/lib/metaMarketingApi';
import { isAiCampaignsEnabled, reserveOpenAIBudget } from '@/lib/aiCampaignBudget';
import type { ImageBrief, PlannedCreative } from '@/lib/aiCampaignStrategist';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  brief_id: z.string().uuid(),
  skip_images: z.boolean().default(true),  // default: copy first, image later via /variants/[id]/generate-image
  skip_judge: z.boolean().default(false),
});

interface AdsetRow {
  id: string;
  meta_campaign_row_id: string;
  name: string;
  strategy_type: string;
  targeting_summary: Record<string, unknown>;
}

interface CampaignRow {
  id: string;
  experiment_id: string;
  angle: string;
  rationale: string | null;
}

interface BriefRow {
  id: string;
  branch: string;
  target_audience: Record<string, unknown>;
  geographic_targeting: { countries: string[]; regions?: string[] };
  special_ad_category: 'NONE' | 'CREDIT' | 'EMPLOYMENT' | 'HOUSING' | 'ISSUES_ELECTIONS_POLITICS';
  variant_count: number;
  is_test_mode: boolean;
  strategy_plan: {
    campaigns: Array<{
      angle: string;
      adsets: Array<{
        strategy_type: string;
        creative_brief: {
          style: AdSetCreativeContext['style'];
          framework: AdSetCreativeContext['framework'];
          tone: string;
          hook: string;
          must_include?: string[];
          must_avoid?: string[];
        };
        targeting: Record<string, unknown>;
        creatives?: PlannedCreative[];
      }>;
    }>;
  } | null;
  strategy_params: { creatives_per_adset?: number } | null;
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

  const { data: briefData } = await supabase
    .from('ai_campaign_briefs')
    .select('*')
    .eq('id', body.brief_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!briefData) {
    return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 });
  }
  const brief = briefData as unknown as BriefRow;

  const { data: branchRow } = await supabase
    .from('branches')
    .select('slug, name')
    .eq('slug', brief.branch)
    .maybeSingle();

  const briefForGen: Brief = {
    id: brief.id,
    branch: brief.branch,
    branchName: branchRow?.name,
    targetAudience: brief.target_audience,
    geographicTargeting: brief.geographic_targeting,
    specialAdCategory: brief.special_ad_category,
    variantCount: brief.variant_count,
    isTestMode: brief.is_test_mode,
  };

  // OpenAI budget reserveren
  const estimate = brief.variant_count * 25 + 100; // copy + (optioneel) images
  const guard = await reserveOpenAIBudget(brief.branch, estimate);
  if (!guard.ok) {
    return NextResponse.json({ error: 'OpenAI-budget bereikt', guard }, { status: 402 });
  }

  // ── Tree ophalen (als strategist al heeft gedraaid) ──
  const { data: experiment } = await supabase
    .from('ai_campaign_experiments')
    .select('id')
    .eq('brief_id', brief.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let plannedAdsets: AdsetRow[] = [];
  let plannedCampaigns: CampaignRow[] = [];
  if (experiment) {
    // Order by created_at zodat we per-index kunnen matchen met de strategy_plan
    const { data: cmps } = await supabase
      .from('ai_campaign_meta_campaigns')
      .select('id, experiment_id, angle, rationale')
      .eq('experiment_id', experiment.id)
      .order('created_at', { ascending: true });
    plannedCampaigns = (cmps || []) as CampaignRow[];
    if (plannedCampaigns.length > 0) {
      const { data: ads } = await supabase
        .from('ai_campaign_meta_adsets')
        .select('id, meta_campaign_row_id, name, strategy_type, targeting_summary')
        .in('meta_campaign_row_id', plannedCampaigns.map(c => c.id))
        .order('created_at', { ascending: true });
      plannedAdsets = (ads || []) as AdsetRow[];
    }
  }

  const hasStrategy = brief.strategy_plan && plannedAdsets.length > 0;
  const insertedVariants: Array<{ id: string; meta_image_hash: string | null; image_url: string | null; meta_adset_row_id: string | null }> = [];

  if (hasStrategy && brief.strategy_plan) {
    // ── Nieuwe flow: per adset genereren via strategist-context ──
    const creativesPerAdset = brief.strategy_params?.creatives_per_adset || 3;

    // Index-based matching: strategist gaf campaigns in volgorde, wij hebben
    // ze ook in volgorde opgeslagen. Angle/strategy_type-string-match was
    // fragiel als de strategist toevallig duplicates produceerde.
    for (let ci = 0; ci < brief.strategy_plan.campaigns.length; ci++) {
      const campaignPlan = brief.strategy_plan.campaigns[ci];
      const cmpRow = plannedCampaigns[ci];
      if (!cmpRow) continue;
      const cmpAdsets = plannedAdsets.filter(a => a.meta_campaign_row_id === cmpRow.id);
      for (let ai = 0; ai < campaignPlan.adsets.length; ai++) {
        const adsetPlan = campaignPlan.adsets[ai];
        const adsetRow = cmpAdsets[ai];
        if (!adsetRow) continue;

        const targetingSpec = (adsetRow.targeting_summary || {}) as Record<string, unknown>;
        const audienceParts: string[] = [];
        if (targetingSpec.age_min || targetingSpec.age_max) {
          audienceParts.push(`leeftijd ${targetingSpec.age_min || '?'}-${targetingSpec.age_max || '?'}`);
        }
        if (Array.isArray(targetingSpec.interests) && targetingSpec.interests.length > 0) {
          audienceParts.push(`interesses: ${(targetingSpec.interests as Array<{ name?: string }>).map(i => i.name).filter(Boolean).join(', ')}`);
        }
        if (adsetPlan.strategy_type === 'lookalike') audienceParts.push('lookalike van onze bestaande leads');
        if (adsetPlan.strategy_type === 'broad') audienceParts.push('geen interest-targeting (broad)');

        const ctx: AdSetCreativeContext = {
          angle: campaignPlan.angle,
          rationale: undefined,
          strategy_type: adsetPlan.strategy_type,
          audience_summary: audienceParts.join('; ') || 'algemene doelgroep',
          style: adsetPlan.creative_brief.style,
          framework: adsetPlan.creative_brief.framework,
          tone: adsetPlan.creative_brief.tone,
          hook: adsetPlan.creative_brief.hook,
          must_include: adsetPlan.creative_brief.must_include,
          must_avoid: adsetPlan.creative_brief.must_avoid,
          creatives_per_adset: creativesPerAdset,
          // Per-creative image_briefs (uit strategist) — als die er zijn
          // gebruikt de generator ze als basis voor de image-prompt
          // i.p.v. de inline image_prompt-string.
          planned_creatives: adsetPlan.creatives && adsetPlan.creatives.length > 0
            ? adsetPlan.creatives
            : undefined,
        };

        let copyRes;
        try {
          copyRes = await generateVariantsForAdSet(briefForGen, ctx);
        } catch (e) {
          console.warn('[generate] adset copy failed', adsetRow.name, (e as Error).message);
          continue;
        }

        for (const v of copyRes.variants) {
          // Optional judge
          let judgeVerdict: 'safe' | 'risky' | 'block' | undefined;
          let judgeReason: string | undefined;
          if (!body.skip_judge && v.policy_warnings.length > 0) {
            try {
              const judged = await judgeVariantPolicy(briefForGen, v);
              judgeVerdict = judged.verdict;
              judgeReason = judged.reason;
            } catch (e) {
              judgeReason = `judge_failed: ${(e as Error).message}`;
            }
          }

          let imageHash: string | null = null;
          let imageUrl: string | null = null;
          if (!body.skip_images && judgeVerdict !== 'block') {
            try {
              const img = await generateVariantImage(briefForGen, brief.id, v.image_prompt);
              if (img) {
                const buf = Buffer.from(img.base64, 'base64');
                const up = await uploadAdImage(buf, `ai_${brief.id.slice(0, 8)}_${adsetRow.id.slice(0, 6)}.png`);
                imageHash = up.hash;
                imageUrl = up.url;
              }
            } catch (e) {
              console.warn('[generate] image inline failed', (e as Error).message);
            }
          }

          const status = judgeVerdict === 'block' ? 'failed' : 'draft';
          const imageBrief: ImageBrief | undefined = v.image_brief;
          const overlayUsed = !!(imageBrief?.overlay.enabled && imageBrief.overlay.text);
          const { data: row } = await supabase
            .from('ai_campaign_variants')
            .insert({
              brief_id: brief.id,
              experiment_id: experiment?.id,
              meta_adset_row_id: adsetRow.id,
              angle: campaignPlan.angle,
              tone: v.tone,
              headline: v.headline,
              primary_text: v.primary_text,
              description: v.description,
              cta: v.cta,
              image_prompt: v.image_prompt,
              image_brief_json: imageBrief || null,
              overlay_used: overlayUsed,
              overlay_text: overlayUsed ? imageBrief!.overlay.text : null,
              aspect_ratio: '1024x1536',
              creative_style: v.creative_style,
              framework: v.framework,
              meta_image_hash: imageHash,
              image_url: imageUrl,
              image_provider: imageHash ? 'gpt' : null,
              image_model: imageHash ? 'gpt-image-1' : null,
              status,
              policy_precheck: {
                regex_warnings: v.policy_warnings,
                judge_verdict: judgeVerdict ?? null,
                judge_reason: judgeReason ?? null,
              },
              generation: { model: 'gpt-4o-mini', adset_strategy: adsetPlan.strategy_type },
            })
            .select('id, meta_image_hash, image_url, meta_adset_row_id')
            .single();
          if (row) insertedVariants.push(row);
        }
      }
    }
  } else {
    // ── Legacy flow: één batch zonder strategist ──
    let copyRes;
    try {
      copyRes = await generateCopyVariants(briefForGen);
    } catch (e) {
      await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
      return NextResponse.json({ error: 'Copy-generatie mislukt', details: (e as Error).message }, { status: 502 });
    }
    if (copyRes.variants.length === 0) {
      await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
      return NextResponse.json({ error: 'Geen varianten gegenereerd' }, { status: 502 });
    }
    for (let i = 0; i < copyRes.variants.length; i++) {
      const v = copyRes.variants[i];
      let judgeVerdict: 'safe' | 'risky' | 'block' | undefined;
      let judgeReason: string | undefined;
      if (!body.skip_judge && v.policy_warnings.length > 0) {
        try {
          const judged = await judgeVariantPolicy(briefForGen, v);
          judgeVerdict = judged.verdict;
          judgeReason = judged.reason;
        } catch (e) {
          judgeReason = `judge_failed: ${(e as Error).message}`;
        }
      }
      let imageHash: string | null = null;
      let imageUrl: string | null = null;
      if (!body.skip_images && judgeVerdict !== 'block') {
        try {
          const img = await generateVariantImage(briefForGen, brief.id, v.image_prompt);
          if (img) {
            const buf = Buffer.from(img.base64, 'base64');
            const up = await uploadAdImage(buf, `ai_${brief.id.slice(0, 8)}_v${i + 1}.png`);
            imageHash = up.hash;
            imageUrl = up.url;
          }
        } catch (e) {
          console.warn('[generate] legacy image failed', (e as Error).message);
        }
      }
      const status = judgeVerdict === 'block' ? 'failed' : 'draft';
      const { data: row } = await supabase
        .from('ai_campaign_variants')
        .insert({
          brief_id: brief.id,
          experiment_id: experiment?.id,
          angle: v.angle,
          tone: v.tone,
          headline: v.headline,
          primary_text: v.primary_text,
          description: v.description,
          cta: v.cta,
          image_prompt: v.image_prompt,
          meta_image_hash: imageHash,
          image_url: imageUrl,
          image_provider: imageHash ? 'gpt' : null,
          image_model: imageHash ? 'gpt-image-1' : null,
          status,
          policy_precheck: {
            regex_warnings: v.policy_warnings,
            judge_verdict: judgeVerdict ?? null,
            judge_reason: judgeReason ?? null,
          },
          generation: { model: 'gpt-4o-mini' },
        })
        .select('id, meta_image_hash, image_url, meta_adset_row_id')
        .single();
      if (row) insertedVariants.push(row);
    }
  }

  if (insertedVariants.length === 0) {
    await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
    return NextResponse.json({ error: 'Alle varianten gefaald' }, { status: 502 });
  }

  await supabase.from('ai_campaign_briefs').update({ status: 'generated' }).eq('id', brief.id);

  const { data: variants } = await supabase
    .from('ai_campaign_variants')
    .select('*')
    .eq('brief_id', brief.id)
    .order('created_at');

  return NextResponse.json({
    ok: true,
    brief_id: brief.id,
    brief: { ...brief, status: 'generated' },
    variants: variants || [],
    used_strategy: hasStrategy,
  });
}
