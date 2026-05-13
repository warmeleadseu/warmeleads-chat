/**
 * Onderhouds-batch: herschrijf plaatsnaam + provincie (en lat/lng als PDOK die levert)
 * voor leads in een gegeven branche, op basis van postcode + huisnummer.
 * NL: PDOK Locatieserver; BE (en fallback): Nominatim — zie `resolveAddress` in src/lib/pdok.ts.
 *
 * Gebruik (vanaf projectroot):
 *   npm run fix:lead-addresses -- --dry-run
 *   npm run fix:lead-addresses
 *   BRANCH=warmtepompen npm run fix:lead-addresses
 *
 * Vereist in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { resolveAddress } from '../src/lib/pdok';

config({ path: resolve(process.cwd(), '.env.local') });

const PAGE = 150;
const CONCURRENCY = 5;
/** BE gebruikt vooral Open-Meteo; Nominatim alleen als fallback (spaarzaam). */
const BATCH_PAUSE_MS = 280;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const dryRun = process.argv.includes('--dry-run');
/** Branche-slug in kolom leads.branch (standaard: zonnepanelen). */
const branch = (process.env.BRANCH || 'zonnepanelen').trim();

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig (.env.local).');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { count, error: countErr } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('branch', branch)
    .not('postcode', 'is', null)
    .neq('postcode', '');

  if (countErr) {
    console.error('Tellen mislukt:', countErr.message);
    process.exit(1);
  }

  console.log(`Branch: ${branch} — leads met postcode (huisnummer optioneel): ${count ?? '?'}`);
  if (dryRun) {
    console.log('Dry-run: geen updates.');
    process.exit(0);
  }

  let offset = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (;;) {
    const { data: page, error } = await supabase
      .from('leads')
      .select('id, branch, postcode, huisnummer, plaatsnaam, provincie, lat, lng, land, telefoonnummer, email')
      .eq('branch', branch)
      .not('postcode', 'is', null)
      .neq('postcode', '')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error('Fetch mislukt:', error.message);
      process.exit(1);
    }
    if (!page?.length) break;

    for (let i = 0; i < page.length; i += CONCURRENCY) {
      const batch = page.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async lead => {
          const result = await resolveAddress(
            lead.postcode as string,
            String(lead.huisnummer ?? ''),
            lead.land as 'NL' | 'BE' | null,
            lead.telefoonnummer as string | undefined,
            lead.email as string | undefined,
          );
          if (!result || (!result.plaatsnaam && !result.provincie)) {
            return { id: lead.id, kind: 'skip' as const };
          }
          const updates: Record<string, string | number> = {};
          if (result.plaatsnaam) updates.plaatsnaam = result.plaatsnaam;
          if (result.provincie) updates.provincie = result.provincie;
          if (result.lat != null && result.lng != null) {
            updates.lat = result.lat;
            updates.lng = result.lng;
          }
          // Land altijd gelijk trekken aan resolver (NL vs BE), zodat gemengde pools kloppen.
          if (result.land) updates.land = result.land;
          if (Object.keys(updates).length === 0) return { id: lead.id, kind: 'skip' as const };

          const { error: upErr } = await supabase.from('leads').update(updates).eq('id', lead.id);
          if (upErr) return { id: lead.id, kind: 'fail' as const, err: upErr.message };

          return { id: lead.id, kind: 'ok' as const };
        }),
      );

      for (const r of results) {
        if (r.kind === 'ok') {
          updated++;
        } else if (r.kind === 'fail') {
          failed++;
          console.warn(`Update mislukt ${r.id}:`, r.err);
        } else {
          skipped++;
        }
      }
      await sleep(BATCH_PAUSE_MS);
    }

    offset += page.length;
    if (page.length < PAGE) break;
    console.log(`… ${offset} verwerkt (ok: ${updated}, overgeslagen PDOK: ${skipped}, mislukt: ${failed})`);
  }

  console.log('Klaar.');
  console.log(`  Bijgewerkt: ${updated}`);
  console.log(`  PDOK geen resultaat / geen velden: ${skipped}`);
  console.log(`  DB-fout: ${failed}`);
  console.log('  (Geen automatische distributie — alleen adresvelden bijgewerkt.)');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
