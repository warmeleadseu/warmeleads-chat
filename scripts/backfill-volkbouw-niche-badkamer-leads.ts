/**
 * Eenmalige backfill: badkamer-leads → VolkBouw B.V. niche-onderzoeksbatch.
 *
 * Aanleiding: lead_branch_slug='badkamer' is na batchstart pas gekoppeld,
 * waardoor de runtime-pijplijn eerder gegenereerde badkamer-leads niet aan
 * VolkBouw heeft toegewezen.
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/backfill-volkbouw-niche-badkamer-leads.ts --dry-run
 *   npx tsx scripts/backfill-volkbouw-niche-badkamer-leads.ts
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { syncBatchDelivered } from '../src/lib/batchSync';
import { onLeadAssignedToCustomer } from '../src/lib/integrations/onLeadAssigned';

config({ path: resolve(process.cwd(), '.env.vercel.prod.full') });

const DRY_RUN = process.argv.includes('--dry-run');
const BRANCH = 'badkamer';
const CUSTOMER_NAME_LIKE = 'volkbouw';

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env ontbreekt (.env.vercel.prod.full)');
  return createClient(url, key);
}

async function main() {
  const sb = supabase();

  const { data: customer, error: custErr } = await sb
    .from('customers')
    .select('id, name')
    .ilike('name', `%${CUSTOMER_NAME_LIKE}%`)
    .maybeSingle();
  if (custErr || !customer) throw new Error(`Klant niet gevonden: ${custErr?.message ?? ''}`);

  const { data: batch, error: batchErr } = await sb
    .from('customer_batches')
    .select('id, customer_id, status, is_paid, lead_branch_slug, niche_title, batch_kind, starts_at')
    .eq('customer_id', customer.id)
    .eq('batch_kind', 'niche_research')
    .eq('lead_branch_slug', BRANCH)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (batchErr || !batch) {
    throw new Error(
      `Geen onderzoeksbatch met lead_branch_slug=${BRANCH} voor ${customer.name}: ${batchErr?.message || 'niet gevonden'}`,
    );
  }

  console.log(
    `Batch: ${batch.id} | Klant: ${customer.name} | status: ${batch.status} | paid: ${batch.is_paid} | starts_at: ${batch.starts_at}`,
  );

  if (batch.status !== 'active') {
    console.warn('⚠️  Status is niet active — runtime-pijplijn pakt alleen active batches.');
  }
  if (!batch.is_paid) {
    console.warn('⚠️  Batch is niet als betaald gemarkeerd.');
  }

  const { data: leads, error: leadsErr } = await sb
    .from('leads')
    .select('id, branch, phone_valid, bron, created_at, naam_klant, postcode, plaatsnaam')
    .eq('branch', BRANCH)
    .neq('phone_valid', false)
    .not('bron', 'in', '("demo","excel_import")')
    .order('created_at', { ascending: true });

  if (leadsErr) throw new Error(leadsErr.message);
  const leadList = leads || [];
  console.log(`Gevonden ${leadList.length} leads op ${BRANCH} (geldig tel., geen demo/excel).`);

  const { data: existingAssignments } = await sb
    .from('lead_assignments')
    .select('lead_id')
    .eq('customer_id', batch.customer_id);
  const alreadyAssigned = new Set((existingAssignments || []).map((a) => a.lead_id));

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const insertedIds: string[] = [];

  for (const lead of leadList) {
    if (alreadyAssigned.has(lead.id)) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      inserted++;
      console.log(
        `  zou inladen: ${lead.created_at?.slice(0, 10)} | ${lead.naam_klant ?? '—'} | ${lead.postcode ?? ''} ${lead.plaatsnaam ?? ''}`,
      );
      continue;
    }

    const { data: row, error } = await sb
      .from('lead_assignments')
      .insert({
        lead_id: lead.id,
        customer_id: batch.customer_id,
        batch_id: batch.id,
        distance_km: null,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        skipped++;
        continue;
      }
      console.error('Insert mislukt', lead.id, error.message);
      failed++;
      continue;
    }

    alreadyAssigned.add(lead.id);
    inserted++;
    insertedIds.push(lead.id);
    onLeadAssignedToCustomer({
      customerId: batch.customer_id,
      leadId: lead.id,
      assignmentId: row.id,
    });
    console.log(`  OK ${lead.naam_klant ?? lead.id} → VolkBouw`);
  }

  if (!DRY_RUN && inserted > 0) {
    await syncBatchDelivered(sb, batch.id);
  }

  const { count: finalCount } = await sb
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batch.id);

  console.log('---');
  console.log(DRY_RUN ? 'DRY RUN' : 'Klaar');
  console.log(`Toegewezen: ${inserted} | Al gekoppeld: ${skipped} | Mislukt: ${failed}`);
  console.log(`Totaal assignments op batch: ${finalCount ?? '?'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
