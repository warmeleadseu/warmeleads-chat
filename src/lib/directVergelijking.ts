/**
 * Meten of direct leveren (en de WhatsApp-opvolging van Snelraak) betere
 * resultaten geeft.
 *
 * Waar je op moet letten: de uitkomsten (gecontacteerd, afspraak, verkocht)
 * komen van de statussen die klanten zelf in hun portaal zetten. Niet elke
 * klant doet dat. Daarom staat bij elke vergelijking hoe volledig de klant
 * zijn leads heeft bijgewerkt (datakwaliteit), rekenen we de opvolging alleen
 * over leads die echt zijn bijgewerkt, en markeren we een vergelijking als
 * onbetrouwbaar bij weinig leads of weinig bijgewerkte statussen.
 */

export const OPVOLG_STATUSSEN = ['gecontacteerd', 'geen_gehoor', 'afspraak', 'offerte', 'verkocht', 'afgewezen'] as const;
export type OpvolgStatus = (typeof OPVOLG_STATUSSEN)[number];

/** Pas na zoveel dagen verwachten we dat een klant een lead heeft bijgewerkt. */
export const BIJWERK_TERMIJN_DAGEN = 7;
export const MIN_LEADS_BETROUWBAAR = 30;
export const MIN_BIJGEWERKT_BETROUWBAAR = 0.5;
export const HERBESTEL_TERMIJN_DAGEN = 30;
/**
 * Vanaf dit moment worden statuswijzigingen bijgehouden (migratie 181). Voor
 * eerdere leveringen kennen we de eerste wijziging niet: een latere wijziging
 * zou dan als "eerste" tellen en de tijd tot opvolging veel te lang maken.
 */
export const STATUSLOG_SINDS = '2026-10-20T12:15:00Z';

export type LeveringRij = {
  assignment_id: string;
  customer_id: string;
  lead_id: string;
  branch: string | null;
  assigned_at: string;
  lead_created_at: string | null;
  status: string | null;
  via_direct: boolean;
  snelraak: boolean;
  /** Eerste statuswijziging (uit de statusgeschiedenis), als die er is. */
  eerste_status_at: string | null;
  reclamatie: boolean;
  /** Eerste klant van deze lead (alleen dan zegt de snelheid iets). */
  eerste_klant: boolean;
};

export type Kengetallen = {
  leveringen: number;
  snelheid: { aantal: number; mediaanSec: number | null; binnenMinuutPct: number | null };
  /** Aandeel leads ouder dan de termijn dat een status kreeg. */
  bijgewerktPct: number | null;
  bijgewerktBasis: number;
  /** Verdeling van de opvolging, over bijgewerkte leads ouder dan de termijn. */
  opvolging: Record<OpvolgStatus, number>;
  opvolgingBasis: number;
  /** Mediaan uren tot de eerste statuswijziging (alleen leveringen sinds de statusgeschiedenis bestaat). */
  urenTotEersteStatus: number | null;
  urenBasis: number;
  /** Goedgekeurde reclamaties, over leads ouder dan de termijn. */
  reclamatiePct: number | null;
  betrouwbaar: boolean;
  waarschuwing: string | null;
};

function mediaan(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const pct = (deel: number, geheel: number) => (geheel > 0 ? Math.round((deel / geheel) * 1000) / 10 : null);

export function berekenKengetallen(rijen: LeveringRij[], nu: Date = new Date()): Kengetallen {
  const snel = rijen
    .filter(r => r.eerste_klant && r.lead_created_at)
    .map(r => Math.max(0, (new Date(r.assigned_at).getTime() - new Date(r.lead_created_at as string).getTime()) / 1000));

  /* Opvolging, datakwaliteit en reclamaties over dezelfde leads: die ouder
     dan de termijn. Jonge leads staan nog vaak op "gecontacteerd" en zijn nog
     niet gereclameerd; zouden ze meetellen, dan scoort een groep met veel
     recente leads (zoals net aangezet direct leveren) ongelijk. */
  const termijn = nu.getTime() - BIJWERK_TERMIJN_DAGEN * 86_400_000;
  const oudGenoeg = rijen.filter(r => new Date(r.assigned_at).getTime() <= termijn);
  const isBijgewerkt = (r: LeveringRij) => !!r.status && r.status !== 'nieuw';
  const bijgewerkt = oudGenoeg.filter(isBijgewerkt);

  const opvolging = Object.fromEntries(OPVOLG_STATUSSEN.map(s => [s, 0])) as Record<OpvolgStatus, number>;
  for (const r of bijgewerkt) if ((OPVOLG_STATUSSEN as readonly string[]).includes(r.status as string)) opvolging[r.status as OpvolgStatus]++;

  const logStart = new Date(STATUSLOG_SINDS).getTime();
  const uren = rijen
    .filter(r => r.eerste_status_at && new Date(r.assigned_at).getTime() >= logStart)
    .map(r => Math.max(0, (new Date(r.eerste_status_at as string).getTime() - new Date(r.assigned_at).getTime()) / 3_600_000));

  const bijgewerktPct = pct(bijgewerkt.length, oudGenoeg.length);
  let waarschuwing: string | null = null;
  if (rijen.length < MIN_LEADS_BETROUWBAAR) waarschuwing = `Te weinig leads (${rijen.length}) voor een betrouwbare vergelijking`;
  else if (oudGenoeg.length === 0) waarschuwing = `Nog geen leads ouder dan ${BIJWERK_TERMIJN_DAGEN} dagen om de opvolging te beoordelen`;
  else if (oudGenoeg.length < MIN_LEADS_BETROUWBAAR) waarschuwing = `Pas ${oudGenoeg.length} leads ouder dan ${BIJWERK_TERMIJN_DAGEN} dagen; te weinig om de opvolging te beoordelen`;
  else if (bijgewerktPct !== null && bijgewerktPct < MIN_BIJGEWERKT_BETROUWBAAR * 100) waarschuwing = `Maar ${String(bijgewerktPct).replace('.', ',')}% van de leads is bijgewerkt; de opvolging zegt dan weinig`;

  return {
    leveringen: rijen.length,
    snelheid: {
      aantal: snel.length,
      mediaanSec: snel.length ? Math.round(mediaan(snel)! * 10) / 10 : null,
      binnenMinuutPct: pct(snel.filter(s => s <= 60).length, snel.length),
    },
    bijgewerktPct,
    bijgewerktBasis: oudGenoeg.length,
    opvolging,
    opvolgingBasis: bijgewerkt.length,
    urenTotEersteStatus: uren.length ? Math.round(mediaan(uren)! * 10) / 10 : null,
    urenBasis: uren.length,
    reclamatiePct: pct(oudGenoeg.filter(r => r.reclamatie).length, oudGenoeg.length),
    betrouwbaar: waarschuwing === null,
    waarschuwing,
  };
}

export type BatchRij = {
  id: string;
  customer_id: string;
  branch: string;
  created_at: string;
  completed_at: string | null;
  is_paid: boolean | null;
};

export type Herbestelling = {
  afgerond: number;
  herbesteld: number;
  binnenTermijnPct: number | null;
  mediaanDagen: number | null;
};

/**
 * Herbestellen: voor elke afgeronde betaalde batch, hoeveel dagen tot de
 * volgende betaalde batch van dezelfde klant (eerder besteld dan afgerond
 * telt als 0 dagen). Het percentage binnen de termijn rekent alleen over
 * batches die minstens de termijn geleden afrondden: van een recent
 * afgeronde batch weten we nog niet of de klant terugkomt, en alleen de
 * snelle herbestellers meetellen zou het percentage opblazen.
 */
export function berekenHerbestelling(
  afgerondeBatches: BatchRij[],
  alleBatches: BatchRij[],
  nu: Date = new Date(),
): Herbestelling {
  const dagen: number[] = [];
  let binnen = 0;
  let beoordeelbaar = 0;
  for (const b of afgerondeBatches) {
    if (!b.completed_at || !b.is_paid) continue;
    const klaar = new Date(b.completed_at).getTime();
    const besteld = new Date(b.created_at).getTime();
    const volgende = alleBatches
      .filter(x => x.customer_id === b.customer_id && x.id !== b.id && x.is_paid)
      .map(x => new Date(x.created_at).getTime())
      .filter(t => t > besteld)
      .sort((x, y) => x - y)[0];
    const d = volgende === undefined ? null : Math.max(0, (volgende - klaar) / 86_400_000);
    if (d !== null) dagen.push(d);
    if (nu.getTime() - klaar >= HERBESTEL_TERMIJN_DAGEN * 86_400_000) {
      beoordeelbaar++;
      if (d !== null && d <= HERBESTEL_TERMIJN_DAGEN) binnen++;
    }
  }
  return {
    afgerond: afgerondeBatches.filter(b => b.completed_at && b.is_paid).length,
    herbesteld: dagen.length,
    binnenTermijnPct: pct(binnen, beoordeelbaar),
    mediaanDagen: dagen.length ? Math.round(mediaan(dagen)! * 10) / 10 : null,
  };
}

export type Groep = 'direct_snelraak' | 'direct' | 'snelraak' | 'geen';
export function groepVan(r: Pick<LeveringRij, 'via_direct' | 'snelraak'>): Groep {
  if (r.via_direct && r.snelraak) return 'direct_snelraak';
  if (r.via_direct) return 'direct';
  if (r.snelraak) return 'snelraak';
  return 'geen';
}

/**
 * Even lange periodes vóór en na het aanzetten (maximaal `maxDagen`). Het
 * na-venster eindigt bij `einde` (nu, of wanneer direct leveren stopte);
 * `vroegst` is het begin van de opgehaalde gegevens, zodat het vóór-venster
 * nooit langer is dan waarvoor we gegevens hebben.
 */
export function voorNaVensters(sinds: Date, einde: Date = new Date(), maxDagen = 90, vroegst?: Date): { voor: [Date, Date]; na: [Date, Date] } {
  const lengte = Math.max(0, Math.min(
    einde.getTime() - sinds.getTime(),
    maxDagen * 86_400_000,
    vroegst ? sinds.getTime() - vroegst.getTime() : Infinity,
  ));
  return {
    voor: [new Date(sinds.getTime() - lengte), sinds],
    na: [sinds, new Date(sinds.getTime() + lengte)],
  };
}

export const binnen = (iso: string, [van, tot]: [Date, Date]) => {
  const t = new Date(iso).getTime();
  return t >= van.getTime() && t < tot.getTime();
};
