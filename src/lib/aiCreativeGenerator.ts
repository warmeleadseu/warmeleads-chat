/**
 * AI-creative generator: maakt {variantCount} unieke advertenties voor één brief.
 *
 * Flow:
 * 1. Prompt → GPT-4o-mini met response_format json_schema → varianten (copy+image_prompt).
 * 2. Regex policy-precheck (snel, gratis).
 * 3. Optional LLM-judge (gpt-4o-mini) voor twijfelgevallen.
 * 4. Image generation via gpt-image-1 (base64) per variant.
 *
 * Geen Meta-writes hier; die zitten in `metaMarketingApi.ts`.
 */
import { z } from 'zod';
import {
  estimateImageCostCents,
  estimateTextCostCents,
  getOpenAIClient,
  logOpenAIUsage,
  withOpenAIRetry,
  type SupportedTextModel,
} from '@/lib/openaiClient';
import type { ImageBrief } from '@/lib/aiCampaignStrategist';
import { type VisualStyle } from '@/lib/aiVisualDNA';

export interface Brief {
  id: string;
  branch: string;
  branchName?: string;
  targetAudience: Record<string, unknown>;
  geographicTargeting: { countries: string[]; regions?: string[] };
  specialAdCategory: 'NONE' | 'CREDIT' | 'EMPLOYMENT' | 'HOUSING' | 'ISSUES_ELECTIONS_POLITICS';
  variantCount: number;
  isTestMode?: boolean;
}

/**
 * Compacte input voor per-adset creative-generatie. Komt rechtstreeks
 * uit een CampaignStrategy-rij (zie [aiCampaignStrategist.ts](src/lib/aiCampaignStrategist.ts)).
 */
export interface AdSetCreativeContext {
  angle: string;                                  // bv. "ROI/besparing"
  rationale?: string;                              // waarom deze angle
  strategy_type: string;                            // broad / interest / lookalike / ...
  audience_summary: string;                         // korte beschrijving voor wie deze ad set draait
  style: VisualStyle;
  framework: 'PAS' | 'AIDA' | 'BAB' | 'FAB' | '4U';
  tone: string;                                     // bv. "warm en feitelijk"
  hook: string;                                     // openingszin
  must_include?: string[];
  must_avoid?: string[];
  creatives_per_adset: number;                      // hoeveel varianten genereren binnen deze ad set
  /**
   * Per-creative image-briefs (uit de strategist). Optioneel; bij
   * aanwezigheid gebruiken we deze als bron voor de image-prompt en
   * laten we de copy-LLM alleen tekst genereren.
   */
  planned_creatives?: Array<{
    label: string;
    headline_hook: string;
    image_brief: ImageBrief;
  }>;
}

export interface GeneratedVariant {
  angle: string;
  tone: string;
  headline: string;
  primary_text: string;
  description: string;
  cta: 'LEARN_MORE' | 'SIGN_UP' | 'GET_QUOTE' | 'APPLY_NOW' | 'CONTACT_US' | 'SUBSCRIBE';
  image_prompt: string;
  policy_warnings: string[];
  judge_verdict?: 'safe' | 'risky' | 'block';
  judge_reason?: string;
  framework?: 'PAS' | 'AIDA' | 'BAB' | 'FAB' | '4U';
  creative_style?: VisualStyle;
  /** Volledig image-concept van de strategist (indien beschikbaar). */
  image_brief?: ImageBrief;
}

export interface GenerationResult {
  variants: GeneratedVariant[];
  warnings: string[];
  textCostCents: number;
}

export interface ImageGenerationResult {
  base64: string;
  mimeType: string;
  costCents: number;
}

const VariantSchema = z.object({
  angle: z.string().min(3).max(80),
  tone: z.string().min(3).max(40),
  headline: z.string().min(5).max(40),
  primary_text: z.string().min(20).max(420),
  description: z.string().min(5).max(120),
  cta: z.enum(['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'APPLY_NOW', 'CONTACT_US', 'SUBSCRIBE']),
  image_prompt: z.string().min(20).max(400),
});

const VariantsResponseSchema = z.object({
  variants: z.array(VariantSchema).min(1),
});

// ── Regex-precheck (snel) ─────────────────────────────────────
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bgegarandeerd\b/i, reason: 'absolute_guarantee' },
  { pattern: /\b100\s*%\s*(gratis|gegarandeerd)\b/i, reason: 'absolute_guarantee' },
  { pattern: /\beerste\b.*\bplaats\b/i, reason: 'superlative_unverified' },
  { pattern: /\b(jij|je|jou)\b.*\b(schulden|werkloos|ziek|diabetes|kanker|depressie)\b/i, reason: 'personal_attribute_health_or_finance' },
  { pattern: /\b(diabetes|kanker|depressie|hiv|aids|psoriasis|alzheimer)\b/i, reason: 'health_condition_attribute' },
  { pattern: /\b(islamitisch|moslim|christelijk|joods|hindoe)\b/i, reason: 'religion_attribute' },
  { pattern: /\b(gay|lesbisch|homoseksueel|biseksueel|transgender)\b/i, reason: 'sexual_orientation_attribute' },
  { pattern: /\b(klik\s*hier|klik\s*nu)\b/i, reason: 'clickbait_phrase' },
  { pattern: /\b(weight\s*loss|afvallen|kilo's\s*kwijt)\b/i, reason: 'before_after_weight' },
];

function regexPolicyCheck(text: string): string[] {
  const warnings: string[] = [];
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) warnings.push(reason);
  }
  return warnings;
}

function policyCheckVariant(v: GeneratedVariant): string[] {
  const combined = [v.headline, v.primary_text, v.description, v.image_prompt].join('\n');
  return regexPolicyCheck(combined);
}

// ── Prompt-building ──────────────────────────────────────────
function buildSystemPrompt(brief: Brief): string {
  const branchLabel = brief.branchName || brief.branch;
  const countries = brief.geographicTargeting.countries.join(', ');
  const targetSummary = Object.entries(brief.targetAudience)
    .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');
  const formQuestionsCount =
    typeof (brief.targetAudience as { form_questions_count?: number | null }).form_questions_count === 'number'
      ? (brief.targetAudience as { form_questions_count?: number }).form_questions_count
      : null;

  return [
    `Je bent een senior copywriter voor Meta Lead Ads bij WarmeLeads — een leadgeneratie-bureau`,
    `dat gekwalificeerde leads verkoopt aan installateurs/aannemers in Nederland en België.`,
    '',
    `Branche: ${branchLabel}.`,
    `Doelgebied: ${countries}.`,
    `Doelgroep:\n${targetSummary || '- (niet gespecificeerd)'}`,
    '',
    `Belangrijke context over hoe deze ads gaan werken:`,
    `- De advertentie heeft GEEN landingspagina — de gebruiker klikt op het Meta Lead Form`,
    `  en vult dat formulier IN op Meta zelf.`,
    `- Het formulier vraagt om NAW + ${formQuestionsCount ?? 'enkele'} kwalificerende vragen`,
    `  (eigenaar woning, intentie, budget, tijdvenster). Mensen die het formulier afmaken zijn dus`,
    `  al pre-gekwalificeerd. Je hoeft mensen NIET te overtuigen om te kopen — alleen om het`,
    `  formulier in te vullen voor een vrijblijvende offerte/check.`,
    `- WarmeLeads verkoopt deze leads vervolgens door, dus optimaliseer voor "veel ingevulde`,
    `  formulieren tegen lage CPL", niet voor maximale claims.`,
    '',
    `Schrijfregels:`,
    `- Helder Nederlands (geen anglicismen behalve veelgebruikte termen).`,
    `- Maak ${brief.variantCount} unieke varianten met duidelijk verschillende angles`,
    `  (bv. besparing, comfort, urgentie, social-proof, expertise, FOMO).`,
    `- Headline ≤ 40 tekens; primary_text 80–420 tekens; description ≤ 120 tekens.`,
    `- CTA: gebruik bij voorkeur GET_QUOTE of LEARN_MORE — past bij vrijblijvende lead-flow.`,
    `- Belofte aanpassen op de werkelijkheid: "ontvang een vrijblijvende offerte" / "check je`,
    `  besparing in 2 minuten" — NIET "krijg nu gratis…" of "100% besparing gegarandeerd".`,
    `- Roep de kwalificerende criteria subtiel op zodat onder-gekwalificeerden zelf afhaken`,
    `  (bv. impliceer "voor woningeigenaren", "minimum dakoppervlak X m²" als relevant) —`,
    `  dat verhoogt de kwaliteit van de ingevulde formulieren.`,
    '',
    `Meta Advertising Standards:`,
    `- Geen absolute beloftes ("gegarandeerd", "100%").`,
    `- Geen "jij/je/jou"+gevoelig attribuut (gezondheid, financieel, religie, geaardheid).`,
    `- Geen vóór/na lichaamsclaims, geen clickbait ("klik nu!").`,
    `- image_prompt: fotorealistische scene zonder tekst, zonder herkenbare gezichten,`,
    `  zonder logo's; max 400 tekens.`,
    brief.specialAdCategory !== 'NONE'
      ? `- LET OP: special_ad_category = ${brief.specialAdCategory}. Geen demografische targeting in copy; vermijd persoonlijke attributen.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUserPrompt(brief: Brief): string {
  return [
    `Genereer ${brief.variantCount} advertentievarianten als JSON (schema volgens response_format).`,
    `Elke variant gebruikt een andere "angle".`,
    `Geef per variant: angle, tone, headline, primary_text, description, cta, image_prompt.`,
  ].join('\n');
}

// ── Public: genereer varianten ────────────────────────────────
export async function generateCopyVariants(brief: Brief): Promise<GenerationResult> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      variants: [],
      warnings: ['openai_not_configured'],
      textCostCents: 0,
    };
  }

  const model: SupportedTextModel = 'gpt-4o-mini';
  const systemPrompt = buildSystemPrompt(brief);
  const userPrompt = buildUserPrompt(brief);

  const completion = await withOpenAIRetry(() =>
    client.chat.completions.create({
      model,
      temperature: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ad_variants',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['variants'],
            properties: {
              variants: {
                type: 'array',
                minItems: brief.variantCount,
                maxItems: brief.variantCount,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['angle', 'tone', 'headline', 'primary_text', 'description', 'cta', 'image_prompt'],
                  properties: {
                    angle: { type: 'string' },
                    tone: { type: 'string' },
                    headline: { type: 'string' },
                    primary_text: { type: 'string' },
                    description: { type: 'string' },
                    cta: { type: 'string', enum: ['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'APPLY_NOW', 'CONTACT_US', 'SUBSCRIBE'] },
                    image_prompt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    }),
  );

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error('OpenAI gaf geen content terug');

  let parsed: { variants: GeneratedVariant[] };
  try {
    const json = JSON.parse(raw);
    parsed = VariantsResponseSchema.parse(json) as { variants: GeneratedVariant[] };
  } catch (e) {
    throw new Error(`Variant-JSON ongeldig: ${(e as Error).message}`);
  }

  const usage = completion.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const textCostCents = estimateTextCostCents(model, inputTokens, outputTokens);

  await logOpenAIUsage({
    briefId: brief.id,
    branch: brief.branch,
    kind: 'copy',
    model,
    costCents: textCostCents,
    inputTokens,
    outputTokens,
    metadata: { variantCount: brief.variantCount },
  });

  const variants: GeneratedVariant[] = [];
  for (const v of parsed.variants) {
    const policyWarnings = policyCheckVariant(v);
    variants.push({ ...v, policy_warnings: policyWarnings });
  }

  return { variants, warnings: [], textCostCents };
}

// ── Optional LLM-judge ────────────────────────────────────────
export async function judgeVariantPolicy(brief: Brief, variant: GeneratedVariant): Promise<{
  verdict: 'safe' | 'risky' | 'block';
  reason: string;
  costCents: number;
}> {
  const client = getOpenAIClient();
  if (!client) return { verdict: 'safe', reason: 'judge_disabled', costCents: 0 };

  const model: SupportedTextModel = 'gpt-4o-mini';
  const completion = await withOpenAIRetry(() =>
    client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Je beoordeelt of een Facebook/Instagram advertentie voldoet aan Meta Advertising Standards. ' +
            'Antwoord uitsluitend in JSON: {"verdict":"safe|risky|block","reason":"…"} ' +
            'Block = duidelijke schending (gezondheid, geld, religie, geaardheid attribuut, voor/na, absolute beloftes). ' +
            'Risky = grensgeval. Safe = oké.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            branch: brief.branch,
            headline: variant.headline,
            primary_text: variant.primary_text,
            description: variant.description,
            image_prompt: variant.image_prompt,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'policy_judge',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['verdict', 'reason'],
            properties: {
              verdict: { type: 'string', enum: ['safe', 'risky', 'block'] },
              reason: { type: 'string' },
            },
          },
        },
      },
    }),
  );
  const raw = completion.choices?.[0]?.message?.content || '{}';
  let parsed: { verdict: 'safe' | 'risky' | 'block'; reason: string } = { verdict: 'safe', reason: '' };
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* fallback to safe */
  }
  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const costCents = estimateTextCostCents(model, inputTokens, outputTokens);

  await logOpenAIUsage({
    briefId: brief.id,
    branch: brief.branch,
    kind: 'judge',
    model,
    costCents,
    inputTokens,
    outputTokens,
    metadata: { verdict: parsed.verdict },
  });

  return { ...parsed, costCents };
}

// ── Image-style cinematic prompts ────────────────────────────
/**
 * Per stijl een vast "directing"-blok dat de beeldkwaliteit substantieel
 * omhoog brengt. De eerste 5 stijlen zijn photorealistisch zonder
 * on-image tekst. De laatste 5 (overlay-vriendelijk) zijn ontworpen om
 * een korte CAPS-overlay te dragen — voor scroll-stop-effect op mobile feed.
 */
export const IMAGE_STYLE_DIRECTION: Record<VisualStyle, string> = {
  lifestyle:
    'Cinematic lifestyle photography, shot on 35mm with a 50mm prime lens, f/2.0. Rule-of-thirds composition, warm golden-hour light, shallow depth of field, natural skin tones, ambient interior light. Subject framed at eye level with leading lines into the scene. Authentic candid feel, no posed studio look.',
  product_closeup:
    'Premium product photography, hero close-up, 100mm macro lens. Soft studio key light from upper-left, subtle rim-light, clean uncluttered background in warm neutral tone, macro detail visible, slight bokeh. Magazine-cover quality.',
  emotional:
    'Emotive documentary photography, shot on 50mm with soft natural window light. Muted earth-tone palette, subtle film grain for warmth. Convey safety, calm and family through environment, hands, gestures and props — never faces. National Geographic style restraint.',
  social_proof:
    'Editorial real-estate photography style, 24mm wide lens, slight overcast diffused light. Modern Dutch/Belgian residential street or suburban home from medium-wide angle with neighborhood context, no people. Honest realism, not heroic.',
  infographic:
    'High-end editorial infographic illustration. Clean isometric or flat composition, restrained palette of three brand-aligned colors, subtle gradients, premium magazine-quality layout. Visual metaphor only — no on-image words.',
  bold_promo:
    'High-contrast flat poster design, scroll-stopper for Meta feed. Bold solid background color (single brand-aligned hue), one strong visual element (object cutout, silhouette, icon), generous negative space reserved for ALL-CAPS overlay text. Inspired by Apple/Spotify out-of-home posters.',
  price_badge:
    'Split-screen composition: photo of subject on one side, large circular price/value badge on the other. Photo is clean and bright; badge is bold geometric shape in contrasting brand color, sized for instant readability. Modern fintech-poster vibe.',
  urgency_banner:
    'Documentary or lifestyle photo with a strong color-banner strip across the top OR bottom edge, reserved for urgency/deadline overlay text. Photo itself feels grounded and authentic; banner adds the scroll-stop. Banner color contrasts sharply with photo.',
  testimonial_card:
    'Social-feed style portrait or hand-holding-product shot with a clean white or off-white quote card overlay (subtle drop shadow, rounded corners). Card reserved for short customer quote. Authentic, not stocky.',
  data_visual:
    'Minimalist data-visualization composition with one or two big-number icons (euro sign, percentage, arrow), premium typography reserve area, restrained 3-color palette, soft gradient background. Magazine-quality layout like a Financial Times feature.',
};

const NEGATIVES = [
  'no AI-generated face artifacts',
  'no recognizable real people or celebrities',
  'no fake brand logos, no copyrighted characters',
  'no warped, blurry, gibberish or duplicated overlay text',
  'no medical or before-after framing',
  'no aggressive sales-pitch composition that screams "ad"',
  'no watermarks, no stock-photo timestamps',
].join('; ');

/**
 * Bouwt een image-prompt volgens het OpenAI image-prompt framework
 * (Goal / Subject / Scene / Composition / Lighting / Style / Output /
 * Overlay / Negatives). Dit framework is in 2025-2026 expliciet door
 * OpenAI aanbevolen voor GPT-Image-1.x als beste praktijk voor
 * consistente, scroll-stoppende output.
 *
 * Twee paden:
 *  - Met `image_brief` (van strategist): gebruik alle gedetailleerde
 *    velden incl. overlay-object. Geeft de beste resultaten.
 *  - Zonder brief (legacy): val terug op (baseIdea + style + branch)
 *    en gebruik de oude SAFETY_TRAILER zonder overlay. Backwards-compat.
 */
export function buildImagePromptFromBrief(
  baseIdea: string,
  style: VisualStyle,
  branchName?: string,
  image_brief?: ImageBrief,
  options?: { headline?: string; primary_text?: string },
): string {
  if (image_brief) {
    return buildImagePromptFromFullBrief(image_brief, branchName, options);
  }
  // Legacy fallback (geen full brief beschikbaar)
  const direction = IMAGE_STYLE_DIRECTION[style];
  return [
    'GOAL: Facebook Lead Ad creative for the Dutch/Belgian home market, must stop the scroll on mobile feed.',
    `SUBJECT: ${baseIdea}.`,
    branchName ? `CONTEXT: branche = ${branchName}.` : '',
    `STYLE: ${direction}`,
    'OUTPUT: vertical 4:5 mobile-feed framing, photorealistic where applicable.',
    'NO TEXT IN IMAGE.',
    `NEGATIVES: ${NEGATIVES}.`,
    'SAFETY: Compliant with Meta advertising policies.',
  ].filter(Boolean).join(' ');
}

/**
 * Volledige image-prompt op basis van de strategist-brief. Dit is de
 * voorkeurspad — zorgt dat het beeld 1-op-1 aansluit op de copy-hook,
 * de DNA-keuzes en de overlay-beslissing.
 */
function buildImagePromptFromFullBrief(
  brief: ImageBrief,
  branchName?: string,
  options?: { headline?: string; primary_text?: string },
): string {
  const direction = IMAGE_STYLE_DIRECTION[brief.style] || IMAGE_STYLE_DIRECTION.lifestyle;
  const headlineHint = options?.headline
    ? `COPY ALIGNMENT: this image must visually reinforce the headline "${options.headline.slice(0, 60)}"${brief.copy_alignment ? ` — ${brief.copy_alignment}` : ''}.`
    : brief.copy_alignment
      ? `COPY ALIGNMENT: ${brief.copy_alignment}`
      : '';

  const overlayBlock = brief.overlay.enabled && brief.overlay.text
    ? buildOverlayInstruction(brief.overlay)
    : 'NO TEXT IN IMAGE. Let the composition and visual hook carry the message.';

  return [
    'GOAL: Facebook Lead Ad creative for the Dutch/Belgian home market, must stop the scroll on mobile feed.',
    branchName ? `CONTEXT: branche = ${branchName}.` : '',
    `SUBJECT: ${brief.subject}.`,
    `SCENE: ${brief.scene_setting}.`,
    `COMPOSITION: ${brief.composition}; vertical 4:5 framing optimised for mobile feed.`,
    `LIGHTING: ${brief.lighting}.`,
    `MOOD: ${brief.mood}. COLOR FOCUS: ${brief.color_focus}.`,
    `STYLE: ${direction}`,
    `VISUAL HOOK: ${brief.visual_hook}.`,
    headlineHint,
    overlayBlock,
    `NEGATIVES: ${NEGATIVES}.`,
    'SAFETY: Compliant with Meta advertising policies. Photorealistic where applicable, authentic candid composition, never feel "AI-generated".',
  ].filter(Boolean).join(' ');
}

/**
 * Typography-instructies voor overlay-tekst. Volgt OpenAI's eigen
 * best practice: zet de letterlijke tekst in quotes, ALL CAPS waar
 * passend, expliciete font-weight + placement + contrast-instructie.
 * Zo voorkomen we wazige/verminkte tekst die GPT-Image normaal
 * snel produceert bij ad-stijl beelden.
 */
function buildOverlayInstruction(overlay: NonNullable<ImageBrief['overlay']>): string {
  const text = (overlay.text || '').trim();
  const upperised = text.length > 0 ? text.toUpperCase() : '';
  const placement = overlay.placement || 'top';
  const styleHint = overlay.style_hint || 'bold sans-serif, high contrast against background, perfectly legible on a mobile screen';
  const placementDescriptor: Record<NonNullable<ImageBrief['overlay']['placement']>, string> = {
    top: 'across the top third of the image',
    bottom: 'across the bottom third of the image',
    center: 'centered, dominant in the composition',
    badge_top_right: 'as a circular badge in the top-right corner',
    badge_top_left: 'as a circular badge in the top-left corner',
  };
  const placementText = placementDescriptor[placement] || 'across the top';

  return [
    `TEXT OVERLAY: render exactly the text "${upperised}" (do not change wording, do not add extra characters)`,
    `placed ${placementText}.`,
    `Typography: ${styleHint}.`,
    'Crisp, perfectly readable, no kerning issues. Maximum 3-6 words. Reserve clear negative space around the text.',
    'The overlay must look intentional and professionally designed, like a poster — not stamped on top.',
  ].join(' ');
}

/**
 * Backwards compatibel — sommige oude code paths gebruiken SAFETY_TRAILER
 * direct. We exposen het, maar het is leeg geworden omdat alles via
 * NEGATIVES/SAFETY in de nieuwe builder loopt.
 */
const SAFETY_TRAILER =
  'Photorealistic where applicable, natural composition. Authentic feel, never AI-generated look. ' +
  `NEGATIVES: ${NEGATIVES}.`;

// ── Per-adset creative-generator (Studio v2) ─────────────────
const PerAdsetVariantSchema = z.object({
  headline: z.string().min(5).max(40),
  primary_text: z.string().min(20).max(420),
  description: z.string().min(5).max(120),
  cta: z.enum(['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'APPLY_NOW', 'CONTACT_US', 'SUBSCRIBE']),
  image_prompt: z.string().min(20).max(400),
});

const PerAdsetVariantsResponseSchema = z.object({
  variants: z.array(PerAdsetVariantSchema).min(1),
});

function buildAdSetSystemPrompt(brief: Brief, ctx: AdSetCreativeContext): string {
  const branchLabel = brief.branchName || brief.branch;
  const countries = brief.geographicTargeting.countries.join(', ');
  const targetSummary = Object.entries(brief.targetAudience || {})
    .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');

  return [
    `Je bent een senior copywriter voor Meta Lead Ads bij WarmeLeads.`,
    `Branche: ${branchLabel}. Doelgebied: ${countries}.`,
    '',
    `BATTLE-PLAN VOOR DEZE AD SET:`,
    `- Angle: ${ctx.angle}${ctx.rationale ? ` (${ctx.rationale})` : ''}`,
    `- Targeting-strategie: ${ctx.strategy_type}`,
    `- Doelgroep-samenvatting: ${ctx.audience_summary}`,
    `- Persuasion framework: ${ctx.framework}`,
    `  ${frameworkExplanation(ctx.framework)}`,
    `- Toon: ${ctx.tone}`,
    `- Visuele stijl: ${ctx.style}`,
    `- Hook (verplichte richting): "${ctx.hook}"`,
    ctx.must_include && ctx.must_include.length > 0 ? `- Moet bevatten / refereren: ${ctx.must_include.join('; ')}` : '',
    ctx.must_avoid && ctx.must_avoid.length > 0 ? `- Vermijd: ${ctx.must_avoid.join('; ')}` : '',
    '',
    `EXTRA CONTEXT VAN BRIEF:`,
    targetSummary || '- (geen)',
    '',
    `SCHRIJFREGELS:`,
    `- Genereer ${ctx.creatives_per_adset} unieke varianten BINNEN deze angle, varieerend in headline & openingszin maar binnen hetzelfde framework.`,
    `- Geen anglicismen behalve veelgebruikte.`,
    `- Headline ≤ 40 tekens; primary_text 80–420 tekens; description ≤ 120 tekens.`,
    `- CTA: bij voorkeur GET_QUOTE of LEARN_MORE (vrijblijvende lead-flow).`,
    `- Optimaliseer voor "veel ingevulde formulieren tegen lage CPL", niet voor maximale claims.`,
    `- Maak realistische, controleerbare beloftes; expliciet GEEN "gegarandeerd", "100%", "klik hier".`,
    `- image_prompt: visuele beschrijving van scène/onderwerp passend bij de stijl. Hoef GEEN composition/lighting`,
    `  uit te leggen — die wordt automatisch toegevoegd. Focus op WAT er in beeld is.`,
    '',
    brief.specialAdCategory !== 'NONE'
      ? `LET OP: special_ad_category=${brief.specialAdCategory}. Geen demografische targeting in copy; vermijd persoonlijke attributen.`
      : '',
  ].filter(Boolean).join('\n');
}

function frameworkExplanation(fw: AdSetCreativeContext['framework']): string {
  switch (fw) {
    case 'PAS': return '(Problem -> Agitate -> Solution) — open met het probleem, vergroot de pijn, sluit af met onze oplossing.';
    case 'AIDA': return '(Attention -> Interest -> Desire -> Action) — klassiek: aandacht trekken, nieuwsgierigheid wekken, verlangen opwekken, CTA.';
    case 'BAB': return '(Before -> After -> Bridge) — schets situatie nu, situatie straks, en hoe we daar samen komen.';
    case 'FAB': return '(Features -> Advantages -> Benefits) — feiten, voordelen, persoonlijk resultaat — voor goed geïnformeerde doelgroep.';
    case '4U': return '(Useful, Urgent, Unique, Ultra-specific) — alle 4 in elke variant; goed voor schaarste & FOMO.';
  }
}

const PER_ADSET_JSON_SCHEMA = (count: number) => ({
  type: 'object',
  additionalProperties: false,
  required: ['variants'],
  properties: {
    variants: {
      type: 'array',
      minItems: count,
      maxItems: count,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'primary_text', 'description', 'cta', 'image_prompt'],
        properties: {
          headline: { type: 'string' },
          primary_text: { type: 'string' },
          description: { type: 'string' },
          cta: { type: 'string', enum: ['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'APPLY_NOW', 'CONTACT_US', 'SUBSCRIBE'] },
          image_prompt: { type: 'string' },
        },
      },
    },
  },
});

/**
 * Genereer N creative-varianten voor één ad set, op basis van de
 * battle-plan context. Returnt verrijkte GeneratedVariant[] inclusief
 * framework + creative_style + policy-precheck.
 */
export async function generateVariantsForAdSet(
  brief: Brief,
  ctx: AdSetCreativeContext,
): Promise<GenerationResult> {
  const client = getOpenAIClient();
  if (!client) {
    return { variants: [], warnings: ['openai_not_configured'], textCostCents: 0 };
  }

  const model: SupportedTextModel = 'gpt-4o-mini';
  const systemPrompt = buildAdSetSystemPrompt(brief, ctx);
  const userPrompt = `Genereer ${ctx.creatives_per_adset} varianten als JSON (response_format).`;

  const completion = await withOpenAIRetry(() =>
    client.chat.completions.create({
      model,
      temperature: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'adset_variants',
          strict: true,
          schema: PER_ADSET_JSON_SCHEMA(ctx.creatives_per_adset),
        },
      },
    }),
  );

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error('OpenAI gaf geen content terug');
  let parsed: { variants: Array<{ headline: string; primary_text: string; description: string; cta: GeneratedVariant['cta']; image_prompt: string }> };
  try {
    const json = JSON.parse(raw);
    parsed = PerAdsetVariantsResponseSchema.parse(json) as typeof parsed;
  } catch (e) {
    throw new Error(`Per-adset JSON ongeldig: ${(e as Error).message}`);
  }

  const usage = completion.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const textCostCents = estimateTextCostCents(model, inputTokens, outputTokens);

  await logOpenAIUsage({
    briefId: brief.id,
    branch: brief.branch,
    kind: 'copy',
    model,
    costCents: textCostCents,
    inputTokens,
    outputTokens,
    metadata: {
      adset_strategy: ctx.strategy_type,
      angle: ctx.angle,
      framework: ctx.framework,
      style: ctx.style,
      variant_count: ctx.creatives_per_adset,
    },
  });

  const variants: GeneratedVariant[] = parsed.variants.map((v, idx) => {
    // Wanneer de strategist per creative een complete image_brief heeft
    // bedacht, gebruik die (1-op-1 koppeling op index). Anders val terug
    // op de ouderwetse builder met enkel baseIdea + style.
    const planned = ctx.planned_creatives?.[idx];
    const richPrompt = planned
      ? buildImagePromptFromBrief(
          planned.image_brief.subject,
          planned.image_brief.style,
          brief.branchName,
          planned.image_brief,
          { headline: v.headline, primary_text: v.primary_text },
        )
      : buildImagePromptFromBrief(v.image_prompt, ctx.style, brief.branchName);

    const variant: GeneratedVariant = {
      angle: ctx.angle,
      tone: ctx.tone,
      headline: v.headline,
      primary_text: v.primary_text,
      description: v.description,
      cta: v.cta,
      image_prompt: richPrompt,
      policy_warnings: [],
      framework: ctx.framework,
      creative_style: planned?.image_brief.style || ctx.style,
      image_brief: planned?.image_brief,
    };
    variant.policy_warnings = policyCheckVariant(variant);
    return variant;
  });

  return { variants, warnings: [], textCostCents };
}

// ── Image generation ─────────────────────────────────────────
/**
 * Valide image-API-formaten voor gpt-image-1. 1024x1536 = 4:5 vertical
 * (mobile-feed-optimized), 1024x1024 = vierkant, 1536x1024 = landscape.
 */
export const IMAGE_SIZES = ['1024x1024', '1024x1536', '1536x1024'] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export async function generateVariantImage(
  brief: Brief,
  variantId: string,
  imagePrompt: string,
  options?: { size?: ImageSize },
): Promise<ImageGenerationResult | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  // image_prompt komt al verrijkt uit `generateVariantsForAdSet`. We laten
  // de safety-trailer voor backwards-compat (oude legacy generator zonder style).
  const hasNegatives = imagePrompt.includes('NEGATIVES:') || imagePrompt.includes('STRICT: absolutely no on-image text');
  const safetyPrompt = hasNegatives ? imagePrompt : [imagePrompt, SAFETY_TRAILER].join(' ');

  // 4:5 (1024x1536) is sinds Meta's mobile-first roll-out de feed-default
  // en presteert in CTR-benchmarks beduidend beter dan 1:1. Caller kan
  // overschrijven via options.size voor specifieke plaatsingen.
  const size: ImageSize = options?.size || '1024x1536';

  const res = await withOpenAIRetry(() =>
    client.images.generate({
      model: 'gpt-image-1',
      prompt: safetyPrompt,
      size,
      n: 1,
    }),
  );

  const first = res.data?.[0];
  const b64 = first?.b64_json;
  if (!b64) throw new Error('Geen image data ontvangen');

  const costCents = estimateImageCostCents(1, '1024x1024');
  await logOpenAIUsage({
    briefId: brief.id,
    variantId,
    branch: brief.branch,
    kind: 'image',
    model: 'gpt-image-1',
    costCents,
    metadata: { promptLength: imagePrompt.length, size: '1024x1024' },
  });

  return { base64: b64, mimeType: 'image/png', costCents };
}

// ── Internal exports for tests ───────────────────────────────
export const __internal = {
  regexPolicyCheck,
  policyCheckVariant,
  VariantsResponseSchema,
  buildSystemPrompt,
};
