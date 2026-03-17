import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { key_id } = await request.json();
    if (!key_id) {
      return NextResponse.json({ error: 'Key ID is verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: keyRecord, error: keyError } = await supabase
      .from('webhook_keys')
      .select('*, customers(id, name)')
      .eq('id', key_id)
      .single();

    if (keyError || !keyRecord) {
      return NextResponse.json({ error: 'Key niet gevonden' }, { status: 404 });
    }

    const testData: Record<string, string> = {
      naam_klant: 'Test Lead (automatisch)',
      email: 'test@warmeleads.eu',
      telefoonnummer: '+31600000000',
      postcode: '1000AA',
      huisnummer: '1',
      plaatsnaam: 'Amsterdam',
      provincie: 'Noord-Holland',
    };

    if (keyRecord.branch === 'thuisbatterij') {
      testData.zonnepanelen = 'Ja, 10 panelen';
      testData.dynamisch_contract = 'Nee';
      testData.stroomverbruik = '3500 kWh';
      testData.budget = '5000-7500';
      testData.reden_thuisbatterij = 'Testlead';
    } else if (keyRecord.branch === 'airco') {
      testData.type_airco = 'Split unit';
      testData.koelen_verwarmen = 'Beide';
      testData.hoeveel_ruimtes = '2';
      testData.zakelijk = 'Nee';
      testData.koop_of_huur = 'Koop';
      testData.boorwerkzaamheden_toegestaan = 'Ja';
    }

    const origin = request.headers.get('origin') || request.nextUrl.origin;
    const webhookUrl = `${origin}/api/admin/webhook/leads`;

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': keyRecord.key,
      },
      body: JSON.stringify(testData),
    });

    const webhookResult = await webhookRes.json();

    if (!webhookRes.ok) {
      return NextResponse.json({
        success: false,
        error: webhookResult.error || 'Test mislukt',
        status: webhookRes.status,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      lead_id: webhookResult.lead_id,
      message: `Test lead aangemaakt voor ${keyRecord.customers?.name || 'onbekende klant'}`,
    });
  } catch {
    return NextResponse.json({ error: 'Test mislukt' }, { status: 500 });
  }
}
