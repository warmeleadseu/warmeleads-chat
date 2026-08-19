/**
 * Laad alle dakrenovatie-leads die nog niet bij LeadsConnect staan in hun actieve batch.
 * Guardrails (geo Antwerpen) worden overgeslagen — expliciete handmatige inlaad.
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/assign-dakrenovatie-leadsconnect.ts
 *   npx tsx scripts/assign-dakrenovatie-leadsconnect.ts --execute
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { syncBatchDelivered } from '../src/lib/batchSync';
import { onLeadAssignedToCustomer } from '../src/lib/integrations/onLeadAssigned';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const EXECUTE = process.argv.includes('--execute');
const LEADSCONNECT_ID = '4b295fb5-a707-4abc-a216-04cc0e0d27f3';
const BATCH_ID = 'a10e69d2-96ae-45bd-9d03-2ad0c081a409';

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: customer } = await sb
    .from('customers')
    .select('id, name, branches')
    .eq('id', LEADSCONNECT_ID)
    .single();
  if (!customer) throw new Error('LeadsConnect niet gevonden');

  const { data: batch } = await sb
    .from('customer_batches')
    .select('id, batch_size, leads_delivered, status, is_paid, branch')
    .eq('id', BATCH_ID)
    .single();
  if (!batch) throw new Error('Batch niet gevonden');

  // Alle dakrenovatie-leads zonder bestaande assignment bij LeadsConnect
  const { data: already } = await sb
    .from('lead_assignments')
    .select('lead_id')
    .eq('customer_id', LEADSCONNECT_ID);

  const alreadySet = new Set((already || []).map((r) => r.lead_id));

  const PAGE = 1000;
  const toAssign: Array<{
    id: string;
    naam_klant: string | null;
    postcode: string | null;
    plaatsnaam: string | null;
    provincie: string | null;
    created_at: string;
  }> = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('leads')
      .select('id, naam_klant, postcode, plaatsnaam, provincie, created_at')
      .eq('branch', 'dakrenovatie')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const l of data) {
      if (!alreadySet.has(l.id)) toAssign.push(l);
    }
    if (data.length < PAGE) break;
    offset += data.length;
  }

  const needed = (batch.leads_delivered ?? 0) + toAssign.length;
  const newBatchSize = Math.max(batch.batch_size ?? 0, needed);

  console.log(`Klant: ${customer.name}`);
  console.log(`Batch: ${batch.id} (${batch.leads_delivered}/${batch.batch_size}) → size ${newBatchSize}`);
  console.log(`Te laden: ${toAssign.length} dakrenovatie-leads\n`);
  for (const l of toAssign) {
    console.log(
      `  ${l.created_at.slice(0, 10)} | ${l.naam_klant || '—'} | ${[l.postcode, l.plaatsnaam, l.provincie].filter(Boolean).join(' ') || '(geen adres)'}`,
    );
  }

  if (!EXECUTE) {
    console.log('\nDry-run — voeg --execute toe om in te laden.');
    return;
  }

  if (newBatchSize > (batch.batch_size ?? 0)) {
    const { error: sizeErr } = await sb
      .from('customer_batches')
      .update({ batch_size: newBatchSize, status: 'active', completed_at: null })
      .eq('id', BATCH_ID);
    if (sizeErr) throw new Error(`batch_size update: ${sizeErr.message}`);
    console.log(`\nBatch-size opgehoogd naar ${newBatchSize}`);
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of toAssign) {
    const { data: row, error } = await sb
      .from('lead_assignments')
      .insert({
        lead_id: lead.id,
        customer_id: LEADSCONNECT_ID,
        batch_id: BATCH_ID,
        source: 'bulk_assign',
        distance_km: null,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        skipped++;
        continue;
      }
      failed++;
      console.error(`FAIL ${lead.id}:`, error.message);
      continue;
    }

    inserted++;
    try {
      onLeadAssignedToCustomer({
        customerId: LEADSCONNECT_ID,
        leadId: lead.id,
        assignmentId: row.id,
      });
    } catch {
      /* non-blocking */
    }
    console.log(`OK ${lead.naam_klant}`);
  }

  const delivered = await syncBatchDelivered(sb, BATCH_ID);
  console.log(`\nKlaar: ${inserted} ingeladen, ${skipped} overgeslagen, ${failed} mislukt. Batch delivered=${delivered}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
