import { assertPublicHttpUrl } from '@/lib/ssrfGuard';

/**
 * Timeout voor het wachten op een antwoord. Bewust ruim: sommige endpoints
 * (bv. Softr-workflows) draaien meerdere stappen vóór ze 2xx teruggeven. Te
 * krap zetten zorgt voor "false failures" → onnodige retry → dubbele levering.
 */
const WEBHOOK_TIMEOUT_MS = 25_000;

/** Max. aantal bytes dat we uit het antwoord lezen (exfiltratie-cap). */
const MAX_RESPONSE_BYTES = 1_000_000;

export type WebhookOutcome = 'success' | 'http_error' | 'rejected' | 'timeout' | 'network_error';

export type WebhookResponse = {
  /** True alleen bij een 2xx-respons waarin de ontvanger de lead niet weigert. */
  ok: boolean;
  /** HTTP-status, of 0 als er geen respons kwam (timeout/netwerkfout). */
  status: number;
  bodySnippet: string;
  outcome: WebhookOutcome;
  /** Mensvriendelijke foutomschrijving (null bij succes). */
  errorMessage: string | null;
  /** Aangenomen maar overgeslagen (bv. dubbel), met de reden van de ontvanger. */
  notitie?: string | null;
};

/** Haalt een leesbare reden uit één item van `failed`/`skipped`. */
function redenVan(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    for (const k of ['reason', 'reden', 'error', 'message', 'fout']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return JSON.stringify(item).slice(0, 200);
  }
  return String(item);
}

function lijstOfAantal(v: unknown): { aantal: number; redenen: string[] } {
  if (Array.isArray(v)) return { aantal: v.length, redenen: v.map(redenVan) };
  if (typeof v === 'number' && Number.isFinite(v)) return { aantal: v, redenen: [] };
  return { aantal: 0, redenen: [] };
}

/**
 * Leest uit een 2xx-antwoord of de ontvanger de lead tóch weigerde.
 *
 * Sommige ontvangers (Ventasol) antwoorden altijd met 200 en zetten per lead
 * in `failed` wat er niet is binnengekomen, en in `skipped` wat ze bewust
 * lieten liggen (bijvoorbeeld een dubbele). Alleen naar de HTTP-status kijken
 * markeert een geweigerde lead als afgeleverd, en dan verdwijnt hij zonder dat
 * iemand het ziet.
 *
 * - `failed` niet leeg: geweigerd, met de reden erbij.
 * - `skipped` niet leeg (en niets geïmporteerd): aangenomen met een notitie.
 *   De ontvanger heeft hem gezien en er bewust iets mee gedaan; opnieuw sturen
 *   levert hetzelfde op.
 * Geen JSON of geen van deze velden: gewoon geslaagd, zoals voorheen.
 */
export function leesOntvangerUitslag(body: string): { geweigerd: string | null; notitie: string | null } {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { geweigerd: null, notitie: null };
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { geweigerd: null, notitie: null };
  const o = json as Record<string, unknown>;

  const mislukt = lijstOfAantal(o.failed);
  if (mislukt.aantal > 0) {
    const reden = mislukt.redenen.filter(Boolean).join('; ') || JSON.stringify(o).slice(0, 300);
    return { geweigerd: reden, notitie: null };
  }

  const overgeslagen = lijstOfAantal(o.skipped);
  const binnen = lijstOfAantal(o.imported).aantal;
  if (overgeslagen.aantal > 0 && binnen === 0) {
    const reden = overgeslagen.redenen.filter(Boolean).join('; ');
    return { geweigerd: null, notitie: `Overgeslagen door ontvanger${reden ? `: ${reden}` : ''}` };
  }

  return { geweigerd: null, notitie: null };
}

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

    let body = '';
    try {
      const lenHeader = Number(res.headers.get('content-length') || '0');
      if (!Number.isFinite(lenHeader) || lenHeader <= MAX_RESPONSE_BYTES) {
        body = (await res.text()).slice(0, MAX_RESPONSE_BYTES);
      }
    } catch {
      /* body niet leesbaar — niet kritiek */
    }
    const bodySnippet = body.slice(0, 500);

    if (res.ok) {
      /* Het hele antwoord lezen, niet het afgekapte stukje: een lange lijst
         redenen zou anders net geen geldige JSON meer zijn. */
      const uitslag = leesOntvangerUitslag(body);
      if (uitslag.geweigerd) {
        return {
          ok: false,
          status: res.status,
          bodySnippet,
          outcome: 'rejected',
          errorMessage: `Ontvanger weigerde de lead: ${uitslag.geweigerd}`.slice(0, 1000),
        };
      }
      return {
        ok: true,
        status: res.status,
        bodySnippet,
        outcome: 'success',
        errorMessage: null,
        notitie: uitslag.notitie,
      };
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
