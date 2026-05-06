/**
 * Lichtgewicht datum-helpers voor de team-agenda. We gebruiken bewust geen
 * date-fns in de UI om de bundle klein te houden; alleen pure functies.
 */

export const DAY_LABELS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
export const MONTH_LABELS_NL = [
  'Januari',
  'Februari',
  'Maart',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Augustus',
  'September',
  'Oktober',
  'November',
  'December',
];

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
export function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

export function startOfWeek(d: Date): Date {
  const c = startOfDay(d);
  const day = (c.getDay() + 6) % 7; // ma=0 .. zo=6
  c.setDate(c.getDate() - day);
  return c;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return endOfDay(e);
}

export function startOfMonth(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return c;
}

export function endOfMonth(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Bouw een 6x7 grid (42 dagen) startend op de maandag vóór of op `monthStart`. */
export function buildMonthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Bouw 7 dagen vanaf maandag van de week waarin `d` valt. */
export function buildWeekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDayLabel(d: Date): string {
  return DAY_LABELS_NL[(d.getDay() + 6) % 7];
}

export function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatRange(starts: Date, ends: Date, allDay: boolean): string {
  if (allDay) {
    if (isSameDay(starts, ends))
      return `Hele dag · ${starts.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;
    return `${starts.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – ${ends.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;
  }
  if (isSameDay(starts, ends)) {
    return `${starts.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} · ${formatTime(starts)} – ${formatTime(ends)}`;
  }
  return `${starts.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${formatTime(starts)} → ${ends.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${formatTime(ends)}`;
}

/** ISO-string maar dan in lokaal tijdzone-formaat dat <input type="datetime-local"> snapt. */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
