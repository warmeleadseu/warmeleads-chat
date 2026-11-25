'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClockIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { LEAD_STATUS_LABELS } from '@/lib/leadStatuses';
import { UITKOMSTEN, nlTijd, telLink, uitstelkeuzes, type PopupFase, type Terugbelmoment } from '@/lib/terugbellen';
import { MOTION } from '../_ui/tokens';

/** De pop-up bij een terugbelmoment: bellen, uitstellen of openen, en na het bellen de uitkomst. */
export default function TerugbelPopup({ moment, fase, nu, inGesprek, onBel, onWijzig, onOpen, onAnderMoment, onSluit }: {
  moment: Terugbelmoment;
  fase: PopupFase;
  nu: number;
  inGesprek: boolean;
  onBel: () => void;
  onWijzig: (w: { terug_op: string } | { uitkomst: string }) => Promise<string | null>;
  onOpen: () => void;
  onAnderMoment: () => void;
  onSluit: () => void;
}) {
  const [uitstellen, setUitstellen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const tel = telLink(moment.telefoon);
  const minuten = Math.round((Date.parse(moment.terug_op) - nu) / 60_000);
  const wanneer = fase === 'vooraf'
    ? minuten <= 0 ? 'nu' : `over ${minuten} ${minuten === 1 ? 'minuut' : 'minuten'}`
    : minuten >= 0 ? 'nu' : `${-minuten} ${minuten === -1 ? 'minuut' : 'minuten'} geleden`;

  const doe = async (w: { terug_op: string } | { uitkomst: string }) => {
    if (bezig) return;
    setBezig(true);
    setFout(null);
    const f = await onWijzig(w);
    setBezig(false);
    if (f) setFout(f);
    else setUitstellen(false);
  };
  const keuze = 'min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={MOTION.springSheet}
      role="alertdialog"
      aria-label={`Terugbellen: ${moment.naam}`}
      className="pointer-events-auto overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-2xl"
    >
      <div className={`h-1 ${fase === 'nu' ? 'bg-red-500' : 'bg-sky-500'}`} />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${fase === 'nu' ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-600'}`}>
            <ClockIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500">Terugbellen om {nlTijd(moment.terug_op)} · {wanneer}</p>
            <p className="truncate text-base font-bold text-slate-900">{moment.naam}</p>
            <p className="truncate text-xs text-slate-500">{[moment.plaats, moment.telefoon].filter(Boolean).join(' · ')}</p>
            {moment.notitie && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-700">{moment.notitie}</p>}
            {!moment.eigen && moment.gepland_door && <p className="mt-1 text-[11px] text-amber-700">Nog niet opgepakt, ingepland door {moment.gepland_door}</p>}
          </div>
          <button type="button" onClick={onSluit} aria-label="Sluiten" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {inGesprek ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Hoe ging het?</p>
            <div className="flex flex-wrap gap-1.5">
              {UITKOMSTEN.map(u => (
                <button key={u} type="button" disabled={bezig} onClick={() => void doe({ uitkomst: u })} className={keuze}>{LEAD_STATUS_LABELS[u]}</button>
              ))}
              <button type="button" disabled={bezig} onClick={onAnderMoment} className={keuze}>Opnieuw terugbellen</button>
            </div>
          </div>
        ) : uitstellen ? (
          <div className="flex flex-wrap gap-1.5">
            {uitstelkeuzes(new Date(nu)).map(k => (
              <button key={k.label} type="button" disabled={bezig} onClick={() => void doe({ terug_op: k.iso })} className={keuze}>{k.label}</button>
            ))}
            <button type="button" disabled={bezig} onClick={onAnderMoment} className={keuze}>Zelf kiezen</button>
            <button type="button" onClick={() => setUitstellen(false)} className="px-2 text-xs text-slate-500 hover:underline">Terug</button>
          </div>
        ) : (
          <div className="flex gap-2">
            {tel ? (
              <a href={tel} onClick={onBel} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700">
                <PhoneIcon className="h-4 w-4" /> Bel nu
              </a>
            ) : (
              <button type="button" onClick={onBel} className="min-h-10 flex-1 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700">Gebeld</button>
            )}
            <button type="button" onClick={() => setUitstellen(true)} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Uitstellen</button>
            <button type="button" onClick={onOpen} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Openen</button>
          </div>
        )}
        {fout && <p className="text-xs text-red-600">{fout}</p>}
      </div>
    </motion.div>
  );
}
