import { createServerClient } from './supabase';

export interface AvailableSlot {
  start: string; // ISO
  end: string;   // ISO
}

export interface ComputeSlotsParams {
  customerId: string;
  portalUserId?: string | null;
  from: Date;
  to: Date;
  durationMinutes: number;
  bufferMinutes?: number;
  step?: number; // slot granularity in minutes (default 30)
  excludeAppointmentId?: string;
}

interface WeeklyRow {
  portal_user_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface OverrideRow {
  portal_user_id: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  type: 'blocked' | 'extra';
}

interface AppointmentRow {
  id: string;
  portal_user_id: string | null;
  starts_at: string;
  duration_minutes: number;
  travel_buffer_minutes: number;
  status: string;
}

export interface Interval {
  start: Date;
  end: Date;
}

const AMSTERDAM_TZ = 'Europe/Amsterdam';

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** YYYY-MM-DD in Europe/Amsterdam. */
export function amsterdamYmd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: AMSTERDAM_TZ });
}

/** 0=zondag … 6=zaterdag in Europe/Amsterdam. */
export function amsterdamDayOfWeek(d: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: AMSTERDAM_TZ,
    weekday: 'short',
  }).format(d);
  return WEEKDAY_MAP[wd] ?? 0;
}

/**
 * Interpreteert een lokale wandkloktijd (HH:MM[:SS]) op een Amsterdam-kalenderdag
 * als UTC Date — correct bij CET/CEST.
 */
export function amsterdamWallTimeToUtc(ymd: string, timeStr: string): Date {
  const [ys, ms, ds] = ymd.split('-');
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  const [hRaw, mRaw, sRaw] = timeStr.split(':').map(Number);
  const hour = hRaw || 0;
  const minute = mRaw || 0;
  const second = sRaw || 0;

  // Start met UTC-guess op dezelfde wandklokcijfers, corrigeer daarna met zone-offset.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: AMSTERDAM_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = fmt.formatToParts(utcGuess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  let zh = get('hour');
  if (zh === 24) zh = 0;
  const asZoneMs = Date.UTC(get('year'), get('month') - 1, get('day'), zh, get('minute'), get('second'));
  const offset = asZoneMs - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

/** Civil-date arithmetic on YYYY-MM-DD (timezone-agnostic). */
export function addCivilDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

/**
 * Availability/overrides filter:
 * - undefined → iedereen (union)
 * - null → alleen klant-/bedrijfsniveau
 * - uuid → eigen rijen + bedrijfsniveau (inheritance)
 */
export function filterAvailabilityRows<T extends { portal_user_id: string | null }>(
  arr: T[],
  portalUserId: string | null | undefined,
): T[] {
  if (portalUserId === undefined) return arr;
  if (portalUserId === null) return arr.filter((r) => r.portal_user_id === null);
  return arr.filter((r) => r.portal_user_id === portalUserId || r.portal_user_id === null);
}

/**
 * Busy appointments: eigen + unassigned (null). Andere adviseurs blokkeren niet.
 * undefined → alle appointments.
 */
export function filterBusyAppointments<T extends { portal_user_id: string | null }>(
  arr: T[],
  portalUserId: string | null | undefined,
): T[] {
  if (portalUserId === undefined) return arr;
  if (portalUserId === null) return arr.filter((r) => r.portal_user_id === null);
  return arr.filter((r) => r.portal_user_id === portalUserId || r.portal_user_id === null);
}

/** Middernacht (Amsterdam) van een kalenderdag, in ms. */
function dayIntervalsStart(ymd: string): number {
  return amsterdamWallTimeToUtc(ymd, '00:00:00').getTime();
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const result: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    const cur = sorted[i];
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) last.end = cur.end;
    } else {
      result.push({ ...cur });
    }
  }
  return result;
}

function subtractIntervals(base: Interval[], subtract: Interval[]): Interval[] {
  if (subtract.length === 0) return base;
  let current = base.map((i) => ({ ...i }));
  for (const s of subtract) {
    const next: Interval[] = [];
    for (const c of current) {
      if (s.end <= c.start || s.start >= c.end) {
        next.push(c);
      } else {
        if (s.start > c.start) next.push({ start: c.start, end: s.start });
        if (s.end < c.end) next.push({ start: s.end, end: c.end });
      }
    }
    current = next;
  }
  return current;
}

/**
 * Tijdsloten op één dag.
 *
 * De beschikbaarheid geldt voor de afspraak zelf: bij 18:00 - 19:30 kan een
 * afspraak van een uur om 18:00 of 18:30. Reistijd zit alleen tussen twee
 * afspraken: tussen een nieuwe en een bestaande afspraak moet minstens de
 * grootste van beide reistijden vrij blijven.
 *
 * Voorheen moest de reistijd vóór en na elke afspraak ook binnen de
 * beschikbaarheid passen. RJ CV Optimalisatie (beschikbaar 18:00 - 19:30,
 * afspraak 60 min + 2 x 30 min reistijd) kreeg daardoor geen enkel tijdslot.
 */
export function slotsVoorDag(params: {
  beschikbaar: Interval[];
  afspraken: { start: Date; end: Date; buffer: number }[];
  durationMinutes: number;
  bufferMinutes: number;
  step: number;
  now: Date;
  from: Date;
  to: Date;
}): AvailableSlot[] {
  const { beschikbaar, afspraken, durationMinutes, bufferMinutes, step, now, from, to } = params;
  const duur = durationMinutes * 60_000;
  const uit: AvailableSlot[] = [];
  for (const iv of beschikbaar) {
    for (let t = iv.start.getTime(); t + duur <= iv.end.getTime(); t += step * 60_000) {
      const start = new Date(t);
      const end = new Date(t + duur);
      if (start < now || start < from || end > to) continue;
      const botst = afspraken.some(a => {
        const gat = Math.max(bufferMinutes, a.buffer) * 60_000;
        return start.getTime() < a.end.getTime() + gat && a.start.getTime() - gat < end.getTime();
      });
      if (!botst) uit.push({ start: start.toISOString(), end: end.toISOString() });
    }
  }
  return uit;
}

/**
 * Compute available appointment slots for a customer (optionally filtered by portal_user_id).
 * - portalUserId undefined: union van alle adviseurs
 * - portalUserId null: alleen bedrijfsniveau (portal_user_id IS NULL)
 * - portalUserId uuid: eigen beschikbaarheid + bedrijfsniveau (inheritance)
 */
export async function computeAvailableSlots(params: ComputeSlotsParams): Promise<AvailableSlot[]> {
  const {
    customerId,
    portalUserId,
    from,
    to,
    durationMinutes,
    bufferMinutes = 0,
    step = 30,
    excludeAppointmentId,
  } = params;

  const supabase = createServerClient();

  const fromYmd = amsterdamYmd(from);
  const toYmd = amsterdamYmd(to);

  const [availRes, ovRes, apptRes] = await Promise.all([
    supabase
      .from('adviser_availability')
      .select('portal_user_id, day_of_week, start_time, end_time, is_active')
      .eq('customer_id', customerId)
      .eq('is_active', true),
    supabase
      .from('availability_overrides')
      .select('portal_user_id, date, start_time, end_time, type')
      .eq('customer_id', customerId)
      .gte('date', fromYmd)
      .lte('date', toYmd),
    supabase
      .from('appointments')
      .select('id, portal_user_id, starts_at, duration_minutes, travel_buffer_minutes, status')
      .eq('customer_id', customerId)
      .in('status', ['scheduled'])
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString()),
  ]);

  const weekly: WeeklyRow[] = filterAvailabilityRows((availRes.data as WeeklyRow[]) || [], portalUserId);
  const overrides: OverrideRow[] = filterAvailabilityRows((ovRes.data as OverrideRow[]) || [], portalUserId);
  const appointments: AppointmentRow[] = filterBusyAppointments(
    ((apptRes.data as AppointmentRow[]) || []).filter((a) => a.id !== excludeAppointmentId),
    portalUserId,
  );

  const slots: AvailableSlot[] = [];
  const now = new Date();

  let ymd = fromYmd;
  while (ymd <= toYmd) {
    // Noon UTC on the civil day → stable Amsterdam weekday/date
    const [y, m, d] = ymd.split('-').map(Number);
    const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = amsterdamDayOfWeek(noonUtc);

    const dayOverrides = overrides.filter((o) => o.date === ymd);
    const fullyBlocked = dayOverrides.some((o) => o.type === 'blocked' && !o.start_time && !o.end_time);

    if (!fullyBlocked) {
      const baseWeekly: Interval[] = weekly
        .filter((w) => w.day_of_week === dayOfWeek)
        .map((w) => ({
          start: amsterdamWallTimeToUtc(ymd, w.start_time),
          end: amsterdamWallTimeToUtc(ymd, w.end_time),
        }));

      const extraIntervals: Interval[] = dayOverrides
        .filter((o) => o.type === 'extra' && o.start_time && o.end_time)
        .map((o) => ({
          start: amsterdamWallTimeToUtc(ymd, o.start_time!),
          end: amsterdamWallTimeToUtc(ymd, o.end_time!),
        }));

      let dayIntervals = mergeIntervals([...baseWeekly, ...extraIntervals]);

      const blockedIntervals: Interval[] = dayOverrides
        .filter((o) => o.type === 'blocked' && o.start_time && o.end_time)
        .map((o) => ({
          start: amsterdamWallTimeToUtc(ymd, o.start_time!),
          end: amsterdamWallTimeToUtc(ymd, o.end_time!),
        }));
      dayIntervals = subtractIntervals(dayIntervals, blockedIntervals);

      const afspraken = appointments
        .filter((ap) => {
          /* Ook afspraken die net op een andere kalenderdag beginnen kunnen
             met hun reistijd raken; een dag ruim pakken is goedkoop. */
          const st = new Date(ap.starts_at).getTime();
          return st > dayIntervalsStart(ymd) - 86_400_000 && st < dayIntervalsStart(ymd) + 2 * 86_400_000;
        })
        .map((ap) => {
          const st = new Date(ap.starts_at);
          return { start: st, end: new Date(st.getTime() + ap.duration_minutes * 60_000), buffer: ap.travel_buffer_minutes || 0 };
        });

      slots.push(...slotsVoorDag({
        beschikbaar: dayIntervals,
        afspraken,
        durationMinutes,
        bufferMinutes,
        step,
        now,
        from,
        to,
      }));
    }

    ymd = addCivilDays(ymd, 1);
  }

  return slots;
}

/**
 * Validates if a specific slot is bookable — used by POST endpoints.
 */
export async function validateSlot(params: {
  customerId: string;
  portalUserId?: string | null;
  startsAt: Date;
  durationMinutes: number;
  bufferMinutes?: number;
  excludeAppointmentId?: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const { customerId, portalUserId, startsAt, durationMinutes, bufferMinutes = 0, excludeAppointmentId } = params;

  if (startsAt < new Date()) {
    return { valid: false, reason: 'Slot ligt in het verleden' };
  }

  const ymd = amsterdamYmd(startsAt);
  const dayStart = amsterdamWallTimeToUtc(ymd, '00:00:00');
  const dayEnd = amsterdamWallTimeToUtc(ymd, '23:59:59');

  const slots = await computeAvailableSlots({
    customerId,
    portalUserId,
    from: dayStart,
    to: dayEnd,
    durationMinutes,
    bufferMinutes,
    step: 5,
    excludeAppointmentId,
  });

  const target = startsAt.getTime();
  const match = slots.some((s) => new Date(s.start).getTime() === target);
  return match
    ? { valid: true }
    : { valid: false, reason: 'Dit tijdslot is niet beschikbaar' };
}
