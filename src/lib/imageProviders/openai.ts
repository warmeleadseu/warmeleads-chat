/**
 * OpenAI gpt-image-1 provider — legacy fallback.
 *
 * Wrappert de bestaande gpt-image-1 logica uit
 * [src/lib/aiCreativeGenerator.ts](src/lib/aiCreativeGenerator.ts) achter de
 * `ImageProvider`-interface zodat de selector hem identiek kan aanroepen
 * als Replicate/Pexels.
 *
 * Kosten (Q1 2026): standard quality 1024x1024 = $0.04, 1024x1536 = $0.06.
 * We rekenen 4¢/6¢ per beeld; matcht `estimateImageCostCents` exact.
 */
import { getOpenAIClient, withOpenAIRetry } from '@/lib/openaiClient';
import type {
  ImageProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  SupportedSize,
} from './types';

export const OPENAI_MODEL = 'gpt-image-1';

export function estimateOpenAIImageCostCents(_model: string, size: SupportedSize): number {
  return size === '1024x1024' ? 4 : 6;
}

export const openAIProvider: ImageProvider = {
  id: 'openai',
  estimateCostCents: estimateOpenAIImageCostCents,
  async generate(input: ProviderGenerateInput & { model: string }): Promise<ProviderGenerateResult> {
    const client = getOpenAIClient();
    if (!client) throw new Error('openai_not_configured');

    const res = await withOpenAIRetry(() =>
      client.images.generate({
        model: OPENAI_MODEL,
        prompt: input.prompt,
        size: input.size,
        n: 1,
      }),
    );

    const first = res.data?.[0];
    const b64 = first?.b64_json;
    if (!b64) throw new Error('openai_no_image_data');

    const buffer = Buffer.from(b64, 'base64');
    const costCents = estimateOpenAIImageCostCents(OPENAI_MODEL, input.size);

    return {
      buffer,
      mimeType: 'image/png',
      provider: 'openai',
      model: OPENAI_MODEL,
      costCents,
      metadata: { size: input.size, promptLength: input.prompt.length },
    };
  },
};
