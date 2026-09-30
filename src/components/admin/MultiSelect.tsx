'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

/**
 * Meerkeuzemenu met zoekveld en tellingen, gedeeld door Leads CRM en Restleads.
 * Eén component, zodat beide schermen hetzelfde werken en een verbetering op
 * de ene plek ook op de andere terechtkomt.
 */

export interface MultiSelectOption { value: string; label: string; }
export interface MultiSelectGroup { label: string; options: MultiSelectOption[]; }

export default function MultiSelect({
  label,
  allLabel,
  options,
  groups,
  selected,
  onChange,
  searchable = false,
  counts,
}: {
  label: string;
  allLabel: string;
  options?: MultiSelectOption[];
  groups?: MultiSelectGroup[];
  selected: string[];
  onChange: (v: string[]) => void;
  searchable?: boolean;
  counts?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allOptions = useMemo(() => {
    if (groups) return groups.flatMap(g => g.options);
    return options || [];
  }, [options, groups]);

  const allValues = useMemo(() => allOptions.map(o => o.value), [allOptions]);
  const isAll = selected.length === 0;

  const filtered = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return allOptions.filter(o => o.label.toLowerCase().includes(q));
  }, [search, allOptions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open, searchable]);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      const next = selected.filter(v => v !== val);
      onChange(next);
    } else {
      const next = [...selected, val];
      if (next.length === allValues.length) onChange([]);
      else onChange(next);
    }
  };

  const selectAll = () => onChange([]);
  const deselectAll = () => onChange([allValues[0]]);

  const selectedCount = useMemo(() => {
    if (!counts || selected.length === 0) return null;
    return selected.reduce((s, v) => s + (counts[v] || 0), 0);
  }, [counts, selected]);

  const triggerLabel = useMemo(() => {
    if (isAll) return allLabel;
    if (selected.length === 1) {
      const opt = allOptions.find(o => o.value === selected[0]);
      const lbl = opt?.label || selected[0];
      return selectedCount !== null ? `${lbl} (${selectedCount})` : lbl;
    }
    return selectedCount !== null
      ? `${selected.length} ${label} (${selectedCount})`
      : `${selected.length} ${label}`;
  }, [isAll, selected, allLabel, label, allOptions, selectedCount]);

  const hasSelection = !isAll;

  const totalFacetCount = useMemo(() => {
    if (!counts) return 0;
    return Object.values(counts).reduce((s, n) => s + n, 0);
  }, [counts]);

  const renderCheckbox = (opt: MultiSelectOption) => {
    const checked = isAll || selected.includes(opt.value);
    const count = counts?.[opt.value];
    const hasCount = count !== undefined;
    const zeroCount = hasCount && count === 0;
    return (
      <button
        key={opt.value}
        type="button"
        onClick={() => toggle(opt.value)}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-50 ${zeroCount ? 'opacity-40' : ''}`}
      >
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${checked ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-300 bg-white'}`}>
          {checked && <CheckIcon className="h-3 w-3" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-slate-700">{opt.label}</span>
        {hasCount && (
          <span className={`tabular-nums text-xs ${zeroCount ? 'text-slate-300' : 'text-slate-400'}`}>{count.toLocaleString('nl-NL')}</span>
        )}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded-lg border px-3 py-2 text-sm transition ${hasSelection ? 'border-brand-purple/40 bg-brand-purple/5 text-brand-purple font-medium' : 'border-slate-200 bg-white text-slate-700'}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition ${open ? 'rotate-180' : ''} ${hasSelection ? 'text-brand-purple' : 'text-slate-400'}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {searchable && (
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Zoeken..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-brand-purple/50 focus:bg-white"
                  />
                </div>
              </div>
            )}

            <div className="border-b border-slate-100 px-3 py-1.5">
              <div className="flex items-center justify-between">
                <button type="button" onClick={selectAll} className={`text-xs font-medium transition ${isAll ? 'text-brand-purple' : 'text-slate-400 hover:text-slate-600'}`}>
                  Alles
                </button>
                {hasSelection && (
                  <button type="button" onClick={selectAll} className="text-xs text-slate-400 hover:text-slate-600">
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {filtered ? (
                filtered.length === 0 ? (
                  <p className="px-3 py-3 text-center text-xs text-slate-400">Geen resultaten</p>
                ) : (
                  filtered.map(opt => renderCheckbox(opt))
                )
              ) : groups ? (
                groups.map(g => (
                  <div key={g.label}>
                    <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
                    {g.options.map(opt => renderCheckbox(opt))}
                  </div>
                ))
              ) : (
                allOptions.map(opt => renderCheckbox(opt))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

