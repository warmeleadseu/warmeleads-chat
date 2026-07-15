import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const leadId = request.nextUrl.searchParams.get('lead_id');
  if (!leadId) {
    return NextResponse.json({ error: 'lead_id is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'Activiteiten ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ activities: data || [] });
}
