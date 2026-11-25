import { amsterdamDayOfWeek, amsterdamWallTimeToUtc, amsterdamYmd } from './appointmentSlots';

/**
 * Terugbelmomenten in het portaal (migratie 202), puur en te testen.
 *
 * Een lead krijgt de status "terugbellen" met een datum en tijd. Vijf minuten
 * van tevoren komt er een pop-up in het portaal en, als die aanstaat, een
 * pushmelding. Zodra de lead een andere status krijgt, is het moment klaar.
 *
 * Wie het seintje krijgt: de gebruiker die het inplande of aan wie het is
 * toegewezen. Bij een account met één gedeelde login (zoals Infinite Scale) is
 * dat de browser waarin het is ingepland, tenzij voor iedereen is gekozen.
 * Reageert niemand, dan ziet twee minuten na het tijdstip iedereen het.
 */

export const TERUGBELLEN = 'terugbellen';
export const SEINTJE_MIN = 5;
/** Na het tijdstip: zo lang blijft de pop-up bij de eigenaar komen; daarna alleen nog in de lijst. */
export const EIGEN_TOT_MIN = 30;
/** Reageert de eigenaar niet, dan zien de anderen het vanaf en tot zoveel minuten na het tijdstip. */
export const ANDEREN_VANAF_MIN = 2;
export const ANDEREN_TOT_MIN = 15;
export const MAX_DAGEN_VOORUIT = 365;
export const MAX_NOTITIE = 500;

/** Uitkomsten na het bellen (statussen van een lead). */
export const UITKOMSTEN = ['afspraak', 'offerte', 'gecontacteerd', 'geen_gehoor', 'verkocht', 'afgewezen'] as const;

export type Terugbelmoment = {
  id: string;
  lead_id: string;
  terug_op: string;
  notitie: string | null;
  portal_user_id: string | null;
  voor_iedereen: boolean;
  gepland_door: string | null;
  /** Is het seintje voor deze sessie? Door de server bepaald. */
  eigen: boolean;
  naam: string;
  telefoon: string | null;
  plaats: string | null;
  branch: string;
};

const MIN = 60_000;

/** Een apparaatkenmerk is een willekeurige code uit de browser; al het andere telt niet. */
export function schoonApparaat(v: unknown): string | null {
  return typeof v === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(v) ? v : null;
}

/** Controleert het gekozen tijdstip; geeft de ISO-tijd of een uitleg terug. */
export function leesMoment(v: unknown, nu: Date = new Date()): { ok: true; iso: string } | { ok: false; fout: string } {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(t)) return { ok: false, fout: 'Kies een geldige datum en tijd' };
  if (t < nu.getTime() - MIN) return { ok: false, fout: 'Dit tijdstip is al voorbij' };
  if (t > nu.getTime() + MAX_DAGEN_VOORUIT * 86_400_000) return { ok: false, fout: 'Kies een tijdstip binnen een jaar' };
  return { ok: true, iso: new Date(t).toISOString() };
}

/** Datum (YYYY-MM-DD) en tijd (HH:MM) in Nederlandse tijd naar ISO; null als het niet klopt. */
export function nlNaarIso(dag: string, tijd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag) || !/^\d{2}:\d{2}$/.test(tijd)) return null;
  const d = amsterdamWallTimeToUtc(dag, tijd);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function nlTijd(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
}

const plusDagen = (ymd: string, n: number): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "vandaag 14:30", "morgen 10:00" of "ma 1 dec 10:00". */
export function momentLabel(iso: string, nu: Date = new Date()): string {
  const dag = amsterdamYmd(new Date(iso));
  const vandaag = amsterdamYmd(nu);
  if (dag === vandaag) return `vandaag ${nlTijd(iso)}`;
  if (dag === plusDagen(vandaag, 1)) return `morgen ${nlTijd(iso)}`;
  if (dag === plusDagen(vandaag, -1)) return `gisteren ${nlTijd(iso)}`;
  const datum = new Date(iso).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' });
  return `${datum} ${nlTijd(iso)}`;
}

const afgerond = (t: number) => Math.ceil(t / (5 * MIN)) * 5 * MIN;

/** Snelkeuzes in het plan-venster, in Nederlandse tijd. */
export function snelkeuzes(nu: Date = new Date()): { label: string; iso: string }[] {
  const vandaag = amsterdamYmd(nu);
  const om = (dag: string, tijd: string) => amsterdamWallTimeToUtc(dag, tijd).toISOString();
  const uit: { label: string; iso: string }[] = [{ label: 'Over 1 uur', iso: new Date(afgerond(nu.getTime() + 60 * MIN)).toISOString() }];
  const middag = om(vandaag, '14:00');
  const avond = om(vandaag, '19:00');
  if (Date.parse(middag) - nu.getTime() > 90 * MIN) uit.push({ label: 'Vanmiddag 14:00', iso: middag });
  else if (Date.parse(avond) - nu.getTime() > 90 * MIN) uit.push({ label: 'Vanavond 19:00', iso: avond });
  const morgen = plusDagen(vandaag, 1);
  uit.push({ label: 'Morgen 10:00', iso: om(morgen, '10:00') });
  uit.push({ label: 'Morgen 19:00', iso: om(morgen, '19:00') });
  /* Maandag alleen als dat niet al "morgen" is. */
  const tot = (8 - amsterdamDayOfWeek(nu)) % 7 || 7;
  if (tot > 1) uit.push({ label: 'Maandag 10:00', iso: om(plusDagen(vandaag, tot), '10:00') });
  return uit;
}

/** Uitstellen vanuit de pop-up. */
export function uitstelkeuzes(nu: Date = new Date()): { label: string; iso: string }[] {
  return [
    { label: '15 min', iso: new Date(nu.getTime() + 15 * MIN).toISOString() },
    { label: '1 uur', iso: new Date(afgerond(nu.getTime() + 60 * MIN)).toISOString() },
    { label: 'Morgen 10:00', iso: amsterdamWallTimeToUtc(plusDagen(amsterdamYmd(nu), 1), '10:00').toISOString() },
  ];
}

/** Is het seintje voor deze sessie? */
export function isEigen(
  m: { portal_user_id: string | null; apparaat: string | null; voor_iedereen: boolean },
  sessie: { portalUserId: string | null; apparaat: string | null },
): boolean {
  if (m.voor_iedereen) return true;
  if (m.portal_user_id) return m.portal_user_id === sessie.portalUserId;
  if (m.apparaat) return m.apparaat === sessie.apparaat;
  return true;
}

export type PopupFase = 'vooraf' | 'nu';

/** Moet de pop-up nu in beeld, en in welke vorm? */
export function popupFase(m: Pick<Terugbelmoment, 'terug_op' | 'eigen'>, nu: number): PopupFase | null {
  const na = (nu - Date.parse(m.terug_op)) / MIN;
  if (!Number.isFinite(na) || na < -SEINTJE_MIN) return null;
  if (m.eigen) return na < 0 ? 'vooraf' : na <= EIGEN_TOT_MIN ? 'nu' : null;
  return na >= ANDEREN_VANAF_MIN && na <= ANDEREN_TOT_MIN ? 'nu' : null;
}

/** Verdeelt open momenten in gemist, vandaag en later, elk op tijd. */
export function groepeerMomenten<T extends { terug_op: string }>(momenten: T[], nu: Date = new Date()): { gemist: T[]; vandaag: T[]; later: T[] } {
  const dag = amsterdamYmd(nu);
  const uit = { gemist: [] as T[], vandaag: [] as T[], later: [] as T[] };
  for (const m of [...momenten].sort((a, b) => Date.parse(a.terug_op) - Date.parse(b.terug_op))) {
    if (Date.parse(m.terug_op) < nu.getTime()) uit.gemist.push(m);
    else if (amsterdamYmd(new Date(m.terug_op)) === dag) uit.vandaag.push(m);
    else uit.later.push(m);
  }
  return uit;
}

/** Voor een tel:-link: alleen cijfers en een plus vooraan. */
export function telLink(telefoon: string | null): string | null {
  const t = (telefoon ?? '').replace(/[^\d+]/g, '');
  return t.replace(/\D/g, '').length >= 8 ? `tel:${t}` : null;
}
