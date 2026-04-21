import webpush from 'web-push';
import { createServerClient } from './supabase';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:info@warmeleads.eu', VAPID_PUBLIC, VAPID_PRIVATE);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  actions?: { action: string; title: string }[];
}

/**
 * Send a push notification to all subscriptions for a customer.
 * Automatically cleans up expired/invalid subscriptions (410 Gone).
 */
export async function sendPushToCustomer(customerId: string, payload: PushPayload): Promise<{ sent: number; failed: number; cleaned: number }> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('VAPID keys not configured, skipping push');
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const supabase = createServerClient();
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('customer_id', customerId);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  const message = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let cleaned = 0;

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message,
          { TTL: 86400 },
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          cleaned++;
        } else {
          failed++;
          console.error(`Push failed for subscription ${sub.id}:`, err);
        }
      }
    }),
  );

  void results;
  return { sent, failed, cleaned };
}

/**
 * Send a push notification about a new lead to a customer.
 */
export async function sendNewLeadPush(
  customerId: string,
  lead: { naam_klant?: string; plaatsnaam?: string; branch?: string },
): Promise<void> {
  const parts = [lead.naam_klant, lead.plaatsnaam].filter(Boolean);
  const body = parts.length > 0 ? parts.join(' uit ') : 'Bekijk de details in je portaal';

  try {
    await sendPushToCustomer(customerId, {
      title: 'Nieuwe lead ontvangen',
      body,
      url: '/portal',
      tag: 'new-lead',
    });
  } catch (err) {
    console.error('sendNewLeadPush error:', err);
  }
}

/**
 * Send a push notification about a new appointment.
 */
export async function sendAppointmentPush(
  customerId: string,
  kind: 'created' | 'reminder' | 'cancelled',
  opts: { contactName: string; whenLabel: string; appointmentId: string },
): Promise<void> {
  const msgs: Record<string, { title: string; body: string }> = {
    created: { title: 'Nieuwe afspraak ingepland', body: `${opts.contactName} · ${opts.whenLabel}` },
    reminder: { title: 'Afspraak morgen', body: `${opts.contactName} · ${opts.whenLabel}` },
    cancelled: { title: 'Afspraak geannuleerd', body: `${opts.contactName} · ${opts.whenLabel}` },
  };
  const m = msgs[kind];
  try {
    await sendPushToCustomer(customerId, {
      title: m.title,
      body: m.body,
      url: `/portal/agenda`,
      tag: `appointment-${kind}-${opts.appointmentId}`,
    });
  } catch (err) {
    console.error('sendAppointmentPush error:', err);
  }
}

/**
 * Send a batch milestone push notification.
 */
export async function sendBatchMilestonePush(
  customerId: string,
  batchId: string,
  branchName: string,
  milestone: '80pct' | 'completed' | 'reminder',
): Promise<void> {
  const messages: Record<string, { title: string; body: string }> = {
    '80pct': {
      title: 'Batch bijna vol!',
      body: `Je batch ${branchName} is bijna voltooid. Bestel nu een vervolg batch.`,
    },
    completed: {
      title: 'Batch voltooid!',
      body: `Je batch ${branchName} is volledig geleverd. Bestel een nieuwe batch om leads te blijven ontvangen.`,
    },
    reminder: {
      title: `Je mist leads in ${branchName}`,
      body: 'Je batch is al een paar dagen voltooid. Bestel een nieuwe batch om weer leads te ontvangen.',
    },
  };

  const msg = messages[milestone];
  try {
    await sendPushToCustomer(customerId, {
      title: msg.title,
      body: msg.body,
      url: `/portal/bestellen?batch=${batchId}`,
      tag: `batch-${milestone}`,
    });
  } catch (err) {
    console.error('sendBatchMilestonePush error:', err);
  }
}
