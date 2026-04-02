import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { resolveAddress, isValidPlace } from '@/lib/pdok';
import { distributeUnassignedLeads } from '@/lib/distribution';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { syncBatchDelivered } from '@/lib/batchSync';

const MAX_LEAD_AGE_DAYS = 3;

/**
 * Cron job: enrich + distribute leads ≤ 3 days old.
 * Runs every 5 minutes via Vercel Cron.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_LEAD_AGE_DAYS);

  // Phase 1: Enrich recent leads missing coordinates (skip spreadsheet imports)
  const { data: leads } = await supabase
    .from('leads')
    .select('id, postcode, huisnummer, plaatsnaam, provincie, lat, lng, land, telefoonnummer')
    .neq('bron', 'excel_import')
    .gte('created_at', cutoff.toISOString())
    .not('postcode', 'is', null)
    .not('postcode', 'eq', '')
    .not('huisnummer', 'is', null)
    .not('huisnummer', 'eq', '');

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
          lead.telefoonnummer
        );
        if (!result) return null;

        const updates: Record<string, string | number> = {};
        if (!isValidPlace(lead.plaatsnaam) && result.plaatsnaam) updates.plaatsnaam = result.plaatsnaam;
        if (!isValidPlace(lead.provincie) && result.provincie) updates.provincie = result.provincie;
        if ((!lead.lat || !lead.lng) && result.lat && result.lng) {
          updates.lat = result.lat;
          updates.lng = result.lng;
        }
        if (result.land && !lead.land) updates.land = result.land;
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

  // Phase 2: Validate phone numbers for leads without phone_valid set (skip spreadsheet imports)
  let phonesValidated = 0;
  const { data: unvalidated } = await supabase
    .from('leads')
    .select('id, telefoonnummer')
    .neq('bron', 'excel_import')
    .is('phone_valid', null)
    .gte('created_at', cutoff.toISOString())
    .limit(500);

  if (unvalidated && unvalidated.length > 0) {
    for (const lead of unvalidated) {
      const valid = isPhoneValid(lead.telefoonnummer);
      await supabase.from('leads').update({ phone_valid: valid }).eq('id', lead.id);
      phonesValidated++;
    }
  }

  // Phase 3: Delete profanity leads (recent, skip spreadsheet imports) and sync affected batch counters
  let profanityDeleted = 0;
  const affectedBatchIds = new Set<string>();
  const { data: recentLeads } = await supabase
    .from('leads')
    .select('id, naam_klant, email, notities, custom_fields')
    .neq('bron', 'excel_import')
    .gte('created_at', cutoff.toISOString())
    .limit(2000);

  if (recentLeads) {
    for (const lead of recentLeads) {
      if (checkLeadProfanity(lead as Record<string, unknown>).blocked) {
        const { data: assignments } = await supabase
          .from('lead_assignments')
          .select('batch_id')
          .eq('lead_id', lead.id);
        for (const a of assignments || []) {
          if (a.batch_id) affectedBatchIds.add(a.batch_id);
        }
        await supabase.from('lead_assignments').delete().eq('lead_id', lead.id);
        await supabase.from('leads').delete().eq('id', lead.id);
        profanityDeleted++;
      }
    }
  }

  for (const batchId of affectedBatchIds) {
    await syncBatchDelivered(supabase, batchId);
  }

  // Phase 4: Distribute (uses 3-day limit internally)
  const distResult = await distributeUnassignedLeads();

  return NextResponse.json({
    ok: true,
    enriched,
    phonesValidated,
    profanityDeleted,
    distributed: distResult.distributed,
    assignments: distResult.assignments,
    avgAssignments: distResult.avgAssignments,
    timestamp: new Date().toISOString(),
  });
}
