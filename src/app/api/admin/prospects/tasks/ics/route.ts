import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { isAccountManagerScope } from '@/lib/prospects';

/**
 * ICS-feed met openstaande prospect-taken die een due_at hebben.
 *
 * Standaard: alleen taken die aan de ingelogde admin zijn toegewezen.
 * Query: ?portfolio=1 (AM) — alle open taken op eigen prospects.
 *
 * Importeren in Outlook/Apple/Google Calendar als "Subscribed calendar".
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const url = request.nextUrl;
  const portfolio = url.searchParams.get('portfolio') === '1' && isAccountManagerScope(admin);

  let query = supabase
    .from('prospect_tasks')
    .select(
      'id, prospect_id, type, title, description, due_at, completed_at, assigned_to_admin_id, created_at, updated_at, prospect:prospects!inner(id, company_name)',
    )
    .is('completed_at', null)
    .not('due_at', 'is', null);

  if (portfolio) {
    const { data: rows } = await supabase
      .from('prospects')
      .select('id')
      .eq('account_manager_id', admin.id);
    const ids = (rows || []).map(r => r.id);
    if (ids.length === 0) {
      return ics([], admin.name);
    }
    query = query.in('prospect_id', ids);
  } else {
    query = query.eq('assigned_to_admin_id', admin.id);
  }

  const { data } = await query.order('due_at', { ascending: true }).limit(500);

  return ics(data || [], admin.name);
}

interface IcsTaskRow {
  id: string;
  prospect_id: string;
  type: string;
  title: string;
  description: string | null;
  due_at: string;
  created_at: string;
  updated_at: string;
  prospect: { company_name: string };
}

const DEFAULT_DURATION_MIN = 30;

function ics(rows: IcsTaskRow[] | unknown[], adminName: string): NextResponse {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WarmeLeads//Prospect Taken//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:WarmeLeads — Prospect-taken (${escapeIcs(adminName)})`,
    'X-WR-TIMEZONE:Europe/Amsterdam',
  ];

  for (const r of rows as IcsTaskRow[]) {
    if (!r.due_at) continue;
    const start = new Date(r.due_at);
    const end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);
    const summary = `[${labelForType(r.type)}] ${r.title} — ${r.prospect?.company_name || 'Prospect'}`;
    const descParts: string[] = [];
    if (r.description) descParts.push(r.description);
    descParts.push(`Open in CRM: ${siteUrl()}/admin/prospects?id=${r.prospect_id}`);
    lines.push(
      'BEGIN:VEVENT',
      `UID:prospect-task-${r.id}@warmeleads.eu`,
      `DTSTAMP:${formatIcsDate(new Date(r.updated_at || r.created_at))}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(descParts.join('\\n'))}`,
      `URL:${siteUrl()}/admin/prospects?id=${r.prospect_id}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  const body = lines.join('\r\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="prospect-taken.ics"',
      'Cache-Control': 'no-store',
    },
  });
}

function labelForType(t: string): string {
  switch (t) {
    case 'call':
      return 'Bellen';
    case 'email':
      return 'E-mail';
    case 'meeting':
      return 'Afspraak';
    case 'followup':
      return 'Opvolgen';
    default:
      return 'Taak';
  }
}

function formatIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu').replace(/\/$/, '');
}
