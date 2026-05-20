/**
 * Replicate image-provider — Flux 1.1 Pro Ultra, Ideogram v3 Turbo,
 * Recraft V3 en Google Imagen 4 Ultra.
 *
 * Waarom 4 modellen onder één provider:
 *  - Flux 1.1 Pro Ultra → fotorealistische lifestyle/emotional creatives
 *    met `raw: true` voor een minder "AI-achtige" look.
 *  - Ideogram v3 Turbo → de enige image-API met écht perfecte typografie;
 *    onze go-to voor `bold_promo`, `urgency_banner`, `price_badge` en
 *    elke creative met `overlay.enabled = true`.
 *  - Recraft V3 → vector/illustration/infographic stijl; voor
 *    `infographic` en `data_visual` styles.
 *  - Imagen 4 Ultra → premium fotorealisme als alternatief voor Flux;
 *    handig als override wanneer een specifieke creative meer "Google"
 *    polish nodig heeft.
 *
 * Kosten (Q1 2026, per beeld):
 *  - flux-1.1-pro-ultra  : ~$0.06  → 6 cent
 *  - ideogram-v3-turbo   : ~$0.03  → 3 cent
 *  - recraft-v3          : ~$0.08  → 8 cent
 *  - imagen-4-ultra      : ~$0.06  → 6 cent
 *
 * Implementatie: we gebruiken Replicate's "models endpoint" (
 * `POST /v1/models/{owner}/{name}/predictions`) zodat we geen
 * version-hash hoeven te onderhouden — Replicate kiest automatisch
 * de laatste stable revision van het model.
 *
 * We pollen handmatig met exponentiele backoff (geen `Prefer: wait`
 * omdat dat alleen voor zeer snelle modellen werkt en Replicate dan
 * nog wel eens een 524 teruggeeft via Vercel).
 */
import { getReplicateToken } from './credentials';
import type {
  ImageProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  SupportedSize,
} from './types';

export const REPLICATE_BASE = 'https://api.replicate.com/v1';

export const REPLICATE_MODELS = {
  flux: 'black-forest-labs/flux-1.1-pro-ultra',
  ideogram: 'ideogram-ai/ideogram-v3-turbo',
  recraft: 'recraft-ai/recraft-v3',
  imagen: 'google/imagen-4-ultra',
} as const;
export type ReplicateModelKey = keyof typeof REPLICATE_MODELS;

const COST_CENTS_BY_MODEL: Record<string, number> = {
  [REPLICATE_MODELS.flux]: 6,
  [REPLICATE_MODELS.ideogram]: 3,
  [REPLICATE_MODELS.recraft]: 8,
  [REPLICATE_MODELS.imagen]: 6,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function estimateReplicateImageCostCents(model: string, _size: SupportedSize): number {
  // Replicate-kosten variëren per model, niet per resolutie — size blijft in
  // de interface voor symmetrie met openAIProvider.estimateCostCents.
  return COST_CENTS_BY_MODEL[model] ?? 8;
}

/** Vertaal onze size-strings (`WxH`) naar Replicate-aspect-ratio's per model. */
function sizeToAspectRatio(model: string, size: SupportedSize): string {
  if (size === '1024x1024') return '1:1';
  if (size === '1024x1536') {
    // Imagen 4 ondersteunt geen 2:3, gebruik 3:4 als dichtstbijzijnde portrait.
    if (model === REPLICATE_MODELS.imagen) return '3:4';
    return '2:3';
  }
  // 1536x1024 = landscape
  if (model === REPLICATE_MODELS.imagen) return '4:3';
  return '3:2';
}

/**
 * Bouw de input-payload per model. Elk model accepteert subtiel andere
 * keys — we centraliseren dat hier zodat de rest van de codebase model-
 * agnostisch blijft.
 */
export function buildReplicateInput(model: string, input: ProviderGenerateInput): Record<string, unknown> {
  const aspectRatio = sizeToAspectRatio(model, input.size);

  if (model === REPLICATE_MODELS.flux) {
    return {
      prompt: input.prompt,
      aspect_ratio: aspectRatio,
      // raw=true levert "minder AI-achtige" beelden — de hele reden
      // dat we Flux toevoegen ten opzichte van gpt-image-1.
      raw: true,
      safety_tolerance: 2,
      output_format: 'png',
    };
  }
  if (model === REPLICATE_MODELS.ideogram) {
    return {
      prompt: input.prompt,
      aspect_ratio: aspectRatio,
      // Magic Prompt = AI-prompt-rewriting van Ideogram; uit zodat onze
      // gestructureerde prompt 1-op-1 wordt gerespecteerd (we hebben al
      // een sterke prompt-builder).
      magic_prompt_option: 'Off',
      style_type: input.imageBrief?.style && /infographic|data_visual|bold_promo/i.test(input.imageBrief.style)
        ? 'DESIGN'
        : 'REALISTIC',
    };
  }
  if (model === REPLICATE_MODELS.recraft) {
    // Recraft V3 verwacht `size` als `WxH`-string. Map onze portrait
    // 1024x1536 op het dichtstbijzijnde Recraft-formaat.
    const sizeMap: Record<SupportedSize, string> = {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    };
    const style = input.imageBrief?.style === 'data_visual'
      ? 'digital_illustration'
      : input.imageBrief?.style === 'infographic'
        ? 'vector_illustration'
        : 'realistic_image';
    return {
      prompt: input.prompt,
      size: sizeMap[input.size],
      style,
    };
  }
  if (model === REPLICATE_MODELS.imagen) {
    return {
      prompt: input.prompt,
      aspect_ratio: aspectRatio,
      safety_filter_level: 'block_only_high',
      output_format: 'png',
    };
  }
  throw new Error(`replicate_unsupported_model:${model}`);
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string | null;
  urls?: { get?: string };
}

const MAX_POLL_ATTEMPTS = 60;       // ~120s totale wachttijd (1s start + jitter)
const POLL_INITIAL_DELAY_MS = 1500;
const POLL_MAX_DELAY_MS = 4000;

/**
 * Start een prediction en poll tot success/failure. We praten met de
 * "models endpoint" zodat we geen version-hash hoeven te onderhouden.
 */
export async function runReplicate(
  model: string,
  input: Record<string, unknown>,
  options?: { fetchImpl?: typeof fetch },
): Promise<{ output: string; predictionId: string }> {
  const token = await getReplicateToken();
  if (!token) throw new Error('replicate_not_configured');
  const fetchImpl = options?.fetchImpl || fetch;

  const startRes = await fetchImpl(`${REPLICATE_BASE}/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });
  const startJson = (await startRes.json().catch(() => ({}))) as ReplicatePrediction & { detail?: string };
  if (!startRes.ok) {
    throw new Error(`replicate_start_failed:${startRes.status}:${startJson.detail || startJson.error || 'unknown'}`);
  }
  const predictionId = startJson.id;
  const getUrl = startJson.urls?.get;
  if (!predictionId || !getUrl) throw new Error('replicate_start_no_id');

  let current: ReplicatePrediction = startJson;
  let delay = POLL_INITIAL_DELAY_MS;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (current.status === 'succeeded') {
      const out = current.output;
      const url = Array.isArray(out) ? out[0] : out;
      if (!url) throw new Error('replicate_no_output_url');
      return { output: url, predictionId };
    }
    if (current.status === 'failed' || current.status === 'canceled') {
      throw new Error(`replicate_${current.status}:${current.error || 'unknown'}`);
    }
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(POLL_MAX_DELAY_MS, Math.round(delay * 1.3));
    const pollRes = await fetchImpl(getUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    current = (await pollRes.json().catch(() => ({}))) as ReplicatePrediction;
  }
  throw new Error('replicate_timeout');
}

/**
 * Download de output-URL naar een Buffer. Replicate serveert PNG/JPG
 * vanaf hun CDN — geen auth nodig op de output-URL.
 */
async function downloadAsBuffer(url: string, fetchImpl?: typeof fetch): Promise<{ buffer: Buffer; mimeType: 'image/png' | 'image/jpeg' }> {
  const f = fetchImpl || fetch;
  const res = await f(url);
  if (!res.ok) throw new Error(`replicate_download_failed:${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ct = res.headers.get('content-type') || '';
  const mimeType: 'image/png' | 'image/jpeg' = ct.includes('jpeg') || ct.includes('jpg') ? 'image/jpeg' : 'image/png';
  return { buffer, mimeType };
}

export const replicateProvider: ImageProvider = {
  id: 'replicate',
  estimateCostCents: estimateReplicateImageCostCents,
  async generate(input: ProviderGenerateInput & { model: string }): Promise<ProviderGenerateResult> {
    const model = input.model;
    if (!Object.values(REPLICATE_MODELS).includes(model as (typeof REPLICATE_MODELS)[ReplicateModelKey])) {
      throw new Error(`replicate_unknown_model:${model}`);
    }
    const payload = buildReplicateInput(model, input);
    const { output, predictionId } = await runReplicate(model, payload);
    const { buffer, mimeType } = await downloadAsBuffer(output);
    return {
      buffer,
      mimeType,
      provider: 'replicate',
      model,
      costCents: estimateReplicateImageCostCents(model, input.size),
      metadata: {
        prediction_id: predictionId,
        source_url: output,
        size: input.size,
      },
    };
  },
};

/** Test-only export. */
export const __internal = {
  buildReplicateInput,
  sizeToAspectRatio,
  COST_CENTS_BY_MODEL,
};
