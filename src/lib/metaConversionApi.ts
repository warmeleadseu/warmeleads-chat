/**
 * Meta Conversions API (CAPI) helper.
 *
 * Stuurt server-side events naar Meta Pixel zodat de Meta-ad-optimizer
 * weet welke leads "kwalificerend" of "verkocht" zijn. Cruciaal voor
 * de feedback-loop van de AI-campagnes.
 *
 * Vereist:
 * - META_PIXEL_ID                (env)
 * - META_CAPI_ACCESS_TOKEN       (env, óf hergebruik META_ACCESS_TOKEN)
 * - META_CAPI_TEST_EVENT_CODE    (env, optioneel; alleen in testmodus)
 */
import { createHash } from 'crypto';
import { META_GRAPH_URL } from '@/lib/meta';

export type CapiEventName = 'Lead' | 'QualifiedLead' | 'Purchase';

export interface CapiUserData {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  fbclid?: string | null;
  externalId?: string | null;
}

export interface CapiEventInput {
  eventName: CapiEventName;
  eventId?: string;
  eventTime?: number;
  user: CapiUserData;
  value?: number;
  currency?: string;
  customData?: Record<string, unknown>;
  sourceUrl?: string;
}

function sha256Lower(input: string): string {
  return createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
}

/**
 * E.164: alleen cijfers, optionele +. Voor Meta: zonder + en met landcode.
 */
export function normalizePhoneForCapi(phone: string, defaultCountry: '31' | '32' = '31'): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = defaultCountry + cleaned.slice(1);
  }
  if (cleaned.length < 8 || cleaned.length > 15) return null;
  if (!/^\d+$/.test(cleaned)) return null;
  return cleaned;
}

export function hashCapiUserData(u: CapiUserData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (u.email) out.em = sha256Lower(u.email);
  if (u.phone) {
    const norm = normalizePhoneForCapi(u.phone);
    if (norm) out.ph = sha256Lower(norm);
  }
  if (u.firstName) out.fn = sha256Lower(u.firstName);
  if (u.lastName) out.ln = sha256Lower(u.lastName);
  if (u.city) out.ct = sha256Lower(u.city.replace(/\s+/g, ''));
  if (u.zip) out.zp = sha256Lower(u.zip.replace(/\s+/g, ''));
  if (u.country) out.country = sha256Lower(u.country);
  if (u.externalId) out.external_id = sha256Lower(u.externalId);
  if (u.fbclid) out.fbc = `fb.1.${Date.now()}.${u.fbclid}`;
  if (u.clientIp) out.client_ip_address = u.clientIp;
  if (u.clientUserAgent) out.client_user_agent = u.clientUserAgent;
  return out;
}

export interface CapiCredentials {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}

export function getCapiCredentials(): CapiCredentials | null {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return null;
  return {
    pixelId,
    accessToken,
    testEventCode: process.env.META_CAPI_TEST_EVENT_CODE || undefined,
  };
}

export interface CapiSendResult {
  ok: boolean;
  status: number;
  eventsReceived?: number;
  error?: string;
  raw?: unknown;
}

export async function sendCapiEvent(input: CapiEventInput): Promise<CapiSendResult> {
  const creds = getCapiCredentials();
  if (!creds) return { ok: false, status: 0, error: 'capi_not_configured' };

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'system_generated' as const,
        event_source_url: input.sourceUrl,
        user_data: hashCapiUserData(input.user),
        custom_data: {
          ...(input.value != null ? { value: input.value } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.customData || {}),
        },
      },
    ],
    ...(creds.testEventCode ? { test_event_code: creds.testEventCode } : {}),
  };

  try {
    const res = await fetch(`${META_GRAPH_URL}/${creds.pixelId}/events?access_token=${encodeURIComponent(creds.accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.error) {
      const errMsg = (json.error as { message?: string } | undefined)?.message || `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errMsg, raw: json };
    }
    const eventsReceived = typeof json.events_received === 'number' ? json.events_received : undefined;
    return { ok: true, status: res.status, eventsReceived, raw: json };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
}

export const __internal = {
  sha256Lower,
};
