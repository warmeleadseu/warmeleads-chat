'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FlagIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { AFSPRAAK_RECLAMATIE_STATUS, redenLabel } from '@/lib/afspraakReclamatie';

/** Beoordelen van reclamaties op geleverde afspraken. */

interface Reclamatie {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  customers: { name: string; email: string } | null;
  appointments: {
    starts_at: string;
    contact_name: string;
    contact_phone: string | null;
    postcode: string | null;
    city: string | null;
    branch: string;
    status: string;
    batch_id: string | null;
  } | null;
}

const FILTERS = [
  { value: 'pending', label: 'Openstaand', icon: ClockIcon },
  { value: 'approved', label: 'Goedgekeurd', icon: CheckCircleIcon },
  { value: 'rejected', label: 'Afgewezen', icon: XCircleIcon },
  { value: 'all', label: 'Alle', icon: FlagIcon },
] as const;

type FilterWaarde = (typeof FILTERS)[number]['value'];

export default function AfspraakReclamatiesPage() {
  const [rijen, setRijen] = useState<Reclamatie[]>([]);
  const [laden, setLaden] = useState(true);
  const [filter, setFilter] = useState<FilterWaarde>('pending');
  const [geopend, setGeopend] = useState<Reclamatie | null>(null);
  const [notitie, setNotitie] = useState('');
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    try {
      const r = await adminFetch('/api/admin/afspraak-reclamaties');
      if (r.ok) setRijen(await r.json());
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const zichtbaar = useMemo(
    () => (filter === 'all' ? rijen : rijen.filter(r => r.status === filter)),
    [rijen, filter],
  );

  const aantallen = useMemo(() => ({
    pending: rijen.filter(r => r.status === 'pending').length,
    approved: rijen.filter(r => r.status === 'approved').length,
    rejected: rijen.filter(r => r.status === 'rejected').length,
    all: rijen.length,
  }), [rijen]);

  const beoordeel = async (status: 'approved' | 'rejected') => {
    if (!geopend) return;
    setBezig(true);
    try {
      const r = await adminFetch('/api/admin/afspraak-reclamaties', {
        method: 'PUT',
        body: JSON.stringify({ id: geopend.id, status, admin_notes: notitie }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMelding(d.error || 'Opslaan mislukt'); return; }
      setMelding(
        d.compensatie === 1 ? 'Goedgekeurd, batch met 1 afspraak verhoogd'
          : d.compensatie === -1 ? 'Afgewezen, compensatie teruggedraaid'
          : status === 'approved' ? 'Goedgekeurd' : 'Afgewezen',
      );
      setGeopend(null);
      setNotitie('');
      laad();
    } finally {
      setBezig(false);
      setTimeout(() => setMelding(null), 4000);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <FlagIcon className="h-5 w-5 text-brand-purple" />
          Reclamaties op afspraken
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Bij goedkeuring krijgt de klant er automatisch een afspraak bij in zijn batch.
        </p>
      </div>

      {melding && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{melding}</div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-xl border p-3 text-left transition ${filter === f.value ? 'border-brand-purple bg-brand-purple/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-slate-500">{f.label}</p>
              <f.icon className="h-4 w-4 text-slate-300" />
            </div>
            <p className="mt-1 text-xl font-bold text-slate-900">{aantallen[f.value]}</p>
          </button>
        ))}
      </div>

      {laden ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : zichtbaar.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center">
          <FlagIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="text-sm font-medium text-slate-400">Geen reclamaties in dit filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zichtbaar.map(r => (
            <button
              key={r.id}
              onClick={() => { setGeopend(r); setNotitie(r.admin_notes || ''); }}
              className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-purple/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{r.customers?.name}</p>
                <p className="mt-0.5 text-xs text-slate-600">{redenLabel(r.reason)}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {r.appointments?.contact_name}
                  {r.appointments?.city && ` · ${r.appointments.city}`}
                  {r.appointments?.starts_at && ` · ${new Date(r.appointments.starts_at).toLocaleDateString('nl-NL')}`}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                r.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
                  : r.status === 'rejected' ? 'bg-red-100 text-red-600'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {AFSPRAAK_RECLAMATIE_STATUS[r.status]}
              </span>
            </button>
          ))}
        </div>
      )}

      {geopend && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setGeopend(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg space-y-3 rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="text-base font-bold text-slate-900">{geopend.customers?.name}</h2>
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800">{redenLabel(geopend.reason)}</p>
              {geopend.description && <p className="text-xs text-slate-600">{geopend.description}</p>}
              <p className="pt-1 text-xs text-slate-500">
                {geopend.appointments?.contact_name} · {geopend.appointments?.contact_phone}
              </p>
              <p className="text-xs text-slate-500">
                {[geopend.appointments?.postcode, geopend.appointments?.city].filter(Boolean).join(' ')}
                {geopend.appointments?.starts_at && ` · ${new Date(geopend.appointments.starts_at).toLocaleString('nl-NL')}`}
              </p>
              <p className="text-xs text-slate-400">Afspraakstatus: {geopend.appointments?.status}</p>
              {!geopend.appointments?.batch_id && (
                <p className="text-xs font-semibold text-amber-700">
                  Let op: deze afspraak hangt niet aan een batch, dus goedkeuren levert geen compensatie op.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Toelichting voor de klant</label>
              <div className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                <strong>De klant ziet deze tekst</strong> bij de afspraak in zijn portaal.
              </div>
              <textarea
                value={notitie}
                onChange={e => setNotitie(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => beoordeel('rejected')} disabled={bezig} className="h-11 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-700 disabled:opacity-50">
                Afwijzen
              </button>
              <button onClick={() => beoordeel('approved')} disabled={bezig} className="h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-50">
                Goedkeuren
              </button>
            </div>
            <button onClick={() => setGeopend(null)} className="h-10 w-full rounded-xl text-sm font-semibold text-slate-500">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
