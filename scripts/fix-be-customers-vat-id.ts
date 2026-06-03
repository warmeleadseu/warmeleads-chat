/**
 * Eenmalige fix voor BE-klanten met onjuiste/missende vat_id.
 *
 *  - Belivert: vat_id wordt gezet op het officiële Belgische BTW-nummer (BE0831630290),
 *    opgehaald via KBO. Dat verandert de portal-display direct van 21% NL-BTW
 *    naar 'BTW verlegd' (€605 → €500 voor de openstaande batch).
 *  - JCS B.V en Total Energy: vat_id is bezet door e-mailadressen — wordt op null
 *    gezet zodat de waarschuwing voor onbekende BTW-id zichtbaar wordt.
 *  - Voor elke wijziging worden eventuele open invoices herberekend
 *    (recalcOpenInvoicesForCustomer) zodat al klaarstaande Mollie-betaallinks
 *    bij de eerstvolgende portaalklik een correct bedrag krijgen.
 *
 * Run: `npx tsx scripts/fix-be-customers-vat-id.ts`
 *      `npx tsx scripts/fix-be-customers-vat-id.ts --apply`  (default = dry-run)
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { recalcOpenInvoicesForCustomer } from '../src/lib/recalcOpenInvoices';
import { validateVatIdForCountry } from '../src/lib/invoiceVat';

config({ path: resolve(process.cwd(), '.env.vercel.prod.full') });

const APPLY = process.argv.includes('--apply');

type Update = {
  match: { name: string };
  next_vat_id: string | null;
  reason: string;
};

const UPDATES: Update[] = [
  {
    match: { name: 'Belivert' },
    next_vat_id: 'BE0831630290',
    reason: 'BTW-nummer ontbrak; opgezocht via KBO (BVBA Belivert, Zedelgem)',
  },
  {
    match: { name: 'JCS B.V' },
    next_vat_id: null,
    reason: 'vat_id bevatte een e-mailadres (bart@warmeleads.eu), gewist',
  },
  {
    match: { name: 'Total Energy' },
    next_vat_id: null,
    reason: 'vat_id bevatte een e-mailadres (info@warmeleads.eu), gewist',
  },
];

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log(APPLY ? '== APPLY ==' : '== DRY-RUN ==', '\n');

  for (const u of UPDATES) {
    const { data: customers } = await sb
      .from('customers')
      .select('id, name, country, vat_id')
      .eq('name', u.match.name);

    if (!customers || customers.length === 0) {
      console.log(`[skip] geen klant gevonden met naam '${u.match.name}'`);
      continue;
    }
    if (customers.length > 1) {
      console.log(`[skip] >1 match voor '${u.match.name}': ${customers.length}`);
      continue;
    }
    const c = customers[0];

    if (u.next_vat_id) {
      const v = validateVatIdForCountry(c.country ?? 'NL', u.next_vat_id);
      if (!v.ok) {
        console.log(`[skip] '${c.name}' validatie faalde: ${v.error}`);
        continue;
      }
    }

    console.log(`[${u.match.name}] ${c.id}`);
    console.log(`  country: ${c.country}`);
    console.log(`  vat_id : ${c.vat_id ?? 'null'}  →  ${u.next_vat_id ?? 'null'}`);
    console.log(`  reden  : ${u.reason}`);

    if (!APPLY) continue;

    const { error: upErr } = await sb
      .from('customers')
      .update({ vat_id: u.next_vat_id })
      .eq('id', c.id);
    if (upErr) {
      console.log(`  ✗ update mislukt: ${upErr.message}`);
      continue;
    }
    console.log('  ✓ klant geüpdatet');

    const recalced = await recalcOpenInvoicesForCustomer(sb as Parameters<typeof recalcOpenInvoicesForCustomer>[0], c.id);
    if (recalced.length > 0) {
      console.log(`  ✓ ${recalced.length} open factu(u)r(en) herberekend`);
      for (const r of recalced) {
        console.log(`    - ${r.invoice_number}: ${r.previous.vat_mode} (€${r.previous.total_incl_btw}) → ${r.next.vat_mode} (€${r.next.total_incl_btw})`);
      }
    } else {
      console.log('  - geen open invoices die herberekend hoefden te worden');
    }
    console.log('');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
