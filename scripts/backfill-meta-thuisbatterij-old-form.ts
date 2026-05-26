/**
 * Haal gemiste Meta Lead Ads leads op van het oude thuisbatterij-formulier.
 * Importeert zonder automatische distributie (toewijzing doen jullie later handmatig).
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/backfill-meta-thuisbatterij-old-form.ts --dry-run
 *   npx tsx scripts/backfill-meta-thuisbatterij-old-form.ts
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getMetaCredentials, META_GRAPH_URL } from '../src/lib/meta';
import { enrichLeadAddress } from '../src/lib/pdok';
import { isPhoneValid } from '../src/lib/phoneValidation';
import { checkLeadProfanity } from '../src/lib/profanityFilter';
import { calculateQualityScore } from '../src/lib/leadQuality';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const DRY_RUN = process.argv.includes('--dry-run');
const BRANCH = 'thuisbatterij';
const DATE_FROM = '2026-05-19';
const DATE_TO = '2026-05-26';
const OLD_FORM_ID = '961423323120969';
const OLD_WEBHOOK_KEY_ID = 'e97df070-fe6c-4d20-9b95-d825634b789b';
/** Actieve thuisbatterij-formulieren (Meta ads) + oud formulier voor volledigheid. */
const FORM_IDS = [
  OLD_FORM_ID,
  '4476176142665336', // Algemeen Formulier: Thuisbatterij (v1)
  '2526833207771154', // Algemeen Formulier: Thuisbatterij
];

/** Zapier veldnamen → CRM. */
const ZAPIER_FIELD_MAPPING: Record<string, string> = {
  naam_klant: 'naam_klant',
  email: 'email',
  telefoonnummer: 'telefoonnummer',
  postcode: 'postcode',
  huisnummer: 'huisnummer',
  plaatsnaam: 'plaatsnaam',
  provincie: 'provincie',
  zonnepanelen: 'zonnepanelen',
  dynamisch_contract: 'dynamisch_contract',
  stroomverbruik: 'stroomverbruik',
  budget: 'budget',
  reden_thuisbatterij: 'reden_thuisbatterij',
  ad_id: '_skip',
};

async function loadFieldMapping(
  sb: ReturnType<typeof supabase>,
  formId: string,
): Promise<Record<string, string>> {
  const { data: row } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', `field_mapping:${formId}`)
    .maybeSingle();
  if (row?.value) return JSON.parse(row.value) as Record<string, string>;

  const { data: oldRow } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', `field_mapping:${OLD_FORM_ID}`)
    .maybeSingle();
  if (oldRow?.value) return JSON.parse(oldRow.value) as Record<string, string>;

  return ZAPIER_FIELD_MAPPING;
}

type MetaLead = {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
};

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env ontbreekt');
  return createClient(url, key);
}

async function metaGet(path: string, token: string) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${META_GRAPH_URL}/${path}${sep}access_token=${token}`);
  return res.json();
}

async function resolveFormId(
  sb: ReturnType<typeof supabase>,
  token: string,
  explicitFormId?: string,
): Promise<string> {
  if (explicitFormId) return explicitFormId;

  const { data: formSetting } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', `webhook_form:${OLD_WEBHOOK_KEY_ID}`)
    .maybeSingle();
  if (formSetting?.value) {
    console.log(`Form ID uit app_settings: ${formSetting.value}`);
    return formSetting.value;
  }

  const { data: mappingRow } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', `field_mapping:${OLD_FORM_ID}`)
    .maybeSingle();
  if (mappingRow?.value) {
    console.log(`Form ID fallback: ${OLD_FORM_ID}`);
    return OLD_FORM_ID;
  }

  throw new Error(`Kon form niet vinden. Geef --form-id=${OLD_FORM_ID} mee.`);
}

async function fetchMetaLeads(
  formId: string,
  token: string,
  since: number,
  until: number,
): Promise<MetaLead[]> {
  const leads: MetaLead[] = [];
  let url: string | null =
    `${META_GRAPH_URL}/${formId}/leads?fields=id,created_time,field_data,ad_id,adset_id,campaign_id` +
    `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}},{"field":"time_created","operator":"LESS_THAN","value":${until}}]` +
    `&limit=500&access_token=${token}`;

  while (url) {
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Meta API fout');
    }
    leads.push(...(data.data || []));
    url = data.paging?.next || null;
  }
  return leads;
}

function parseMetaLead(ml: MetaLead, mapping: Record<string, string>) {
  const result: Record<string, string> = { branch: BRANCH };
  for (const field of ml.field_data || []) {
    const val = field.values?.[0] || '';
    if (!val) continue;
    const target = mapping[field.name] || mapping[field.name.toLowerCase()] || field.name;
    if (!target || target === '_skip') continue;
    if (!result[target]) result[target] = val;
  }
  result.wervingsdatum = ml.created_time ? ml.created_time.split('T')[0] : DATE_TO;
  return result;
}

async function main() {
  const formIdArg = process.argv.find((a) => a.startsWith('--form-id='))?.split('=')[1];
  const credentials = await getMetaCredentials();
  if (!credentials) throw new Error('Meta credentials niet geconfigureerd');

  const sb = supabase();
  const formIds = formIdArg ? [formIdArg] : FORM_IDS;
  const sinceDate = new Date(DATE_FROM);
  sinceDate.setHours(0, 0, 0, 0);
  const untilDate = new Date(DATE_TO);
  untilDate.setHours(23, 59, 59, 999);
  const since = Math.floor(sinceDate.getTime() / 1000);
  const until = Math.floor(untilDate.getTime() / 1000);

  console.log(`Formulieren: ${formIds.join(', ')}`);
  console.log(`Periode: ${DATE_FROM} t/m ${DATE_TO}${DRY_RUN ? ' [DRY RUN]' : ''}`);

  type MetaLeadWithForm = MetaLead & { formId: string };
  const metaLeads: MetaLeadWithForm[] = [];
  for (const formId of formIds) {
    const batch = await fetchMetaLeads(formId, credentials.accessToken, since, until);
    console.log(`  Form ${formId}: ${batch.length} lead(s)`);
    metaLeads.push(...batch.map((l) => ({ ...l, formId })));
  }
  console.log(`Opgehaald bij Meta (totaal): ${metaLeads.length} lead(s)`);

  if (metaLeads.length === 0) {
    console.log('Geen leads in deze periode.');
    return;
  }

  const metaIds = metaLeads.map((l) => l.id);
  const { data: existingByMeta } = await sb
    .from('leads')
    .select('meta_leadgen_id')
    .in('meta_leadgen_id', metaIds);
  const existingMetaIds = new Set((existingByMeta || []).map((r) => r.meta_leadgen_id));

  const { data: portalInPeriod } = await sb
    .from('leads')
    .select('email')
    .eq('branch', BRANCH)
    .gte('wervingsdatum', DATE_FROM)
    .lte('wervingsdatum', DATE_TO);
  const existingEmails = new Set(
    (portalInPeriod || [])
      .map((r) => (r.email || '').toLowerCase().trim())
      .filter(Boolean),
  );

  const { data: branchRow } = await sb.from('branches').select('id').eq('slug', BRANCH).single();
  const { data: branchFields } = await sb
    .from('branch_fields')
    .select('key')
    .eq('branch_id', branchRow?.id || '');
  const fieldKeys = new Set((branchFields || []).map((f: { key: string }) => f.key));
  const COMMON_KEYS = new Set([
    'branch', 'naam_klant', 'email', 'telefoonnummer', 'postcode',
    'huisnummer', 'plaatsnaam', 'provincie', 'wervingsdatum', 'land',
  ]);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const importedLeads: Array<{ id: string; naam: string; email: string; datum: string }> = [];

  for (const ml of metaLeads) {
    if (existingMetaIds.has(ml.id)) {
      skipped++;
      continue;
    }

    const mapping = await loadFieldMapping(sb, ml.formId);
    const parsed = parseMetaLead(ml, mapping);
    const emailLower = (parsed.email || '').toLowerCase().trim();
    if (emailLower && existingEmails.has(emailLower)) {
      skipped++;
      continue;
    }
    if (!parsed.naam_klant) {
      skipped++;
      continue;
    }

    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!COMMON_KEYS.has(k) && fieldKeys.has(k) && v) customFields[k] = v;
    }

    const phone = parsed.telefoonnummer || '';
    const leadData = {
      branch: BRANCH,
      naam_klant: parsed.naam_klant,
      email: parsed.email || '',
      telefoonnummer: phone,
      phone_valid: isPhoneValid(phone),
      postcode: parsed.postcode || '',
      huisnummer: parsed.huisnummer || '',
      plaatsnaam: parsed.plaatsnaam || '',
      provincie: parsed.provincie || '',
      land: parsed.land || 'NL',
      wervingsdatum: parsed.wervingsdatum,
      status: 'nieuw' as const,
      bron: 'zapier' as const,
      notities: 'Geïmporteerd via Meta backfill (oud formulier)',
      custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
      meta_campaign_id: ml.campaign_id || null,
      meta_adset_id: ml.adset_id || null,
      meta_ad_id: ml.ad_id || parsed.ad_id || null,
      meta_leadgen_id: ml.id,
    };

    if (DRY_RUN) {
      imported++;
      importedLeads.push({
        id: ml.id,
        naam: parsed.naam_klant,
        email: parsed.email || '',
        datum: parsed.wervingsdatum,
      });
      continue;
    }

    try {
      let lead;
      try {
        lead = await enrichLeadAddress(leadData);
      } catch {
        lead = leadData;
      }

      const profanity = checkLeadProfanity(lead as Record<string, unknown>);
      if (profanity.blocked) {
        skipped++;
        continue;
      }

      const quality_score = calculateQualityScore(lead);
      const { data, error } = await sb
        .from('leads')
        .insert({ ...lead, quality_score })
        .select('id, naam_klant, email, wervingsdatum')
        .single();

      if (error) {
        errors++;
        console.error(`Insert mislukt (${parsed.email || parsed.naam_klant}):`, error.message);
        continue;
      }

      imported++;
      existingMetaIds.add(ml.id);
      if (emailLower) existingEmails.add(emailLower);
      importedLeads.push({
        id: data.id,
        naam: data.naam_klant || '',
        email: data.email || '',
        datum: data.wervingsdatum || parsed.wervingsdatum,
      });
    } catch (err) {
      errors++;
      console.error(`Fout (${parsed.naam_klant}):`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n=== Resultaat ===');
  console.log(`Opgehaald bij Meta:     ${metaLeads.length}`);
  console.log(`Nieuw geïmporteerd:     ${imported}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`Overgeslagen (dup/leeg): ${skipped}`);
  console.log(`Fouten:                 ${errors}`);

  if (importedLeads.length > 0) {
    console.log('\nGeïmporteerde leads:');
    for (const l of importedLeads) {
      console.log(`  - ${l.datum} | ${l.naam} | ${l.email || 'geen e-mail'} | ${l.id}`);
    }
  }

  if (!DRY_RUN && imported > 0) {
    await sb.from('app_settings').upsert({
      key: `backfill:meta_old_form:${Date.now()}`,
      value: JSON.stringify({
        form_ids: formIds,
        date_from: DATE_FROM,
        date_to: DATE_TO,
        imported_at: new Date().toISOString(),
        lead_ids: importedLeads.map((l) => l.id),
        count: imported,
      }),
    }, { onConflict: 'key' });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
