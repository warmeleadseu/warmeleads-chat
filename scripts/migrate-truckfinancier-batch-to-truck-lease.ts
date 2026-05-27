/**
 * De Truckfinancier: batch financial_lease → truck_lease (productie-fix).
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/migrate-truckfinancier-batch-to-truck-lease.ts
 *   npx tsx scripts/migrate-truckfinancier-batch-to-truck-lease.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { reconcileBatchMetaCampaigns } from '../src/lib/metaBatchCampaignSync';

const DRY_RUN = process.argv.includes('--dry-run');

const CUSTOMER_ID = '2ce01196-c11d-46ea-bf36-f96c1745d392';
const BATCH_ID = 'b2631abb-f078-4251-a3e2-187828168fee';
const OLD_BRANCH = 'financial_lease';
const NEW_BRANCH = 'truck_lease';
const MIGRATION_NOTE =
  '[Migratie 128] Branche gewijzigd: financial_lease → truck_lease (Truck Lease leads).';

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env ontbreekt');
  return createClient(url, key);
}

async function main() {
  const sb = supabase();

  const { data: batch, error: batchErr } = await sb
    .from('customer_batches')
    .select(
      'id, customer_id, branch, status, batch_kind, meta_campaign_ids, meta_campaign_sync_enabled, notes, customers(name)',
    )
    .eq('id', BATCH_ID)
    .single();

  if (batchErr || !batch) throw new Error(`Batch niet gevonden: ${batchErr?.message}`);
  if (batch.customer_id !== CUSTOMER_ID) {
    throw new Error(`Batch hoort niet bij verwachte klant (${CUSTOMER_ID})`);
  }

  const custName =
    (batch.customers as { name?: string } | null)?.name ?? 'De Truckfinancier';

  console.log('Klant:', custName);
  console.log('Batch:', batch.id, '|', batch.branch, '→', NEW_BRANCH, '| status:', batch.status);

  if (batch.branch === NEW_BRANCH) {
    console.log('Batch heeft al branche truck_lease — geen actie nodig.');
    return;
  }

  if (batch.branch !== OLD_BRANCH) {
    throw new Error(`Onverwachte huidige branche: ${batch.branch} (verwacht ${OLD_BRANCH})`);
  }

  const { data: truckBranch } = await sb
    .from('branches')
    .select('slug, is_active')
    .eq('slug', NEW_BRANCH)
    .single();
  if (!truckBranch?.is_active) throw new Error('Branche truck_lease niet actief');

  const metaIds = (batch.meta_campaign_ids as string[] | null) ?? [];
  const metaSync = batch.meta_campaign_sync_enabled !== false;
  const notes = [batch.notes?.trim(), MIGRATION_NOTE].filter(Boolean).join('\n');

  if (DRY_RUN) {
    console.log('DRY RUN — zou updaten:', {
      customer_branches: [NEW_BRANCH],
      batch_branch: NEW_BRANCH,
      meta_defaults: { branch: NEW_BRANCH, meta_campaign_ids: metaIds },
      batch_orders_branch: NEW_BRANCH,
    });
    return;
  }

  const { error: batchUpdErr } = await sb
    .from('customer_batches')
    .update({ branch: NEW_BRANCH, notes })
    .eq('id', BATCH_ID);
  if (batchUpdErr) throw new Error(`Batch update: ${batchUpdErr.message}`);

  const { error: custErr } = await sb
    .from('customers')
    .update({ branches: [NEW_BRANCH] })
    .eq('id', CUSTOMER_ID);
  if (custErr) throw new Error(`Klant branches: ${custErr.message}`);

  const { error: orderErr } = await sb
    .from('batch_orders')
    .update({ branch: NEW_BRANCH })
    .eq('batch_id', BATCH_ID);
  if (orderErr) throw new Error(`Batch order: ${orderErr.message}`);

  await sb
    .from('customer_branch_meta_defaults')
    .delete()
    .eq('customer_id', CUSTOMER_ID)
    .eq('branch', OLD_BRANCH);

  const { error: metaErr } = await sb.from('customer_branch_meta_defaults').upsert(
    {
      customer_id: CUSTOMER_ID,
      branch: NEW_BRANCH,
      meta_campaign_ids: metaIds,
      meta_campaign_sync_enabled: metaSync,
      meta_campaign_paused_ids: [],
    },
    { onConflict: 'customer_id,branch' },
  );
  if (metaErr) throw new Error(`Meta defaults: ${metaErr.message}`);

  try {
    await reconcileBatchMetaCampaigns(sb, BATCH_ID, 'admin');
    console.log('Meta-campagne sync gereconcilieerd.');
  } catch (e) {
    console.warn('Meta reconcile (niet-blokkerend):', e);
  }

  const { data: verify } = await sb
    .from('customer_batches')
    .select('branch, status, leads_delivered, batch_size')
    .eq('id', BATCH_ID)
    .single();

  console.log('Klaar. Batch nu:', verify);
  console.log(
    'Nieuwe truck_lease-leads worden verdeeld zodra inbound leads branch=truck_lease hebben.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
