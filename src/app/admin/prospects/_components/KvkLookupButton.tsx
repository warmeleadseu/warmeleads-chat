'use client';

import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface KvkResult {
  kvkNummer: string;
  naam: string;
  straatnaam: string;
  huisnummer: string;
  postcode: string;
  plaats: string;
  actief: boolean;
}

export interface KvkApply {
  company_name?: string;
  kvk_nummer?: string;
  vat_id?: string;
  address?: string;
  postcode?: string;
  city?: string;
}

export function KvkLookupButton({ onApply }: { onApply: (data: KvkApply) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<KvkResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await adminFetch(`/api/admin/kvk?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const d = await res.json();
        if (!res.ok) {
          setError(d.error || 'KVK-lookup mislukt');
          setResults([]);
        } else {
          setResults(d.resultaten || []);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError('KVK-lookup mislukt');
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  const apply = async (r: KvkResult) => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/kvk?kvk=${r.kvkNummer}`);
      const d = await res.json();
      const detail = res.ok ? d : r;
      const address = [detail.straatnaam || r.straatnaam, detail.huisnummer || r.huisnummer]
        .filter(Boolean)
        .join(' ')
        .trim();
      onApply({
        company_name: detail.naam || r.naam,
        kvk_nummer: r.kvkNummer,
        vat_id: detail.rsin || undefined,
        address: address || undefined,
        postcode: detail.postcode || r.postcode || undefined,
        city: detail.plaats || r.plaats || undefined,
      });
    } catch {
      onApply({
        company_name: r.naam,
        kvk_nummer: r.kvkNummer,
        address: [r.straatnaam, r.huisnummer].filter(Boolean).join(' '),
        postcode: r.postcode,
        city: r.plaats,
      });
    } finally {
      setLoading(false);
      setOpen(false);
      setQ('');
      setResults([]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <MagnifyingGlassIcon className="h-3.5 w-3.5" />
        KVK-lookup
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Bedrijfsnaam of KVK-nummer..."
                className="flex-1 outline-none text-sm placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {loading && <div className="px-3 py-6 text-center text-sm text-slate-400">Zoeken...</div>}
              {error && <div className="px-3 py-4 text-sm text-rose-600">{error}</div>}
              {!loading && !error && q.trim().length >= 2 && results.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">Geen resultaten gevonden.</div>
              )}
              {results.map(r => (
                <button
                  key={`${r.kvkNummer}-${r.naam}`}
                  type="button"
                  onClick={() => apply(r)}
                  className="block w-full rounded-lg p-3 text-left hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{r.naam}</span>
                    <span className="font-mono text-xs text-slate-500">KVK {r.kvkNummer}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {[r.straatnaam, r.huisnummer].filter(Boolean).join(' ')}
                    {r.postcode && r.plaats ? `, ${r.postcode} ${r.plaats}` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
