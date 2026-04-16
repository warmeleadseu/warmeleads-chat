import { NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  reset: number;
}

const buckets = new Map<string, Map<string, RateLimitEntry>>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [, bucket] of buckets) {
    for (const [key, entry] of bucket) {
      if (now > entry.reset) bucket.delete(key);
    }
  }
}

export function rateLimit(
  key: string,
  bucketName: string,
  maxRequests: number,
  windowMs: number,
): { limited: boolean; response?: NextResponse } {
  cleanup();

  if (!buckets.has(bucketName)) buckets.set(bucketName, new Map());
  const bucket = buckets.get(bucketName)!;

  const now = Date.now();
  const entry = bucket.get(key);

  if (!entry || now > entry.reset) {
    bucket.set(key, { count: 1, reset: now + windowMs });
    return { limited: false };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.reset - now) / 1000);
    return {
      limited: true,
      response: NextResponse.json(
        { error: 'Te veel verzoeken. Probeer het later opnieuw.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      ),
    };
  }

  return { limited: false };
}

/** Backward-compatible check for webhook routes */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ allowed: boolean }> {
  const { limited } = rateLimit(key, 'webhook', maxRequests, windowMs);
  return { allowed: !limited };
}

export function getClientIp(request: Request): string {
  const forwarded = (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  return forwarded || 'unknown';
}
