import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { enrichLeadAddress } from '@/lib/pdok';
import { distributeLead } from '@/lib/distribution';

const COMMON_KEYS = new Set([
  'branch', 'customer_id', 'naam_klant', 'name', 'email', 'telefoonnummer', 'phone',
  'postcode', 'huisnummer', 'plaatsnaam', 'city', 'provincie', 'wervingsdatum',
  'status', 'bron', 'notities', 'land',
]);

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key ontbreekt' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: keyRecord, error: keyError } = await supabase
      .from('webhook_keys')
      .select('*, customers(id, name)')
      .eq('key', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !keyRecord) {
      return NextResponse.json({ error: 'Ongeldige of inactieve API key' }, { status: 401 });
    }

    const body = await request.json();
    const branchSlug = body.branch || keyRecord.branch;

    const { data: branchFields } = await supabase
      .from('branch_fields')
      .select('key')
      .eq('branch_id', (
        await supabase.from('branches').select('id').eq('slug', branchSlug).single()
      ).data?.id || '');

    const fieldKeys = new Set((branchFields || []).map((f: { key: string }) => f.key));

    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!COMMON_KEYS.has(k) && fieldKeys.has(k) && v) {
        customFields[k] = String(v);
      }
    }

    const phone = body.telefoonnummer || body.phone || '';
    const lead = await enrichLeadAddress({
      branch: branchSlug,
      naam_klant: body.naam_klant || body.name || '',
      email: body.email || '',
      telefoonnummer: phone,
      postcode: body.postcode || '',
      huisnummer: body.huisnummer || '',
      plaatsnaam: body.plaatsnaam || body.city || '',
      provincie: body.provincie || '',
      land: body.land || '',
      wervingsdatum: body.wervingsdatum || new Date().toISOString().split('T')[0],
      status: 'nieuw',
      bron: 'zapier',
      notities: body.notities || '',
      custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
    });

    if (!lead.naam_klant) {
      return NextResponse.json({ error: 'naam_klant is verplicht' }, { status: 400 });
    }

    const { data, error } = await supabase.from('leads').insert(lead).select().single();

    if (error) {
      console.error('Webhook lead insert error:', error);
      return NextResponse.json({ error: 'Lead opslaan mislukt' }, { status: 500 });
    }

    await supabase
      .from('webhook_keys')
      .update({
        last_used_at: new Date().toISOString(),
        request_count: (keyRecord.request_count || 0) + 1,
      })
      .eq('id', keyRecord.id);

    if (data.lat && data.lng) {
      try {
        await distributeLead({ id: data.id, branch: data.branch, lat: data.lat, lng: data.lng });
      } catch { /* distribution failure should not block webhook */ }
    }

    return NextResponse.json({ success: true, lead_id: data.id });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 });
  }
}
