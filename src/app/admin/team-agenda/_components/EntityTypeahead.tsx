'use client';

import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

export interface EntityValue {
  id: string;
  label: string;
}

interface Props {
  kind: 'customer' | 'prospect';
  value: EntityValue | null;
  onChange: (v: EntityValue | null) => void;
  disabled?: boolean;
}

interface CustomerRow {
  id: string;
  name: string;
  city?: string | null;
}
interface ProspectRow {
  id: string;
  company_name: string;
  city?: string | null;
}

export function EntityTypeahead({ kind, value, onChange, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<EntityValue[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const path =
          kind === 'customer'
            ? `/api/admin/customers?limit=20&search=${encodeURIComponent(term)}`
            : `/api/admin/prospects?limit=20&search=${encodeURIComponent(term)}`;
        const res = await adminFetch(path);
        const data = await res.json();
        if (cancelled) return;
        if (kind === 'customer') {
          const list = (data.customers || []) as CustomerRow[];
          setResults(
            list.map(c => ({
              id: c.id,
              label: c.city ? `${c.name} · ${c.city}` : c.name,
            })),
          );
        } else {
          const list = (data.prospects || []) as ProspectRow[];
          setResults(
            list.map(p => ({
              id: p.id,
              label: p.city ? `${p.company_name} · ${p.city}` : p.company_name,
            })),
          );
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, kind]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {kind === 'customer' ? 'Klant' : 'Prospect'}
          </div>
          <div className="truncate text-sm font-medium text-slate-800">{value.label}</div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            aria-label="Koppeling verwijderen"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20">
        <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={kind === 'customer' ? 'Zoek klant op naam of stad…' : 'Zoek prospect op naam of stad…'}
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          disabled={disabled}
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-400">Bezig met zoeken…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">Geen resultaten</div>
          )}
          {!loading &&
            results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                  setQuery('');
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {r.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
