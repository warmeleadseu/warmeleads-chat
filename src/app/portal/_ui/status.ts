export type StatusScope = 'order' | 'appointment' | 'lead';

export interface StatusStyle {
  text: string;
  cls: string;
  dot: string;
}

const ORDER_STATUS: Record<string, StatusStyle> = {
  paid: { text: 'Betaald', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  pending: { text: 'In behandeling', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  failed: { text: 'Mislukt', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  expired: { text: 'Verlopen', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  cancelled: { text: 'Geannuleerd', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

const APPOINTMENT_STATUS: Record<string, StatusStyle> = {
  scheduled: { text: 'Ingepland', cls: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  completed: { text: 'Voltooid', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  no_show: { text: 'No-show', cls: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  cancelled: { text: 'Geannuleerd', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  rescheduled: { text: 'Verzet', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
};

const LEAD_STATUS: Record<string, StatusStyle> = {
  nieuw: { text: 'Nieuw', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  gecontacteerd: { text: 'Gecontacteerd', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  geen_gehoor: { text: 'Geen gehoor', cls: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  offerte: { text: 'Offerte', cls: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  verkocht: { text: 'Verkocht', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  afgewezen: { text: 'Afgewezen', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

export const STATUS_MAPS: Record<StatusScope, Record<string, StatusStyle>> = {
  order: ORDER_STATUS,
  appointment: APPOINTMENT_STATUS,
  lead: LEAD_STATUS,
};

const FALLBACK: StatusStyle = { text: '', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };

export function getStatusStyle(scope: StatusScope, status: string): StatusStyle {
  const map = STATUS_MAPS[scope];
  const entry = map[status];
  if (entry) return entry;
  return { ...FALLBACK, text: status };
}
