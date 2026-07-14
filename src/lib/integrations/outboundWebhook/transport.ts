import { assertPublicHttpUrl } from '@/lib/ssrfGuard';

/**
 * Timeout voor het wachten op een antwoord. Bewust ruim: sommige endpoints
 * (bv. Softr-workflows) draaien meerdere stappen vóór ze 2xx teruggeven. Te
 * krap zetten zorgt voor "false failures" → onnodige retry → dubbele levering.
 */
const WEBHOOK_TIMEOUT_MS = 25_000;

/** Max. aantal bytes dat we uit het antwoord lezen (exfiltratie-cap). */
const MAX_RESPONSE_BYTES = 1_000_000;

export type WebhookOutcome = 'success' | 'http_error' | 'timeout' | 'network_error';

export type WebhookResponse = {
  /** True alleen bij een echte 2xx-respons. */
  ok: boolean;
  /** HTTP-status, of 0 als er geen respons kwam (timeout/netwerkfout). */
  status: number;
  bodySnippet: string;
  outcome: WebhookOutcome;
  /** Mensvriendelijke foutomschrijving (null bij succes). */
  errorMessage: string | null;
};

type SendOptions = {
  /** Stabiele sleutel zodat de ontvanger zelf kan dedupliceren. */
  idempotencyKey?: string | null;
};

/**
 * Verstuurt een JSON-payload naar de opgegeven URL en classificeert de uitkomst.
 *
 * Gooit nooit: de aanroeper beslist op basis van `outcome` wat te doen. Dat is
 * cruciaal voor het voorkomen van dubbele afleveringen — een `timeout` betekent
 * dat de POST (incl. body) al verstuurd is en de ontvanger hem vrijwel zeker
 * heeft verwerkt; alleen het antwoord bleef uit. Zo'n levering mag dus NIET
 * opnieuw verstuurd worden. Alleen een `network_error` (geen verbinding/DNS)
 * betekent met zekerheid "niet afgeleverd" en is veilig om te herhalen.
 *
 * Een bearer-token is optioneel (bv. Softr-workflow-webhooks accepteren de POST
 * zonder auth-header).
 */
export async function sendWebhookRequest(
  url: string,
  token: string | null | undefined,
  payload: unknown,
  options?: SendOptions,
): Promise<WebhookResponse> {
  // SSRF-guard: geen requests naar privé/gereserveerde adressen. Dit is een
  // "http_error" (niet "network_error") zodat het NIET opnieuw geprobeerd wordt.
  const guard = await assertPublicHttpUrl(url);
  if (!guard.ok) {
    return {
      ok: false,
      status: 0,
      bodySnippet: '',
      outcome: 'http_error',
      errorMessage: `Webhook-URL geweigerd: ${guard.reason}`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options?.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      // Volg geen redirects: voorkomt public→intern redirect-SSRF.
      redirect: 'manual',
    });

    let bodySnippet = '';
    try {
      const lenHeader = Number(res.headers.get('content-length') || '0');
      if (!Number.isFinite(lenHeader) || lenHeader <= MAX_RESPONSE_BYTES) {
        bodySnippet = (await res.text()).slice(0, 500);
      }
    } catch {
      /* body niet leesbaar — niet kritiek */
    }

    if (res.ok) {
      return { ok: true, status: res.status, bodySnippet, outcome: 'success', errorMessage: null };
    }
    const detail = bodySnippet ? `: ${bodySnippet}` : '';
    return {
      ok: false,
      status: res.status,
      bodySnippet,
      outcome: 'http_error',
      errorMessage: `Webhook gaf HTTP ${res.status}${detail}`,
    };
  } catch (err) {
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError');
    if (isAbort) {
      return {
        ok: false,
        status: 0,
        bodySnippet: '',
        outcome: 'timeout',
        errorMessage: `Geen antwoord binnen ${WEBHOOK_TIMEOUT_MS / 1000}s (verzonden, niet bevestigd)`,
      };
    }
    return {
      ok: false,
      status: 0,
      bodySnippet: '',
      outcome: 'network_error',
      errorMessage: err instanceof Error ? err.message : 'Netwerkfout bij webhook-aflevering',
    };
  } finally {
    clearTimeout(timeout);
  }
}
