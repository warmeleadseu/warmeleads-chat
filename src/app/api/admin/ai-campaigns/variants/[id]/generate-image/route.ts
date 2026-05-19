/**
 * Per-variant image-generatie endpoint.
 *
 * De Studio gebruikt eerst /generate met skip_images=true om binnen ~20s
 * tekstvarianten te tonen, en vuurt vervolgens N parallelle calls naar dit
 * endpoint af om beelden los op te bouwen. Per call duurt het ~30-90s
 * (GPT-Image-1) maar de gebruiker ziet ondertussen de copy en de overige
 * varianten al volledig in beeld.
 *
 * Idempotent: als er al een `meta_image_hash` op de variant staat, returnen
 * we de bestaande hash zonder nieuwe OpenAI-kosten.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { generateVariantImage, type Brief } from '@/lib/aiCreativeGenerator';
import { uploadAdImage } from '@/lib/metaMarketingApi';
import { isAiCampaignsEnabled, reserveOpenAIBudget } from '@/lib/aiCampaignBudget';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const { id: variantId } = await context.params;
  if (!variantId) return NextResponse.json({ error: 'variant_id ontbreekt' }, { status: 400 });

  if (!(await isAiCampaignsEnabled())) {
    return NextResponse.json({ error: 'AI campaigns master switch staat uit' }, { status: 409 });
  }

  const supabase = createServerClient();
  const { data: variant } = await supabase
    .from('ai_campaign_variants')
    .select('id, brief_id, status, image_prompt, image_url, meta_image_hash, policy_precheck')
    .eq('id', variantId)
    .maybeSingle();
  if (!variant) return NextResponse.json({ error: 'variant niet gevonden' }, { status: 404 });
  if (variant.status === 'failed') {
    return NextResponse.json({ error: 'variant is geblokkeerd door policy' }, { status: 409 });
  }
  if (variant.meta_image_hash && variant.image_url) {
    return NextResponse.json({
      ok: true,
      variant_id: variant.id,
      meta_image_hash: variant.meta_image_hash,
      image_url: variant.image_url,
      cached: true,
    });
  }
  if (!variant.image_prompt) {
    return NextResponse.json({ error: 'variant heeft geen image_prompt' }, { status: 400 });
  }

  const { data: brief } = await supabase
    .from('ai_campaign_briefs')
    .select('id, branch, target_audience, geographic_targeting, special_ad_category, variant_count, is_test_mode')
    .eq('id', variant.brief_id)
    .maybeSingle();
  if (!brief) return NextResponse.json({ error: 'brief niet gevonden' }, { status: 404 });

  // OpenAI-budgetreservering per image (~4 cent voor 1024×1024).
  const guard = await reserveOpenAIBudget(brief.branch, 5);
  if (!guard.ok) {
    return NextResponse.json({ error: 'OpenAI-budget bereikt', guard }, { status: 402 });
  }

  const { data: branchRow } = await supabase
    .from('branches')
    .select('name')
    .eq('slug', brief.branch)
    .maybeSingle();

  const briefForGen: Brief = {
    id: brief.id,
    branch: brief.branch,
    branchName: branchRow?.name,
    targetAudience: brief.target_audience as Record<string, unknown>,
    geographicTargeting: brief.geographic_targeting as { countries: string[]; regions?: string[] },
    specialAdCategory: brief.special_ad_category as Brief['specialAdCategory'],
    variantCount: brief.variant_count as number,
    isTestMode: brief.is_test_mode as boolean,
  };

  try {
    const img = await generateVariantImage(briefForGen, variant.id, variant.image_prompt);
    if (!img) return NextResponse.json({ error: 'image generation gaf geen resultaat' }, { status: 502 });

    const buf = Buffer.from(img.base64, 'base64');
    const uploaded = await uploadAdImage(buf, `ai_${brief.id.slice(0, 8)}_${variant.id.slice(0, 8)}.png`);

    await supabase
      .from('ai_campaign_variants')
      .update({ meta_image_hash: uploaded.hash, image_url: uploaded.url })
      .eq('id', variant.id);

    return NextResponse.json({
      ok: true,
      variant_id: variant.id,
      meta_image_hash: uploaded.hash,
      image_url: uploaded.url,
      cost_cents: img.costCents,
    });
  } catch (e) {
    const msg = (e as Error).message || 'unknown';
    return NextResponse.json({ error: 'image generation failed', details: msg }, { status: 502 });
  }
}
