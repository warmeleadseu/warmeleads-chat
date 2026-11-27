'use client';

import { useCallback, useEffect, useState } from 'react';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Voicemailteller in de prospectkaart: hoe vaak gebeld en voicemail, met
 * datum, tijd en wie belde. "Voicemail +1" legt een nieuwe poging vast;
 * "Laatste weghalen" herstelt een verkeerde klik.
 */

export type VoicemailSamenvatting = { aantal: number; momenten: { op: string; door: string | null }[] };

export const voicemailMoment = (iso: string) =>
  new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

/** Korte badge voor in de lijst, met de momenten als tooltip. */
export function VoicemailBadge({ vm }: { vm?: VoicemailSamenvatting | null }) {
  if (!vm?.aantal) return null;
  const titel = vm.momenten.map(m => `${voicemailMoment(m.op)}${m.door ? ` (${m.door})` : ''}`).join('\n');
  return (
    <span title={titel} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
      <PhoneIcon className="h-3 w-3" /> {vm.aantal}× voicemail
    </span>
  );
}

/** Kolom in de prospectlijst: aantal en de laatste keer, alle momenten als tooltip. */
export function VoicemailCel({ vm }: { vm?: VoicemailSamenvatting | null }) {
  if (!vm?.aantal) return <span className="text-[11px] text-slate-300">—</span>;
  const titel = vm.momenten.map(m => `${voicemailMoment(m.op)}${m.door ? ` (${m.door})` : ''}`).join('\n');
  const laatste = vm.momenten[0]?.op;
  const kleur = vm.aantal >= 3 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200';
  return (
    <span title={titel} className="inline-flex flex-col">
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${kleur}`}>
        <PhoneIcon className="h-3 w-3" /> {vm.aantal}×
      </span>
      {laatste && (
        <span className="mt-0.5 text-[10px] text-slate-400">
          laatst {new Date(laatste).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })}
        </span>
      )}
    </span>
  );
}

export function VoicemailTeller({ prospectId, onGewijzigd }: {
  prospectId: string;
  /** Na een klik: de bijgewerkte prospect (status kan zijn veranderd). */
  onGewijzigd: (prospect: unknown, vm: VoicemailSamenvatting | null) => void;
}) {
  const [vm, setVm] = useState<VoicemailSamenvatting | null>(null);
  const [kanWeg, setKanWeg] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [melding, setMelding] = useState<{ tekst: string; goed: boolean } | null>(null);
  const [toonAlles, setToonAlles] = useState(false);

  const laad = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/prospects/${prospectId}/voicemail`);
      if (!res.ok) return;
      const d = (await res.json()) as { voicemail: VoicemailSamenvatting; kan_weghalen: boolean };
      setVm(d.voicemail);
      setKanWeg(d.kan_weghalen);
    } catch { /* volgende keer */ }
  }, [prospectId]);
  useEffect(() => { void laad(); }, [laad]);

  const doe = async (methode: 'POST' | 'DELETE') => {
    if (methode === 'DELETE' && !confirm('De laatste voicemail weghalen?')) return;
    setBezig(true);
    setFout(null);
    setMelding(null);
    try {
      const res = await adminFetch(`/api/admin/prospects/${prospectId}/voicemail`, { method: methode });
      const d = (await res.json().catch(() => ({}))) as { error?: string; prospect?: unknown; voicemail?: VoicemailSamenvatting; contactmail?: { verstuurd: boolean; reden?: string; naar?: string } | null };
      if (!res.ok) { setFout(d.error || 'Opslaan mislukt'); return; }
      if (d.contactmail) {
        setMelding(d.contactmail.verstuurd
          ? { tekst: `3e voicemail: contactverzoek gemaild naar ${d.contactmail.naar}.`, goed: true }
          : { tekst: `3e voicemail, maar geen contactverzoek gemaild: ${d.contactmail.reden ?? 'onbekende reden'}.`, goed: false });
      }
      if (d.voicemail) setVm(d.voicemail);
      if (d.prospect) onGewijzigd(d.prospect, d.voicemail ?? null);
      await laad();
    } finally {
      setBezig(false);
    }
  };

  const momenten = vm?.momenten ?? [];
  const zichtbaar = toonAlles ? momenten : momenten.slice(0, 3);

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <PhoneIcon className="h-4 w-4 text-amber-600" />
          {vm ? (vm.aantal ? `${vm.aantal}× voicemail` : 'Nog geen voicemail') : '…'}
        </span>
        <button
          type="button"
          disabled={bezig}
          onClick={() => void doe('POST')}
          className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg bg-amber-500 px-3 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          📞 Voicemail +1
        </button>
        {kanWeg && (
          <button type="button" disabled={bezig} onClick={() => void doe('DELETE')} className="min-h-9 rounded-lg px-2 text-xs text-slate-500 hover:text-rose-600 disabled:opacity-50">
            Laatste weghalen
          </button>
        )}
      </div>
      {zichtbaar.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
          {zichtbaar.map((m, i) => (
            <li key={`${m.op}-${i}`}>
              {voicemailMoment(m.op)}{m.door ? <span className="text-slate-400"> · {m.door}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {momenten.length > 3 && (
        <button type="button" onClick={() => setToonAlles(t => !t)} className="mt-1 text-[11px] font-medium text-amber-700 hover:underline">
          {toonAlles ? 'Minder tonen' : `Alle ${momenten.length} tonen`}
        </button>
      )}
      {melding && <p className={`mt-1 text-xs ${melding.goed ? 'text-emerald-700' : 'text-amber-800'}`}>{melding.tekst}</p>}
      {vm && vm.aantal < 3 && <p className="mt-1 text-[11px] text-slate-400">Bij de 3e voicemail krijgt de prospect automatisch een mail met een contactverzoek.</p>}
      {fout && <p className="mt-1 text-xs text-rose-600">{fout}</p>}
    </div>
  );
}
