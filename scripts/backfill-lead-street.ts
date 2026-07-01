/**
 * Backfill: leidt de straatnaam af uit postcode + huisnummer en zet die in
 * `leads.custom_fields.straat` voor bestaande leads die nog geen straat hebben.
 *
 * Nieuwe leads krijgen de straat automatisch bij ingestie (zie
 * `enrichLeadAddress` in src/lib/pdok.ts). Dit script is voor de terugwerkende
 * kracht en voor branches/imports van vóór die wijziging.
 *
 * Idempotent: leads die al een straat/adres in custom_fields hebben, worden
 * overgeslagen. Best-effort: een mislukte lookup laat de lead ongewijzigd.
 *
 * Vereist .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 *   npx tsx scripts/backfill-lead-street.ts --dry-run
 *   npx tsx scripts/backfill-lead-street.ts --branch=kozijnen
 *   npx tsx scripts/backfill-lead-street.ts            # alle branches
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { resolveStreetName } from '../src/lib/pdok';
import { createServerClient } from '../src/lib/supabase';

config({ path: resolve(process.cwd(), '.env.local') });

/** Kleine pauze tussen lookups; Nominatim (BE) heeft een strikte rate limit. */
const THROTTLE_MS = 300;
const PAGE_SIZE = 1000;

type LeadRow = {
  id: string;
  postcode: string | null;
  huisnummer: string | null;
  land: string | null;
  telefoonnummer: string | null;
  email: string | null;
  custom_fields: Record<string, unknown> | null;
};

function hasStreet(cf: Record<string, unknown> | null): boolean {
  if (!cf || typeof cf !== 'object') return false;
  const v = cf.straat ?? cf.street ?? cf.adres;
  return typeof v === 'string' && v.trim() !== '';
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const branchArg = process.argv.find(a => a.startsWith('--branch='))?.split('=')[1] || null;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig (.env.local).');
    process.exit(1);
  }

  const supabase = createServerClient();
  console.log(
    `Backfill straatnaam${branchArg ? ` voor branche '${branchArg}'` : ' (alle branches)'}` +
      `${dryRun ? ' — DRY RUN' : ''}`,
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let scanned = 0;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let q = supabase
      .from('leads')
      .select('id, postcode, huisnummer, land, telefoonnummer, email, custom_fields')
      .not('postcode', 'is', null)
      .not('huisnummer', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (branchArg) q = q.eq('branch', branchArg);

    const { data, error } = await q;
    if (error) {
      console.error('Leads ophalen mislukt:', error.message);
      process.exit(1);
    }
    const rows = (data || []) as LeadRow[];
    if (rows.length === 0) break;

    for (const lead of rows) {
      scanned++;
      const postcode = (lead.postcode ?? '').trim();
      const huisnummer = (lead.huisnummer ?? '').trim();
      if (!postcode || !huisnummer || hasStreet(lead.custom_fields)) {
        skipped++;
        continue;
      }

      const straat = await resolveStreetName(postcode, huisnummer, {
        land: (lead.land as 'NL' | 'BE' | null) ?? null,
        telefoonnummer: lead.telefoonnummer ?? undefined,
        email: lead.email ?? undefined,
      });
      await sleep(THROTTLE_MS);

      if (!straat) {
        failed++;
        continue;
      }

      if (dryRun) {
        updated++;
        console.log(`(dry) ${lead.id}: ${postcode} ${huisnummer} → ${straat}`);
        continue;
      }

      const cf =
        lead.custom_fields && typeof lead.custom_fields === 'object' && !Array.isArray(lead.custom_fields)
          ? (lead.custom_fields as Record<string, unknown>)
          : {};
      const { error: upErr } = await supabase
        .from('leads')
        .update({ custom_fields: { ...cf, straat } })
        .eq('id', lead.id);
      if (upErr) {
        failed++;
        console.error(`Update mislukt ${lead.id}:`, upErr.message);
      } else {
        updated++;
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  console.log(
    `Klaar. Gescand: ${scanned}, straat toegevoegd: ${updated}, overgeslagen (al ingevuld/incompleet): ${skipped}, mislukt: ${failed}.`,
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
