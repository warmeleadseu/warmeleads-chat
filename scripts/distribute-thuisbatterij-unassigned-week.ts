/**
 * Eénmalige/backfill: thuisbatterij-leads uit de vorige kalenderweek (ma–zo, UTC)
 * zonder enige lead_assignment, opnieuw verdelen.
 *
 * - Mediabink krijgt voorrang als die in de match-set zit (zelfde regels als runtime).
 * - Leads met phone_valid = false worden overgeslagen (niet uitdelen).
 * - Max. 1 nieuwe toewijzing per lead → uitdeelratio ≤ 1.0 (< 1.5).
 *
 * Vereist .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 *   npx tsx scripts/distribute-thuisbatterij-unassigned-week.ts --dry-run
 *   npx tsx scripts/distribute-thuisbatterij-unassigned-week.ts
 *   npx tsx scripts/distribute-thuisbatterij-unassigned-week.ts --ignore-daily-cap
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { distributeLead } from '../src/lib/distribution';
import { syncBatchDelivered } from '../src/lib/batchSync';
import { createServerClient } from '../src/lib/supabase';

config({ path: resolve(process.cwd(), '.env.local') });

const BRANCH = 'thuisbatterij';
/** Maximaal (nieuwe assignments / leads) — met 1 assignment per lead altijd 1.0 */
const MAX_ASSIGNMENT_RATIO = 1.5;

function previousUtcWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getUTCDay();
  const toMonday = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + toMonday, 0, 0, 0, 0));
  const prevMonday = new Date(thisMonday);
  prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
  return { start: prevMonday, end: thisMonday };
}

async function resolveMediabinkActiveBatchId(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('customer_batches')
    .select('id')
    .eq('customer_id', customerId)
    .eq('branch', BRANCH)
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .neq('is_paid', false)
    .order('created_at', { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}

/** Buiten NL-radius-target (bv. BE) — expliciet naar Mediabink-batch. */
async function forceAssignMediabink(
  supabase: ReturnType<typeof createServerClient>,
  leadId: string,
  customerId: string,
  batchId: string,
): Promise<boolean> {
  const { error } = await supabase.from('lead_assignments').insert({
    lead_id: leadId,
    customer_id: customerId,
    batch_id: batchId,
    distance_km: 0,
  });
  if (error) {
    if (error.code === '23505') return false;
    console.error(`Force-assign mislukt ${leadId}:`, error.message);
    return false;
  }
  await syncBatchDelivered(supabase, batchId);
  return true;
}

async function resolveMediabinkCustomerId(supabase: ReturnType<typeof createServerClient>): Promise<string | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', '%mediabink%')
    .limit(3);
  const rows = (data || []) as { id: string; name: string | null }[];
  if (error || !rows.length) return null;
  if (rows.length > 1) {
    console.warn('Meerdere klanten matchen op "mediabink", neem eerste:', rows.map(r => r.name ?? r.id).join(', '));
  }
  return rows[0].id;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const ignoreDailyCap = process.argv.includes('--ignore-daily-cap');
  if (ignoreDailyCap && !dryRun) {
    console.warn('Let op: --ignore-daily-cap negeert leads_per_day (alleen gebruiken als klant akkoord is).');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig (.env.local).');
    process.exit(1);
  }

  const supabase = createServerClient();
  const mediabinkId = await resolveMediabinkCustomerId(supabase);
  if (!mediabinkId) {
    console.error('Mediabink-klant niet gevonden (ilike name %mediabink%).');
    process.exit(1);
  }
  const mediabinkBatchId = await resolveMediabinkActiveBatchId(supabase, mediabinkId);
  if (!mediabinkBatchId) {
    console.error('Geen actieve thuisbatterij-batch voor Mediabink.');
    process.exit(1);
  }

  const { start, end } = previousUtcWeekRange();
  console.log(
    `Venster vorige week UTC: ${start.toISOString()} — ${end.toISOString()} (exclusief eind) | Mediabink: ${mediabinkId}`,
  );

  const { data: weekLeads, error: wErr } = await supabase
    .from('leads')
    .select('id, branch, lat, lng, provincie, bron, phone_valid, custom_fields, quality_score, budget, zonnepanelen, dynamisch_contract, stroomverbruik')
    .eq('branch', BRANCH)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .neq('bron', 'excel_import')
    .neq('bron', 'demo');

  if (wErr || !weekLeads) {
    console.error('Leads ophalen mislukt:', wErr?.message);
    process.exit(1);
  }

  const ids = weekLeads.map(l => l.id);
  if (ids.length === 0) {
    console.log('Geen leads in venster.');
    process.exit(0);
  }

  const { data: assigns, error: aErr } = await supabase.from('lead_assignments').select('lead_id').in('lead_id', ids);
  if (aErr) {
    console.error('Assignments ophalen mislukt:', aErr.message);
    process.exit(1);
  }
  const assigned = new Set((assigns || []).map(r => r.lead_id));
  const unassigned = weekLeads.filter(l => !assigned.has(l.id));
  const distributable = unassigned.filter(l => l.phone_valid !== false);
  const skippedInvalidPhone = unassigned.length - distributable.length;

  console.log(
    `Week-leads: ${weekLeads.length}, nog zonder assignment: ${unassigned.length}` +
      (skippedInvalidPhone > 0 ? ` (waarvan ${skippedInvalidPhone} overgeslagen: phone_valid=false)` : ''),
  );

  if (distributable.length === 0) {
    process.exit(0);
  }

  const maxAllowedAssignments = Math.ceil(distributable.length * MAX_ASSIGNMENT_RATIO);

  if (dryRun) {
    console.log('Dry-run: geen distributeLead-aanroepen.');
    for (const l of distributable) {
      console.log(`  ${l.id} phone_valid=${l.phone_valid} lat=${l.lat} lng=${l.lng} prov=${(l as { provincie?: string }).provincie}`);
    }
    process.exit(0);
  }

  const activeBatchesByBranch = new Map();
  const ctxBase = { supabase, activeBatchesByBranch };

  let newAssignments = 0;
  let ok = 0;
  let unchanged = 0;

  for (const row of distributable) {
    const lead = {
      id: row.id,
      branch: row.branch,
      lat: Number(row.lat),
      lng: Number(row.lng),
      provincie: (row as { provincie?: string }).provincie,
      bron: row.bron,
      phone_valid: row.phone_valid,
      custom_fields: row.custom_fields as Record<string, string> | undefined,
      quality_score: row.quality_score,
      budget: row.budget,
      zonnepanelen: row.zonnepanelen,
      dynamisch_contract: row.dynamisch_contract,
      stroomverbruik: row.stroomverbruik,
    };

    const ctx = {
      ...ctxBase,
      preferCustomerId: mediabinkId,
      ...(ignoreDailyCap ? { ignoreBatchDailyCap: true } : {}),
    };

    const result = await distributeLead(lead, ctx);
    if (result.assignments.length > 0) {
      newAssignments += result.assignments.length;
      ok++;
      console.log(`OK ${lead.id} → ${result.assignments[0].customer_id} batch ${result.assignments[0].batch_id}`);
    } else if (mediabinkBatchId && lead.phone_valid !== false) {
      const forced = await forceAssignMediabink(supabase, lead.id, mediabinkId, mediabinkBatchId);
      if (forced) {
        newAssignments += 1;
        ok++;
        console.log(`OK ${lead.id} → ${mediabinkId} batch ${mediabinkBatchId} (force Mediabink, buiten NL-target)`);
      } else {
        unchanged++;
        console.log(`— ${lead.id} (geen match, force mislukt of dubbel)`);
      }
    } else {
      unchanged++;
      console.log(`— ${lead.id} (geen match of limiet/cooldown)`);
    }

    if (newAssignments > maxAllowedAssignments) {
      console.error(`Gestopt: uitdeelratio zou ${(newAssignments / distributable.length).toFixed(2)} > ${MAX_ASSIGNMENT_RATIO} worden.`);
      process.exit(1);
    }
  }

  const ratio = distributable.length > 0 ? newAssignments / distributable.length : 0;
  console.log(
    `Klaar: ${ok} leads met nieuwe assignment, ${unchanged} ongewijzigd. Nieuwe assignments: ${newAssignments}, ratio: ${ratio.toFixed(2)} (max ${MAX_ASSIGNMENT_RATIO}).` +
      (skippedInvalidPhone > 0 ? ` ${skippedInvalidPhone} lead(s) met ongeldig nummer niet uitgedeeld.` : ''),
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
