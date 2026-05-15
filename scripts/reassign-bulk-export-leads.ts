/**
 * Verplaats bulk-export naar de juiste klant + bulk-batch in het portaal.
 *
 * Twee scenario's:
 * 1) Er bestaan al `lead_assignments` met source=bulk_export voor de bronklant
 *    → UPDATE naar doelklant + juiste bulk-batch.
 * 2) Er is wel een `lead_exports`-rij met `lead_ids`, maar (nog) geen portal-toewijzing
 *    → INSERT van bulk_export-assignments voor de doelklant (zoals bij export + portal).
 *
 * Gebruik (projectroot, .env.local met service role):
 *   npx tsx scripts/reassign-bulk-export-leads.ts --dry-run
 *   npx tsx scripts/reassign-bulk-export-leads.ts --confirm
 *
 * Optioneel:
 *   FROM_NAME=PakketAdvies TO_NAME=Repkesales BRANCH=thuisbatterij EXPECT_COUNT=105
 *   EXPORT_ID=<uuid>   # aanbevolen als er meerdere exports zijn
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const dryRun = process.argv.includes('--dry-run');
const confirm = process.argv.includes('--confirm');

const fromName = (process.env.FROM_NAME || 'PakketAdvies').trim();
const toName = (process.env.TO_NAME || 'Repkesales').trim();
const branch = (process.env.BRANCH || 'thuisbatterij').trim();
const expectCount = Math.max(1, parseInt(process.env.EXPECT_COUNT || '105', 10));
const exportIdEnv = process.env.EXPORT_ID?.trim();

function ilikeName(col: string, term: string) {
  return `${col}.ilike.%${term.replace(/%/g, '')}%`;
}

async function main() {
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig (.env.local).');
    process.exit(1);
  }
  if (!dryRun && !confirm) {
    console.error('Geef --dry-run (alleen tonen) of --confirm (echt uitvoeren) mee.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: fromRows, error: fromErr } = await supabase
    .from('customers')
    .select('id, name')
    .or(ilikeName('name', fromName));
  if (fromErr || !fromRows?.length) {
    console.error('Bronklant niet gevonden:', fromName, fromErr?.message);
    process.exit(1);
  }
  if (fromRows.length > 1) {
    console.error('Meerdere bronklanten voor', fromName, ':', fromRows.map(r => `${r.name} (${r.id})`).join(', '));
    process.exit(1);
  }
  const fromCustomer = fromRows[0];

  const { data: toRows, error: toErr } = await supabase
    .from('customers')
    .select('id, name')
    .or(ilikeName('name', toName));
  if (toErr || !toRows?.length) {
    console.error('Doelklant niet gevonden:', toName, toErr?.message);
    process.exit(1);
  }
  if (toRows.length > 1) {
    console.error('Meerdere doelklanten voor', toName, ':', toRows.map(r => `${r.name} (${r.id})`).join(', '));
    process.exit(1);
  }
  const toCustomer = toRows[0];

  if (fromCustomer.id === toCustomer.id) {
    console.error('Bron- en doelklant zijn hetzelfde.');
    process.exit(1);
  }

  const { data: bulkBatches, error: bbErr } = await supabase
    .from('customer_batches')
    .select('id, branch, batch_kind, status, is_paid, created_at')
    .eq('customer_id', toCustomer.id)
    .eq('branch', branch)
    .eq('batch_kind', 'bulk_leads')
    .eq('status', 'active')
    .neq('is_paid', false)
    .order('created_at', { ascending: false })
    .limit(3);

  if (bbErr || !bulkBatches?.length) {
    console.error(
      `Geen actieve betaalde bulk_leads-batch voor ${toCustomer.name} (${toCustomer.id}) op branch ${branch}.`,
      bbErr?.message,
    );
    process.exit(1);
  }
  const toBulkBatchId = bulkBatches[0].id as string;
  console.log('Doel bulk-batch:', toBulkBatchId, bulkBatches[0]);

  type ExportRow = {
    id: string;
    created_at: string;
    lead_count: number;
    lead_ids: string[] | null;
    filters: unknown;
    customer_id: string | null;
    added_to_portal: boolean | null;
  };

  let leadIds: string[] = [];
  let exportRow: ExportRow | null = null;

  if (exportIdEnv) {
    const { data: ex, error: exErr } = await supabase
      .from('lead_exports')
      .select('id, created_at, lead_count, lead_ids, filters, customer_id, added_to_portal')
      .eq('id', exportIdEnv)
      .maybeSingle();
    if (exErr || !ex) {
      console.error('EXPORT_ID niet gevonden:', exportIdEnv, exErr?.message);
      process.exit(1);
    }
    if (ex.customer_id !== fromCustomer.id) {
      console.error('Export customer_id komt niet overeen met bronklant:', ex.customer_id, 'vs', fromCustomer.id);
      process.exit(1);
    }
    exportRow = ex as ExportRow;
    leadIds = ex.lead_ids || [];
  } else {
    const { data: exports, error: exErr } = await supabase
      .from('lead_exports')
      .select('id, created_at, lead_count, lead_ids, filters, customer_id, added_to_portal')
      .eq('customer_id', fromCustomer.id)
      .eq('lead_count', expectCount)
      .order('created_at', { ascending: false })
      .limit(15);

    if (exErr) {
      console.error('lead_exports query:', exErr.message);
      process.exit(1);
    }

    const branchMatch = (exports || []).filter(row => {
      const f = row.filters as Record<string, unknown> | null;
      return f?.branch === branch;
    });

    if (branchMatch.length === 0) {
      console.error(
        `Geen lead_exports met filters.branch="${branch}" voor ${fromCustomer.name}, lead_count=${expectCount}. ` +
          `Zet EXPORT_ID=... op de juiste rij.`,
      );
      process.exit(1);
    }

    exportRow = branchMatch[0] as ExportRow;
    leadIds = exportRow.lead_ids || [];

    if (branchMatch.length > 1) {
      console.warn('Meerdere exports met deze branch+telling; neem de nieuwste. Kandidaten:');
      for (const c of branchMatch) {
        console.warn(' ', c.id, c.created_at, 'added_to_portal', c.added_to_portal, c.filters);
      }
    }
  }

  if (!leadIds.length) {
    console.error('Geen lead_ids op de export-rij; kan niet veilig matchen.');
    process.exit(1);
  }

  console.log(
    'Export:',
    exportRow?.id,
    exportRow?.created_at,
    'lead_ids:',
    leadIds.length,
    'added_to_portal:',
    exportRow?.added_to_portal,
  );

  const { data: assignments, error: asgErr } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, customer_id, batch_id, source, assigned_at')
    .eq('customer_id', fromCustomer.id)
    .eq('source', 'bulk_export')
    .in('lead_id', leadIds);

  if (asgErr) {
    console.error('lead_assignments:', asgErr.message);
    process.exit(1);
  }

  const rowsFrom = assignments || [];

  const { data: branchCheck, error: bcErr } = await supabase.from('leads').select('id, branch').in('id', leadIds);
  if (bcErr) {
    console.error('Branch check:', bcErr.message);
    process.exit(1);
  }
  if ((branchCheck || []).length !== leadIds.length) {
    console.error('Niet alle lead_ids bestaan in leads:', leadIds.length, 'vs', branchCheck?.length);
    process.exit(1);
  }
  const wrongBranch = (branchCheck || []).filter(l => l.branch !== branch);
  if (wrongBranch.length) {
    console.error(`${wrongBranch.length} leads hebben niet branch=${branch}. Eerste:`, wrongBranch[0]);
    process.exit(1);
  }

  const { data: existingTo, error: exToErr } = await supabase
    .from('lead_assignments')
    .select('lead_id')
    .eq('customer_id', toCustomer.id)
    .in('lead_id', leadIds);
  if (exToErr) {
    console.error('Check bestaande doel-assignments:', exToErr.message);
    process.exit(1);
  }
  const toLeadSet = new Set((existingTo || []).map(r => r.lead_id));
  const overlap = leadIds.filter(id => toLeadSet.has(id));
  if (overlap.length) {
    console.error(
      `${overlap.length} leads hebben al een assignment bij ${toCustomer.name}; stop. Voorbeeld:`,
      overlap[0],
    );
    process.exit(1);
  }

  if (rowsFrom.length === leadIds.length) {
    console.log(`Modus: UPDATE — ${rowsFrom.length} bulk_export-rijen bij ${fromCustomer.name}.`);
  } else if (rowsFrom.length === 0) {
    console.log(`Modus: INSERT — geen bulk_export bij bron; ${leadIds.length} nieuwe rijen voor ${toCustomer.name}.`);
  } else {
    console.error(
      `Gedeeltelijk: ${rowsFrom.length} bulk_export-rijen bij bron, verwacht ${leadIds.length}. Handmatig nalopen.`,
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log('Dry-run: geen updates.');
    process.exit(0);
  }

  if (rowsFrom.length === leadIds.length) {
    const { error: upErr } = await supabase
      .from('lead_assignments')
      .update({ customer_id: toCustomer.id, batch_id: toBulkBatchId })
      .eq('customer_id', fromCustomer.id)
      .eq('source', 'bulk_export')
      .in('lead_id', leadIds);

    if (upErr) {
      console.error('Update mislukt:', upErr.message);
      process.exit(1);
    }
    console.log('lead_assignments geüpdatet (UPDATE).');
  } else {
    const assignedAt = exportRow?.created_at || new Date().toISOString();
    const toInsert = leadIds.map(leadId => ({
      lead_id: leadId,
      customer_id: toCustomer.id,
      batch_id: toBulkBatchId,
      source: 'bulk_export' as const,
      assigned_at: assignedAt,
    }));
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error: insErr } = await supabase.from('lead_assignments').insert(chunk);
      if (insErr) {
        console.error('Insert mislukt:', insErr.message);
        process.exit(1);
      }
    }
    console.log('lead_assignments ingevoegd (INSERT):', toInsert.length);
  }

  const { count: verifyCount } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', toCustomer.id)
    .eq('source', 'bulk_export')
    .eq('batch_id', toBulkBatchId)
    .in('lead_id', leadIds);

  console.log('Controle: bulk_export bij doel+batch voor deze leads:', verifyCount, '(verwacht', leadIds.length, ')');

  if (exportRow?.id) {
    const prevFilters = (exportRow.filters as Record<string, unknown>) || {};
    const { error: exUp } = await supabase
      .from('lead_exports')
      .update({
        customer_id: toCustomer.id,
        customer_name: toCustomer.name,
        added_to_portal: true,
        filters: {
          ...prevFilters,
          bulk_batch_id: toBulkBatchId,
          reassigned_from_customer_id: fromCustomer.id,
          reassigned_from_customer_name: fromCustomer.name,
          reassigned_at: new Date().toISOString(),
        },
      })
      .eq('id', exportRow.id);

    if (exUp) {
      console.error('lead_exports bijwerken mislukt (assignments wel aangepast):', exUp.message);
      process.exit(1);
    }
    console.log('lead_exports audit bijgewerkt:', exportRow.id);
  }

  console.log('Klaar.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
