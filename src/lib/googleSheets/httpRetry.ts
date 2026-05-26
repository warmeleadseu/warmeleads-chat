const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_MESSAGES = [
  /service is currently unavailable/i,
  /backend error/i,
  /internal error/i,
  /rate limit/i,
  /quota exceeded/i,
  /try again/i,
];

export function isRetryableGoogleSheetsError(status: number, message: string): boolean {
  if (RETRYABLE_STATUS.has(status)) return true;
  return RETRYABLE_MESSAGES.some((re) => re.test(message));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry Google Sheets API calls on transient failures (503, rate limits, etc.).
 */
export async function fetchGoogleSheetsWithRetry(
  url: string,
  init?: RequestInit,
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 800;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;

      const clone = res.clone();
      let message = `HTTP ${res.status}`;
      try {
        const json = (await clone.json()) as { error?: { message?: string } };
        message = json.error?.message || message;
      } catch {
        /* ignore */
      }

      if (attempt < maxAttempts && isRetryableGoogleSheetsError(res.status, message)) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
        continue;
      }

      lastError = new Error(message);
      throw lastError;
    } catch (err) {
      if (err instanceof Error && err.message && attempt < maxAttempts) {
        if (isRetryableGoogleSheetsError(0, err.message)) {
          lastError = err;
          await sleep(baseDelayMs * 2 ** (attempt - 1));
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError ?? new Error('Google Sheets request mislukt');
}
