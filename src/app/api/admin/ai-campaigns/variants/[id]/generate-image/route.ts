/**
 * Per-variant image-generatie endpoint — multi-provider image engine.
 *
 * Twee modi:
 *  1. Initiële generatie (default): de Studio doet eerst `/generate` met
 *     skip_images=true om binnen ~20s tekstvarianten te tonen, en vuurt
 *     vervolgens N parallelle calls naar dit endpoint af. Idempotent:
 *     als er al een `meta_image_hash` op de variant staat, returnen we
 *     die zonder nieuwe provider-kosten.
 *  2. Regeneratie (`{ regenerate: true, override?: {...} }`): volgt
 *     "change-only-X" best practice. Met `override` kan de admin precies
 *     één variabele wijzigen (overlay-text, scene, style, mood) zonder
 *     de rest van de brief te verliezen. Verhoogt `image_regeneration_count`
 *     voor audit en rate-limit.
 *
 * Provider-keuze (nieuw):
 *  - `body.provider` overrult alles. Geldige waardes:
 *    `auto | flux | ideogram | recraft | imagen | pexels_overlay | gpt`.
 *  - Geen provider in body → val terug op `ai_campaign_briefs.preferred_image_provider`.
 *  - Beide leeg → smart auto-routing op `image_brief.style` + `overlay.enabled`.
 *
 * Aspect ratio default = 1024x1536 (4:5 mobile-feed). Caller kan via
 * `aspect_ratio` overschrijven naar 1024x1024 of 1536x1024 voor specifieke
 * plaatsingen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import {
  buildImagePromptFromBrief,
  IMAGE_SIZES,
  type ImageSize,
} from '@/lib/aiCreativeGenerator';
import type { ImageBrief } from '@/lib/aiCampaignStrategist';
import { uploadAdImage } from '@/lib/metaMarketingApi';
import { isAiCampaignsEnabled, reserveOpenAIBudget } from '@/lib/aiCampaignBudget';
import {
  generateImage,
  estimateProviderCostCents,
  PROVIDER_IDS,
  type ProviderId,
} from '@/lib/imageProviders';

export const runtime = 'nodejs';
export const maxDuration = 180;

/**
 * Max regeneraties per variant per request-cyclus. Voorkomt dat
 * een admin per ongeluk 50x op een knop ramt en zo budget verbrandt.
 * Bij overschrijden blokkeren we met 429.
 */
const MAX_REGENERATIONS_PER_VARIANT = 8;

function parseProviderId(raw: unknown): ProviderId | null {
  if (typeof raw !== 'string') return null;
  return (PROVIDER_IDS as readonly string[]).includes(raw) ? (raw as ProviderId) : null;
}

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

  // Optionele body. Zonder body = initiële generatie met auto-routing.
  let body: {
    regenerate?: boolean;
    override?: Partial<ImageBrief> & { overlay?: Partial<ImageBrief['overlay']> };
    aspect_ratio?: ImageSize;
    provider?: string;
  } = {};
  try {
    const raw = await request.text();
    if (raw && raw.trim().length > 0) body = JSON.parse(raw);
  } catch {
    // ignore: lege body of geen JSON => default initial-mode
  }

  const supabase = createServerClient();
  const { data: variant } = await supabase
    .from('ai_campaign_variants')
    .select('id, brief_id, status, image_prompt, image_url, meta_image_hash, policy_precheck, image_brief_json, image_regeneration_count, overlay_used, overlay_text, aspect_ratio, image_provider, image_model')
    .eq('id', variantId)
    .maybeSingle();
  if (!variant) return NextResponse.json({ error: 'variant niet gevonden' }, { status: 404 });
  if (variant.status === 'failed') {
    return NextResponse.json({ error: 'variant is geblokkeerd door policy' }, { status: 409 });
  }

  const isRegenerate = !!body.regenerate;
  const currentRegenCount = (variant.image_regeneration_count as number) || 0;
  if (isRegenerate && currentRegenCount >= MAX_REGENERATIONS_PER_VARIANT) {
    return NextResponse.json({
      error: `Max ${MAX_REGENERATIONS_PER_VARIANT} regeneraties bereikt voor deze variant.`,
      regeneration_count: currentRegenCount,
    }, { status: 429 });
  }

  // Initial-mode + reeds gegenereerd = serveer cached.
  if (!isRegenerate && variant.meta_image_hash && variant.image_url) {
    return NextResponse.json({
      ok: true,
      variant_id: variant.id,
      meta_image_hash: variant.meta_image_hash,
      image_url: variant.image_url,
      image_provider: variant.image_provider,
      image_model: variant.image_model,
      cached: true,
    });
  }

  const { data: brief } = await supabase
    .from('ai_campaign_briefs')
    .select('id, branch, target_audience, geographic_targeting, special_ad_category, variant_count, is_test_mode, preferred_image_provider')
    .eq('id', variant.brief_id)
    .maybeSingle();
  if (!brief) return NextResponse.json({ error: 'brief niet gevonden' }, { status: 404 });

  // Provider-resolve: body > brief.preferred > auto. Geeft de selector
  // straks een hint die hij respecteert tenzij credentials ontbreken.
  const requestedProvider: ProviderId =
    parseProviderId(body.provider) ||
    parseProviderId(brief.preferred_image_provider) ||
    'auto';

  // Aspect ratio: client kan overrulen, anders default mobile-first 4:5.
  const requestedSize: ImageSize | undefined = body.aspect_ratio
    && (IMAGE_SIZES as readonly string[]).includes(body.aspect_ratio)
    ? body.aspect_ratio
    : undefined;
  const size: ImageSize = requestedSize || ((variant.aspect_ratio as ImageSize) || '1024x1536');

  // Provider-aware budget-reservering. Pexels = 0 (noop), Recraft = 8¢, etc.
  // We rekenen pessimistisch zodat we nooit underflow op rekening lopen.
  const estCost = Math.max(1, estimateProviderCostCents(requestedProvider, size));
  const guard = await reserveOpenAIBudget(brief.branch, estCost);
  if (!guard.ok) {
    return NextResponse.json({ error: 'OpenAI/image-budget bereikt', guard }, { status: 402 });
  }

  const { data: branchRow } = await supabase
    .from('branches')
    .select('name')
    .eq('slug', brief.branch)
    .maybeSingle();

  // Bepaal de te gebruiken image-prompt:
  //  - Bij regeneratie + override + bestaande image_brief: pas override
  //    toe op de brief en bouw nieuwe prompt (alle andere velden blijven
  //    identiek = "change only X" best practice).
  //  - Zonder override: gebruik de bestaande variant.image_prompt.
  let promptToUse = variant.image_prompt as string;
  let effectiveBrief: ImageBrief | null = (variant.image_brief_json as ImageBrief | null) || null;

  if (isRegenerate && body.override && effectiveBrief) {
    effectiveBrief = mergeOverride(effectiveBrief, body.override);
    promptToUse = buildImagePromptFromBrief(
      effectiveBrief.subject,
      effectiveBrief.style,
      branchRow?.name,
      effectiveBrief,
    );
  } else if (!promptToUse && effectiveBrief) {
    // Pathologisch: brief aanwezig maar geen rendered prompt. Bouw 'm.
    promptToUse = buildImagePromptFromBrief(
      effectiveBrief.subject,
      effectiveBrief.style,
      branchRow?.name,
      effectiveBrief,
    );
  }

  if (!promptToUse) {
    return NextResponse.json({ error: 'variant heeft geen image_prompt en geen image_brief' }, { status: 400 });
  }

  // Strategist hint = `preferred_provider` op het image_brief (indien gezet).
  const strategistHint = parseProviderId((effectiveBrief as ImageBrief & { preferred_provider?: string } | null)?.preferred_provider);

  // Style + overlay drijven auto-routing. Default-style = 'lifestyle'
  // voor legacy varianten zonder image_brief.
  const routingStyle = effectiveBrief?.style || 'lifestyle';
  const routingOverlay = !!effectiveBrief?.overlay?.enabled;

  try {
    const img = await generateImage({
      prompt: promptToUse,
      size,
      branch: brief.branch,
      branchName: branchRow?.name,
      briefId: brief.id,
      variantId: variant.id,
      imageBrief: effectiveBrief,
      override: requestedProvider,
      strategistHint,
      style: routingStyle,
      overlayEnabled: routingOverlay,
    });

    const uploaded = await uploadAdImage(
      img.buffer,
      `ai_${brief.id.slice(0, 8)}_${variant.id.slice(0, 8)}_${Date.now()}.png`,
    );

    const overlayUsed = !!(effectiveBrief?.overlay.enabled && effectiveBrief.overlay.text);
    const overlayText = overlayUsed ? effectiveBrief!.overlay.text : null;
    const newRegenCount = isRegenerate ? currentRegenCount + 1 : currentRegenCount;

    await supabase
      .from('ai_campaign_variants')
      .update({
        meta_image_hash: uploaded.hash,
        image_url: uploaded.url,
        image_prompt: promptToUse,
        image_brief_json: effectiveBrief,
        overlay_used: overlayUsed,
        overlay_text: overlayText,
        aspect_ratio: size,
        image_regeneration_count: newRegenCount,
        image_provider: img.decision.providerId,
        image_model: img.decision.model,
      })
      .eq('id', variant.id);

    return NextResponse.json({
      ok: true,
      variant_id: variant.id,
      meta_image_hash: uploaded.hash,
      image_url: uploaded.url,
      cost_cents: img.costCents,
      overlay_used: overlayUsed,
      overlay_text: overlayText,
      aspect_ratio: size,
      regeneration_count: newRegenCount,
      image_provider: img.decision.providerId,
      image_model: img.decision.model,
      routing_reason: img.decision.reason,
    });
  } catch (e) {
    const msg = (e as Error).message || 'unknown';
    return NextResponse.json({ error: 'image generation failed', details: msg }, { status: 502 });
  }
}

/**
 * Pas een partial-override toe op een ImageBrief. We mergen overlay
 * apart zodat een caller bv. alleen `overlay.text` kan wijzigen zonder
 * `enabled`/`placement`/`rationale` te verliezen.
 */
function mergeOverride(
  base: ImageBrief,
  override: Partial<ImageBrief> & { overlay?: Partial<ImageBrief['overlay']> },
): ImageBrief {
  const merged: ImageBrief = { ...base, ...override, overlay: { ...base.overlay } };
  if (override.overlay) {
    merged.overlay = { ...base.overlay, ...override.overlay };
    // Als enabled niet expliciet meegegeven en text wel: assume enabled=true
    if (override.overlay.text && override.overlay.enabled === undefined) {
      merged.overlay.enabled = true;
    }
  }
  return merged;
}
