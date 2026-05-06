import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const EVENT_TYPES = [
  'customer_visit',
  'prospect_visit',
  'internal',
  'external_event',
  'vacation',
  'other',
] as const;
type EventType = (typeof EVENT_TYPES)[number];

interface UpdateBody {
  title?: unknown;
  description?: unknown;
  event_type?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  all_day?: unknown;
  location?: unknown;
  customer_id?: unknown;
  prospect_id?: unknown;
  participant_ids?: unknown;
}

function asOptionalString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function asOptionalUuid(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v,
  )
    ? v
    : null;
}
function asUuidArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && asOptionalUuid(x) !== null);
}
function isIsoDateLike(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

interface ParticipantRow {
  admin_user_id: string;
  admin_users: { id: string; name: string; email: string } | null;
}
interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  customer_id: string | null;
  prospect_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer: { id: string; name: string } | null;
  prospect: { id: string; company_name: string } | null;
  creator: { id: string; name: string } | null;
  participants: ParticipantRow[];
}

function shapeEvent(row: EventRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    event_type: row.event_type,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    all_day: row.all_day,
    location: row.location,
    customer: row.customer_id
      ? { id: row.customer_id, name: row.customer?.name ?? null }
      : null,
    prospect: row.prospect_id
      ? {
          id: row.prospect_id,
          company_name: row.prospect?.company_name ?? null,
        }
      : null,
    created_by: row.created_by,
    creator: row.creator
      ? { id: row.creator.id, name: row.creator.name }
      : null,
    participants: (row.participants || [])
      .map(p => p.admin_users)
      .filter((p): p is { id: string; name: string; email: string } => !!p)
      .map(p => ({ id: p.id, name: p.name, email: p.email })),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const FULL_SELECT = `
  *,
  customer:customers(id, name),
  prospect:prospects(id, company_name),
  creator:admin_users!team_calendar_events_created_by_fkey(id, name),
  participants:team_calendar_event_participants(admin_user_id, admin_users(id, name, email))
`;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('team_calendar_events')
    .select(FULL_SELECT)
    .eq('id', params.id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Event niet gevonden' }, { status: 404 });
  }
  return NextResponse.json(shapeEvent(data as unknown as EventRow));
}

async function ensureCanMutate(
  supabase: ReturnType<typeof createServerClient>,
  eventId: string,
  admin: { id: string; role: string },
) {
  const { data } = await supabase
    .from('team_calendar_events')
    .select('id, created_by')
    .eq('id', eventId)
    .single();
  if (!data) return { ok: false as const, status: 404, body: { error: 'Event niet gevonden' } };
  const isOwner = data.created_by === admin.id;
  const canManage = admin.role === 'admin' || admin.role === 'superadmin';
  if (!isOwner && !canManage) {
    return { ok: false as const, status: 403, body: { error: 'Onvoldoende rechten' } };
  }
  return { ok: true as const, event: data };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const guard = await ensureCanMutate(supabase, params.id, admin);
  if (!guard.ok) {
    return guard.status === 403
      ? forbidden()
      : NextResponse.json(guard.body, { status: guard.status });
  }

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: 'Titel mag niet leeg zijn' }, { status: 400 });
    if (t.length > 200)
      return NextResponse.json({ error: 'Titel is te lang' }, { status: 400 });
    updates.title = t;
  }
  if (body.description !== undefined) {
    updates.description = asOptionalString(body.description);
  }
  if (body.event_type !== undefined) {
    if (!EVENT_TYPES.includes(body.event_type as EventType)) {
      return NextResponse.json({ error: 'Onbekend type' }, { status: 400 });
    }
    updates.event_type = body.event_type;
  }
  if (body.starts_at !== undefined) {
    if (!isIsoDateLike(body.starts_at))
      return NextResponse.json({ error: 'Ongeldige starttijd' }, { status: 400 });
    updates.starts_at = new Date(body.starts_at as string).toISOString();
  }
  if (body.ends_at !== undefined) {
    if (!isIsoDateLike(body.ends_at))
      return NextResponse.json({ error: 'Ongeldige eindtijd' }, { status: 400 });
    updates.ends_at = new Date(body.ends_at as string).toISOString();
  }
  if (body.all_day !== undefined) updates.all_day = body.all_day === true;
  if (body.location !== undefined) updates.location = asOptionalString(body.location);
  if (body.customer_id !== undefined) updates.customer_id = asOptionalUuid(body.customer_id);
  if (body.prospect_id !== undefined) updates.prospect_id = asOptionalUuid(body.prospect_id);

  if (
    typeof updates.starts_at === 'string' &&
    typeof updates.ends_at === 'string' &&
    new Date(updates.ends_at) < new Date(updates.starts_at)
  ) {
    return NextResponse.json({ error: 'Eindtijd ligt vóór starttijd' }, { status: 400 });
  }

  if (updates.customer_id && updates.prospect_id) {
    return NextResponse.json(
      { error: 'Koppel óf een klant óf een prospect, niet beide' },
      { status: 400 },
    );
  }

  if (Object.keys(updates).length > 0) {
    const { error: upErr } = await supabase
      .from('team_calendar_events')
      .update(updates)
      .eq('id', params.id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.participant_ids)) {
    const ids = new Set<string>(asUuidArray(body.participant_ids));
    ids.add(guard.event.created_by ?? admin.id);
    await supabase
      .from('team_calendar_event_participants')
      .delete()
      .eq('event_id', params.id);
    if (ids.size > 0) {
      const rows = Array.from(ids).map(id => ({
        event_id: params.id,
        admin_user_id: id,
      }));
      const { error: pErr } = await supabase
        .from('team_calendar_event_participants')
        .insert(rows);
      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 });
      }
    }
  }

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'calendar.event_updated',
    entityType: 'team_calendar_event',
    entityId: params.id,
    details: { fields: Object.keys(updates) },
  }).catch(() => {});

  const { data: full } = await supabase
    .from('team_calendar_events')
    .select(FULL_SELECT)
    .eq('id', params.id)
    .single();
  if (!full) return NextResponse.json({ id: params.id });
  return NextResponse.json(shapeEvent(full as unknown as EventRow));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const guard = await ensureCanMutate(supabase, params.id, admin);
  if (!guard.ok) {
    return guard.status === 403
      ? forbidden()
      : NextResponse.json(guard.body, { status: guard.status });
  }

  const { error } = await supabase
    .from('team_calendar_events')
    .delete()
    .eq('id', params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'calendar.event_deleted',
    entityType: 'team_calendar_event',
    entityId: params.id,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
