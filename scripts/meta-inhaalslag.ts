/**
 * Inhaalslag: de leads van Meta-formulier "Jens oud formulier - Final Final"
 * die nooit in het CRM zijn aangekomen alsnog inladen.
 *
 * Dat formulier hangt onder vijf thuisbatterij-campagnes maar is nooit
 * aangesloten in Zapier. Sinds 24 juli zijn er daardoor 182 leads verloren
 * gegaan waar wel advertentiegeld voor is betaald.
 *
 * Het script volgt exact de weg die een lead normaal aflegt via
 * src/app/api/admin/webhook/leads/route.ts, met twee bewuste afwijkingen:
 *
 *  1. Geen Meta-conversie-event. Die zou bij Meta als van vandaag tellen en
 *     daarmee de campagnecijfers vervuilen.
 *  2. Niet zelf verdelen. Dat laten we aan de bestaande cron, die elk kwartier
 *     draait en alle normale regels toepast: doelgebied, branche, batchruimte,
 *     dagplafond, twaalf uur tussen twee klanten en maximaal drie klanten.
 *
 * Gebruik:
 *   node meta-inhaalslag.cjs --tranche 1 --dry-run
 *   node meta-inhaalslag.cjs --tranche 1
 *   node meta-inhaalslag.cjs --infinite-scale        (na tranche 1)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { enrichLeadAddress } from '@/lib/pdok';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { calculateQualityScore } from '@/lib/leadQuality';
import { assignLeadToBatch } from '@/lib/assignLeadToBatch';

const BRON_BESTAND = process.env.LIJST || './jens-weg.json';
const VERSLAG = process.env.VERSLAG || './inhaalslag-verslag.json';
const TRANCHES = 3;
const INFINITE_SCALE = '5bb1dfc6-def7-4067-9723-e0713cc08c74';
const DIRECTE_PROVINCIES = ['Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Flevoland'];

/** Meta-veldnaam naar ons branche-veld. */
const VELDEN: Record<string, string> = {
  'heb_je_zonnepanelen?': 'zonnepanelen',
  'heb_je_een_dynamisch_energiecontract?': 'dynamisch_contract',
  'hoeveel_kwh_stroom_verbruik_je_per_jaar_ongeveer?': 'stroomverbruik',
  'wat_is_je_budget_voor_een_thuisbatterij?': 'budget',
  'voornaamste_reden_voor_je_interesse_in_een_thuisbatterij?': 'reden_thuisbatterij',
};

type MetaLead = {
  id: string; t: string; camp: string | null;
  email: string | null; tel: string | null; naam: string | null;
  postcode: string | null; huisnummer: string | null;
  velden: Record<string, string | null>;
};

const arg = (naam: string): string | null => {
  const i = process.argv.indexOf(naam);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
};
const heeft = (naam: string) => process.argv.includes(naam);
const staart = (t: string | null) => {
  const d = String(t ?? '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : null;
};

function verslagLezen(): Record<string, string[]> {
  return existsSync(VERSLAG) ? JSON.parse(readFileSync(VERSLAG, 'utf8')) : {};
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const droog = heeft('--dry-run');

  if (heeft('--infinite-scale')) return infiniteScale(supabase, droog);

  const tranche = Number(arg('--tranche') || 0);
  if (!tranche || tranche < 1 || tranche > TRANCHES) {
    console.error(`Geef --tranche 1 t/m ${TRANCHES} op, of --infinite-scale.`);
    process.exit(1);
  }

  /* Vaste volgorde op Meta-id: dezelfde lead zit altijd in dezelfde tranche,
     ook als het script opnieuw draait. */
  const alle: MetaLead[] = JSON.parse(readFileSync(BRON_BESTAND, 'utf8'))
    .slice()
    .sort((a: MetaLead, b: MetaLead) => a.id.localeCompare(b.id));

  const perTranche = Math.ceil(alle.length / TRANCHES);
  const deel = alle.slice((tranche - 1) * perTranche, tranche * perTranche);
  console.log(`Tranche ${tranche} van ${TRANCHES}: ${deel.length} leads van de ${alle.length}${droog ? '  (PROEFDRAAI)' : ''}\n`);

  /* Ontdubbelen tegen wat er nu staat, op e-mail én telefoon en
     hoofdletterongevoelig. Onze eigen intake vergelijkt hoofdlettergevoelig;
     precies daardoor leken eerder 129 leads te ontbreken die er gewoon in
     stonden, alleen met een hoofdletter vooraan het e-mailadres. */
  const mails = new Set<string>(), tels = new Set<string>();
  for (let p = 0; p < 40; p++) {
    const { data } = await supabase.from('leads').select('email, telefoonnummer, created_at')
      .gte('created_at', '2026-07-01T00:00:00Z').order('created_at').range(p * 1000, p * 1000 + 999);
    if (!data?.length) break;
    for (const r of data) {
      if (r.email) mails.add(String(r.email).toLowerCase().trim());
      const s = staart(r.telefoonnummer);
      if (s) tels.add(s);
    }
    if (data.length < 1000) break;
  }

  const vandaag = new Date().toISOString().split('T')[0];
  const gemaakt: string[] = [];
  const overgeslagen: Record<string, number> = {};
  const provincies: Record<string, number> = {};
  const sla = (reden: string) => { overgeslagen[reden] = (overgeslagen[reden] ?? 0) + 1; };

  for (const m of deel) {
    const email = (m.email ?? '').toLowerCase().trim();
    const tel = staart(m.tel);
    if ((email && mails.has(email)) || (tel && tels.has(tel))) { sla('stond er al in'); continue; }
    if (!m.naam) { sla('geen naam'); continue; }

    const customFields: Record<string, string> = {};
    for (const [metaKey, onsKey] of Object.entries(VELDEN)) {
      const v = m.velden?.[metaKey];
      if (v) customFields[onsKey] = String(v);
    }

    const lead = await enrichLeadAddress({
      branch: 'thuisbatterij',
      naam_klant: m.naam,
      email: m.email ?? '',
      telefoonnummer: m.tel ?? '',
      phone_valid: isPhoneValid(m.tel ?? ''),
      postcode: m.postcode ?? '',
      huisnummer: m.huisnummer ?? '',
      plaatsnaam: '',
      provincie: '',
      land: '',
      wervingsdatum: vandaag,
      status: 'nieuw',
      bron: 'zapier',
      notities: '',
      custom_fields: customFields,
      ...(m.camp && { meta_campaign_id: m.camp }),
      meta_leadgen_id: String(m.id),
    });

    if (checkLeadProfanity(lead as Record<string, unknown>).blocked) { sla('ongepaste inhoud'); continue; }

    const prov = (lead as { provincie?: string }).provincie || '(onbekend)';
    provincies[prov] = (provincies[prov] ?? 0) + 1;

    if (droog) { gemaakt.push('(proefdraai)'); continue; }

    const quality_score = calculateQualityScore(lead);
    const { data, error } = await supabase.from('leads').insert({ ...lead, quality_score }).select('id').single();
    if (error) { console.error('  inserten mislukt:', m.naam, error.message); sla('inserten mislukt'); continue; }
    gemaakt.push(data.id);
    if (email) mails.add(email);
    if (tel) tels.add(tel);
  }

  console.log(droog ? 'zou inladen:' : 'ingeladen:', gemaakt.length);
  if (Object.keys(overgeslagen).length) {
    console.log('overgeslagen:');
    for (const [k, n] of Object.entries(overgeslagen)) console.log('  ', String(n).padStart(3), k);
  }
  console.log('\nper provincie:');
  for (const [k, n] of Object.entries(provincies).sort((a, b) => b[1] - a[1])) {
    const direct = DIRECTE_PROVINCIES.includes(k) ? '  <- direct naar Infinite Scale' : '';
    console.log('  ', String(n).padStart(3), k + direct);
  }

  if (!droog) {
    const verslag = verslagLezen();
    verslag[`tranche-${tranche}`] = gemaakt;
    writeFileSync(VERSLAG, JSON.stringify(verslag, null, 1));
    console.log(`\nlead-ids weggeschreven naar ${VERSLAG} (nodig om terug te draaien)`);
  }
}

/** Alle ingeladen leads uit de vier provincies in één keer naar Infinite Scale. */
async function infiniteScale(supabase: ReturnType<typeof createClient>, droog: boolean) {
  const verslag = verslagLezen();
  const ids = Object.values(verslag).flat();
  if (!ids.length) { console.error('Geen ingeladen leads gevonden; draai eerst een tranche.'); process.exit(1); }

  const { data: batch } = await supabase.from('customer_batches')
    .select('id, batch_size, leads_delivered').eq('customer_id', INFINITE_SCALE)
    .eq('status', 'active').eq('branch', 'thuisbatterij').maybeSingle();
  if (!batch) { console.error('Infinite Scale heeft geen actieve thuisbatterij-batch.'); process.exit(1); }

  const { data: klant } = await supabase.from('customers')
    .select('id, branches').eq('id', INFINITE_SCALE).maybeSingle();

  const { data: leads } = await supabase.from('leads')
    .select('*').in('id', ids).in('provincie', DIRECTE_PROVINCIES);

  console.log(`leads in ${DIRECTE_PROVINCIES.join(', ')}: ${leads?.length ?? 0}`);
  if (droog) { console.log('(PROEFDRAAI, niets toegewezen)'); return; }

  let ok = 0;
  for (const lead of leads ?? []) {
    const r = await assignLeadToBatch({
      supabase: supabase as never,
      lead,
      customer: { id: klant!.id, branches: (klant!.branches as string[] | null) ?? null },
      batchId: batch.id,
      source: 'distribution',
    });
    if (r.ok) ok++;
    else console.log('  overgeslagen:', lead.naam_klant, '::', r.reason);
  }
  console.log('toegewezen aan Infinite Scale:', ok);
}

main().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
