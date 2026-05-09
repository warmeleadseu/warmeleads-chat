/**
 * One-off: verwijder lead_assignments uit nieuwere actieve batches wanneer dezelfde
 * lead_id al aan dezelfde klant in een oudere actieve batch hangt (backfill-bug >1000 rows).
 *
 * Usage: node scripts/fix-duplicate-batch-assignments.mjs [--dry-run] [--customer-name=Mediabink]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');
const nameArg = process.argv.find((a) => a.startsWith('--customer-name='));
const customerNamePattern = nameArg ? nameArg.split('=')[1] : 'Mediabink';

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchAssignmentsForBatch(batchId) {
  const pageSize = 1000;
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('id, lead_id')
      .eq('batch_id', batchId)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function main() {
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', `%${customerNamePattern}%`)
    .limit(5);

  if (cErr) throw new Error(cErr.message);
  if (!customers?.length) {
    console.error('No customer found for pattern:', customerNamePattern);
    process.exit(1);
  }
  if (customers.length > 1) {
    console.log('Multiple matches, using first:', customers.map((c) => `${c.name} (${c.id})`).join(', '));
  }
  const customerId = customers[0].id;
  console.log('Customer:', customers[0].name, customerId);

  const { data: batches, error: bErr } = await supabase
    .from('customer_batches')
    .select('id, branch, batch_size, leads_delivered, status, is_paid, created_at, batch_kind')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (bErr) throw new Error(bErr.message);
  const pipeline = (batches || []).filter((b) => (b.batch_kind || 'leads') === 'leads');
  console.log(
    'Active pipeline batches:',
    pipeline.map((b) => ({
      id: b.id,
      branch: b.branch,
      batch_size: b.batch_size,
      leads_delivered: b.leads_delivered,
      created_at: b.created_at,
    })),
  );

  if (pipeline.length < 2) {
    console.log('Fewer than 2 active lead batches; nothing to fix.');
    return;
  }

  const byCreated = [...pipeline].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  /** Eerste batch (oudste) wint: zelfde lead mag niet opnieuw in jongere actieve batches. */
  const seenLeadIds = new Set();
  const idsToDelete = [];

  for (const batch of byCreated) {
    const rows = await fetchAssignmentsForBatch(batch.id);
    for (const row of rows) {
      if (seenLeadIds.has(row.lead_id)) {
        idsToDelete.push(row.id);
      } else {
        seenLeadIds.add(row.lead_id);
      }
    }
  }

  console.log('Assignment rows to remove (duplicate in newer active batch):', idsToDelete.length);
  if (idsToDelete.length === 0) {
    return;
  }

  if (dryRun) {
    console.log('Dry run — no deletes. First 20 ids:', idsToDelete.slice(0, 20));
    return;
  }

  const chunkSize = 500;
  for (let i = 0; i < idsToDelete.length; i += chunkSize) {
    const chunk = idsToDelete.slice(i, i + chunkSize);
    const { error: dErr } = await supabase.from('lead_assignments').delete().in('id', chunk);
    if (dErr) throw new Error(dErr.message);
    console.log('Deleted', chunk.length, 'rows');
  }

  const affectedBatchIds = pipeline.map((b) => b.id);
  for (const bid of affectedBatchIds) {
    const { count } = await supabase
      .from('lead_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', bid);

    const { data: batchRow } = await supabase
      .from('customer_batches')
      .select('leads_delivered_external')
      .eq('id', bid)
      .single();
    const external = batchRow?.leads_delivered_external || 0;
    const delivered = (count || 0) + external;

    const { error: uErr } = await supabase
      .from('customer_batches')
      .update({ leads_delivered: delivered })
      .eq('id', bid);
    if (uErr) console.error('Update leads_delivered failed for', bid, uErr.message);
    else console.log('Updated batch', bid, 'leads_delivered ->', delivered);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
