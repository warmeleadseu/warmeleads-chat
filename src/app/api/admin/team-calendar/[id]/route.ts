import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { buildJitsiUrl } from '@/lib/email/videocallInvite';
import { deliverVideocallInvite, type InviteResult } from '@/lib/email/deliverVideocallInvite';

export const runtime = 'nodejs';

const EVENT_TYPES = [
  'customer_visit',
  'prospect_visit',
  'videocall',
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
  meeting_url?: unknown;
  /** Verstuur (of opnieuw versturen) van de videocall-uitnodiging. */
  send_invite?: unknown;
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
  admin_users: { id: string; name: string; email: string; avatar_url: string | null } | null;
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
  meeting_url: string | null;
  meeting_invite_sent_at: string | null;
  customer: { id: string; name: string; email: string | null } | null;
  prospect: { id: string; company_name: string; email: string | null; contact_person: string | null } | null;
  creator: { id: string; name: string; avatar_url: string | null } | null;
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
    meeting_url: row.meeting_url,
    meeting_invite_sent_at: row.meeting_invite_sent_at,
    customer: row.customer_id
      ? {
          id: row.customer_id,
          name: row.customer?.name ?? null,
          email: row.customer?.email ?? null,
        }
      : null,
    prospect: row.prospect_id
      ? {
          id: row.prospect_id,
          company_name: row.prospect?.company_name ?? null,
          email: row.prospect?.email ?? null,
          contact_person: row.prospect?.contact_person ?? null,
        }
      : null,
    created_by: row.created_by,
    creator: row.creator
      ? {
          id: row.creator.id,
          name: row.creator.name,
          avatar_url: row.creator.avatar_url ?? null,
        }
      : null,
    participants: (row.participants || [])
      .map(p => p.admin_users)
      .filter(
        (p): p is { id: string; name: string; email: string; avatar_url: string | null } =>
          !!p,
      )
      .map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        avatar_url: p.avatar_url ?? null,
      })),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const FULL_SELECT = `
  *,
  customer:customers(id, name, email),
  prospect:prospects(id, company_name, email, contact_person),
  creator:admin_users!team_calendar_events_created_by_fkey(id, name, avatar_url),
  participants:team_calendar_event_participants(admin_user_id, admin_users(id, name, email, avatar_url))
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
  if (body.meeting_url !== undefined) {
    const m = asOptionalString(body.meeting_url);
    if (m && !/^https?:\/\//i.test(m)) {
      return NextResponse.json({ error: 'Meeting-URL moet beginnen met http(s)://' }, { status: 400 });
    }
    updates.meeting_url = m;
  }
  // Wanneer iemand het type wijzigt naar videocall en er nog geen URL is,
  // genereren we er hier alvast een op basis van het bestaande event-id.
  const switchingToVideocall = updates.event_type === 'videocall';
  if (switchingToVideocall && updates.meeting_url === undefined) {
    const { data: existing } = await supabase
      .from('team_calendar_events')
      .select('meeting_url')
      .eq('id', params.id)
      .single();
    if (!existing?.meeting_url) {
      updates.meeting_url = buildJitsiUrl(params.id);
    }
  }

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

  // Verstuur of opnieuw versturen van de videocall-uitnodiging.
  let inviteResult: InviteResult | null = null;
  if (body.send_invite === true) {
    const { data: full } = await supabase
      .from('team_calendar_events')
      .select('id, title, description, event_type, starts_at, ends_at, all_day, meeting_url, customer_id, prospect_id')
      .eq('id', params.id)
      .single();
    if (full && full.event_type === 'videocall' && full.meeting_url) {
      inviteResult = await deliverVideocallInvite(supabase, {
        eventId: full.id,
        admin: { id: admin.id, name: admin.name, email: admin.email },
        title: full.title,
        description: full.description,
        startsAt: full.starts_at,
        endsAt: full.ends_at,
        allDay: full.all_day,
        meetingUrl: full.meeting_url,
        customerId: full.customer_id,
        prospectId: full.prospect_id,
      });
    } else {
      inviteResult = { ok: false, skipped_reason: 'event_not_videocall_or_missing_url' };
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
  if (!full) return NextResponse.json({ id: params.id, invite: inviteResult });
  return NextResponse.json({ ...shapeEvent(full as unknown as EventRow), invite: inviteResult });
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
