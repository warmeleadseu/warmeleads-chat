/** Periodes voor admin-dashboard + kosten/CPL (zelfde grenzen als periodestatistieken). */

export const DASHBOARD_PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export function getPrevPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1) - 7);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
    case 'year':
      return new Date(now.getFullYear() - 1, 0, 1);
    default:
      return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  }
}

export function parseDashboardPeriod(value: string | null | undefined): DashboardPeriod {
  const v = (value || 'week').toLowerCase();
  return (DASHBOARD_PERIODS as readonly string[]).includes(v) ? (v as DashboardPeriod) : 'week';
}
