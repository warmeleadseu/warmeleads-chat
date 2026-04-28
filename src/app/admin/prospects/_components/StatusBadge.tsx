import { PROSPECT_STATUS_COLORS, PROSPECT_STATUS_LABELS, type ProspectStatus } from '@/lib/prospects';

interface Props {
  status: ProspectStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const c = PROSPECT_STATUS_COLORS[status];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${c.bg} ${c.text} ${c.ring} ${padding}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden />
      {PROSPECT_STATUS_LABELS[status]}
    </span>
  );
}
