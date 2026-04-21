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

function parseTimeOnDate(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function dateYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface Interval {
  start: Date;
  end: Date;
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
  let current = base.map(i => ({ ...i }));
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
 * Compute available appointment slots for a customer (optionally filtered by portal_user_id).
 * If portalUserId is null, computes slots from customer-level availability (portal_user_id IS NULL).
 * If portalUserId is undefined, merges all advisers' availability (union).
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

  // Fetch availability + overrides + existing appointments
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
      .gte('date', dateYMD(from))
      .lte('date', dateYMD(to)),
    supabase
      .from('appointments')
      .select('id, portal_user_id, starts_at, duration_minutes, travel_buffer_minutes, status')
      .eq('customer_id', customerId)
      .in('status', ['scheduled'])
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString()),
  ]);

  const filterByUser = <T extends { portal_user_id: string | null }>(arr: T[]): T[] => {
    if (portalUserId === undefined) return arr;
    return arr.filter(r => r.portal_user_id === portalUserId);
  };

  const weekly: WeeklyRow[] = filterByUser((availRes.data as WeeklyRow[]) || []);
  const overrides: OverrideRow[] = filterByUser((ovRes.data as OverrideRow[]) || []);
  const appointments: AppointmentRow[] = filterByUser(((apptRes.data as AppointmentRow[]) || []).filter(a => a.id !== excludeAppointmentId));

  const slots: AvailableSlot[] = [];
  const now = new Date();

  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(to);
  endDay.setHours(23, 59, 59, 999);

  while (cursor <= endDay) {
    const dayOfWeek = cursor.getDay();
    const ymd = dateYMD(cursor);

    // Check if day is fully blocked (type=blocked without time range)
    const dayOverrides = overrides.filter(o => o.date === ymd);
    const fullyBlocked = dayOverrides.some(o => o.type === 'blocked' && !o.start_time && !o.end_time);

    if (!fullyBlocked) {
      // Base intervals from weekly schedule for this day
      const baseWeekly: Interval[] = weekly
        .filter(w => w.day_of_week === dayOfWeek)
        .map(w => ({
          start: parseTimeOnDate(cursor, w.start_time),
          end: parseTimeOnDate(cursor, w.end_time),
        }));

      // Add extra overrides
      const extraIntervals: Interval[] = dayOverrides
        .filter(o => o.type === 'extra' && o.start_time && o.end_time)
        .map(o => ({
          start: parseTimeOnDate(cursor, o.start_time!),
          end: parseTimeOnDate(cursor, o.end_time!),
        }));

      let dayIntervals = mergeIntervals([...baseWeekly, ...extraIntervals]);

      // Subtract time-range blocked overrides
      const blockedIntervals: Interval[] = dayOverrides
        .filter(o => o.type === 'blocked' && o.start_time && o.end_time)
        .map(o => ({
          start: parseTimeOnDate(cursor, o.start_time!),
          end: parseTimeOnDate(cursor, o.end_time!),
        }));
      dayIntervals = subtractIntervals(dayIntervals, blockedIntervals);

      // Subtract existing appointments (including travel buffer)
      const apptIntervals: Interval[] = appointments
        .filter(a => {
          const d = new Date(a.starts_at);
          return dateYMD(d) === ymd;
        })
        .map(a => {
          const s = new Date(a.starts_at);
          const buffer = a.travel_buffer_minutes || 0;
          const startWithBuffer = new Date(s.getTime() - buffer * 60_000);
          const endWithBuffer = new Date(s.getTime() + (a.duration_minutes + buffer) * 60_000);
          return { start: startWithBuffer, end: endWithBuffer };
        });

      dayIntervals = subtractIntervals(dayIntervals, apptIntervals);

      // Generate candidate slots at `step` granularity
      for (const iv of dayIntervals) {
        const slotDurationMs = (durationMinutes + (bufferMinutes * 2)) * 60_000;
        const ivStartMs = iv.start.getTime();
        const ivEndMs = iv.end.getTime();

        for (let t = ivStartMs; t + slotDurationMs <= ivEndMs; t += step * 60_000) {
          const slotStart = new Date(t + bufferMinutes * 60_000);
          const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
          if (slotStart < now) continue;
          if (slotStart < from || slotEnd > to) continue;
          slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
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

  const dayStart = new Date(startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

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
  const match = slots.some(s => new Date(s.start).getTime() === target);
  return match
    ? { valid: true }
    : { valid: false, reason: 'Dit tijdslot is niet beschikbaar' };
}
