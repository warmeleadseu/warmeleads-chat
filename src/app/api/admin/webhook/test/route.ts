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

    const { data: branchFields } = await supabase
      .from('branch_fields')
      .select('key, label, field_type')
      .eq('branch_id', (
        await supabase.from('branches').select('id').eq('slug', keyRecord.branch).single()
      ).data?.id || '')
      .order('sort_order', { ascending: true });

    const testData: Record<string, string> = {
      naam_klant: 'Test Lead (automatisch)',
      email: 'test@warmeleads.eu',
      telefoonnummer: '+31600000000',
      postcode: '1000AA',
      huisnummer: '1',
      plaatsnaam: 'Amsterdam',
      provincie: 'Noord-Holland',
    };

    for (const field of (branchFields || [])) {
      if (field.field_type === 'boolean') {
        testData[field.key] = 'Ja';
      } else if (field.field_type === 'number') {
        testData[field.key] = '5';
      } else {
        testData[field.key] = `Test ${field.label}`;
      }
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
