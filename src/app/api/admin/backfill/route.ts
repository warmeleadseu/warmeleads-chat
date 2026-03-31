import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { getMetaCredentials } from '@/lib/meta';
import { createServerClient } from '@/lib/supabase';
import { enrichLeadAddress } from '@/lib/pdok';
import { isPhoneValid } from '@/lib/phoneValidation';
import { calculateQualityScore } from '@/lib/leadQuality';
import { distributeLead } from '@/lib/distribution';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

const FIELD_MAP: Record<string, string> = {
  email: 'email',
  full_name: 'naam_klant',
  first_name: '_first',
  last_name: '_last',
  phone_number: 'telefoonnummer',
  phone: 'telefoonnummer',
  street_address: '_street',
  city: 'plaatsnaam',
  zip_code: 'postcode',
  post_code: 'postcode',
  state: 'provincie',
  country: 'land',
};

interface MetaLead {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
}

function parseMetaLead(ml: MetaLead, branch: string): Record<string, string> {
  const result: Record<string, string> = { branch };
  const extras: Record<string, string> = {};

  for (const field of ml.field_data) {
    const val = field.values?.[0] || '';
    if (!val) continue;

    const mapped = FIELD_MAP[field.name.toLowerCase()];
    if (mapped === '_first') {
      extras._first = val;
    } else if (mapped === '_last') {
      extras._last = val;
    } else if (mapped === '_street') {
      extras._street = val;
    } else if (mapped) {
      result[mapped] = val;
    } else {
      result[field.name.toLowerCase()] = val;
    }
  }

  if (!result.naam_klant && (extras._first || extras._last)) {
    result.naam_klant = [extras._first, extras._last].filter(Boolean).join(' ');
  }

  if (extras._street && !result.postcode) {
    const pcMatch = extras._street.match(/(\d{4}\s?[A-Za-z]{2})/);
    if (pcMatch) result.postcode = pcMatch[1].replace(/\s/g, '').toUpperCase();
    const hnMatch = extras._street.match(/\b(\d{1,5})\b/);
    if (hnMatch && !result.huisnummer) result.huisnummer = hnMatch[1];
  }

  result.wervingsdatum = ml.created_time ? ml.created_time.split('T')[0] : new Date().toISOString().split('T')[0];

  return result;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { form_id, branch, days, webhook_key_id } = await request.json();

  if (!form_id || !branch || !days) {
    return NextResponse.json({ error: 'form_id, branch en days zijn verplicht' }, { status: 400 });
  }

  const credentials = await getMetaCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'Meta API niet geconfigureerd' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Save form_id mapping for this webhook key
  if (webhook_key_id) {
    await supabase.from('app_settings').upsert(
      { key: `webhook_form:${webhook_key_id}`, value: form_id },
      { onConflict: 'key' },
    );
  }

  // Fetch leads from Meta form
  const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  let allMetaLeads: MetaLead[] = [];

  try {
    let url: string | null = `${META_GRAPH_URL}/${form_id}/leads?fields=id,created_time,field_data&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}}]&limit=500&access_token=${credentials.accessToken}`;

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

  // Get branch fields for custom_fields
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

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const ml of allMetaLeads) {
    const parsed = parseMetaLead(ml, branch);

    // Deduplication: check email + branch within 30 days
    if (parsed.email) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('email', parsed.email)
        .eq('branch', branch)
        .gte('created_at', thirtyDaysAgo)
        .limit(1);
      if (existing && existing.length > 0) { skipped++; continue; }
    }

    // Split into common fields + custom fields
    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!COMMON_KEYS.has(k) && fieldKeys.has(k) && v) customFields[k] = v;
    }

    const phone = parsed.telefoonnummer || '';

    try {
      const lead = await enrichLeadAddress({
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
        status: 'nieuw',
        bron: 'meta_backfill',
        notities: '',
        custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
      });

      const quality_score = calculateQualityScore(lead);
      const { data, error } = await supabase.from('leads').insert({ ...lead, quality_score }).select().single();

      if (error) { errors++; continue; }

      imported++;

      if (data.lat && data.lng) {
        try {
          await distributeLead({ id: data.id, branch: data.branch, lat: data.lat, lng: data.lng });
        } catch { /* distribution failure should not block backfill */ }
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    fetched: allMetaLeads.length,
    imported,
    skipped,
    errors,
  });
}
