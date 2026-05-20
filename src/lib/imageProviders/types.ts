/**
 * Multi-provider AI Ad Image Engine — gedeelde types.
 *
 * Eén `ImageProvider`-interface dekt al onze image-bronnen:
 *  - OpenAI gpt-image-1 (legacy, fallback)
 *  - Replicate (Flux 1.1 Pro Ultra, Ideogram v3 Turbo, Recraft V3, Imagen 4 Ultra)
 *  - Pexels + sharp (hybride 'echte foto + lokale typografie')
 *
 * Door één interface te delen kan de selector iedere provider transparant
 * aanroepen en kunnen we modellen makkelijk toevoegen zonder de Studio,
 * route of optimizer aan te raken.
 */
import type { ImageBrief } from '@/lib/aiCampaignStrategist';
import type { VisualStyle } from '@/lib/aiVisualDNA';

/**
 * Public provider-IDs. Dit zijn ook de waardes die in
 * `ai_campaign_briefs.preferred_image_provider` en
 * `ai_campaign_variants.image_provider` worden opgeslagen,
 * plus de waardes in de Studio chip-group.
 */
export const PROVIDER_IDS = [
  'auto',           // selector kiest beste model op basis van DNA + overlay
  'flux',           // Replicate · black-forest-labs/flux-1.1-pro-ultra
  'ideogram',       // Replicate · ideogram-ai/ideogram-v3-turbo
  'recraft',        // Replicate · recraft-ai/recraft-v3
  'imagen',         // Replicate · google/imagen-4-ultra
  'pexels_overlay', // Pexels stock + sharp overlay
  'gpt',            // OpenAI gpt-image-1 (legacy)
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Concrete leverancier-implementaties, los van de "auto"-route. */
export const CONCRETE_PROVIDERS = ['openai', 'replicate', 'pexels'] as const;
export type ConcreteProvider = (typeof CONCRETE_PROVIDERS)[number];

/** Aspect ratios die we ondersteunen — 4:5 = mobile-feed default. */
export const SUPPORTED_SIZES = ['1024x1024', '1024x1536', '1536x1024'] as const;
export type SupportedSize = (typeof SUPPORTED_SIZES)[number];

/**
 * Input voor elke provider. We geven het volledige `ImageBrief` mee
 * zodat providers die hun eigen prompt-bouwer hebben (Pexels: zoekterm,
 * Ideogram: overlay-tekst, Recraft: style-modifier) de juiste velden
 * kunnen extracten.
 */
export interface ProviderGenerateInput {
  /** De volledige rendered prompt (al door buildImagePromptFromBrief gebouwd). */
  prompt: string;
  /**
   * Het complete image-concept van de strategist. Optioneel bij legacy
   * varianten zonder brief — providers vallen dan terug op `prompt`.
   */
  imageBrief?: ImageBrief | null;
  /** Output-formaat. */
  size: SupportedSize;
  /** Branche-slug voor logging + budget-bucket. */
  branch: string;
  /** Brief-ID voor cost-logging. */
  briefId: string;
  /** Variant-ID voor cost-logging. */
  variantId: string;
  /** Branche-naam (NL) als hint voor Pexels-zoekterm. */
  branchName?: string;
}

/**
 * Output van elke provider. Buffer wordt direct doorgegeven aan
 * `uploadAdImage(buffer, ...)` in `metaMarketingApi.ts` — geen base64
 * heen-en-weer-converteren tussen lagen.
 */
export interface ProviderGenerateResult {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  /** Welke leverancier-implementatie het beeld heeft gemaakt. */
  provider: ConcreteProvider;
  /** Exact model-slug, bv. `gpt-image-1` of `black-forest-labs/flux-1.1-pro-ultra`. */
  model: string;
  /** Geschatte kosten in cents (voor budget-guard + optimizer-tracking). */
  costCents: number;
  /** Provider-specifieke meta (bv. prediction-id, foto-source-url). */
  metadata?: Record<string, unknown>;
}

/**
 * Concrete provider-implementatie. Idempotent, throws bij echte fouten.
 */
export interface ImageProvider {
  /** Stabiele identifier — gebruikt in DB-rijen en logs. */
  id: ConcreteProvider;
  /** Geschatte kosten in cents vóór de call (voor budget-reservering). */
  estimateCostCents(model: string, size: SupportedSize): number;
  /** Daadwerkelijke generatie. Retourneert een ruwe PNG/JPEG buffer. */
  generate(input: ProviderGenerateInput & { model: string }): Promise<ProviderGenerateResult>;
}

/**
 * Smart routing context. De selector mapt visueel DNA + overlay-beslissing
 * naar een concrete provider+model combinatie.
 */
export interface SelectorInput {
  /** Door admin gekozen voorkeur uit StudioForm-dropdown. */
  override?: ProviderId | null;
  /** Door strategist voorgestelde provider (per-creative hint). */
  strategistHint?: ProviderId | null;
  /** Style uit `image_brief.style` (drijft auto-routing). */
  style: VisualStyle;
  /** Of er een overlay in beeld komt (Ideogram-trigger). */
  overlayEnabled: boolean;
  /** Of credentials voor Replicate/Pexels zijn geconfigureerd. */
  capabilities: ProviderCapabilities;
}

export interface ProviderCapabilities {
  openai: boolean;
  replicate: boolean;
  pexels: boolean;
}

export interface SelectorDecision {
  /** Geselecteerde provider-ID (zoals in DB-rij). */
  providerId: ProviderId;
  /** Concrete provider-implementatie. */
  provider: ConcreteProvider;
  /** Exact model-slug om aan te roepen. */
  model: string;
  /** Reden voor logging/UI-tooltip. */
  reason: string;
}
