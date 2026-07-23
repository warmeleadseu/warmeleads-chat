/** Datum-helpers voor het klantportaal (Europe/Amsterdam). */

function amsterdamParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday'), // Mon, Tue, …
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

/** YYYY-MM-DD vandaag in Amsterdam. */
export function todayAmsterdam(): string {
  return amsterdamParts().date;
}

/** YYYY-MM-DD N dagen geleden (kalenderdag Amsterdam). */
export function daysAgoAmsterdam(days: number): string {
  const today = todayAmsterdam();
  const [y, m, d] = today.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - Math.max(0, days));
  return utc.toISOString().slice(0, 10);
}

/**
 * Maandag van de huidige week (Amsterdam), YYYY-MM-DD.
 * Maandag = start van de werkweek.
 */
export function startOfWeekAmsterdam(d = new Date()): string {
  const { date, weekday } = amsterdamParts(d);
  const offset: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const daysBack = offset[weekday] ?? 0;
  const [y, m, day] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day));
  utc.setUTCDate(utc.getUTCDate() - daysBack);
  return utc.toISOString().slice(0, 10);
}

/**
 * Relatieve weergave voor lead-ontvangstdatum.
 * Voorbeelden: "zojuist", "2u geleden", "gisteren", "23 jul".
 */
export function formatRelativeLeadDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '-';

  const now = Date.now();
  const diffMs = now - then.getTime();
  if (diffMs < 0) {
    return then.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'zojuist';
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;

  const thenDay = amsterdamParts(then).date;
  const today = todayAmsterdam();
  const yParts = amsterdamParts(new Date(now - 24 * 60 * 60 * 1000));
  if (thenDay === today) return 'vandaag';
  if (thenDay === yParts.date) return 'gisteren';

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 7) return `${days}d geleden`;

  return then.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export function mapsUrlForLead(lead: {
  postcode?: string | null;
  huisnummer?: string | null;
  plaatsnaam?: string | null;
  provincie?: string | null;
  land?: string | null;
}): string | null {
  const parts = [
    [lead.postcode, lead.huisnummer].filter(Boolean).join(' '),
    lead.plaatsnaam,
    lead.provincie,
    lead.land === 'BE' ? 'België' : lead.land === 'NL' ? 'Nederland' : lead.land,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}
