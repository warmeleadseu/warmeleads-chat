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
  const res = await rateLimitShared(key, 'webhook', maxRequests, windowMs);
  return { allowed: !res.limited };
}

/* ─── Gedeelde (distributed) rate limiting ───
 *
 * In-memory buckets werken per serverless-instance; op meerdere instances kan
 * een aanvaller de limiet omzeilen. Wanneer Upstash Redis REST is geconfigureerd
 * (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) gebruiken we een gedeelde
 * teller (INCR + PEXPIRE) zodat de limiet over alle instances geldt. Zonder
 * configuratie of bij een storing vallen we veilig terug op de in-memory limiter.
 */

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return { url, token };
  return null;
}

function tooManyResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Te veel verzoeken. Probeer het later opnieuw.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSec)) } },
  );
}

/**
 * Gedeelde rate limit. Gebruikt Upstash (indien geconfigureerd), anders de
 * in-memory limiter. Async zodat aanroepers `await` kunnen gebruiken.
 */
export async function rateLimitShared(
  key: string,
  bucketName: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ limited: boolean; response?: NextResponse }> {
  const cfg = upstashConfig();
  if (!cfg) return rateLimit(key, bucketName, maxRequests, windowMs);

  const redisKey = `rl:${bucketName}:${key}`;
  try {
    // Pipeline: INCR gevolgd door PEXPIRE (alleen effectief zetten bij eerste hit
    // dankzij NX). Upstash REST pipeline-endpoint verwacht een array van commando's.
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(windowMs), 'NX'],
        ['PTTL', redisKey],
      ]),
      // Rate limiting mag nooit lang blokkeren.
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(data?.[0]?.result ?? 0);
    const pttl = Number(data?.[2]?.result ?? windowMs);

    if (count > maxRequests) {
      const retryAfter = Math.ceil((pttl > 0 ? pttl : windowMs) / 1000);
      return { limited: true, response: tooManyResponse(retryAfter) };
    }
    return { limited: false };
  } catch {
    // Storing/timeout: val veilig terug op in-memory zodat de route blijft werken.
    return rateLimit(key, bucketName, maxRequests, windowMs);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  return forwarded || 'unknown';
}
