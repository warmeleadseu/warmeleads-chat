import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

function forbidden() {
  return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('live_test_events')
    .select('*')
    .eq('consumed', false)
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data && data.length > 0) {
    await supabase
      .from('live_test_events')
      .update({ consumed: true })
      .in('id', data.map(e => e.id));
  }

  return NextResponse.json({ events: data || [] });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  try {
    const body = await request.json();
    const { event_type, payload } = body;

    const validTypes = ['sales_bell', 'celebration_video', 'batch_complete', 'confetti'];
    if (!validTypes.includes(event_type)) {
      return NextResponse.json({ error: 'Ongeldig event type' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('live_test_events')
      .insert({
        event_type,
        payload: payload || {},
        created_by: admin.id,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  const supabase = createServerClient();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await supabase
    .from('live_test_events')
    .delete()
    .lt('created_at', cutoff);

  return NextResponse.json({ success: true });
}
