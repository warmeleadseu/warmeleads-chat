/**
 * Statussen, uitkomsten en overgangsregels van een afspraak.
 *
 * Eén bron voor het portaal, de admin en de API. De agenda liet eerder alleen
 * 'voltooid' en 'niet verschenen' toe terwijl de API vijf statussen kende, en
 * dat verschil zat verspreid over drie bestanden. Alles wat hier staat wordt
 * door alle drie gelezen.
 */

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'completed',
  'no_show',
  'cancelled',
  'rescheduled',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Ingepland',
  completed: 'Bezocht',
  no_show: 'Niet verschenen',
  cancelled: 'Geannuleerd',
  rescheduled: 'Verzet',
};

/** Uitkomst van een bezoek. Alleen zinvol bij status 'completed'. */
export const APPOINTMENT_OUTCOMES = ['deal', 'no_deal', 'follow_up'] as const;
export type AppointmentOutcome = (typeof APPOINTMENT_OUTCOMES)[number];

export const OUTCOME_LABELS: Record<AppointmentOutcome, string> = {
  deal: 'Deal gesloten',
  no_deal: 'Geen deal',
  follow_up: 'Vervolg nodig',
};

/** Redenen bij 'geen deal'. Vaste lijst, zodat je er later op kunt rapporteren. */
export const NO_DEAL_REASONS = [
  { value: 'prijs', label: 'Te duur' },
  { value: 'geen_interesse', label: 'Geen interesse meer' },
  { value: 'concurrent', label: 'Gaat met concurrent in zee' },
  { value: 'niet_beslissingsbevoegd', label: 'Niet beslissingsbevoegd' },
  { value: 'geen_budget', label: 'Geen budget' },
  { value: 'niet_geschikt', label: 'Woning/situatie niet geschikt' },
  { value: 'bedenktijd', label: 'Wil bedenktijd' },
  { value: 'anders', label: 'Anders' },
] as const;

export const CANCELLED_BY = [
  { value: 'lead', label: 'Door de klant afgezegd' },
  { value: 'customer', label: 'Zelf afgezegd' },
  { value: 'admin', label: 'Door Warme Leads afgezegd' },
] as const;

export type CancelledBy = (typeof CANCELLED_BY)[number]['value'];

/**
 * Welke statusovergangen mogen.
 *
 * Een afgeboekte afspraak mag terug naar 'ingepland' (een vergissing moet je
 * kunnen herstellen), maar 'verzet' is een eindpunt: die afspraak leeft verder
 * als de opvolger, en hem heropenen zou twee actieve afspraken voor dezelfde
 * lead opleveren.
 */
const TOEGESTANE_OVERGANGEN: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['completed', 'no_show', 'cancelled', 'rescheduled'],
  completed: ['scheduled', 'no_show', 'cancelled'],
  no_show: ['scheduled', 'completed', 'cancelled'],
  cancelled: ['scheduled'],
  rescheduled: [],
};

export function isAppointmentStatus(waarde: unknown): waarde is AppointmentStatus {
  return typeof waarde === 'string' && (APPOINTMENT_STATUSES as readonly string[]).includes(waarde);
}

export function isAppointmentOutcome(waarde: unknown): waarde is AppointmentOutcome {
  return typeof waarde === 'string' && (APPOINTMENT_OUTCOMES as readonly string[]).includes(waarde);
}

export function mayTransition(van: AppointmentStatus, naar: AppointmentStatus): boolean {
  if (van === naar) return true;
  return TOEGESTANE_OVERGANGEN[van].includes(naar);
}

export type OutcomeInvoer = {
  status: AppointmentStatus;
  outcome?: string | null;
  outcome_reason?: string | null;
  deal_value?: number | string | null;
  cancelled_by?: string | null;
};

export type OutcomeResultaat =
  | { ok: true; velden: Record<string, unknown> }
  | { ok: false; fout: string };

/**
 * Valideert een afboeking en levert precies de kolommen op die geschreven
 * mogen worden. Zet ook de velden leeg die bij de nieuwe status niet meer
 * horen: wie een deal terugzet naar 'niet verschenen' mag geen dealbedrag
 * laten staan, anders tellen de omzetcijfers een verkoop mee die niet bestaat.
 */
export function bereidAfboekingVoor(invoer: OutcomeInvoer, nu: Date = new Date()): OutcomeResultaat {
  const { status } = invoer;
  if (!isAppointmentStatus(status)) return { ok: false, fout: 'Onbekende status' };

  const velden: Record<string, unknown> = { status };
  const tijdstempel = nu.toISOString();

  // Standaard alles leegmaken wat statusgebonden is; hieronder vullen we terug
  // wat bij deze status hoort.
  velden.outcome = null;
  velden.outcome_reason = null;
  velden.deal_value = null;
  velden.outcome_at = null;
  velden.cancelled_at = null;
  velden.cancelled_by = null;
  velden.completed_at = null;

  if (status === 'completed') {
    const { outcome } = invoer;
    if (outcome != null && outcome !== '') {
      if (!isAppointmentOutcome(outcome)) return { ok: false, fout: 'Onbekende uitkomst' };
      velden.outcome = outcome;
      velden.outcome_at = tijdstempel;

      if (outcome === 'deal') {
        const ruw = invoer.deal_value;
        if (ruw != null && ruw !== '') {
          const bedrag = typeof ruw === 'number' ? ruw : Number(String(ruw).replace(',', '.'));
          if (!Number.isFinite(bedrag) || bedrag < 0) {
            return { ok: false, fout: 'Ongeldig dealbedrag' };
          }
          velden.deal_value = Math.round(bedrag * 100) / 100;
        }
      }

      if (outcome === 'no_deal') {
        const reden = invoer.outcome_reason;
        if (!reden) return { ok: false, fout: 'Geef een reden op waarom het geen deal werd' };
        if (!NO_DEAL_REASONS.some(r => r.value === reden)) {
          return { ok: false, fout: 'Onbekende reden' };
        }
        velden.outcome_reason = reden;
      }
    }
    velden.completed_at = tijdstempel;
  }

  if (status === 'cancelled') {
    velden.cancelled_at = tijdstempel;
    const door = invoer.cancelled_by;
    if (door) {
      if (!CANCELLED_BY.some(c => c.value === door)) return { ok: false, fout: 'Onbekende afzegger' };
      velden.cancelled_by = door;
    }
  }

  return { ok: true, velden };
}

/** Telt hoe vaak een afspraak is verzet, door de keten terug te lopen. */
export function telVerzettingen(
  afspraakId: string,
  ketenPerId: Map<string, string | null>,
): number {
  let aantal = 0;
  let huidig = ketenPerId.get(afspraakId) ?? null;
  const gezien = new Set<string>([afspraakId]);
  while (huidig && !gezien.has(huidig)) {
    gezien.add(huidig);
    aantal += 1;
    huidig = ketenPerId.get(huidig) ?? null;
  }
  return aantal;
}

/** Of een afspraak nog een plek in de agenda inneemt. */
export function isActief(status: string): boolean {
  return status === 'scheduled';
}

/** Of er nog iets afgeboekt moet worden: bezoek geweest, maar geen uitkomst. */
export function wachtOpAfboeking(
  afspraak: { status: string; starts_at: string; outcome?: string | null },
  nu: Date = new Date(),
): boolean {
  if (afspraak.status !== 'scheduled') return false;
  const start = new Date(afspraak.starts_at);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() < nu.getTime();
}
