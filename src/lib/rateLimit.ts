import { createServerClient } from './supabase';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const supabase = createServerClient();
  const now = new Date();

  const { data: existing } = await supabase
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .single();

  if (!existing) {
    const windowStart = now;
    const resetAt = new Date(windowStart.getTime() + windowMs);

    await supabase.from('rate_limits').upsert({
      key,
      count: 1,
      window_start: windowStart.toISOString(),
    });

    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  const windowStart = new Date(existing.window_start);
  const windowEnd = new Date(windowStart.getTime() + windowMs);

  if (now >= windowEnd) {
    const newWindowStart = now;
    const resetAt = new Date(newWindowStart.getTime() + windowMs);

    await supabase
      .from('rate_limits')
      .update({ count: 1, window_start: newWindowStart.toISOString() })
      .eq('key', key);

    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  const newCount = existing.count + 1;

  if (newCount > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: windowEnd,
    };
  }

  await supabase
    .from('rate_limits')
    .update({ count: newCount })
    .eq('key', key);

  return {
    allowed: true,
    remaining: maxRequests - newCount,
    resetAt: windowEnd,
  };
}
