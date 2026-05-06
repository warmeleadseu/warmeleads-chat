import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
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

interface CreateBody {
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
  /** Stuur direct na aanmaak een videocall-uitnodiging naar de gekoppelde klant of prospect. */
  send_invite?: unknown;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
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

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const params = request.nextUrl.searchParams;

  const from = params.get('from');
  const to = params.get('to');
  const participant = params.get('participant');
  const customerId = params.get('customer_id');
  const prospectId = params.get('prospect_id');
  const types = params.getAll('type').filter(t => EVENT_TYPES.includes(t as EventType));
  const q = params.get('q');

  let query = supabase
    .from('team_calendar_events')
    .select(
      `
      *,
      customer:customers(id, name, email),
      prospect:prospects(id, company_name, email, contact_person),
      creator:admin_users!team_calendar_events_created_by_fkey(id, name, avatar_url),
      participants:team_calendar_event_participants(admin_user_id, admin_users(id, name, email, avatar_url))
    `,
    )
    .order('starts_at', { ascending: true });

  if (from && isIsoDateLike(from)) query = query.gte('ends_at', from);
  if (to && isIsoDateLike(to)) query = query.lte('starts_at', to);
  if (customerId && asOptionalUuid(customerId)) query = query.eq('customer_id', customerId);
  if (prospectId && asOptionalUuid(prospectId)) query = query.eq('prospect_id', prospectId);
  if (types.length > 0) query = query.in('event_type', types);
  if (q && q.trim().length > 0) {
    const safe = q.trim().replace(/[%_]/g, c => `\\${c}`);
    query = query.or(`title.ilike.%${safe}%,location.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  // Filter on participant via junction table requires a separate prefilter.
  if (participant && asOptionalUuid(participant)) {
    const { data: rows } = await supabase
      .from('team_calendar_event_participants')
      .select('event_id')
      .eq('admin_user_id', participant);
    const ids = (rows || []).map(r => r.event_id);
    if (ids.length === 0) return NextResponse.json([]);
    query = query.in('id', ids);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const list = (data || []) as unknown as EventRow[];
  return NextResponse.json(list.map(shapeEvent));
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const title = asString(body.title).trim();
  if (!title) return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 });
  if (title.length > 200)
    return NextResponse.json({ error: 'Titel is te lang (max 200 tekens)' }, { status: 400 });

  const eventType = asString(body.event_type) as EventType;
  if (!EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: 'Onbekend type' }, { status: 400 });
  }

  if (!isIsoDateLike(body.starts_at) || !isIsoDateLike(body.ends_at)) {
    return NextResponse.json({ error: 'Start- of eindtijd ontbreekt' }, { status: 400 });
  }
  const startsAt = new Date(body.starts_at as string);
  const endsAt = new Date(body.ends_at as string);
  if (endsAt < startsAt) {
    return NextResponse.json({ error: 'Eindtijd ligt vóór starttijd' }, { status: 400 });
  }

  const allDay = body.all_day === true;
  const description = asOptionalString(body.description);
  const location = asOptionalString(body.location);
  const customerId = asOptionalUuid(body.customer_id);
  const prospectId = asOptionalUuid(body.prospect_id);
  if (customerId && prospectId) {
    return NextResponse.json(
      { error: 'Koppel óf een klant óf een prospect, niet beide' },
      { status: 400 },
    );
  }

  // Voor videocall: accepteer de meegegeven meeting-URL (Google Meet, Zoom,
  // Teams, etc). We genereren niets meer automatisch.
  let meetingUrl: string | null = null;
  if (eventType === 'videocall') {
    const customUrl = asOptionalString(body.meeting_url);
    if (customUrl && /^https?:\/\//i.test(customUrl)) {
      meetingUrl = customUrl;
    }
  }

  const supabase = createServerClient();
  const { data: created, error } = await supabase
    .from('team_calendar_events')
    .insert({
      title,
      description,
      event_type: eventType,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      all_day: allDay,
      location,
      customer_id: customerId,
      prospect_id: prospectId,
      meeting_url: meetingUrl,
      created_by: admin.id,
    })
    .select('id')
    .single();
  if (error || !created) {
    return NextResponse.json({ error: error?.message || 'Aanmaken mislukt' }, { status: 500 });
  }

  // We genereren géén meeting-URL meer automatisch. De AM plakt zelf een
  // Google Meet / Zoom / Teams / etc-link in het meeting_url-veld.

  const participantIds = new Set<string>(asUuidArray(body.participant_ids));
  participantIds.add(admin.id);
  const rows = Array.from(participantIds).map(id => ({
    event_id: created.id,
    admin_user_id: id,
  }));
  const { error: pErr } = await supabase
    .from('team_calendar_event_participants')
    .insert(rows);
  if (pErr) {
    await supabase.from('team_calendar_events').delete().eq('id', created.id);
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'calendar.event_created',
    entityType: 'team_calendar_event',
    entityId: created.id,
    details: { title, event_type: eventType, starts_at: startsAt.toISOString() },
  }).catch(() => {});

  // Verstuur direct een videocall-uitnodiging als gevraagd.
  let inviteResult: InviteResult | null = null;
  if (eventType === 'videocall' && body.send_invite === true && meetingUrl) {
    inviteResult = await deliverVideocallInvite(supabase, {
      eventId: created.id,
      admin: { id: admin.id, name: admin.name, email: admin.email },
      title,
      description,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      allDay,
      meetingUrl,
      customerId,
      prospectId,
    });
  }

  // Re-fetch full shape so client can immediately render.
  const { data: full } = await supabase
    .from('team_calendar_events')
    .select(
      `
      *,
      customer:customers(id, name, email),
      prospect:prospects(id, company_name, email, contact_person),
      creator:admin_users!team_calendar_events_created_by_fkey(id, name, avatar_url),
      participants:team_calendar_event_participants(admin_user_id, admin_users(id, name, email, avatar_url))
    `,
    )
    .eq('id', created.id)
    .single();
  if (!full) {
    return NextResponse.json({ id: created.id, invite: inviteResult }, { status: 201 });
  }
  return NextResponse.json({ ...shapeEvent(full as unknown as EventRow), invite: inviteResult }, { status: 201 });
}

