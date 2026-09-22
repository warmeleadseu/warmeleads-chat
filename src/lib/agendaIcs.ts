import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * ICS-agenda voor het klantportaal.
 *
 * Bedoeld om te abonneren in Google Agenda of Outlook: die halen de link elk
 * kwartier tot elk uur zelf op. Eenrichtingsverkeer, dus wat in ons portaal
 * staat verschijnt daar, en niet andersom.
 *
 * De link bevat een token in plaats van een sessie, omdat een agenda-abonnement
 * geen cookies meestuurt. Dat token is een HMAC over klant en gebruiker, zodat
 * er niets hoeft te worden opgeslagen en niemand hem kan raden.
 */

export interface IcsAfspraak {
  id: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  contact_name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  street?: string | null;
  house_number?: string | null;
  postcode?: string | null;
  city?: string | null;
  notes?: string | null;
  branch?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

/** Vouwt een regel volgens RFC 5545: maximaal 75 octetten, vervolg begint met een spatie. */
export function vouwRegel(regel: string): string {
  if (Buffer.byteLength(regel, 'utf8') <= 75) return regel;
  const stukken: string[] = [];
  let huidig = '';
  for (const teken of regel) {
    const kandidaat = huidig + teken;
    const limiet = stukken.length === 0 ? 75 : 74;
    if (Buffer.byteLength(kandidaat, 'utf8') > limiet) {
      stukken.push(huidig);
      huidig = teken;
    } else {
      huidig = kandidaat;
    }
  }
  if (huidig) stukken.push(huidig);
  return stukken.map((s, i) => (i === 0 ? s : ` ${s}`)).join('\r\n');
}

export function escapeIcs(waarde: string): string {
  return String(waarde ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Een geannuleerde afspraak blijft in de feed staan, maar dan als afgezegd. */
function icsStatus(status: string): string {
  if (status === 'cancelled' || status === 'rescheduled') return 'CANCELLED';
  if (status === 'scheduled') return 'CONFIRMED';
  return 'CONFIRMED';
}

export function bouwAgendaIcs(
  afspraken: IcsAfspraak[],
  opties: { kalenderNaam: string; siteUrl: string; branchNamen?: Record<string, string> },
): string {
  const regels: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WarmeLeads//Portaal Agenda//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(opties.kalenderNaam)}`,
    'X-WR-TIMEZONE:Europe/Amsterdam',
    /* Google en Outlook halen een abonnement op hun eigen ritme op. Deze hint
       vraagt om een kwartier, wat ze soms respecteren en soms niet. */
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];

  for (const a of afspraken) {
    const start = new Date(a.starts_at);
    if (Number.isNaN(start.getTime())) continue;
    const eind = new Date(start.getTime() + (a.duration_minutes || 60) * 60_000);

    const adres = [
      [a.street, a.house_number].filter(Boolean).join(' '),
      [a.postcode, a.city].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ');

    const branche = a.branch ? (opties.branchNamen?.[a.branch] ?? a.branch) : '';
    const titel = branche ? `${a.contact_name} (${branche})` : a.contact_name;

    const omschrijving: string[] = [];
    if (a.contact_phone) omschrijving.push(`Telefoon: ${a.contact_phone}`);
    if (a.contact_email) omschrijving.push(`E-mail: ${a.contact_email}`);
    if (a.notes) omschrijving.push(`Opmerkingen: ${a.notes}`);
    omschrijving.push(`Openen in portaal: ${opties.siteUrl}/portal/agenda`);

    const stempelBron = a.updated_at || a.created_at || a.starts_at;
    const stempel = new Date(stempelBron);

    regels.push(
      'BEGIN:VEVENT',
      `UID:afspraak-${a.id}@warmeleads.eu`,
      `DTSTAMP:${formatIcsDate(Number.isNaN(stempel.getTime()) ? start : stempel)}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(eind)}`,
      `SUMMARY:${escapeIcs(titel)}`,
      `DESCRIPTION:${escapeIcs(omschrijving.join('\n'))}`,
      ...(adres ? [`LOCATION:${escapeIcs(adres)}`] : []),
      `URL:${opties.siteUrl}/portal/agenda`,
      `STATUS:${icsStatus(a.status)}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }

  regels.push('END:VCALENDAR');
  return regels.map(vouwRegel).join('\r\n') + '\r\n';
}

/* ── Token ────────────────────────────────────────────────────────────── */

function sleutel(): string {
  const s = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Geen servergeheim beschikbaar voor agenda-tokens');
  return s;
}

export function maakAgendaToken(customerId: string, portalUserId: string | null): string {
  return createHmac('sha256', sleutel())
    .update(`agenda:${customerId}:${portalUserId ?? 'alle'}`)
    .digest('hex')
    .slice(0, 40);
}

/** Vergelijking in constante tijd, zodat het token niet teken voor teken te raden is. */
export function controleerAgendaToken(
  customerId: string,
  portalUserId: string | null,
  token: string,
): boolean {
  if (!token || typeof token !== 'string') return false;
  const verwacht = maakAgendaToken(customerId, portalUserId);
  if (token.length !== verwacht.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(verwacht));
}
