import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { loadAccessibleProspect } from '@/lib/prospects';

const ALLOWED_TYPES = ['note', 'call', 'email', 'meeting'] as const;
type ActivityType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(s: unknown): s is ActivityType {
  return typeof s === 'string' && (ALLOWED_TYPES as readonly string[]).includes(s);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('prospect_activities')
    .select('id, type, title, body, metadata, created_at, admin_user_id')
    .eq('prospect_id', params.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'Activiteiten ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ activities: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: { type?: unknown; title?: unknown; body?: unknown; metadata?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  if (!isAllowedType(body.type)) {
    return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  const insert = {
    prospect_id: params.id,
    admin_user_id: admin.id,
    type: body.type,
    title,
    body: typeof body.body === 'string' ? body.body : null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
  };

  const { data, error } = await supabase
    .from('prospect_activities')
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Activiteit aanmaken mislukt' }, { status: 500 });
  }

  // Update last_contacted_at als type 'call', 'email', 'meeting'
  if (body.type === 'call' || body.type === 'email' || body.type === 'meeting') {
    await supabase
      .from('prospects')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', params.id);
  }

  return NextResponse.json({ success: true, activity: data });
}
