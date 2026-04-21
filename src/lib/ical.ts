export interface ICalEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  durationMinutes: number;
  organizer?: { name: string; email: string };
  attendees?: { name?: string; email: string }[];
  method?: 'REQUEST' | 'CANCEL' | 'PUBLISH';
  sequence?: number;
  status?: 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE';
}

function escapeText(s: string): string {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function fmtUTC(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Builds a minimal, widely-compatible iCalendar file (RFC 5545).
 * Returns the raw .ics string.
 */
export function buildICal(event: ICalEvent): string {
  const end = new Date(event.startsAt.getTime() + event.durationMinutes * 60_000);
  const method = event.method || 'REQUEST';
  const status = event.status || 'CONFIRMED';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WarmeLeads//Appointments//NL',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${fmtUTC(new Date())}`,
    `DTSTART:${fmtUTC(event.startsAt)}`,
    `DTEND:${fmtUTC(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `STATUS:${status}`,
    `SEQUENCE:${event.sequence ?? 0}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.organizer) {
    lines.push(`ORGANIZER;CN=${escapeText(event.organizer.name)}:mailto:${event.organizer.email}`);
  }
  if (event.attendees && event.attendees.length) {
    for (const a of event.attendees) {
      const cn = a.name ? `CN=${escapeText(a.name)};` : '';
      lines.push(`ATTENDEE;${cn}RSVP=TRUE:mailto:${a.email}`);
    }
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
