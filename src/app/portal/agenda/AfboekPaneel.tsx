'use client';

import { useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  NoSymbolIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import {
  STATUS_LABELS,
  OUTCOME_LABELS,
  NO_DEAL_REASONS,
  CANCELLED_BY,
  type AppointmentStatus,
  type AppointmentOutcome,
} from '@/lib/appointmentOutcome';

/**
 * Het afboeken van een afspraak.
 *
 * Eerder waren er twee knoppen (Voltooid en Niet verschenen) en verder niets.
 * In productie was dan ook geen enkele van de 26 afspraken ooit afgeboekt. Hier
 * kiest de adviseur eerst wat er is gebeurd en pas daarna wat het opleverde,
 * zodat het in twee tikken klaar is voor het veelvoorkomende geval en er toch
 * ruimte is voor dealbedrag en reden.
 */

type Keuze = 'completed' | 'no_show' | 'cancelled' | null;

export interface AfboekAfspraak {
  id: string;
  status: string;
  outcome?: string | null;
  outcome_reason?: string | null;
  outcome_notes?: string | null;
  deal_value?: number | null;
  cancelled_by?: string | null;
  cancelled_reason?: string | null;
}

export function AfboekPaneel({
  appointment,
  onDone,
  onVerzetten,
}: {
  appointment: AfboekAfspraak;
  onDone: () => void;
  onVerzetten: () => void;
}) {
  const [keuze, setKeuze] = useState<Keuze>(null);
  const [outcome, setOutcome] = useState<AppointmentOutcome | null>(null);
  const [dealValue, setDealValue] = useState('');
  const [reden, setReden] = useState('');
  const [wieZegdeAf, setWieZegdeAf] = useState('');
  const [toelichting, setToelichting] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const afgeboekt = appointment.status !== 'scheduled';

  const verstuur = async (status: AppointmentStatus, extra: Record<string, unknown> = {}) => {
    setBezig(true);
    setFout(null);
    try {
      const res = await portalFetch(`/api/portal/appointments/${appointment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, outcome_notes: toelichting.trim() || null, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setFout(d.error || 'Afboeken mislukt'); return; }
      onDone();
    } catch {
      setFout('Er ging iets mis');
    } finally {
      setBezig(false);
    }
  };

  /* Al afgeboekt: toon het resultaat met de mogelijkheid het te herstellen.
     Een verkeerd aangetikte knop moet je kunnen terugdraaien. */
  if (afgeboekt) {
    return (
      <section className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Afgeboekt</h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-800">
            {STATUS_LABELS[appointment.status as AppointmentStatus] ?? appointment.status}
            {appointment.outcome && ` · ${OUTCOME_LABELS[appointment.outcome as AppointmentOutcome]}`}
          </p>
          {appointment.deal_value != null && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
              <BanknotesIcon className="h-4 w-4" />
              € {Number(appointment.deal_value).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          )}
          {appointment.outcome_reason && (
            <p className="mt-1 text-xs text-slate-500">
              Reden: {NO_DEAL_REASONS.find(r => r.value === appointment.outcome_reason)?.label ?? appointment.outcome_reason}
            </p>
          )}
          {appointment.cancelled_by && (
            <p className="mt-1 text-xs text-slate-500">
              {CANCELLED_BY.find(c => c.value === appointment.cancelled_by)?.label ?? appointment.cancelled_by}
            </p>
          )}
          {appointment.outcome_notes && (
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{appointment.outcome_notes}</p>
          )}
        </div>
        {appointment.status !== 'rescheduled' && (
          <button
            onClick={() => verstuur('scheduled')}
            disabled={bezig}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
            Terugzetten naar ingepland
          </button>
        )}
        {fout && <p className="mt-2 text-xs text-rose-600">{fout}</p>}
      </section>
    );
  }

  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Afboeken</h3>

      {keuze === null && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Knop
            kleur="emerald"
            icon={CheckCircleIcon}
            label="Bezocht"
            onClick={() => setKeuze('completed')}
          />
          <Knop
            kleur="rose"
            icon={ExclamationCircleIcon}
            label="Niet verschenen"
            onClick={() => setKeuze('no_show')}
          />
          <Knop
            kleur="amber"
            icon={ArrowPathIcon}
            label="Verzetten"
            onClick={onVerzetten}
          />
          <Knop
            kleur="slate"
            icon={NoSymbolIcon}
            label="Geannuleerd"
            onClick={() => setKeuze('cancelled')}
          />
        </div>
      )}

      {keuze === 'completed' && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs font-semibold text-emerald-800">Wat kwam eruit?</p>
          <div className="grid grid-cols-3 gap-2">
            {(['deal', 'no_deal', 'follow_up'] as AppointmentOutcome[]).map(o => (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                  outcome === o
                    ? 'border-emerald-500 bg-white text-emerald-800 shadow-sm'
                    : 'border-emerald-200 bg-white/60 text-emerald-700 hover:bg-white'
                }`}
              >
                {OUTCOME_LABELS[o]}
              </button>
            ))}
          </div>

          {outcome === 'deal' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Dealbedrag (optioneel)</label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                <span className="text-sm text-slate-400">€</span>
                <input
                  value={dealValue}
                  onChange={e => setDealValue(e.target.value)}
                  inputMode="decimal"
                  placeholder="8750"
                  className="h-10 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>
          )}

          {outcome === 'no_deal' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Waarom niet? *</label>
              <select
                value={reden}
                onChange={e => setReden(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none"
              >
                <option value="">Kies een reden</option>
                {NO_DEAL_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          )}

          <Toelichting waarde={toelichting} zet={setToelichting} />
          <Acties
            bezig={bezig}
            terug={() => { setKeuze(null); setOutcome(null); }}
            opslaan={() => verstuur('completed', {
              outcome,
              outcome_reason: outcome === 'no_deal' ? reden : null,
              deal_value: outcome === 'deal' && dealValue.trim() ? dealValue.trim() : null,
            })}
            uitgeschakeld={outcome === 'no_deal' && !reden}
          />
        </div>
      )}

      {keuze === 'no_show' && (
        <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <p className="text-xs text-rose-800">De lead was niet aanwezig op de afgesproken tijd.</p>
          <Toelichting waarde={toelichting} zet={setToelichting} />
          <Acties bezig={bezig} terug={() => setKeuze(null)} opslaan={() => verstuur('no_show')} />
        </div>
      )}

      {keuze === 'cancelled' && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Wie zegde af?</label>
            <select
              value={wieZegdeAf}
              onChange={e => setWieZegdeAf(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none"
            >
              <option value="">Onbekend</option>
              {CANCELLED_BY.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <Toelichting waarde={toelichting} zet={setToelichting} label="Reden" />
          <Acties
            bezig={bezig}
            terug={() => setKeuze(null)}
            opslaan={() => verstuur('cancelled', {
              cancelled_by: wieZegdeAf || null,
              cancelled_reason: toelichting.trim() || null,
            })}
          />
        </div>
      )}

      {fout && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{fout}</div>
      )}
    </section>
  );
}

function Knop({
  kleur, icon: Icon, label, onClick,
}: {
  kleur: 'emerald' | 'rose' | 'amber' | 'slate';
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
}) {
  const kleuren = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
    slate: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  }[kleur];
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${kleuren}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function Toelichting({ waarde, zet, label = 'Toelichting' }: { waarde: string; zet: (v: string) => void; label?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label} (optioneel)</label>
      <textarea
        value={waarde}
        onChange={e => zet(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
      />
    </div>
  );
}

function Acties({
  bezig, terug, opslaan, uitgeschakeld = false,
}: {
  bezig: boolean; terug: () => void; opslaan: () => void; uitgeschakeld?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button onClick={terug} disabled={bezig} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
        Terug
      </button>
      <button onClick={opslaan} disabled={bezig || uitgeschakeld} className="h-10 flex-1 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-sm font-bold text-white shadow-sm disabled:opacity-50">
        {bezig ? 'Opslaan...' : 'Afboeken'}
      </button>
    </div>
  );
}
