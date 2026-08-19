/**
 * Laad Greenteam thuisbatterij-leads gestaag in over 5 uur.
 * Portaal-datum = assigned_at op moment van insert (nu), niet oude wervingsdatum.
 *
 * Periode: laatste 10 dagen, targets ZH/NH/NB/FL/GL + max 10 km erbuiten, geldig tel.
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/stagger-greenteam-load.ts --execute
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { leadMatchesAnyProvinceTarget } from '../src/lib/provinceTargetMatch';
import { PROVINCE_CENTROIDS, haversineKm } from '../src/lib/portalDistanceOrigin';
import { syncBatchDelivered } from '../src/lib/batchSync';
import { onLeadAssignedToCustomer } from '../src/lib/integrations/onLeadAssigned';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const EXECUTE = process.argv.includes('--execute');
const GREENTEAM_ID = '88db5950-4002-455e-a531-dba63c5b4bc2';
const TARGET_PROVS = ['Zuid-Holland', 'Noord-Holland', 'Noord-Brabant', 'Flevoland', 'Gelderland'];
const TARGET_TOKENS = TARGET_PROVS.map((p) => `NL:${p}`);
const BUFFER_KM = 10;
const WINDOW_DAYS = 10;
const SPREAD_MS = 5 * 60 * 60 * 1000; // 5 uur

const STATE_DIR = resolve(process.cwd(), 'scripts/.stagger-state');
const STATE_FILE = resolve(STATE_DIR, 'greenteam-2026-07-30.json');
const LOG_FILE = resolve(STATE_DIR, 'greenteam-2026-07-30.log');

type LeadRow = {
  id: string;
  naam_klant: string | null;
  postcode: string | null;
  plaatsnaam: string | null;
  provincie: string | null;
  land: string | null;
  lat: number | null;
  lng: number | null;
  phone_valid: boolean | null;
  created_at: string;
  wervingsdatum: string | null;
};

const REF_POINTS: { lat: number; lng: number; province: string }[] = [
  ...TARGET_PROVS.map((p) => {
    const c = PROVINCE_CENTROIDS[p];
    return { lat: c.lat, lng: c.lng, province: p };
  }),
  { lat: 51.8305, lng: 4.974, province: 'Zuid-Holland' },
  { lat: 52.15, lng: 4.777, province: 'Zuid-Holland' },
  { lat: 52.132, lng: 4.655, province: 'Zuid-Holland' },
  { lat: 52.223, lng: 5.176, province: 'Noord-Holland' },
  { lat: 52.299, lng: 5.241, province: 'Noord-Holland' },
  { lat: 52.342, lng: 5.62, province: 'Gelderland' },
  { lat: 52.379, lng: 5.786, province: 'Gelderland' },
  { lat: 52.273, lng: 5.161, province: 'Noord-Holland' },
  { lat: 52.307, lng: 5.043, province: 'Noord-Holland' },
  { lat: 52.33, lng: 5.069, province: 'Noord-Holland' },
  { lat: 52.508, lng: 5.475, province: 'Flevoland' },
  { lat: 52.3508, lng: 5.2647, province: 'Flevoland' },
  { lat: 52.331, lng: 5.542, province: 'Flevoland' },
  { lat: 52.525, lng: 5.718, province: 'Flevoland' },
  { lat: 52.475, lng: 6.069, province: 'Gelderland' },
  { lat: 52.45, lng: 6.05, province: 'Gelderland' },
  { lat: 52.138, lng: 6.201, province: 'Gelderland' },
  { lat: 52.015, lng: 6.132, province: 'Gelderland' },
  { lat: 51.985, lng: 5.898, province: 'Gelderland' },
  { lat: 51.842, lng: 5.853, province: 'Gelderland' },
  { lat: 51.73, lng: 5.879, province: 'Noord-Brabant' },
  { lat: 51.645, lng: 5.947, province: 'Noord-Brabant' },
  { lat: 51.765, lng: 5.518, province: 'Noord-Brabant' },
  { lat: 51.6978, lng: 5.3037, province: 'Noord-Brabant' },
  { lat: 51.555, lng: 5.091, province: 'Noord-Brabant' },
  { lat: 51.5719, lng: 4.7683, province: 'Noord-Brabant' },
  { lat: 51.53, lng: 4.465, province: 'Noord-Brabant' },
  { lat: 51.495, lng: 4.291, province: 'Noord-Brabant' },
  { lat: 51.584, lng: 4.319, province: 'Noord-Brabant' },
  { lat: 51.692, lng: 4.438, province: 'Noord-Brabant' },
  { lat: 51.8133, lng: 4.6901, province: 'Zuid-Holland' },
  { lat: 51.8365, lng: 4.9724, province: 'Zuid-Holland' },
  { lat: 51.955, lng: 5.227, province: 'Gelderland' },
  { lat: 51.886, lng: 5.43, province: 'Gelderland' },
  { lat: 51.879, lng: 5.288, province: 'Gelderland' },
  { lat: 51.81, lng: 5.244, province: 'Gelderland' },
  { lat: 51.81, lng: 4.894, province: 'Noord-Brabant' },
  { lat: 51.815, lng: 5.0, province: 'Noord-Brabant' },
  { lat: 52.0705, lng: 4.3007, province: 'Zuid-Holland' },
  { lat: 51.9225, lng: 4.4792, province: 'Zuid-Holland' },
  { lat: 52.3676, lng: 4.9041, province: 'Noord-Holland' },
  { lat: 52.3874, lng: 4.6462, province: 'Noord-Holland' },
  { lat: 52.632, lng: 4.751, province: 'Noord-Holland' },
  { lat: 52.956, lng: 4.759, province: 'Noord-Holland' },
  { lat: 52.703, lng: 5.292, province: 'Noord-Holland' },
  { lat: 52.642, lng: 5.06, province: 'Noord-Holland' },
  { lat: 52.505, lng: 4.959, province: 'Noord-Holland' },
  { lat: 52.442, lng: 4.829, province: 'Noord-Holland' },
  { lat: 51.4416, lng: 5.4697, province: 'Noord-Brabant' },
  { lat: 51.481, lng: 5.661, province: 'Noord-Brabant' },
];

const EDGE = REF_POINTS.filter((p) => TARGET_PROVS.includes(p.province));

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    /* ignore */
  }
}

function amsterdamDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function minDistToTarget(lat: number, lng: number): number {
  let best = Infinity;
  for (const p of EDGE) {
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d < best) best = d;
  }
  return best;
}

function isEligible(l: LeadRow): boolean {
  if (l.phone_valid === false) return false;
  if (leadMatchesAnyProvinceTarget(l, TARGET_TOKENS)) return true;
  if (l.lat == null || l.lng == null) return false;
  return minDistToTarget(Number(l.lat), Number(l.lng)) <= BUFFER_KM;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type State = {
  leadIds: string[];
  doneIds: string[];
  batchId: string;
  startedAt: string;
  intervalMs: number;
};

function loadState(): State | null {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State;
}

function saveState(state: State) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  process.on('unhandledRejection', (err) => {
    log(`unhandledRejection (genegeerd): ${err instanceof Error ? err.message : err}`);
  });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: batches } = await sb
    .from('customer_batches')
    .select('id, batch_size, leads_delivered, status, starts_at, created_at')
    .eq('customer_id', GREENTEAM_ID)
    .eq('branch', 'thuisbatterij')
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .order('created_at', { ascending: true });

  const now = new Date();
  const batch = (batches || []).find((b) => !b.starts_at || new Date(b.starts_at) <= now);
  if (!batch) throw new Error('Geen actieve Greenteam thuisbatterij-batch');

  let state = loadState();
  let queue: LeadRow[] = [];

  if (state && state.batchId === batch.id && state.leadIds.length > 0) {
    log(`Hervat state: ${state.doneIds.length}/${state.leadIds.length} al gedaan`);
    const remainingIds = state.leadIds.filter((id) => !state!.doneIds.includes(id));
    if (remainingIds.length === 0) {
      log('Alles al ingeladen volgens state.');
      return;
    }
    const { data: rows } = await sb
      .from('leads')
      .select(
        'id, naam_klant, postcode, plaatsnaam, provincie, land, lat, lng, phone_valid, created_at, wervingsdatum',
      )
      .in('id', remainingIds);
    const byId = new Map((rows || []).map((r) => [r.id, r as LeadRow]));
    queue = remainingIds.map((id) => byId.get(id)).filter(Boolean) as LeadRow[];
  } else {
    const today = amsterdamDate(now);
    const startDay = (() => {
      const d = new Date();
      d.setDate(d.getDate() - (WINDOW_DAYS - 1));
      return amsterdamDate(d);
    })();
    const fetchFrom = new Date(now.getTime() - (WINDOW_DAYS + 2) * 24 * 60 * 60 * 1000).toISOString();

    const atGt = new Set<string>();
    let offset = 0;
    while (true) {
      const { data } = await sb
        .from('lead_assignments')
        .select('lead_id')
        .eq('customer_id', GREENTEAM_ID)
        .range(offset, offset + 999);
      if (!data?.length) break;
      for (const r of data) atGt.add(r.lead_id);
      if (data.length < 1000) break;
      offset += data.length;
    }

    const leads: LeadRow[] = [];
    offset = 0;
    while (true) {
      const { data, error } = await sb
        .from('leads')
        .select(
          'id, naam_klant, postcode, plaatsnaam, provincie, land, lat, lng, phone_valid, created_at, wervingsdatum',
        )
        .eq('branch', 'thuisbatterij')
        .gte('created_at', fetchFrom)
        .order('created_at', { ascending: true })
        .range(offset, offset + 999);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      leads.push(...(data as LeadRow[]));
      if (data.length < 1000) break;
      offset += data.length;
    }

    const dayOf = (l: LeadRow) => l.wervingsdatum || amsterdamDate(new Date(l.created_at));
    queue = leads
      .filter((l) => {
        const day = dayOf(l);
        return day >= startDay && day <= today && !atGt.has(l.id) && isEligible(l);
      })
      // Oudste eerst → gestaag “aanvullen”, nieuwste later in het venster
      .sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || a.created_at.localeCompare(b.created_at));

    const intervalMs = queue.length <= 1 ? 0 : Math.floor(SPREAD_MS / (queue.length - 1));
    state = {
      leadIds: queue.map((l) => l.id),
      doneIds: [],
      batchId: batch.id,
      startedAt: now.toISOString(),
      intervalMs,
    };
    saveState(state);

    log(
      `Greenteam batch ${batch.id} (${batch.leads_delivered}/${batch.batch_size}) — ${queue.length} leads over 5u (interval ~${Math.round(intervalMs / 60000)} min)`,
    );
    for (const l of queue) {
      log(`  QUEUE ${l.naam_klant || '—'} | ${l.postcode || ''} ${l.plaatsnaam || ''} | ${l.provincie || ''}`);
    }
  }

  if (!EXECUTE) {
    log('Dry-run — voeg --execute toe om te starten.');
    return;
  }

  if (!state) throw new Error('Geen state');
  const intervalMs = state.intervalMs;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const lead = queue[i]!;
    // assigned_at bewust weglaten → DB default now() = portaal-ontvangstdatum
    const { data: row, error } = await sb
      .from('lead_assignments')
      .insert({
        lead_id: lead.id,
        customer_id: GREENTEAM_ID,
        batch_id: batch.id,
        source: 'bulk_assign',
        distance_km: null,
      })
      .select('id, assigned_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        skipped++;
        log(`SKIP (bestond al) ${lead.naam_klant}`);
      } else {
        failed++;
        log(`FAIL ${lead.naam_klant}: ${error.message}`);
      }
    } else {
      inserted++;
      // Fire-and-forget; nooit laten crashen op Sheets/TL sync
      Promise.resolve(
        onLeadAssignedToCustomer({
          customerId: GREENTEAM_ID,
          leadId: lead.id,
          assignmentId: row.id,
        }),
      ).catch((err) => {
        log(`sync warn ${lead.naam_klant}: ${err instanceof Error ? err.message : err}`);
      });
      log(
        `OK ${state.doneIds.length + 1}/${state.leadIds.length} ${lead.naam_klant} → assigned_at=${row.assigned_at}`,
      );
    }

    state.doneIds.push(lead.id);
    saveState(state);

    // Sync batch progress periodiek
    if (inserted % 3 === 0 || i === queue.length - 1) {
      try {
        const delivered = await syncBatchDelivered(sb, batch.id);
        log(`Batch sync leads_delivered=${delivered}`);
      } catch (e) {
        log(`Batch sync warn: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (i < queue.length - 1 && intervalMs > 0) {
      const nextAt = new Date(Date.now() + intervalMs).toISOString();
      log(`Wacht ${Math.round(intervalMs / 1000)}s tot volgende (~${nextAt})…`);
      await sleep(intervalMs);
    }
  }

  await syncBatchDelivered(sb, batch.id);
  log(`Klaar: ${inserted} nieuw, ${skipped} skip, ${failed} fail. Totaal done=${state.doneIds.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
