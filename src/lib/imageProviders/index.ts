/**
 * Public entry voor de multi-provider AI Ad Image Engine.
 *
 * Eén functie `generateImage(input)` doet alles:
 *  1. Bepaal capabilities (welke API-keys zijn er).
 *  2. Roep `selectProvider` aan met user-override + strategist-hint + DNA.
 *  3. Roep de concrete provider aan (openai / replicate / pexels).
 *  4. Log de OpenAI-usage / cost in `ai_openai_usage` (één tabel voor alle
 *     image-spend zodat de optimizer en het live dashboard simpel blijven).
 *  5. Retourneer buffer + provider/model/cost.
 *
 * De /generate-image route blijft verantwoordelijk voor:
 *  - Budget-reservering (gebruikt `estimateProviderCostCents` hieronder).
 *  - Upload naar Meta via `uploadAdImage`.
 *  - DB-write naar `ai_campaign_variants`.
 */
import { logOpenAIUsage } from '@/lib/openaiClient';
import { openAIProvider, estimateOpenAIImageCostCents, OPENAI_MODEL } from './openai';
import { replicateProvider, estimateReplicateImageCostCents, REPLICATE_MODELS } from './replicate';
import { pexelsProvider, estimatePexelsCostCents, PEXELS_MODEL } from './pexels';
import { selectProvider } from './selector';
import { getProviderCapabilities } from './credentials';
import type {
  ConcreteProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderId,
  SelectorDecision,
  SupportedSize,
} from './types';
import type { VisualStyle } from '@/lib/aiVisualDNA';

export type { ProviderId, ConcreteProvider, SupportedSize, SelectorDecision } from './types';
export { PROVIDER_IDS, SUPPORTED_SIZES } from './types';
export { REPLICATE_MODELS } from './replicate';
export { OPENAI_MODEL } from './openai';
export { PEXELS_MODEL } from './pexels';

const PROVIDERS: Record<ConcreteProvider, typeof openAIProvider> = {
  openai: openAIProvider,
  replicate: replicateProvider,
  pexels: pexelsProvider,
};

/**
 * Bereken vooraf de geschatte kosten voor budget-reservering, zonder
 * de daadwerkelijke API call te doen. Provider-ID is gerelateerd aan
 * de selector-output `decision.providerId`.
 */
export function estimateProviderCostCents(providerId: ProviderId, size: SupportedSize): number {
  if (providerId === 'gpt') return estimateOpenAIImageCostCents(OPENAI_MODEL, size);
  if (providerId === 'pexels_overlay') return estimatePexelsCostCents(PEXELS_MODEL, size);
  // 'auto' rekent default als duurste replicate-pad (Recraft) zodat de
  // budgetreservering nooit underflows. Dit is conservatief en correct.
  if (providerId === 'auto') return 8;
  // Concrete replicate-modellen
  const model =
    providerId === 'flux' ? REPLICATE_MODELS.flux :
    providerId === 'ideogram' ? REPLICATE_MODELS.ideogram :
    providerId === 'recraft' ? REPLICATE_MODELS.recraft :
    REPLICATE_MODELS.imagen;
  return estimateReplicateImageCostCents(model, size);
}

export interface GenerateImageInput {
  prompt: string;
  size: SupportedSize;
  branch: string;
  briefId: string;
  variantId: string;
  branchName?: string;
  imageBrief?: ProviderGenerateInput['imageBrief'];
  /** User override uit StudioForm of regenerate-knop. */
  override?: ProviderId | null;
  /** Strategist hint uit `image_brief.preferred_provider`. */
  strategistHint?: ProviderId | null;
  /** Visuele style uit het brief — drijft auto-routing. */
  style: VisualStyle;
  /** Of er een overlay in beeld komt — drijft Ideogram-routing. */
  overlayEnabled: boolean;
}

export interface GenerateImageOutput {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  decision: SelectorDecision;
  costCents: number;
  metadata?: Record<string, unknown>;
}

/**
 * Main entry. Throws bij echte fouten (caller wraps in try/catch en mapt
 * naar 502 / partial errors voor de Studio UI).
 */
export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const capabilities = await getProviderCapabilities();
  const decision = selectProvider({
    override: input.override ?? null,
    strategistHint: input.strategistHint ?? null,
    style: input.style,
    overlayEnabled: input.overlayEnabled,
    capabilities,
  });

  const provider = PROVIDERS[decision.provider];
  const providerInput: ProviderGenerateInput & { model: string } = {
    prompt: input.prompt,
    imageBrief: input.imageBrief ?? null,
    size: input.size,
    branch: input.branch,
    briefId: input.briefId,
    variantId: input.variantId,
    branchName: input.branchName,
    model: decision.model,
  };

  const result: ProviderGenerateResult = await provider.generate(providerInput);

  await logOpenAIUsage({
    briefId: input.briefId,
    variantId: input.variantId,
    branch: input.branch,
    kind: 'image',
    model: `${result.provider}:${result.model}`,
    costCents: result.costCents,
    metadata: {
      provider_id: decision.providerId,
      reason: decision.reason,
      size: input.size,
      ...result.metadata,
    },
  });

  return {
    buffer: result.buffer,
    mimeType: result.mimeType,
    decision,
    costCents: result.costCents,
    metadata: result.metadata,
  };
}
