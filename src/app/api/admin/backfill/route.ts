import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { getMetaCredentials } from '@/lib/meta';
import { createServerClient } from '@/lib/supabase';
import { enrichLeadAddress } from '@/lib/pdok';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { calculateQualityScore } from '@/lib/leadQuality';
import { distributeLead } from '@/lib/distribution';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

/* ─── Field mapping: exact name → our field ────────────────────────────── */
const EXACT_MAP: Record<string, string> = {
  email: 'email',
  full_name: 'naam_klant',
  first_name: '_first',
  last_name: '_last',
  phone_number: 'telefoonnummer',
  phone: 'telefoonnummer',
  telefoon: 'telefoonnummer',
  telefoonnummer: 'telefoonnummer',
  mobiel: 'telefoonnummer',
  street_address: '_street',
  straat: '_street',
  adres: '_street',
  address: '_street',
  city: 'plaatsnaam',
  stad: 'plaatsnaam',
  plaats: 'plaatsnaam',
  woonplaats: 'plaatsnaam',
  plaatsnaam: 'plaatsnaam',
  zip_code: 'postcode',
  post_code: 'postcode',
  postcode: 'postcode',
  zip: 'postcode',
  huisnummer: 'huisnummer',
  house_number: 'huisnummer',
  state: 'provincie',
  provincie: 'provincie',
  country: 'land',
  land: 'land',
  naam: 'naam_klant',
  name: 'naam_klant',
  achternaam: '_last',
  voornaam: '_first',
};

/* ─── Keyword fallback: field name CONTAINS keyword → our field ────────── */
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

const NL_POSTCODE_RE = /\d{4}\s?[A-Za-z]{2}/;

interface MetaLead {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
}

function mapFieldName(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  if (EXACT_MAP[lower]) return EXACT_MAP[lower];
  for (const [re, target] of KEYWORD_MAP) {
    if (re.test(lower)) return target;
  }
  return null;
}

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

function parseMetaLead(ml: MetaLead, branch: string): Record<string, string> {
  const result: Record<string, string> = { branch };
  const extras: Record<string, string> = {};
  const unmapped: { name: string; value: string }[] = [];

  for (const field of ml.field_data) {
    const val = field.values?.[0] || '';
    if (!val) continue;

    const target = mapFieldName(field.name);

    if (target === '_first') {
      extras._first = val;
    } else if (target === '_last') {
      extras._last = val;
    } else if (target === '_street') {
      extras._street = val;
    } else if (target === 'naam_klant') {
      if (!result.naam_klant) result.naam_klant = val;
    } else if (target) {
      if (!result[target]) result[target] = val;
    } else {
      unmapped.push({ name: field.name.toLowerCase(), value: val });
      result[field.name.toLowerCase()] = val;
    }
  }

  // Combine first + last name
  if (!result.naam_klant && (extras._first || extras._last)) {
    result.naam_klant = [extras._first, extras._last].filter(Boolean).join(' ');
  }

  // Extract postcode + huisnummer from street address
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

  // Last resort: scan ALL unmapped values for a Dutch postcode pattern
  if (!result.postcode) {
    for (const { value } of unmapped) {
      const pcMatch = value.match(NL_POSTCODE_RE);
      if (pcMatch) {
        result.postcode = pcMatch[0].replace(/\s/g, '').toUpperCase();
        break;
      }
    }
  }

  // Clean postcode format
  if (result.postcode) {
    result.postcode = cleanPostcode(result.postcode);
  }

  result.wervingsdatum = ml.created_time
    ? ml.created_time.split('T')[0]
    : new Date().toISOString().split('T')[0];

  return result;
}

/* ─── Main handler ─────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const body = await request.json();
  const { form_id, branch, webhook_key_id } = body;
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

  if (webhook_key_id) {
    await supabase.from('app_settings').upsert(
      { key: `webhook_form:${webhook_key_id}`, value: form_id },
      { onConflict: 'key' },
    );
  }

  // ── Fetch leads from Meta ───────────────────────────────────────────
  const sinceDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - (days || 1) * 86_400_000);
  sinceDate.setHours(0, 0, 0, 0);
  const since = Math.floor(sinceDate.getTime() / 1000);

  const untilDate = dateTo ? new Date(dateTo) : new Date();
  untilDate.setHours(23, 59, 59, 999);
  const until = Math.floor(untilDate.getTime() / 1000);

  let allMetaLeads: MetaLead[] = [];

  try {
    let url: string | null =
      `${META_GRAPH_URL}/${form_id}/leads?fields=id,created_time,field_data,ad_id,adset_id,campaign_id` +
      `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}},{"field":"time_created","operator":"LESS_THAN","value":${until}}]` +
      `&limit=500&access_token=${credentials.accessToken}`;

    while (url) {
      const response: Response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        const msg = data.error.message || 'Meta API fout';
        if (msg.includes('permission') || msg.includes('leads_retrieve') || msg.includes('#100')) {
          return NextResponse.json({
            error: 'Geen toestemming om leads op te halen. Voeg "leads_retrieve" permissie toe aan je System User in Meta Business Manager.',
            permissionError: true,
          }, { status: 403 });
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      allMetaLeads.push(...(data.data || []));
      url = data.paging?.next || null;
    }
  } catch (err) {
    console.error('Meta form leads fetch error:', err);
    return NextResponse.json({ error: 'Kon leads niet ophalen van Meta' }, { status: 500 });
  }

  if (allMetaLeads.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, imported: 0, skipped: 0, message: 'Geen leads gevonden in deze periode' });
  }

  // ── Prepare branch fields ───────────────────────────────────────────
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

  // ── Pre-fetch existing emails for fast dedup ────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('email')
    .eq('branch', branch)
    .gte('created_at', thirtyDaysAgo);
  const existingEmails = new Set(
    (existingLeads || []).map(l => l.email?.toLowerCase()).filter(Boolean),
  );

  // ── Process each lead (same pipeline as webhook) ────────────────────
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let profanityBlocked = 0;
  const importedIds: string[] = [];
  const errorSamples: string[] = [];

  for (const ml of allMetaLeads) {
    const parsed = parseMetaLead(ml, branch);

    // 1) Deduplication
    if (parsed.email && existingEmails.has(parsed.email.toLowerCase())) {
      skipped++;
      continue;
    }

    // 2) Build custom_fields (same as webhook)
    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!COMMON_KEYS.has(k) && fieldKeys.has(k) && v) customFields[k] = v;
    }

    const phone = parsed.telefoonnummer || '';

    try {
      // 3) Enrich address via PDOK (same as webhook)
      const metaCampaignId = ml.campaign_id || null;
      const metaAdsetId = ml.adset_id || null;
      const metaAdId = ml.ad_id || null;

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
      };

      let lead;
      try {
        lead = await enrichLeadAddress(leadData);
      } catch {
        lead = leadData;
      }

      // 4) Skip if no name (same as webhook)
      if (!lead.naam_klant) {
        skipped++;
        continue;
      }

      // 5) Profanity check (same as webhook)
      const profanity = checkLeadProfanity(lead as Record<string, unknown>);
      if (profanity.blocked) {
        profanityBlocked++;
        skipped++;
        continue;
      }

      // 6) Quality score (same as webhook)
      const quality_score = calculateQualityScore(lead);

      // 7) Insert
      const { data, error } = await supabase.from('leads').insert({ ...lead, quality_score }).select().single();

      if (error) {
        errors++;
        if (errorSamples.length < 3) {
          errorSamples.push(`DB: ${error.message} (${parsed.email || parsed.naam_klant || 'onbekend'})`);
        }
        console.error('Backfill insert error:', error.message, parsed.email);
        continue;
      }

      imported++;
      importedIds.push(data.id);
      existingEmails.add((parsed.email || '').toLowerCase());

      // 8) Auto-distribute (same as webhook)
      if (data.lat && data.lng) {
        try {
          await distributeLead({ id: data.id, branch: data.branch, lat: data.lat, lng: data.lng });
        } catch { /* distribution failure should not block backfill */ }
      }
    } catch (err) {
      errors++;
      if (errorSamples.length < 3) {
        errorSamples.push(`${err instanceof Error ? err.message : 'Onbekende fout'} (${parsed.email || parsed.naam_klant || 'onbekend'})`);
      }
      console.error('Backfill error:', err, parsed.email);
    }
  }

  // Save backfill run for history/undo
  if (importedIds.length > 0) {
    const runId = `backfill:${webhook_key_id || branch}:${Date.now()}`;
    const formName = (await supabase.from('app_settings').select('value').eq('key', `backfill_form_name:${form_id}`).single())?.data?.value || form_id;
    await supabase.from('app_settings').upsert({
      key: runId,
      value: JSON.stringify({
        lead_ids: importedIds,
        webhook_key_id: webhook_key_id || null,
        branch,
        form_id,
        form_name: formName,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        imported_at: new Date().toISOString(),
        count: importedIds.length,
      }),
    }, { onConflict: 'key' });
  }

  return NextResponse.json({
    ok: true,
    fetched: allMetaLeads.length,
    imported,
    skipped,
    errors,
    ...(profanityBlocked > 0 && { profanityBlocked }),
    ...(errorSamples.length > 0 && { errorDetails: errorSamples }),
  });
}

/* ─── GET: Backfill history for a webhook key ──────────────────────────── */

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const webhookKeyId = request.nextUrl.searchParams.get('webhook_key_id') || '';
  const branch = request.nextUrl.searchParams.get('branch') || '';
  if (!webhookKeyId && !branch) {
    return NextResponse.json({ runs: [] });
  }

  const supabase = createServerClient();
  const prefix = `backfill:${webhookKeyId || branch}:`;

  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', `${prefix}%`)
    .order('key', { ascending: false });

  const runs = (data || []).map(row => {
    try {
      const parsed = JSON.parse(row.value);
      return { id: row.key, ...parsed };
    } catch { return null; }
  }).filter(Boolean);

  return NextResponse.json({ runs });
}

/* ─── DELETE: Undo a backfill run ──────────────────────────────────────── */

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { run_id } = await request.json();
  if (!run_id) {
    return NextResponse.json({ error: 'run_id is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: row } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', run_id)
    .single();

  if (!row) {
    return NextResponse.json({ error: 'Backfill run niet gevonden' }, { status: 404 });
  }

  let leadIds: string[] = [];
  try {
    const parsed = JSON.parse(row.value);
    leadIds = parsed.lead_ids || [];
  } catch {
    return NextResponse.json({ error: 'Ongeldige run data' }, { status: 400 });
  }

  if (leadIds.length > 0) {
    // Delete assignments first (foreign key)
    await supabase.from('lead_assignments').delete().in('lead_id', leadIds);
    await supabase.from('lead_feedback').delete().in('lead_id', leadIds);
    // Delete the leads
    const { error } = await supabase.from('leads').delete().in('id', leadIds);
    if (error) {
      console.error('Backfill undo delete error:', error);
      return NextResponse.json({ error: `Kon leads niet verwijderen: ${error.message}` }, { status: 500 });
    }
  }

  // Remove the backfill run record
  await supabase.from('app_settings').delete().eq('key', run_id);

  return NextResponse.json({ ok: true, deleted: leadIds.length });
}
