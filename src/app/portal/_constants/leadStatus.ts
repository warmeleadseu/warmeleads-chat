import { LEAD_STATUS_LABELS, LEAD_STATUS_VALUES } from '@/lib/leadStatuses';

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle statussen' },
  ...LEAD_STATUS_VALUES.map(value => ({
    value,
    label: LEAD_STATUS_LABELS[value],
  })),
] as const;

export const STATUS_COLORS: Record<string, string> = {
  nieuw: 'bg-blue-100 text-blue-700',
  gecontacteerd: 'bg-amber-100 text-amber-700',
  geen_gehoor: 'bg-orange-100 text-orange-700',
  offerte: 'bg-purple-100 text-purple-700',
  afspraak: 'bg-indigo-100 text-indigo-700',
  verkocht: 'bg-emerald-100 text-emerald-700',
  afgewezen: 'bg-slate-100 text-slate-500',
};
