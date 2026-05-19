import OpenAI from 'openai';
import { createServerClient } from '@/lib/supabase';

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

/**
 * Schatkosten in cents voor de modellen die we in de AI-studio gebruiken.
 * Conservatief; werkelijke kosten gaan via Usage API in fase 2.
 */
export type SupportedTextModel = 'gpt-4o-mini' | 'gpt-4o';

const TEXT_PRICING: Record<SupportedTextModel, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o-mini': { inputPer1M: 15, outputPer1M: 60 },
  'gpt-4o': { inputPer1M: 250, outputPer1M: 1000 },
};

export function estimateTextCostCents(
  model: SupportedTextModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = TEXT_PRICING[model];
  if (!p) return 0;
  const inputCents = (inputTokens / 1_000_000) * p.inputPer1M;
  const outputCents = (outputTokens / 1_000_000) * p.outputPer1M;
  return Math.ceil(inputCents + outputCents);
}

/** gpt-image-1 standard quality 1024×1024 ≈ $0.04 → 4 cents per beeld. */
export function estimateImageCostCents(count: number, size: '1024x1024' | '1024x1792' | '1792x1024' = '1024x1024'): number {
  const perImage = size === '1024x1024' ? 4 : 8;
  return perImage * count;
}

export interface UsageLogInput {
  briefId?: string | null;
  variantId?: string | null;
  branch?: string | null;
  kind: 'copy' | 'image' | 'judge' | 'optimizer';
  model: string;
  costCents: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  metadata?: Record<string, unknown>;
}

/** Log naar `ai_openai_usage`. Errors worden gelogd maar gooien nooit. */
export async function logOpenAIUsage(input: UsageLogInput): Promise<void> {
  try {
    const supabase = createServerClient();
    await supabase.from('ai_openai_usage').insert({
      brief_id: input.briefId ?? null,
      variant_id: input.variantId ?? null,
      branch: input.branch ?? null,
      kind: input.kind,
      model: input.model,
      cost_cents: Math.max(0, Math.round(input.costCents)),
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    console.warn('[openai] logOpenAIUsage failed', e);
  }
}

/**
 * Retry helper voor OpenAI-calls: exponentiele backoff bij 429 / 5xx.
 */
export async function withOpenAIRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelay = opts.baseDelayMs ?? 1000;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500);
      if (!retryable || attempt === maxAttempts - 1) throw e;
      const wait = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error('OpenAI retry exhausted');
}
