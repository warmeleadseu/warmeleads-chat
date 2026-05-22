import type { listDealPipelines } from './deals';

const CACHE_MS = 15 * 60 * 1000;
const pipelineCache = new Map<
  string,
  { at: number; pipelines: Awaited<ReturnType<typeof listDealPipelines>> }
>();

export function getCachedPipelines(
  customerId: string,
): Awaited<ReturnType<typeof listDealPipelines>> | null {
  const cached = pipelineCache.get(customerId);
  if (!cached) return null;
  if (Date.now() - cached.at >= CACHE_MS) {
    pipelineCache.delete(customerId);
    return null;
  }
  return cached.pipelines;
}

export function setCachedPipelines(
  customerId: string,
  pipelines: Awaited<ReturnType<typeof listDealPipelines>>,
): void {
  pipelineCache.set(customerId, { at: Date.now(), pipelines });
}

export function invalidatePipelineCache(customerId: string): void {
  pipelineCache.delete(customerId);
}
