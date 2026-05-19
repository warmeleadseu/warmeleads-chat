import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { getMetaCredentials } from '@/lib/meta';
import { createServerClient } from '@/lib/supabase';
import { enrichLeadAddress } from '@/lib/pdok';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { calculateQualityScore } from '@/lib/leadQuality';
import { distributeLead } from '@/lib/distribution';
import { syncBatchDelivered } from '@/lib/batchSync';
import {
  findRecentPartnerProspectByEmail,
  insertPartnerProspectFromEnrichedLeadRow,
  isPartnerProspectBranch,
} from '@/lib/partnerProspectIngest';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

/* ─── Auto-mapping logic (used for suggestions) ───────────────────────── */

const EXACT_MAP: Record<string, string> = {
  email: 'email', full_name: 'naam_klant', first_name: '_first',
  last_name: '_last', phone_number: 'telefoonnummer', phone: 'telefoonnummer',
  telefoon: 'telefoonnummer', telefoonnummer: 'telefoonnummer', mobiel: 'telefoonnummer',
  street_address: '_street', straat: '_street', adres: '_street', address: '_street',
  city: 'plaatsnaam', stad: 'plaatsnaam', plaats: 'plaatsnaam', woonplaats: 'plaatsnaam',
  plaatsnaam: 'plaatsnaam', zip_code: 'postcode', post_code: 'postcode',
  postcode: 'postcode', zip: 'postcode', huisnummer: 'huisnummer',
  house_number: 'huisnummer', state: 'provincie', provincie: 'provincie',
  country: 'land', land: 'land', naam: 'naam_klant', name: 'naam_klant',
  achternaam: '_last', voornaam: '_first',
};

const KEYWORD_MAP: [RegExp, string][] = [
  [/e-?mail/i, 'email'],
  [/(?:voor|achter)?naam|name/i, 'naam_klant'],
  [/tele|phone|mobiel|gsm|bel/i, 'telefoonnummer'],
  [/post\s?code|zip/i, 'postcode'],
  [/huis\s?n|house/i, 'huisnummer'],
  [/straat|street|adres|address/i, '_street'],
  [/stad|city|woon\s?plaats|plaats/i, 'plaatsnaam'],
  [/provin|state/i, 'provincie'],
  [/land|country/i, 'land'],
];

function autoMapFieldName(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  if (EXACT_MAP[lower]) return EXACT_MAP[lower];
  for (const [re, target] of KEYWORD_MAP) {
    if (re.test(lower)) return target;
  }
  return null;
}

const NL_POSTCODE_RE = /\d{4}\s?[A-Za-z]{2}/;

interface MetaLead {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
}

type FieldMapping = Record<string, string>; // meta_field_name → crm_field

function cleanPostcode(raw: string): string {
  if (!raw) return '';
  const stripped = raw.replace(/\s+/g, '').toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(stripped)) return stripped;
  const match = raw.match(/(\d{4})\s?([A-Za-z]{2})/);
  if (match) return (match[1] + match[2]).toUpperCase();
  const digitsOnly = stripped.match(/^(\d{4})/);
  if (digitsOnly) return digitsOnly[1];
  return raw.trim();
}

function parseMetaLeadWithMapping(ml: MetaLead, branch: string, mapping: FieldMapping): Record<string, string> {
  const result: Record<string, string> = { branch };
  const extras: Record<string, string> = {};

  for (const field of ml.field_data) {
    const val = field.values?.[0] || '';
    if (!val) continue;

    const target = mapping[field.name] || autoMapFieldName(field.name);
    if (!target || target === '_skip') continue;

    if (target === '_first') {
      extras._first = val;
    } else if (target === '_last') {
      extras._last = val;
    } else if (target === '_street') {
      extras._street = val;
    } else if (target === 'naam_klant') {
      if (!result.naam_klant) result.naam_klant = val;
    } else {
      if (!result[target]) result[target] = val;
    }
  }

  if (!result.naam_klant && (extras._first || extras._last)) {
    result.naam_klant = [extras._first, extras._last].filter(Boolean).join(' ');
  }

  if (extras._street) {
    if (!result.postcode) {
      const pcMatch = extras._street.match(NL_POSTCODE_RE);
      if (pcMatch) result.postcode = pcMatch[0].replace(/\s/g, '').toUpperCase();
    }
    if (!result.huisnummer) {
      const hnMatch = extras._street.match(/\b(\d{1,5})\s*[A-Za-z]?\b/);
      if (hnMatch) result.huisnummer = hnMatch[1];
    }
  }

  if (result.postcode) result.postcode = cleanPostcode(result.postcode);

  result.wervingsdatum = ml.created_time
    ? ml.created_time.split('T')[0]
    : new Date().toISOString().split('T')[0];

  return result;
}

async function fetchMetaLeads(
  formId: string, token: string, since: number, until: number, limit?: number,
): Promise<{ leads: MetaLead[]; error?: string; permissionError?: boolean }> {
  const leads: MetaLead[] = [];
  try {
    let url: string | null =
      `${META_GRAPH_URL}/${formId}/leads?fields=id,created_time,field_data,ad_id,adset_id,campaign_id` +
      `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}},{"field":"time_created","operator":"LESS_THAN","value":${until}}]` +
      `&limit=${limit || 500}&access_token=${token}`;

    while (url) {
      const response: Response = await fetch(url);
      const data = await response.json();
      if (data.error) {
        const msg = data.error.message || 'Meta API fout';
        const isPerm = msg.includes('permission') || msg.includes('leads_retrieve') || msg.includes('#100');
        return { leads: [], error: isPerm
          ? 'Geen toestemming om leads op te halen. Voeg "leads_retrieve" permissie toe aan je System User in Meta Business Manager.'
          : msg, permissionError: isPerm };
      }
      leads.push(...(data.data || []));
      if (limit && leads.length >= limit) break;
      url = data.paging?.next || null;
    }
  } catch {
    return { leads: [], error: 'Kon leads niet ophalen van Meta' };
  }
  return { leads: limit ? leads.slice(0, limit) : leads };
}

/* ─── CRM field options ────────────────────────────────────────────────── */
const STANDARD_CRM_FIELDS = [
  { key: 'naam_klant', label: 'Naam klant' },
  { key: '_first', label: 'Voornaam (wordt gecombineerd)' },
  { key: '_last', label: 'Achternaam (wordt gecombineerd)' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefoonnummer', label: 'Telefoonnummer' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'huisnummer', label: 'Huisnummer' },
  { key: '_street', label: 'Straat/adres (postcode + nr extractie)' },
  { key: 'plaatsnaam', label: 'Plaatsnaam' },
  { key: 'provincie', label: 'Provincie' },
  { key: 'land', label: 'Land' },
  { key: '_skip', label: '⊘ Overslaan' },
];

/* ═══════════════════════════════════════════════════════════════════════ */
/* POST: Import leads OR preview mapping                                  */
/* ═══════════════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const body = await request.json();
  const { form_id, branch, webhook_key_id, field_mapping, preview } = body;
  const dateFrom = body.date_from as string | undefined;
  const dateTo = body.date_to as string | undefined;
  const days = body.days as number | undefined;

  if (!form_id || !branch) {
    return NextResponse.json({ error: 'form_id en branch zijn verplicht' }, { status: 400 });
  }
  if (!dateFrom && !days) {
    return NextResponse.json({ error: 'date_from of days is verplicht' }, { status: 400 });
  }

  const credentials = await getMetaCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'Meta API niet geconfigureerd' }, { status: 400 });
  }

  const supabase = createServerClient();

  const sinceDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - (days || 1) * 86_400_000);
  sinceDate.setHours(0, 0, 0, 0);
  const since = Math.floor(sinceDate.getTime() / 1000);
  const untilDate = dateTo ? new Date(dateTo) : new Date();
  untilDate.setHours(23, 59, 59, 999);
  const until = Math.floor(untilDate.getTime() / 1000);

  /* ── PREVIEW MODE: fetch sample + return mapping suggestions ───────── */
  if (preview) {
    const { leads, error, permissionError } = await fetchMetaLeads(form_id, credentials.accessToken, since, until, 3);
    if (error) return NextResponse.json({ error, permissionError }, { status: permissionError ? 403 : 400 });
    if (leads.length === 0) return NextResponse.json({ error: 'Geen leads gevonden in deze periode' }, { status: 404 });

    // Get saved mapping for this form
    const { data: savedRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', `field_mapping:${form_id}`)
      .single();
    const savedMapping: FieldMapping = savedRow ? JSON.parse(savedRow.value) : {};

    // Get branch custom fields
    const { data: branchRow } = await supabase.from('branches').select('id').eq('slug', branch).single();
    const { data: branchFields } = await supabase
      .from('branch_fields')
      .select('key, label')
      .eq('branch_id', branchRow?.id || '');

    // Build field list from sample leads
    const fieldNames = new Map<string, string>();
    for (const lead of leads) {
      for (const field of lead.field_data || []) {
        if (!fieldNames.has(field.name)) {
          fieldNames.set(field.name, field.values?.[0] || '');
        }
      }
    }

    const fields = [...fieldNames.entries()].map(([name, sampleValue]) => ({
      meta_name: name,
      sample_value: sampleValue,
      suggested: savedMapping[name] || autoMapFieldName(name) || '',
    }));

    const customFields = (branchFields || []).map((f: { key: string; label: string }) => ({
      key: f.key,
      label: f.label || f.key,
    }));

    return NextResponse.json({
      preview: true,
      total_leads: leads.length,
      fields,
      standard_crm_fields: STANDARD_CRM_FIELDS,
      custom_crm_fields: customFields,
      saved_mapping: Object.keys(savedMapping).length > 0 ? savedMapping : null,
    });
  }

  /* ── IMPORT MODE ───────────────────────────────────────────────────── */
  const mapping: FieldMapping = field_mapping || {};

  // Save mapping for this form
  if (Object.keys(mapping).length > 0) {
    await supabase.from('app_settings').upsert({
      key: `field_mapping:${form_id}`,
      value: JSON.stringify(mapping),
    }, { onConflict: 'key' });
  }

  if (webhook_key_id) {
    await supabase.from('app_settings').upsert(
      { key: `webhook_form:${webhook_key_id}`, value: form_id },
      { onConflict: 'key' },
    );
  }

  const { leads: allMetaLeads, error: fetchError, permissionError: fetchPerm } =
    await fetchMetaLeads(form_id, credentials.accessToken, since, until);
  if (fetchError) return NextResponse.json({ error: fetchError, permissionError: fetchPerm }, { status: fetchPerm ? 403 : 400 });

  if (allMetaLeads.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, imported: 0, skipped: 0, message: 'Geen leads gevonden in deze periode' });
  }

  const { data: branchRow } = await supabase.from('branches').select('id').eq('slug', branch).single();
  const { data: branchFields } = await supabase
    .from('branch_fields')
    .select('key')
    .eq('branch_id', branchRow?.id || '');
  const fieldKeys = new Set((branchFields || []).map((f: { key: string }) => f.key));

  const COMMON_KEYS = new Set([
    'branch', 'naam_klant', 'email', 'telefoonnummer', 'postcode',
    'huisnummer', 'plaatsnaam', 'provincie', 'wervingsdatum', 'land',
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('email')
    .eq('branch', branch)
    .gte('created_at', thirtyDaysAgo);
  const existingEmails = new Set(
    (existingLeads || []).map(l => l.email?.toLowerCase()).filter(Boolean),
  );
  if (isPartnerProspectBranch(branch)) {
    const { data: existingProspects } = await supabase
      .from('prospects')
      .select('email')
      .contains('branches', [branch])
      .gte('created_at', thirtyDaysAgo);
    (existingProspects || []).forEach(p => {
      if (p.email) existingEmails.add(p.email.toLowerCase());
    });
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let profanityBlocked = 0;
  const importedIds: string[] = [];
  const errorSamples: string[] = [];

  for (const ml of allMetaLeads) {
    const parsed = parseMetaLeadWithMapping(ml, branch, mapping);

    if (parsed.email && existingEmails.has(parsed.email.toLowerCase())) {
      skipped++;
      continue;
    }

    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!COMMON_KEYS.has(k) && fieldKeys.has(k) && v) customFields[k] = v;
    }

    const phone = parsed.telefoonnummer || '';

    try {
      const metaCampaignId = ml.campaign_id || null;
      const metaAdsetId = ml.adset_id || null;
      const metaAdId = ml.ad_id || null;
      // ml.id is de Lead Ads submission-id (Graph API `lead_id`); cruciaal voor CAPI attribution.
      const metaLeadgenId = (ml as { id?: string }).id || null;

      const leadData = {
        branch,
        naam_klant: parsed.naam_klant || '',
        email: parsed.email || '',
        telefoonnummer: phone,
        phone_valid: isPhoneValid(phone),
        postcode: parsed.postcode || '',
        huisnummer: parsed.huisnummer || '',
        plaatsnaam: parsed.plaatsnaam || '',
        provincie: parsed.provincie || '',
        land: parsed.land || '',
        wervingsdatum: parsed.wervingsdatum || new Date().toISOString().split('T')[0],
        status: 'nieuw' as const,
        bron: 'zapier' as const,
        notities: '',
        custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
        ...(metaCampaignId && { meta_campaign_id: metaCampaignId }),
        ...(metaAdsetId && { meta_adset_id: metaAdsetId }),
        ...(metaAdId && { meta_ad_id: metaAdId }),
        ...(metaLeadgenId && { meta_leadgen_id: String(metaLeadgenId) }),
      };

      let lead;
      try { lead = await enrichLeadAddress(leadData); } catch { lead = leadData; }

      if (!lead.naam_klant) { skipped++; continue; }

      if (isPartnerProspectBranch(branch)) {
        if (lead.email) {
          const dup = await findRecentPartnerProspectByEmail(supabase, lead.email);
          if (dup) {
            skipped++;
            continue;
          }
        }
        const profanity = checkLeadProfanity(lead as Record<string, unknown>);
        if (profanity.blocked) { profanityBlocked++; skipped++; continue; }

        const pr = await insertPartnerProspectFromEnrichedLeadRow(
          supabase,
          lead as Record<string, unknown>,
          customFields,
          {
            title: 'Meta Lead Ads (Thuisbatterij Partners)',
            body: 'Geïmporteerd via admin backfill.',
            type: 'import',
          },
        );
        if (!pr) {
          errors++;
          if (errorSamples.length < 3) errorSamples.push(`Prospect insert (${parsed.email || parsed.naam_klant || 'onbekend'})`);
          continue;
        }
        imported++;
        importedIds.push(pr.id);
        if (parsed.email) existingEmails.add(parsed.email.toLowerCase());
        continue;
      }

      const profanity = checkLeadProfanity(lead as Record<string, unknown>);
      if (profanity.blocked) { profanityBlocked++; skipped++; continue; }

      const quality_score = calculateQualityScore(lead);
      const { data, error } = await supabase.from('leads').insert({ ...lead, quality_score }).select().single();

      if (error) {
        errors++;
        if (errorSamples.length < 3) errorSamples.push(`DB: ${error.message} (${parsed.email || parsed.naam_klant || 'onbekend'})`);
        continue;
      }

      imported++;
      importedIds.push(data.id);
      existingEmails.add((parsed.email || '').toLowerCase());

      if (data.lat && data.lng) {
        try { await distributeLead({ id: data.id, branch: data.branch, lat: data.lat, lng: data.lng }); } catch { /* ok */ }
      }
    } catch (err) {
      errors++;
      if (errorSamples.length < 3) errorSamples.push(`${err instanceof Error ? err.message : 'Onbekende fout'} (${parsed.email || parsed.naam_klant || 'onbekend'})`);
    }
  }

  if (importedIds.length > 0) {
    const runId = `backfill:${webhook_key_id || branch}:${Date.now()}`;
    await supabase.from('app_settings').upsert({
      key: runId,
      value: JSON.stringify({
        ...(isPartnerProspectBranch(branch)
          ? { prospect_ids: importedIds, ingest: 'prospect' as const }
          : { lead_ids: importedIds }),
        webhook_key_id: webhook_key_id || null,
        branch, form_id,
        date_from: dateFrom || null, date_to: dateTo || null,
        imported_at: new Date().toISOString(),
        count: importedIds.length,
      }),
    }, { onConflict: 'key' });
  }

  return NextResponse.json({
    ok: true,
    fetched: allMetaLeads.length,
    imported, skipped, errors,
    ...(profanityBlocked > 0 && { profanityBlocked }),
    ...(errorSamples.length > 0 && { errorDetails: errorSamples }),
  });
}

/* ─── GET: Backfill history ────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const webhookKeyId = request.nextUrl.searchParams.get('webhook_key_id') || '';
  const branch = request.nextUrl.searchParams.get('branch') || '';
  if (!webhookKeyId && !branch) return NextResponse.json({ runs: [] });

  const supabase = createServerClient();
  const prefix = `backfill:${webhookKeyId || branch}:`;
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', `${prefix}%`)
    .order('key', { ascending: false });

  const runs = (data || []).map(row => {
    try { return { id: row.key, ...JSON.parse(row.value) }; } catch { return null; }
  }).filter(Boolean);

  return NextResponse.json({ runs });
}

/* ─── DELETE: Undo a backfill run ──────────────────────────────────────── */

export async function DELETE(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const { run_id } = await request.json();
  if (!run_id) return NextResponse.json({ error: 'run_id is verplicht' }, { status: 400 });

  const supabase = createServerClient();
  const { data: row } = await supabase.from('app_settings').select('value').eq('key', run_id).single();
  if (!row) return NextResponse.json({ error: 'Backfill run niet gevonden' }, { status: 404 });

  let leadIds: string[] = [];
  try { leadIds = JSON.parse(row.value).lead_ids || []; } catch {
    return NextResponse.json({ error: 'Ongeldige run data' }, { status: 400 });
  }

  const affectedBatchIds = new Set<string>();

  if (leadIds.length > 0) {
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select('batch_id')
      .in('lead_id', leadIds);
    for (const a of assignments || []) {
      if (a.batch_id) affectedBatchIds.add(a.batch_id);
    }

    await supabase.from('lead_assignments').delete().in('lead_id', leadIds);
    await supabase.from('lead_feedback').delete().in('lead_id', leadIds);
    const { error } = await supabase.from('leads').delete().in('id', leadIds);
    if (error) return NextResponse.json({ error: `Kon leads niet verwijderen: ${error.message}` }, { status: 500 });
  }

  for (const batchId of affectedBatchIds) {
    await syncBatchDelivered(supabase, batchId);
  }

  await supabase.from('app_settings').delete().eq('key', run_id);
  return NextResponse.json({ ok: true, deleted: leadIds.length });
}
