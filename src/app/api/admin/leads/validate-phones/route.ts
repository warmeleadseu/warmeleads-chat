import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { isPhoneValid } from '@/lib/phoneValidation';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const PAGE = 1000;
  let validated = 0;
  let invalid = 0;
  let from = 0;

  while (true) {
    const { data } = await supabase
      .from('leads')
      .select('id, telefoonnummer, phone_valid')
      .range(from, from + PAGE - 1);

    if (!data || data.length === 0) break;

    for (const lead of data) {
      const valid = isPhoneValid(lead.telefoonnummer);
      if (lead.phone_valid !== valid) {
        await supabase.from('leads').update({ phone_valid: valid }).eq('id', lead.id);
      }
      validated++;
      if (!valid) invalid++;
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return NextResponse.json({ success: true, validated, invalid });
}
