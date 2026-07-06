import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

interface ResendEvent {
  type: string;
  created_at?: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    bounce?: { type?: string; subType?: string };
    [key: string]: unknown;
  };
}

/**
 * Resend gebruikt Svix voor webhook-signing. We verifiëren met de standaard
 * Svix-headers wanneer er een webhook secret gezet is (RESEND_WEBHOOK_SECRET).
 * Het secret heeft het formaat 'whsec_xxxxx' (base64-encoded).
 */
function verifySignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed in productie: zonder secret kunnen we de afzender niet
    // verifiëren en accepteren we geen webhooks. In dev mag het door voor
    // lokaal testen.
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook/resend] RESEND_WEBHOOK_SECRET ontbreekt in productie — webhook geweigerd.');
      return false;
    }
    console.warn('[webhook/resend] RESEND_WEBHOOK_SECRET niet gezet; verificatie overgeslagen (niet-productie).');
    return true;
  }
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Tijdsverschil-check: max 5 minuten oud
  const ts = parseInt(svixTimestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false;

  const secretBytes = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice(6), 'base64')
    : Buffer.from(secret, 'utf8');
  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes).update(toSign).digest('base64');

  // Svix kan meerdere signatures sturen, gescheiden door spaties; vorm
  // 'v1,base64'. We accepteren als één van deze matcht.
  const sigs = svixSignature.split(' ');
  for (const sig of sigs) {
    const [, val] = sig.split(',');
    if (!val) continue;
    try {
      const a = Buffer.from(val, 'base64');
      const b = Buffer.from(expected, 'base64');
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      // ignore en probeer volgende
    }
  }
  return false;
}

async function applyEvent(event: ResendEvent): Promise<void> {
  const messageId = event.data?.email_id;
  if (!messageId) return;
  const supabase = createServerClient();

  // Zoek de bijbehorende email_log-rij.
  const { data: row } = await supabase
    .from('email_log')
    .select('id, opens_count, clicks_count, status')
    .eq('provider_message_id', messageId)
    .maybeSingle();
  if (!row) return;

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};
  switch (event.type) {
    case 'email.delivered':
      // Status 'sent' staat al — niets te updaten, wel logvelden.
      break;
    case 'email.opened':
      update.opens_count = (row.opens_count || 0) + 1;
      update.last_opened_at = now;
      break;
    case 'email.clicked':
      update.clicks_count = (row.clicks_count || 0) + 1;
      update.last_clicked_at = now;
      break;
    case 'email.bounced': {
      update.status = 'bounced';
      const subType = event.data?.bounce?.subType?.toLowerCase() || '';
      const bounceType = event.data?.bounce?.type?.toLowerCase() || '';
      const isHard =
        bounceType === 'permanent' ||
        ['general', 'noemail', 'suppressed'].includes(subType);
      update.error = `bounce:${bounceType}/${subType}`;
      if (isHard) {
        // Harde bounce → automatisch op alle scopes uitschrijven om
        // toekomstige verzending tegen te houden.
        const to =
          (Array.isArray(event.data.to) ? event.data.to[0] : event.data.to) || '';
        if (to) {
          await supabase
            .from('email_optouts')
            .upsert(
              {
                email: to.toLowerCase(),
                scope: 'all',
                source: 'hard_bounce',
                unsubscribed_via_message_id: row.id,
              },
              { onConflict: 'email,scope' },
            );
        }
      }
      break;
    }
    case 'email.complained': {
      update.status = 'bounced';
      update.error = 'spam_complaint';
      const to =
        (Array.isArray(event.data.to) ? event.data.to[0] : event.data.to) || '';
      if (to) {
        await supabase
          .from('email_optouts')
          .upsert(
            {
              email: to.toLowerCase(),
              scope: 'all',
              source: 'spam_complaint',
              unsubscribed_via_message_id: row.id,
            },
            { onConflict: 'email,scope' },
          );
      }
      break;
    }
    default:
      return;
  }

  if (Object.keys(update).length > 0) {
    await supabase.from('email_log').update(update).eq('id', row.id);
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!verifySignature(rawBody, svixId, svixTimestamp, svixSignature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    await applyEvent(event);
  } catch (err) {
    console.error('[webhook/resend] apply failed:', err);
    return NextResponse.json({ error: 'apply failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
