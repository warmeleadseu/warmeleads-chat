export const EVENT_TYPES = [
  'customer_visit',
  'prospect_visit',
  'internal',
  'external_event',
  'vacation',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const TYPE_META: Record<
  EventType,
  { label: string; pill: string; dot: string; ring: string; soft: string }
> = {
  customer_visit: {
    label: 'Klantbezoek',
    pill: 'bg-emerald-500 text-white',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    soft: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  prospect_visit: {
    label: 'Prospect-bezoek',
    pill: 'bg-sky-500 text-white',
    dot: 'bg-sky-500',
    ring: 'ring-sky-200',
    soft: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  internal: {
    label: 'Intern',
    pill: 'bg-slate-500 text-white',
    dot: 'bg-slate-500',
    ring: 'ring-slate-200',
    soft: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  external_event: {
    label: 'Beurs / event',
    pill: 'bg-brand-purple text-white',
    dot: 'bg-brand-purple',
    ring: 'ring-brand-purple/30',
    soft: 'bg-brand-purple/10 text-brand-purple ring-brand-purple/20',
  },
  vacation: {
    label: 'Vakantie / vrij',
    pill: 'bg-amber-500 text-white',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
    soft: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  other: {
    label: 'Overig',
    pill: 'bg-zinc-500 text-white',
    dot: 'bg-zinc-500',
    ring: 'ring-zinc-200',
    soft: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  },
};

export interface Participant {
  id: string;
  name: string;
  email: string;
}
export interface AdminOption {
  id: string;
  name: string;
  email?: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  customer: { id: string; name: string | null } | null;
  prospect: { id: string; company_name: string | null } | null;
  created_by: string | null;
  creator: { id: string; name: string } | null;
  participants: Participant[];
  created_at: string;
  updated_at: string;
}

export interface EventInput {
  id?: string;
  title: string;
  description: string;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string;
  customer_id: string | null;
  prospect_id: string | null;
  participant_ids: string[];
}

export type CalendarView = 'month' | 'week' | 'list';
