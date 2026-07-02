'use client';

import { resolveProspectType, type ProspectTypeInput } from '@/lib/prospectType';

interface Props extends ProspectTypeInput {
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Toont in één oogopslag wat voor soort prospect het is (Afspraken, Bulk,
 * Verse lead-interesse, Import, Handmatig, Overig).
 */
export function ProspectTypeBadge({ size = 'md', className = '', branches, source, source_metadata }: Props) {
  const meta = resolveProspectType({ branches, source, source_metadata });
  const sizeCls = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset ${meta.badge} ${sizeCls} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.short}
    </span>
  );
}
