import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  getOutboundWebhookConfig,
  isBranchAllowed,
  isOutboundWebhookSyncReady,
} from '@/lib/integrations/outboundWebhook/integrationRepo';
import { syncAssignmentToOutboundWebhook } from '@/lib/integrations/outboundWebhook/syncAssignment';
import { OUTBOUND_WEBHOOK_PROVIDER } from '@/lib/integrations/outboundWebhook/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Hoeveel toewijzingen we per request maximaal bekijken (keyset-pagina). */
const PAGE_SIZE = 200;
/** Hoeveel echte afleveringen we per request maximaal versturen (timeout-budget). */
const SEND_BUDGET = 10;
/** Korte pauze tussen afleveringen, om het endpoint van de klant te ontzien. */
const SEND_DELAY_MS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AssignmentRow = {
  id: string;
  lead_id: string;
  source: string | null;
  leads: { branch: string | null; bron: string | null } | null;
};

/**
 * Stuurt bestaande (al ingeladen) leads alsnog naar de webhook. Werkt met een
 * keyset-cursor op assignment-id zodat elke toewijzing precies één keer wordt
 * bekeken, ongeacht of er duizenden zijn. De UI roept dit herhaaldelijk aan met
 * de teruggegeven cursor tot `done = true`. Idempotent: al geslaagde
 * afleveringen worden overgeslagen.
 */
export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { cursor?: string | null };
  const cursor = typeof body.cursor === 'string' && body.cursor ? body.cursor : null;

  const supabase = createServerClient();
  const customerId = session.customer.id;

  const config = await getOutboundWebhookConfig(supabase, customerId);
  if (!isOutboundWebhookSyncReady(config)) {
    return NextResponse.json(
      { error: 'Schakel de webhook eerst in en sla een geldige URL op.' },
      { status: 400 },
    );
  }

  // Eerste call: ruwe schatting van hoeveel leads nog verstuurd moeten worden.
  let estimateTotal: number | null = null;
  if (!cursor) {
    estimateTotal = await estimateRemaining(supabase, customerId, config.settings.branches ?? []);
  }

  let query = supabase
    .from('lead_assignments')
    .select('id, lead_id, source, leads!inner(branch, bron)')
    .eq('customer_id', customerId)
    .order('id', { ascending: true })
    .limit(PAGE_SIZE);
  if (cursor) query = query.gt('id', cursor);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as unknown as AssignmentRow[];

  if (rows.length === 0) {
    return NextResponse.json({
      done: true,
      cursor,
      examined: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      estimate_total: estimateTotal,
    });
  }

  // Per pagina in één keer ophalen welke toewijzingen al succesvol verstuurd zijn.
  const pageIds = rows.map((r) => r.id);
  const { data: successLogs } = await supabase
    .from('integration_sync_log')
    .select('assignment_id')
    .eq('provider', OUTBOUND_WEBHOOK_PROVIDER)
    .eq('status', 'success')
    .in('assignment_id', pageIds);
  const alreadySent = new Set((successLogs ?? []).map((l) => l.assignment_id as string));

  let examined = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let cursorOut = cursor;
  let stoppedEarly = false;

  for (const row of rows) {
    const lead = row.leads;
    const isDemo = lead?.bron === 'demo' || row.source === 'demo';
    const allowed = isBranchAllowed(config.settings, lead?.branch ?? null);
    const needsSend = !isDemo && allowed && !alreadySent.has(row.id);

    if (needsSend && sent + failed >= SEND_BUDGET) {
      // Budget op: stop vóór deze toewijzing en laat de cursor erop staan,
      // zodat de volgende call hier verder gaat.
      stoppedEarly = true;
      break;
    }

    if (needsSend) {
      if (sent + failed > 0) await sleep(SEND_DELAY_MS);
      try {
        await syncAssignmentToOutboundWebhook({
          customerId,
          leadId: row.lead_id,
          assignmentId: row.id,
        });
        sent += 1;
      } catch {
        // Mislukte aflevering is gelogd (status=failed) en wordt door de
        // cron-retry automatisch opnieuw geprobeerd.
        failed += 1;
      }
    } else {
      skipped += 1;
    }

    cursorOut = row.id;
    examined += 1;
  }

  const done = !stoppedEarly && rows.length < PAGE_SIZE;

  return NextResponse.json({
    done,
    cursor: cursorOut,
    examined,
    sent,
    failed,
    skipped,
    estimate_total: estimateTotal,
  });
}

/**
 * Ruwe schatting van het aantal nog te versturen leads: niet-demo toewijzingen
 * (eventueel gefilterd op branche) minus reeds geslaagde afleveringen.
 */
async function estimateRemaining(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  branches: string[],
): Promise<number> {
  let eligibleQuery = supabase
    .from('lead_assignments')
    .select('id, leads!inner(branch, bron)', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .neq('leads.bron', 'demo');
  if (branches.length > 0) {
    eligibleQuery = eligibleQuery.in('leads.branch', branches);
  }
  const { count: eligible } = await eligibleQuery;

  const { count: sent } = await supabase
    .from('integration_sync_log')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('provider', OUTBOUND_WEBHOOK_PROVIDER)
    .eq('status', 'success');

  return Math.max((eligible ?? 0) - (sent ?? 0), 0);
}
