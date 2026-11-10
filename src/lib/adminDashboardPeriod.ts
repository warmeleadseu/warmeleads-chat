import { amsterdamDayOfWeek, amsterdamWallTimeToUtc, amsterdamYmd } from './appointmentSlots';

/** Periodes voor admin-dashboard + kosten/CPL (zelfde grenzen als periodestatistieken). */

export const DASHBOARD_PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/* Kalendergrenzen in Nederlandse tijd. De server draait in UTC: met
   new Date(jaar, maand, 1) begon "deze maand" om 01:00 of 02:00 's nachts
   Nederlandse tijd, en telden leads van net na middernacht bij de vorige dag,
   week of maand. Zelfde grenzen als de liveslide. */
function nlDatum(nu: Date): { j: number; m: number; d: number; wd: number } {
  const [j, m, d] = amsterdamYmd(nu).split('-').map(Number);
  return { j, m, d, wd: amsterdamDayOfWeek(nu) };
}
const ymd = (j: number, m: number, d: number) => {
  const t = new Date(Date.UTC(j, m - 1, d));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};
const middernacht = (j: number, m: number, d: number) => amsterdamWallTimeToUtc(ymd(j, m, d), '00:00');

/** Begin van de periode (verschuiving 0) of de periode ervoor (-1), om 00:00 Nederlandse tijd. */
function periodeBegin(period: string, stap: 0 | -1, nu: Date = new Date()): Date {
  const { j, m, d, wd } = nlDatum(nu);
  switch (period) {
    case 'day':
      return middernacht(j, m, d + stap);
    case 'week': {
      const naarMaandag = wd === 0 ? 6 : wd - 1;
      return middernacht(j, m, d - naarMaandag + 7 * stap);
    }
    case 'month':
      return middernacht(j, m + stap, 1);
    case 'quarter':
      return middernacht(j, Math.floor((m - 1) / 3) * 3 + 1 + 3 * stap, 1);
    case 'year':
      return middernacht(j + stap, 1, 1);
    default:
      return new Date(nu.getTime() - (stap === 0 ? 7 : 14) * 24 * 60 * 60 * 1000);
  }
}

export function getPeriodStart(period: string, nu: Date = new Date()): Date {
  return periodeBegin(period, 0, nu);
}

export function getPrevPeriodStart(period: string, nu: Date = new Date()): Date {
  return periodeBegin(period, -1, nu);
}

export function parseDashboardPeriod(value: string | null | undefined): DashboardPeriod {
  const v = (value || 'week').toLowerCase();
  return (DASHBOARD_PERIODS as readonly string[]).includes(v) ? (v as DashboardPeriod) : 'week';
}
