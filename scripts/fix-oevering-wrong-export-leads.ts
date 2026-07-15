/**
 * Verwijdert bulk_export-toewijzingen bij Oevering waar lead.branch !== thuisbatterij.
 *
 *   npx tsx scripts/fix-oevering-wrong-export-leads.ts --dry-run
 *   npx tsx scripts/fix-oevering-wrong-export-leads.ts --confirm
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { syncBatchDelivered } from '../src/lib/batchSync';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const CID = 'aae97e7d-ae4a-40b7-b279-a56243999c7c';
const CUSTOMER_BRANCH = 'thuisbatterij';
const BAD_EXPORT_ID = '924bc134-39df-4bce-b60a-257d19e97a98';

const dryRun = process.argv.includes('--dry-run');
const confirm = process.argv.includes('--confirm');

async function main() {
  if (!dryRun && !confirm) {
    console.error('Geef --dry-run of --confirm mee.');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const sb = createClient(url, key);

  const { data: rows, error } = await sb
    .from('lead_assignments')
    .select('id, lead_id, batch_id, leads(branch, naam_klant)')
    .eq('customer_id', CID)
    .eq('source', 'bulk_export');

  if (error) throw error;

  const wrong = (rows || []).filter(r => (r.leads as { branch?: string } | null)?.branch !== CUSTOMER_BRANCH);
  console.log(`Gevonden: ${wrong.length} verkeerde bulk_export-toewijzingen bij Oevering`);
  for (const r of wrong) {
    const l = r.leads as { branch?: string; naam_klant?: string };
    console.log(` - ${l.naam_klant} (${l.branch}) assignment=${r.id} batch=${r.batch_id}`);
  }

  if (wrong.length === 0) {
    console.log('Niets te doen.');
    return;
  }

  const leadIds = wrong.map(r => r.lead_id);
  const assignmentIds = wrong.map(r => r.id);
  const batchIds = [...new Set(wrong.map(r => r.batch_id).filter(Boolean))] as string[];

  if (dryRun) {
    console.log('\nDry-run: geen wijzigingen.');
    return;
  }

  const { error: delErr } = await sb.from('lead_assignments').delete().in('id', assignmentIds);
  if (delErr) throw delErr;
  console.log(`Verwijderd: ${assignmentIds.length} lead_assignments`);

  const CHUNK = 500;
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK);
    const { error: rpcErr } = await sb.rpc('decrement_bulk_export_count', { lead_ids: chunk });
    if (rpcErr) throw rpcErr;
  }
  console.log(`bulk_export_count verlaagd voor ${leadIds.length} leads`);

  for (const batchId of batchIds) {
    const count = await syncBatchDelivered(sb, batchId);
    console.log(`syncBatchDelivered ${batchId}: ${count} assignments`);
  }

  const { data: ex } = await sb.from('lead_exports').select('lead_ids').eq('id', BAD_EXPORT_ID).maybeSingle();
  if (ex?.lead_ids) {
    const keepIds = (ex.lead_ids as string[]).filter(id => !leadIds.includes(id));
    await sb.from('lead_exports').update({ lead_ids: keepIds, lead_count: keepIds.length }).eq('id', BAD_EXPORT_ID);
    console.log(`lead_exports ${BAD_EXPORT_ID} bijgewerkt: ${keepIds.length} lead(s) over`);
  }

  const { count: remaining } = await sb
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', CID);
  console.log(`\nOevering heeft nu ${remaining} lead_assignments totaal.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
