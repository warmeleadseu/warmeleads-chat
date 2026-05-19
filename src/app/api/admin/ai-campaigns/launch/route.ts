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
} from '@/lib/metaMarketingApi';
import { isAiCampaignsEnabled, reserveBranchBudget } from '@/lib/aiCampaignBudget';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  brief_id: z.string().uuid(),
  go_live: z.boolean().default(false),
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

  const { data: brief } = await supabase
    .from('ai_campaign_briefs')
    .select('*')
    .eq('id', body.brief_id)
    .maybeSingle();
  if (!brief) return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 });
  if (brief.status === 'killed') return NextResponse.json({ error: 'Brief is gekild; resume eerst.' }, { status: 409 });

  // ── Idempotency: bestaat al een experiment voor deze brief? ──
  const { data: existingExp } = await supabase
    .from('ai_campaign_experiments')
    .select('*')
    .eq('brief_id', brief.id)
    .maybeSingle();
  if (existingExp) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      experiment: existingExp,
    });
  }

  const { data: variants } = await supabase
    .from('ai_campaign_variants')
    .select('*')
    .eq('brief_id', brief.id)
    .eq('status', 'draft')
    .order('created_at');
  if (!variants || variants.length === 0) {
    return NextResponse.json({ error: 'Geen draft-varianten om te lanceren' }, { status: 409 });
  }
  const variantsWithImages = variants.filter(v => v.meta_image_hash);
  if (variantsWithImages.length === 0) {
    return NextResponse.json({ error: 'Geen varianten met geüploade Meta image_hash' }, { status: 409 });
  }

  // ── Budget reserveren (alleen bij echte launch) ──
  const initialStatus: 'PAUSED' | 'ACTIVE' = body.go_live && !brief.is_test_mode ? 'ACTIVE' : 'PAUSED';
  if (initialStatus === 'ACTIVE') {
    const reserve = await reserveBranchBudget(brief.branch, brief.daily_budget_cents);
    if (!reserve.ok) {
      return NextResponse.json({ error: 'Branche-budget bereikt of niet geconfigureerd', reserve }, { status: 402 });
    }
  }

  const naming = `AIwl-${brief.branch}-${brief.id.slice(0, 8)}`;

  // ── Meta: 1 campaign + 1 adset met dynamic-style multiple ads ──
  let campaignId: string;
  let adsetId: string;
  try {
    const campaign = await createCampaign({
      name: `${naming}-CMP`,
      objective: 'OUTCOME_LEADS',
      specialAdCategory: brief.special_ad_category,
      status: 'PAUSED',
    });
    campaignId = campaign.id;

    const startTime = brief.is_test_mode
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : new Date().toISOString();

    const adset = await createAdSet({
      campaignId,
      name: `${naming}-AS`,
      pageId: brief.page_id,
      dailyBudgetCents: brief.daily_budget_cents,
      geo: {
        countries: brief.geographic_targeting.countries || ['NL'],
      },
      status: 'PAUSED',
      startTime,
    });
    adsetId = adset.id;
  } catch (e) {
    await supabase.from('ai_campaign_briefs').update({ status: 'failed' }).eq('id', brief.id);
    return NextResponse.json({ error: 'Meta campaign/adset aanmaken faalde', details: (e as Error).message }, { status: 502 });
  }

  // ── Experiment-rij vastleggen (vóór ads zodat we tracebaarheid hebben) ──
  const { data: experiment, error: expErr } = await supabase
    .from('ai_campaign_experiments')
    .insert({
      brief_id: brief.id,
      meta_campaign_id: campaignId,
      meta_adset_id: adsetId,
      phase: 'pending',
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (expErr || !experiment) {
    return NextResponse.json({ error: 'Kon experiment niet opslaan', details: expErr?.message }, { status: 500 });
  }

  // ── Per variant: creative + ad ──
  let createdAds = 0;
  const errors: string[] = [];
  for (const v of variantsWithImages) {
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
      const ad = await createAd({
        name: `${naming}-AD-${v.id.slice(0, 6)}`,
        adsetId,
        creativeId: creative.id,
        status: 'PAUSED',
      });
      await supabase
        .from('ai_campaign_variants')
        .update({
          experiment_id: experiment.id,
          meta_creative_id: creative.id,
          meta_ad_id: ad.id,
          status: 'paused',
        })
        .eq('id', v.id);
      createdAds++;
    } catch (e) {
      errors.push(`${v.id.slice(0, 8)}: ${(e as Error).message}`);
      await supabase
        .from('ai_campaign_variants')
        .update({ status: 'failed' })
        .eq('id', v.id);
    }
  }

  if (createdAds === 0) {
    await supabase
      .from('ai_campaign_experiments')
      .update({ phase: 'killed', ended_at: new Date().toISOString(), stop_reason: 'no_ads_created' })
      .eq('id', experiment.id);
    return NextResponse.json({ error: 'Geen ads aangemaakt', errors }, { status: 502 });
  }

  // ── Optioneel direct ACTIVE (alleen non-test + go_live=true) ──
  if (initialStatus === 'ACTIVE') {
    try {
      await setEntityStatus(adsetId, 'ACTIVE');
      await setEntityStatus(campaignId, 'ACTIVE');
      await supabase
        .from('ai_campaign_variants')
        .update({ status: 'live' })
        .eq('experiment_id', experiment.id)
        .eq('status', 'paused');
      await supabase
        .from('ai_campaign_experiments')
        .update({ phase: 'running' })
        .eq('id', experiment.id);
    } catch (e) {
      errors.push(`activate_failed: ${(e as Error).message}`);
    }
  }

  await supabase.from('ai_campaign_briefs').update({ status: 'launched' }).eq('id', brief.id);

  await supabase.from('ai_campaign_decisions').insert({
    experiment_id: experiment.id,
    action: 'launch',
    reason: initialStatus === 'ACTIVE' ? 'go_live_immediate' : 'paused_for_review',
    metrics_snapshot: { created_ads: createdAds, errors },
    dry_run: false,
  });

  const { data: refreshedExp } = await supabase
    .from('ai_campaign_experiments')
    .select('*')
    .eq('id', experiment.id)
    .single();

  return NextResponse.json({
    ok: true,
    experiment: refreshedExp,
    created_ads: createdAds,
    initial_status: initialStatus,
    errors,
  });
}
