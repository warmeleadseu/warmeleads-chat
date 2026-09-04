import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { resolveAddress, isValidPlace } from '@/lib/pdok';
import { distributeUnassignedLeads, backfillBatch } from '@/lib/distribution';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { syncBatchDelivered } from '@/lib/batchSync';
import { verifyCronAuth } from '@/lib/cronAuth';

const MAX_LEAD_AGE_DAYS = 3;

/**
 * Cron job: enrich + distribute leads ≤ 3 days old.
 * Runs every 15 minutes via Vercel Cron (Nano-tier vriendelijk).
 */
export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_LEAD_AGE_DAYS);

  /* Phase 0: batchtellers gelijktrekken en volle batches sluiten.
     Moet vóór de verdeling, want een batch met een afwijkende teller wint de
     sortering en blokkeert daarna elke lead in zijn werkgebied. Dat legde de
     verdeling tussen 16 augustus en 4 september 2026 stil in zes provincies
     zonder dat er ook maar één foutmelding was. Zie migratie 157. */
  let batchesGecorrigeerd = 0;
  try {
    const { data: hersteld, error: reconcileError } = await supabase.rpc('reconcile_batch_delivered');
    if (reconcileError) {
      console.error('[cron/distribute] reconcile_batch_delivered mislukt:', reconcileError.message);
    } else if (Array.isArray(hersteld) && hersteld.length > 0) {
      batchesGecorrigeerd = hersteld.length;
      console.warn('[cron/distribute] batches gecorrigeerd', hersteld);
    }
  } catch (e) {
    console.error('[cron/distribute] reconcile onverwacht mislukt:', (e as Error).message);
  }

  // Phase 1: Enrich recent leads missing coordinates (skip spreadsheet imports and demo leads)
  const { data: leads } = await supabase
    .from('leads')
    .select('id, postcode, huisnummer, plaatsnaam, provincie, lat, lng, land, telefoonnummer, email')
    .neq('bron', 'excel_import')
    .neq('bron', 'demo')
    .gte('created_at', cutoff.toISOString())
    .not('postcode', 'is', null)
    .not('postcode', 'eq', '')
    .not('huisnummer', 'is', null)
    .not('huisnummer', 'eq', '')
    .limit(2500);

  let enriched = 0;
  const toEnrich = (leads || []).filter(
    l => !isValidPlace(l.plaatsnaam) || !isValidPlace(l.provincie) || !l.lat || !l.lng
  );

  const CONCURRENCY = 3;
  for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
    const batch = toEnrich.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (lead) => {
        const result = await resolveAddress(
          lead.postcode,
          lead.huisnummer,
          lead.land as 'NL' | 'BE' | null,
          lead.telefoonnummer,
          lead.email ?? undefined
        );
        if (!result) return null;

        const updates: Record<string, string | number> = {};
        if (!isValidPlace(lead.plaatsnaam) && result.plaatsnaam) updates.plaatsnaam = result.plaatsnaam;
        if (!isValidPlace(lead.provincie) && result.provincie) updates.provincie = result.provincie;
        if ((!lead.lat || !lead.lng) && result.lat && result.lng) {
          updates.lat = result.lat;
          updates.lng = result.lng;
        }
        if (result.land) updates.land = result.land;
        if (Object.keys(updates).length === 0) return null;
        return { id: lead.id, updates };
      })
    );

    for (const r of results) {
      if (!r) continue;
      const { error } = await supabase.from('leads').update(r.updates).eq('id', r.id);
      if (!error) enriched++;
    }
  }

  // Phase 2: Validate phone numbers for leads without phone_valid set (skip spreadsheet imports and demo leads)
  let phonesValidated = 0;
  const { data: unvalidated } = await supabase
    .from('leads')
    .select('id, telefoonnummer')
    .neq('bron', 'excel_import')
    .neq('bron', 'demo')
    .is('phone_valid', null)
    .gte('created_at', cutoff.toISOString())
    .limit(500);

  if (unvalidated && unvalidated.length > 0) {
    const PHONE_BATCH = 25;
    for (let i = 0; i < unvalidated.length; i += PHONE_BATCH) {
      const slice = unvalidated.slice(i, i + PHONE_BATCH);
      await Promise.all(
        slice.map(async (lead) => {
          const valid = isPhoneValid(lead.telefoonnummer);
          const { error } = await supabase.from('leads').update({ phone_valid: valid }).eq('id', lead.id);
          if (!error) phonesValidated++;
        }),
      );
    }
  }

  // Phase 3: Delete profanity leads (recent, skip spreadsheet imports and demo leads) and sync affected batch counters.
  // Voorheen: per geblokte lead aparte select + delete = N+1. Nu: 1 .in()-select + chunked .in()-deletes.
  const profanityT0 = Date.now();
  let profanityDeleted = 0;
  const affectedBatchIds = new Set<string>();
  const { data: recentLeads } = await supabase
    .from('leads')
    .select('id, naam_klant, email, notities, custom_fields')
    .neq('bron', 'excel_import')
    .neq('bron', 'demo')
    .gte('created_at', cutoff.toISOString())
    .limit(2000);

  const blockedIds: string[] = [];
  for (const lead of recentLeads || []) {
    if (checkLeadProfanity(lead as Record<string, unknown>).blocked) {
      blockedIds.push(lead.id);
    }
  }

  if (blockedIds.length > 0) {
    const PROFANITY_CHUNK = 300;
    // 1) Verzamel betrokken batch_ids in 1 (gechunkt) select i.p.v. per lead.
    for (let i = 0; i < blockedIds.length; i += PROFANITY_CHUNK) {
      const chunk = blockedIds.slice(i, i + PROFANITY_CHUNK);
      const { data: assignments } = await supabase
        .from('lead_assignments')
        .select('batch_id')
        .in('lead_id', chunk);
      for (const a of assignments || []) {
        if (a.batch_id) affectedBatchIds.add(a.batch_id);
      }
    }

    // 2) Delete assignments + leads in chunks.
    for (let i = 0; i < blockedIds.length; i += PROFANITY_CHUNK) {
      const chunk = blockedIds.slice(i, i + PROFANITY_CHUNK);
      const { error: aErr } = await supabase.from('lead_assignments').delete().in('lead_id', chunk);
      if (aErr) {
        console.warn('[cron/distribute] profanity assignments delete error:', aErr.message);
        continue;
      }
      const { error: lErr } = await supabase.from('leads').delete().in('id', chunk);
      if (lErr) {
        console.warn('[cron/distribute] profanity leads delete error:', lErr.message);
        continue;
      }
      profanityDeleted += chunk.length;
    }
  }

  for (const batchId of affectedBatchIds) {
    await syncBatchDelivered(supabase, batchId);
  }

  console.info('[cron/distribute:profanity]', {
    computeMs: Date.now() - profanityT0,
    scanned: recentLeads?.length || 0,
    blocked: blockedIds.length,
    deleted: profanityDeleted,
    affectedBatches: affectedBatchIds.size,
  });

  // Phase 4: Distribute (uses 3-day limit internally)
  const distributieT0 = Date.now();
  const distResult = await distributeUnassignedLeads();

  /* Zonder deze regel was er geen enkel spoor van de verdeling in de logs: de
     cron gaf negentien dagen lang keurig 200 terug terwijl er niets werd
     uitgedeeld. `undeliveredInWindow` is het signaal om op te alarmeren. */
  console.info('[cron/distribute:verdeling]', {
    computeMs: Date.now() - distributieT0,
    kandidaten: distResult.candidates,
    zonderToewijzing: distResult.undeliveredInWindow,
    uitgedeeld: distResult.distributed,
    toewijzingen: distResult.assignments,
    gemiddeldPerLead: distResult.avgAssignments,
    batchesGecorrigeerd,
  });

  // Phase 5: Backfill batches whose starts_at just passed
  let cronBackfilled = 0;
  const { data: pendingStartBatches } = await supabase
    .from('customer_batches')
    .select('id, lookback_days, starts_at')
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .eq('is_paid', true)
    .not('starts_at', 'is', null)
    .lte('starts_at', new Date().toISOString())
    .eq('leads_delivered', 0);

  if (pendingStartBatches && pendingStartBatches.length > 0) {
    for (const b of pendingStartBatches) {
      const lookback = b.lookback_days ?? 3;
      if (lookback > 0) {
        try {
          const result = await backfillBatch(b.id, lookback);
          cronBackfilled += result.assigned;
        } catch { /* non-blocking */ }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    enriched,
    phonesValidated,
    profanityDeleted,
    batchesGecorrigeerd,
    candidates: distResult.candidates,
    undeliveredInWindow: distResult.undeliveredInWindow,
    distributed: distResult.distributed,
    assignments: distResult.assignments,
    avgAssignments: distResult.avgAssignments,
    cronBackfilled,
    timestamp: new Date().toISOString(),
  });
}
