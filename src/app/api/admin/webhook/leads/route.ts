import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

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

    const lead = {
      branch: body.branch || keyRecord.branch,
      customer_id: keyRecord.customer_id,
      naam_klant: body.naam_klant || body.name || '',
      email: body.email || '',
      telefoonnummer: body.telefoonnummer || body.phone || '',
      postcode: body.postcode || '',
      huisnummer: body.huisnummer || '',
      plaatsnaam: body.plaatsnaam || body.city || '',
      provincie: body.provincie || '',
      wervingsdatum: body.wervingsdatum || new Date().toISOString().split('T')[0],
      status: 'nieuw',
      bron: 'zapier',
      notities: body.notities || '',
      // Thuisbatterij fields
      zonnepanelen: body.zonnepanelen || null,
      dynamisch_contract: body.dynamisch_contract || null,
      stroomverbruik: body.stroomverbruik || null,
      budget: body.budget || null,
      reden_thuisbatterij: body.reden_thuisbatterij || null,
      // Airco fields
      type_airco: body.type_airco || null,
      koelen_verwarmen: body.koelen_verwarmen || null,
      hoeveel_ruimtes: body.hoeveel_ruimtes || null,
      zakelijk: body.zakelijk || null,
      koop_of_huur: body.koop_of_huur || null,
      boorwerkzaamheden_toegestaan: body.boorwerkzaamheden_toegestaan || null,
    };

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

    return NextResponse.json({ success: true, lead_id: data.id });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 });
  }
}
