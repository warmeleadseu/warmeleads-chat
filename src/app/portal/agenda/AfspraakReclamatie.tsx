'use client';

import { useState, useEffect } from 'react';
import { FlagIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import {
  AFSPRAAK_RECLAMATIE_REDENEN,
  AFSPRAAK_RECLAMATIE_STATUS,
  redenLabel,
} from '@/lib/afspraakReclamatie';

/**
 * Reclameren op een geleverde afspraak.
 *
 * Voor leads bestond dit al, voor afspraken niet, terwijl een installateur juist
 * per afspraak betaalt. Een no-show of een adres buiten het gebied is precies
 * waarvoor je gecompenseerd wilt worden.
 */
export function AfspraakReclamatie({ appointmentId }: { appointmentId: string }) {
  const [bestaande, setBestaande] = useState<{ status: string; reason: string; description: string | null; admin_notes: string | null } | null>(null);
  const [mag, setMag] = useState(false);
  const [blokkade, setBlokkade] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState('');
  const [toelichting, setToelichting] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    setLaden(true);
    portalFetch(`/api/portal/afspraak-reclamaties?appointment_id=${appointmentId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        setBestaande(d.reclamatie);
        setMag(d.mag);
        setBlokkade(d.blokkade);
      })
      .finally(() => setLaden(false));
  }, [appointmentId]);

  const dien = async () => {
    if (!reden) { setFout('Kies een reden'); return; }
    setBezig(true);
    setFout(null);
    try {
      const res = await portalFetch('/api/portal/afspraak-reclamaties', {
        method: 'POST',
        body: JSON.stringify({ appointment_id: appointmentId, reason: reden, description: toelichting }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setFout(d.error || 'Indienen mislukt'); return; }
      setBestaande(d);
      setOpen(false);
    } finally {
      setBezig(false);
    }
  };

  if (laden) return null;

  if (bestaande) {
    const afgehandeld = bestaande.status !== 'pending';
    return (
      <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <FlagIcon className="h-3.5 w-3.5" /> Reclamatie
          </h3>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            bestaande.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
              : bestaande.status === 'rejected' ? 'bg-red-100 text-red-600'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {AFSPRAAK_RECLAMATIE_STATUS[bestaande.status] ?? bestaande.status}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-slate-700">{redenLabel(bestaande.reason)}</p>
        {bestaande.description && <p className="mt-1 text-xs text-slate-500">{bestaande.description}</p>}
        {afgehandeld && (
          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
            {bestaande.admin_notes || 'Er is geen toelichting bij deze beoordeling gegeven.'}
          </p>
        )}
        {!afgehandeld && (
          <p className="mt-2 text-[11px] text-slate-400">We beoordelen je reclamatie binnen 2 werkdagen.</p>
        )}
      </section>
    );
  }

  if (!mag) {
    /* Vóór de afspraak valt er niets te melden; die melding zou alleen ruis zijn. */
    if (!blokkade || blokkade.includes('moet nog plaatsvinden')) return null;
    return (
      <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{blokkade}</p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs font-medium text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-500"
      >
        <FlagIcon className="h-4 w-4" />
        Reclamatie indienen op deze afspraak
      </button>
    );
  }

  return (
    <section className="mt-5 space-y-3 rounded-xl border border-red-100 bg-red-50/50 p-3">
      <p className="text-xs font-semibold text-red-800">Wat was er mis?</p>
      <select
        value={reden}
        onChange={e => setReden(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none"
      >
        <option value="">Kies een reden</option>
        {AFSPRAAK_RECLAMATIE_REDENEN.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <textarea
        value={toelichting}
        onChange={e => setToelichting(e.target.value)}
        rows={2}
        placeholder="Toelichting (optioneel)"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
      />
      {fout && <p className="text-xs text-rose-700">{fout}</p>}
      <p className="text-[11px] leading-relaxed text-slate-500">
        Bij goedkeuring krijg je er een afspraak bij in je batch.
      </p>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} disabled={bezig} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 disabled:opacity-50">
          Annuleren
        </button>
        <button onClick={dien} disabled={bezig || !reden} className="h-10 flex-1 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-bold text-white disabled:opacity-50">
          {bezig ? 'Indienen...' : 'Indienen'}
        </button>
      </div>
    </section>
  );
}
