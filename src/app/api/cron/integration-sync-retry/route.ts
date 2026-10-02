import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  resolveIntegrationSyncTargets,
  shouldRetryIntegrationSync,
} from '@/lib/integrations/syncRouting';
import { syncAssignmentToGoogleSheets } from '@/lib/googleSheets/syncAssignment';
import { GOOGLE_SHEETS_PROVIDER } from '@/lib/googleSheets/types';
import { syncAssignmentToTeamleader } from '@/lib/teamleader/syncAssignment';
import { TEAMLEADER_PROVIDER } from '@/lib/teamleader/types';
import { getTeamleaderConnectionState } from '@/lib/teamleader/integrationRepo';
import { syncAssignmentToOutboundWebhook } from '@/lib/integrations/outboundWebhook/syncAssignment';
import { verifyCronAuth } from '@/lib/cronAuth';
import { PARTNER_PROVIDERS, partnerOpProvider, PARTNERS } from '@/lib/integrations/partners/registry';
import {
  binnenLeverperiode,
  brancheToegestaan,
  haalPartnerConfig,
  partnerKlaar,
  type PartnerConfig,
} from '@/lib/integrations/partners/repo';
import { leverAanPartner, PartnerTijdelijkFout } from '@/lib/integrations/partners/sync';
import {
  OUTBOUND_WEBHOOK_PROVIDER,
  type OutboundWebhookSettings,
} from '@/lib/integrations/outboundWebhook/types';
import {
  getOutboundWebhookConfig,
  isBranchAllowed,
  isOutboundWebhookSyncReady,
} from '@/lib/integrations/outboundWebhook/integrationRepo';

/* Partnerleveringen worden gedoseerd (limiet van de partner); ruim genoeg. */
export const maxDuration = 300;

const MAX_ATTEMPTS = 8;
const MISSING_LOOKBACK_HOURS = 72;
const MISSING_BATCH_LIMIT = 30;

/** Minuten wachten vóór retry (attempt 1 = direct, daarna backoff). */
function retryWaitMinutes(attempts: number): number {
  if (attempts <= 1) return 0;
  if (attempts === 2) return 5;
  if (attempts === 3) return 15;
  if (attempts === 4) return 60;
  if (attempts === 5) return 240;
  return 24 * 60;
}

type SyncJob = {
  customer_id: string;
  lead_id: string;
  assignment_id: string;
  provider: string;
  attempts: number;
  created_at: string;
  /** Laatste poging; de wachttijd tussen pogingen telt vanaf hier. */
  updated_at?: string | null;
};

const ALLE_PROVIDERS = [TEAMLEADER_PROVIDER, GOOGLE_SHEETS_PROVIDER, OUTBOUND_WEBHOOK_PROVIDER, ...PARTNER_PROVIDERS];

async function runSyncJob(
  supabase: ReturnType<typeof createServerClient>,
  row: SyncJob,
): Promise<boolean> {
  const { data: customer } = await supabase
    .from('customers')
    .select('branches')
    .eq('id', row.customer_id)
    .maybeSingle();
  const branches = (customer?.branches as string[] | null) ?? [];

  const mayRetry = await shouldRetryIntegrationSync(
    supabase,
    row.customer_id,
    row.provider,
    branches,
  );
  if (!mayRetry) return false;

  if (row.provider === TEAMLEADER_PROVIDER) {
    const conn = await getTeamleaderConnectionState(supabase, row.customer_id);
    if (conn.connected && !conn.tokensReadable) return false;
  }

  if (row.provider === GOOGLE_SHEETS_PROVIDER) {
    await syncAssignmentToGoogleSheets({
      customerId: row.customer_id,
      leadId: row.lead_id,
      assignmentId: row.assignment_id,
    });
  } else if (row.provider === TEAMLEADER_PROVIDER) {
    await syncAssignmentToTeamleader({
      customerId: row.customer_id,
      leadId: row.lead_id,
      assignmentId: row.assignment_id,
    });
  } else if (row.provider === OUTBOUND_WEBHOOK_PROVIDER) {
    await syncAssignmentToOutboundWebhook({
      customerId: row.customer_id,
      leadId: row.lead_id,
      assignmentId: row.assignment_id,
    });
  } else if (partnerOpProvider(row.provider)) {
    await leverAanPartner({
      partner: partnerOpProvider(row.provider)!,
      customerId: row.customer_id,
      leadId: row.lead_id,
      assignmentId: row.assignment_id,
      supabase,
    });
  } else {
    return false;
  }
  return true;
}

/** Legt een fout vast die optrad voordat de synchronisatie zelf iets kon loggen. */
async function legFoutVast(
  supabase: ReturnType<typeof createServerClient>,
  row: SyncJob,
  err: unknown,
): Promise<void> {
  const bericht = err instanceof Error ? err.message : String(err);
  try {
    const { data: bestaand } = await supabase
      .from('integration_sync_log')
      .select('id')
      .eq('assignment_id', row.assignment_id)
      .eq('provider', row.provider)
      .maybeSingle();
    if (bestaand?.id) return;

    await supabase.from('integration_sync_log').insert({
      customer_id: row.customer_id,
      lead_id: row.lead_id,
      assignment_id: row.assignment_id,
      provider: row.provider,
      status: 'failed',
      attempts: 1,
      error_message: bericht.slice(0, 500),
    });
  } catch (logErr) {
    console.error('[integration-sync-retry] fout vastleggen mislukt', {
      assignmentId: row.assignment_id,
      provider: row.provider,
      message: logErr instanceof Error ? logErr.message : String(logErr),
    });
  }
}

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const jobs: SyncJob[] = [];
  const seen = new Set<string>();

  const { data: failed } = await supabase
    .from('integration_sync_log')
    .select('customer_id, lead_id, assignment_id, attempts, created_at, updated_at, provider')
    .in('provider', ALLE_PROVIDERS)
    .eq('status', 'failed')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(60);

  /* Ook regels die op 'pending' bleven staan. Een synchronisatie zet zijn regel
     eerst op pending en daarna pas op success of failed; gaat de functie er
     tussenin onderuit, dan blijft hij voor altijd pending en pakte niemand hem
     nog op. De half uur wachttijd voorkomt dat we een poging inhalen die op dit
     moment gewoon nog bezig is. */
  const pendingGrens = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: blijvenHangen } = await supabase
    .from('integration_sync_log')
    .select('customer_id, lead_id, assignment_id, attempts, created_at, updated_at, provider')
    .in('provider', ALLE_PROVIDERS)
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    /* Op de laatste poging, niet de eerste: een regel die net opnieuw in de
       wachtrij is gezet (of nu wordt verstuurd) is niet blijven hangen. */
    .lt('updated_at', pendingGrens)
    .order('created_at', { ascending: true })
    .limit(30);

  for (const row of [...(failed || []), ...(blijvenHangen || [])]) {
    const key = `${row.assignment_id}:${row.provider}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(row as SyncJob);
  }

  const cutoff = new Date(Date.now() - MISSING_LOOKBACK_HOURS * 3_600_000).toISOString();
  /* Nieuwste eerst, en dat is geen detail.
     Dit stond op oudste eerst, met een limiet van 200. Zolang er in 72 uur
     minder dan 200 leads werden uitgedeeld viel dat niet op. Zodra het er meer
     werden, kwam de grens midden in het venster te liggen en verdween alles
     wat er ná die 200e stond definitief uit beeld: juist de verse leads. Bij
     Mediabink liep de spreadsheet daardoor een etmaal leeg zonder één
     foutmelding, want wat de cron niet ziet, probeert hij ook niet. */
  const { data: recentAssignments } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, customer_id, assigned_at, customers(branches), leads(branch, bron)')
    .gte('assigned_at', cutoff)
    .neq('source', 'demo')
    .order('assigned_at', { ascending: false })
    .limit(200);

  let nieuwErbij = 0;
  const partnerCache = new Map<string, PartnerConfig | null>();
  for (const a of recentAssignments || []) {
    if (jobs.length >= 60 + MISSING_BATCH_LIMIT) break;
    const branches = ((a as { customers?: { branches?: string[] } }).customers?.branches ??
      []) as string[];
    const lead = (a as { leads?: { branch?: string | null; bron?: string | null } }).leads;
    const targets = await resolveIntegrationSyncTargets(supabase, a.customer_id, branches);
    const providers: string[] = [];
    if (targets.google_sheets) providers.push(GOOGLE_SHEETS_PROVIDER);
    if (targets.teamleader) providers.push(TEAMLEADER_PROVIDER);

    const webhookConfig = await getOutboundWebhookConfig(supabase, a.customer_id);
    if (
      isOutboundWebhookSyncReady(webhookConfig) &&
      lead?.bron !== 'demo' &&
      isBranchAllowed(webhookConfig.settings as OutboundWebhookSettings, lead?.branch ?? null)
    ) {
      providers.push(OUTBOUND_WEBHOOK_PROVIDER);
    }

    /* Partnerkoppelingen, alleen binnen hun leverperiode: een nieuwe koppeling
       mag niet ongevraagd de toewijzingen van de afgelopen drie dagen
       nasturen. Configuratie per klant één keer per ronde ophalen. */
    for (const partner of PARTNERS) {
      const sleutel = `${a.customer_id}:${partner.provider}`;
      if (!partnerCache.has(sleutel)) {
        partnerCache.set(sleutel, await haalPartnerConfig(supabase, a.customer_id, partner));
      }
      const pc = partnerCache.get(sleutel) ?? null;
      if (
        partnerKlaar(pc) &&
        lead?.bron !== 'demo' &&
        brancheToegestaan(pc.settings, lead?.branch ?? null) &&
        binnenLeverperiode(pc.settings, a.assigned_at)
      ) {
        providers.push(partner.provider);
      }
    }

    for (const provider of providers) {
      const key = `${a.id}:${provider}`;
      if (seen.has(key)) continue;

      const { data: log } = await supabase
        .from('integration_sync_log')
        .select('status, attempts, created_at, updated_at')
        .eq('assignment_id', a.id)
        .eq('provider', provider)
        .maybeSingle();
      if (log?.status === 'success') continue;

      /* Bestaat er al een regel, dan tellen zijn pogingen en zijn leeftijd mee.
         Zonder dat werd elke mislukte levering uit het venster van 72 uur bij
         élke ronde opnieuw als verse poging ingeschoten: het plafond van acht
         pogingen gold niet en de wachttijd tussen pogingen evenmin. Bij
         Energiekompas liep Teamleader daardoor op tot 29 pogingen en begon het
         te antwoorden met 429, oftewel we werden afgeknepen omdat we te vaak
         aanklopten. Een koppeling die stuk is moet je niet blijven rammen. */
      const pogingen = Number(log?.attempts) || 0;
      if (pogingen >= MAX_ATTEMPTS) continue;

      seen.add(key);
      jobs.push({
        customer_id: a.customer_id,
        lead_id: a.lead_id,
        assignment_id: a.id,
        provider,
        attempts: pogingen,
        created_at: log?.created_at ?? a.assigned_at,
        updated_at: log?.updated_at ?? null,
      });
      nieuwErbij++;
      if (nieuwErbij >= MISSING_BATCH_LIMIT) break;
    }
  }

  let retried = 0;
  let succeeded = 0;

  /* Per afleveradres (partner + klant): wanneer we er voor het laatst iets
     heen stuurden, en welke adressen om rust vroegen (429). De limiet van
     Snelraak geldt per adres, niet voor ons verkeer samen. */
  const laatstePartnerLevering = new Map<string, number>();
  const partnerInRust = new Set<string>();
  const partnerFoutenOpRij = new Map<string, number>();
  /* Binnen de looptijd blijven, ook als een partner bij elke poging pas na de
     time-out antwoordt; wat overblijft komt de volgende ronde. */
  const rondeStart = Date.now();
  const RONDE_BUDGET_MS = 240_000;

  for (const row of jobs) {
    if (Date.now() - rondeStart > RONDE_BUDGET_MS) break;
    if (row.attempts > 0) {
      /* Vanaf de laatste poging, niet de eerste. Gemeten vanaf de eerste ging
         na een dag elke nieuwe poging meteen, en gold de opbouwende wachttijd
         niet meer. */
      const vanaf = row.updated_at ?? row.created_at;
      const minutesSince = (Date.now() - new Date(vanaf).getTime()) / 60_000;
      const minWaitMinutes = retryWaitMinutes(row.attempts);
      if (minutesSince < minWaitMinutes) continue;
    }

    const partner = partnerOpProvider(row.provider);
    const adres = partner ? `${partner.provider}:${row.customer_id}` : '';
    if (partner) {
      if (partnerInRust.has(adres)) continue;
      const vorige = laatstePartnerLevering.get(adres);
      const wacht = vorige ? partner.pauzeMs - (Date.now() - vorige) : 0;
      if (wacht > 0) await new Promise(klaar => setTimeout(klaar, wacht));
      laatstePartnerLevering.set(adres, Date.now());
    }

    try {
      const ok = await runSyncJob(supabase, row);
      if (ok) succeeded++;
      if (partner) partnerFoutenOpRij.set(adres, 0);
    } catch (err) {
      if (partner && err instanceof PartnerTijdelijkFout) {
        /* Bij 429, of na drie tijdelijke fouten op rij (partner ligt eruit),
           de partner de rest van deze ronde met rust laten. */
        const fouten = (partnerFoutenOpRij.get(adres) ?? 0) + 1;
        partnerFoutenOpRij.set(adres, fouten);
        if (err.wachtSeconden != null || fouten >= 3) partnerInRust.add(adres);
      }
      /* De synchronisatie schrijft zelf een regel zodra hij eraan toe is, maar
         gaat hij daarvóór onderuit dan verdween de fout hier in een leeg
         catch-blok. Dat is precies hoe een koppeling een etmaal stil kan
         uitvallen zonder spoor. Staat er nog niets, dan leggen we het hier
         vast, zodat het zichtbaar wordt en de volgende ronde het oppakt. */
      await legFoutVast(supabase, row, err);
    }
    retried++;
  }

  return NextResponse.json({ retried, succeeded, queued: jobs.length });
}
