const WEBHOOK_TIMEOUT_MS = 10_000;

export type WebhookResponse = {
  ok: boolean;
  status: number;
  bodySnippet: string;
};

/**
 * Verstuurt een JSON-payload met Bearer-auth naar de opgegeven URL.
 * Gooit bij netwerkfouten/timeouts; HTTP-statussen geeft hij terug in `ok`.
 */
export async function sendWebhookRequest(
  url: string,
  token: string,
  payload: unknown,
): Promise<WebhookResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let bodySnippet = '';
    try {
      bodySnippet = (await res.text()).slice(0, 500);
    } catch {
      /* body niet leesbaar — niet kritiek */
    }

    return { ok: res.ok, status: res.status, bodySnippet };
  } finally {
    clearTimeout(timeout);
  }
}
