import { TEAMLEADER_API_BASE } from './config';

export class TeamleaderApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'TeamleaderApiError';
  }
}

type JsonRpcResponse<T> = {
  data?: T;
  errors?: Array<{
    title?: string;
    detail?: string;
    status?: string;
    meta?: { field?: string };
  }>;
};

function formatTeamleaderError(
  err: NonNullable<JsonRpcResponse<unknown>['errors']>[number],
): string {
  const base = err.detail || err.title || 'Teamleader API error';
  const field = err.meta?.field;
  return field ? `${base} (${field})` : base;
}

/** Teamleader retourneert 204 / lege body voor o.a. contacts.update en contacts.tag. */
export function parseTeamleaderResponseText<T>(
  text: string,
  httpStatus: number,
): JsonRpcResponse<T> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as JsonRpcResponse<T>;
  } catch {
    throw new TeamleaderApiError('Ongeldig antwoord van Teamleader', httpStatus);
  }
}

export async function teamleaderRequest<T>(
  accessToken: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TEAMLEADER_API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') || '60');
    throw new TeamleaderApiError('Teamleader rate limit', 429, retryAfter);
  }

  const text = await res.text();
  const json = parseTeamleaderResponseText<T>(text, res.status);

  if (!res.ok) {
    const err = json?.errors?.[0];
    throw new TeamleaderApiError(
      err ? formatTeamleaderError(err) : `Teamleader API ${res.status}`,
      res.status,
    );
  }

  if (json?.errors?.length) {
    const err = json.errors[0];
    throw new TeamleaderApiError(formatTeamleaderError(err), res.status);
  }

  if (!json) {
    return undefined as T;
  }

  return json.data as T;
}
