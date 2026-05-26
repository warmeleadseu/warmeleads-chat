/**
 * Forceer Google Sheets sync voor alle lead-toewijzingen van één klant (opnieuw versturen).
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/force-google-sheets-resync-customer.ts --customer-name="Greenteam" --dry-run
 *   npx tsx scripts/force-google-sheets-resync-customer.ts --customer-name="Greenteam"
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { syncAssignmentToGoogleSheets } from '../src/lib/googleSheets/syncAssignment';
import { GOOGLE_SHEETS_PROVIDER } from '../src/lib/googleSheets/types';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full') });

const DRY_RUN = process.argv.includes('--dry-run');
const customerArg = process.argv.find((a) => a.startsWith('--customer-name='));
const customerNamePattern = customerArg?.split('=').slice(1).join('=').trim() || 'Greenteam';

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env ontbreekt (.env.local of .env.vercel.prod.full)');
  return createClient(url, key);
}

async function resolveCustomerId(sb: ReturnType<typeof supabase>): Promise<string> {
  const { data: rows, error } = await sb
    .from('customers')
    .select('id, name')
    .ilike('name', `%${customerNamePattern}%`);

  if (error) throw new Error(error.message);
  if (!rows?.length) {
    throw new Error(`Geen klant gevonden voor patroon "${customerNamePattern}"`);
  }
  if (rows.length > 1) {
    console.warn(
      'Meerdere klanten gevonden, neem eerste:',
      rows.map((r) => `${r.name} (${r.id})`).join(', '),
    );
  }
  return rows[0].id as string;
}

async function main() {
  const sb = supabase();
  const customerId = await resolveCustomerId(sb);

  const { data: customer } = await sb.from('customers').select('name').eq('id', customerId).single();
  console.log(`Klant: ${customer?.name ?? customerId}${DRY_RUN ? ' [DRY RUN]' : ''}`);

  const { data: integration } = await sb
    .from('customer_integrations')
    .select('id, connected_at, settings')
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER)
    .maybeSingle();

  if (!integration?.connected_at) {
    throw new Error('Geen actieve Google Sheets-koppeling voor deze klant');
  }

  const { data: assignments, error: assignErr } = await sb
    .from('lead_assignments')
    .select('id, lead_id, assigned_at')
    .eq('customer_id', customerId)
    .neq('source', 'demo')
    .order('assigned_at', { ascending: true });

  if (assignErr) throw new Error(assignErr.message);

  const list = assignments || [];
  console.log(`${list.length} toewijzing(en) gevonden.`);

  if (DRY_RUN) {
    console.log('Dry run — zou alle sync-logs resetten en opnieuw syncen.');
    return;
  }

  const assignmentIds = list.map((a) => a.id);
  if (assignmentIds.length > 0) {
    const { error: resetErr } = await sb
      .from('integration_sync_log')
      .delete()
      .eq('customer_id', customerId)
      .eq('provider', GOOGLE_SHEETS_PROVIDER)
      .in('assignment_id', assignmentIds);

    if (resetErr) throw new Error(`Sync-log reset mislukt: ${resetErr.message}`);
    console.log(`Sync-log gewist voor ${assignmentIds.length} toewijzing(en).`);
  }

  let synced = 0;
  let failed = 0;

  for (const a of list) {
    try {
      await syncAssignmentToGoogleSheets({
        customerId,
        leadId: a.lead_id,
        assignmentId: a.id,
        options: { forceResend: true },
      });
      synced++;
      if (synced % 10 === 0) console.log(`… ${synced}/${list.length} verstuurd`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${a.lead_id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Klaar: ${synced} verstuurd, ${failed} mislukt, ${list.length} totaal.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
