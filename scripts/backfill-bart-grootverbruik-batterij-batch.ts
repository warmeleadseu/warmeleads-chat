/**
 * Eenmalige backfill: Bart — Verduurzamingscoalitie — Grootverbruik Batterij Leads
 * 10 leads × €250 = €2.500, betaald + celebration op live dashboard.
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/backfill-bart-grootverbruik-batterij-batch.ts
 *   npx tsx scripts/backfill-bart-grootverbruik-batterij-batch.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { createInvoice } from '../src/lib/invoice';

const DRY_RUN = process.argv.includes('--dry-run');

const MARKER = '[Backfill 2026-05-22] Bart — Verduurzamingscoalitie — Grootverbruik Batterij 10×€250';
const BRANCH_SLUG = 'grootverbruik_batterij';
const BRANCH_NAME = 'Grootverbruik Batterij Leads';
const BATCH_SIZE = 10;
const PRICE_PER_LEAD = 250;
const TOTAL_PRICE = BATCH_SIZE * PRICE_PER_LEAD;

const CUSTOMER_ID = '66451e68-a0d1-4ee4-a56f-aa0d2c4a1838';
const BART_ID = '0dfb7998-aa13-4e1b-b2cd-415ff82aef26';

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env ontbreekt');
  return createClient(url, key);
}

async function main() {
  const sb = supabase();

  const { data: existing } = await sb
    .from('customer_batches')
    .select('id, notes')
    .eq('customer_id', CUSTOMER_ID)
    .ilike('notes', '%[Backfill 2026-05-22] Bart — Verduurzamingscoalitie — Grootverbruik Batterij%')
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log('Batch bestaat al:', existing.id);
    return;
  }

  const { data: cust } = await sb
    .from('customers')
    .select('id, name, account_manager_id, branches')
    .eq('id', CUSTOMER_ID)
    .single();
  if (!cust) throw new Error('Klant Verduurzamingscoalitie niet gevonden');

  const { data: bart } = await sb.from('admin_users').select('id, name').eq('id', BART_ID).single();
  if (!bart) throw new Error('Bart niet gevonden');

  if (DRY_RUN) {
    console.log('DRY RUN — zou aanmaken:', {
      customer: cust.name,
      bart: bart.name,
      branch: BRANCH_SLUG,
      batch_size: BATCH_SIZE,
      total_price: TOTAL_PRICE,
    });
    return;
  }

  const { error: branchErr } = await sb.from('branches').upsert(
    {
      slug: BRANCH_SLUG,
      name: BRANCH_NAME,
      color: 'amber',
      description: 'Grootverbruik batterij leads (maatwerk-vertical, koppeling later).',
      sort_order: 50,
      pricing_tiers: [{ min_leads: 1, price_per_lead: PRICE_PER_LEAD }],
      min_batch_size: 1,
      nationwide_discount: 0,
      is_active: true,
      hidden_from_admin: false,
    },
    { onConflict: 'slug' },
  );
  if (branchErr) throw new Error(`Branch: ${branchErr.message}`);

  const branches = Array.isArray(cust.branches) ? [...cust.branches] : [];
  if (!branches.includes(BRANCH_SLUG)) {
    branches.push(BRANCH_SLUG);
    await sb.from('customers').update({ branches }).eq('id', CUSTOMER_ID);
  }

  if (cust.account_manager_id !== BART_ID) {
    await sb.from('customers').update({ account_manager_id: BART_ID }).eq('id', CUSTOMER_ID);
  }

  const { data: batch, error: batchErr } = await sb
    .from('customer_batches')
    .insert({
      customer_id: CUSTOMER_ID,
      branch: BRANCH_SLUG,
      batch_kind: 'leads',
      batch_size: BATCH_SIZE,
      price_per_lead: PRICE_PER_LEAD,
      total_price: TOTAL_PRICE,
      leads_delivered: 0,
      leads_delivered_external: 0,
      status: 'active',
      is_paid: true,
      account_manager_id: BART_ID,
      lead_filters: [],
      lookback_days: 3,
      notes: MARKER,
      meta_campaign_sync_enabled: false,
      compensations: [],
    })
    .select('id')
    .single();

  if (batchErr || !batch) throw new Error(`Batch: ${batchErr?.message || 'geen data'}`);

  console.log('Batch aangemaakt:', batch.id);

  try {
    await createInvoice({
      customer_id: CUSTOMER_ID,
      batch_id: batch.id,
      branch_name: BRANCH_NAME,
      batch_size: BATCH_SIZE,
      price_per_lead: PRICE_PER_LEAD,
      total_price: TOTAL_PRICE,
      status: 'paid',
      paid_at: new Date().toISOString(),
    });
    console.log('Factuur aangemaakt (betaald)');
  } catch (e) {
    console.error('Factuur mislukt (batch staat wel):', e);
  }

  const { data: defaults } = await sb
    .from('app_settings')
    .select('key, value')
    .in('key', ['default_celebration_video_url', 'default_celebration_video_start', 'default_celebration_video_end']);

  const map = new Map((defaults || []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const { data: amFull } = await sb
    .from('admin_users')
    .select('id, name, avatar_url, celebration_video_url, celebration_video_start, celebration_video_end')
    .eq('id', BART_ID)
    .single();

  const hasOwnUrl = !!amFull?.celebration_video_url;
  const videoUrl = hasOwnUrl ? amFull!.celebration_video_url : map.get('default_celebration_video_url')?.trim() || null;
  const videoStart = hasOwnUrl ? amFull!.celebration_video_start : Number(map.get('default_celebration_video_start')) || null;
  const videoEnd = hasOwnUrl ? amFull!.celebration_video_end : Number(map.get('default_celebration_video_end')) || null;

  await sb.from('celebration_events').insert({
    event_type: 'sale',
    payload: {
      customer: cust.name,
      branch: BRANCH_SLUG,
      amount: TOTAL_PRICE,
      batchId: batch.id,
      paidAt: new Date().toISOString(),
      amId: BART_ID,
      amName: amFull?.name || bart.name,
      amAvatarUrl: amFull?.avatar_url || null,
      celebrationVideoUrl: videoUrl,
      videoStart,
      videoEnd,
      videoIsFallback: !hasOwnUrl && !!videoUrl,
    },
  });

  console.log('Celebration event gequeued (live dashboard + video)');
  console.log('Klaar — Bart leaderboard/targets tellen batch mee (account_manager_id + total_price).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
