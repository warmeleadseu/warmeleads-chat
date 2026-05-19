import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import {
  generateCopyVariants,
  generateVariantImage,
  judgeVariantPolicy,
  type Brief,
} from '@/lib/aiCreativeGenerator';
import { uploadAdImage } from '@/lib/metaMarketingApi';
import { isAiCampaignsEnabled, reserveOpenAIBudget } from '@/lib/aiCampaignBudget';
import { getBranchDemand } from '@/lib/aiCampaignDemand';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  branch: z.string().min(1),
  target_audience: z.record(z.string(), z.unknown()).default({}),
  geographic_targeting: z.object({
    countries: z.array(z.string()).min(1),
    regions: z.array(z.string()).optional(),
  }),
  target_cpl_cents: z.number().int().nonnegative().optional(),
  daily_budget_cents: z.number().int().min(100),
  max_total_budget_cents: z.number().int().min(100),
  lead_form_id: z.string().min(1),
  page_id: z.string().min(1),
  special_ad_category: z.enum(['NONE', 'CREDIT', 'EMPLOYMENT', 'HOUSING', 'ISSUES_ELECTIONS_POLITICS']).default('NONE'),
  is_test_mode: z.boolean().default(true),
  variant_count: z.number().int().min(1).max(8).default(4),
  skip_images: z.boolean().default(false),
  skip_judge: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  if (!(await isAiCampaignsEnabled())) {
    return NextResponse.json({ error: 'AI campaigns master switch staat uit (app_settings.ai_campaigns_enabled).' }, { status: 409 });
  }

  const parse = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parse.success) {
    return NextResponse.json({ error: 'Ongeldige input', details: parse.error.issues }, { status: 400 });
  }
  const body = parse.data;

  const supabase = createServerClient();

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
      error: 'Geen open klantcapaciteit voor deze branche; advertenties zouden geen klant vinden.',
      demand,
    }, { status: 409 });
  }

  // OpenAI budgetbescherming: gemiddeld <=15ct per variant (copy+image). Conservatief 25 cent.
  const estimateCents = body.variant_count * 25;
  const guard = await reserveOpenAIBudget(body.branch, estimateCents);
  if (!guard.ok) {
    return NextResponse.json({ error: 'OpenAI-budget bereikt', guard }, { status: 402 });
  }

  // ── Brief opslaan ──────────────────────────────────────────
  const { data: brief, error: briefErr } = await supabase
    .from('ai_campaign_briefs')
    .insert({
      branch: body.branch,
      status: 'draft',
      target_audience: body.target_audience,
      geographic_targeting: body.geographic_targeting,
      target_cpl_cents: body.target_cpl_cents ?? null,
      daily_budget_cents: body.daily_budget_cents,
      max_total_budget_cents: body.max_total_budget_cents,
      lead_form_id: body.lead_form_id,
      page_id: body.page_id,
      special_ad_category: body.special_ad_category,
      is_test_mode: body.is_test_mode,
      variant_count: body.variant_count,
      created_by: admin.id,
    })
    .select('*')
    .single();
  if (briefErr || !brief) {
    return NextResponse.json({ error: 'Kon brief niet opslaan', details: briefErr?.message }, { status: 500 });
  }

  const briefForGen: Brief = {
    id: brief.id,
    branch: body.branch,
    branchName: branchRow.name,
    targetAudience: body.target_audience,
    geographicTargeting: body.geographic_targeting,
    specialAdCategory: body.special_ad_category,
    variantCount: body.variant_count,
    isTestMode: body.is_test_mode,
  };

  let copyResult: Awaited<ReturnType<typeof generateCopyVariants>>;
  try {
    copyResult = await generateCopyVariants(briefForGen);
  } catch (e) {
    await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
    return NextResponse.json({ error: 'Copy-generatie mislukt', details: (e as Error).message }, { status: 502 });
  }

  if (copyResult.variants.length === 0) {
    await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
    return NextResponse.json({ error: 'Geen varianten gegenereerd', warnings: copyResult.warnings }, { status: 502 });
  }

  // ── Policy: regex-precheck en, indien warnings, LLM-judge per variant ──
  const insertedVariants: Array<{ id: string; meta_image_hash: string | null; image_url: string | null }> = [];
  for (let i = 0; i < copyResult.variants.length; i++) {
    const v = copyResult.variants[i];

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
          const uploaded = await uploadAdImage(buf, `ai_${brief.id.slice(0, 8)}_v${i + 1}.png`);
          imageHash = uploaded.hash;
          imageUrl = uploaded.url;
        }
      } catch (e) {
        console.warn('[ai-campaigns/generate] image failed', e);
      }
    }

    const status = judgeVerdict === 'block' ? 'failed' : 'draft';

    const { data: row, error: vErr } = await supabase
      .from('ai_campaign_variants')
      .insert({
        brief_id: brief.id,
        angle: v.angle,
        tone: v.tone,
        headline: v.headline,
        primary_text: v.primary_text,
        description: v.description,
        cta: v.cta,
        image_prompt: v.image_prompt,
        meta_image_hash: imageHash,
        image_url: imageUrl,
        status,
        policy_precheck: {
          regex_warnings: v.policy_warnings,
          judge_verdict: judgeVerdict ?? null,
          judge_reason: judgeReason ?? null,
        },
        generation: {
          model: 'gpt-4o-mini',
          temperature: 0.9,
        },
      })
      .select('id, meta_image_hash, image_url')
      .single();
    if (vErr || !row) {
      console.warn('[ai-campaigns/generate] variant insert failed', vErr?.message);
      continue;
    }
    insertedVariants.push(row);
  }

  if (insertedVariants.length === 0) {
    await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
    return NextResponse.json({ error: 'Alle varianten gefaald op policy of image-generatie' }, { status: 502 });
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
    text_cost_cents: copyResult.textCostCents,
    warnings: copyResult.warnings,
    demand,
  });
}
