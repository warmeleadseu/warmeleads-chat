'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDaysIcon, CheckCircleIcon, EyeIcon, PaperAirplaneIcon, UsersIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Geplande mailingen (migratie 204): bekijken, testmail naar jezelf,
 * goedkeuren of annuleren. Een mailing gaat pas weg na goedkeuring, op het
 * tijdstip dat erbij staat.
 */

type Mailing = {
  id: string; naam: string; status: string; verstuur_op: string; aantal_ontvangers: number;
  actieve_ontvangers: { id: string; naam: string; email: string | null }[];
  afzender_naam: string | null; goedgekeurd_door_naam: string | null; goedgekeurd_op: string | null;
  verstuurd: number; mislukt: number; opt_out: number; fout: string | null; aangemaakt_door: string | null;
  voorbeeld: { onderwerp: string; html: string; aan: string } | null; voorbeeld_fout: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  concept: { label: 'Wacht op goedkeuring', cls: 'bg-amber-100 text-amber-800' },
  goedgekeurd: { label: 'Goedgekeurd, gepland', cls: 'bg-emerald-100 text-emerald-800' },
  bezig: { label: 'Wordt verstuurd', cls: 'bg-sky-100 text-sky-800' },
  verstuurd: { label: 'Verstuurd', cls: 'bg-slate-100 text-slate-700' },
  geannuleerd: { label: 'Geannuleerd', cls: 'bg-slate-100 text-slate-500' },
  mislukt: { label: 'Mislukt', cls: 'bg-rose-100 text-rose-700' },
};

const moment = (iso: string) => new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

export default function GeplandeMailingen() {
  const [mailingen, setMailingen] = useState<Mailing[]>([]);
  const [magGoedkeuren, setMagGoedkeuren] = useState(false);
  const [aanwezig, setAanwezig] = useState<boolean | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState<{ id: string; tekst: string; fout: boolean } | null>(null);
  const [open, setOpen] = useState<Record<string, 'voorbeeld' | 'ontvangers' | null>>({});

  const laad = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/emails/geplande');
      if (!res.ok) return;
      const d = (await res.json()) as { mailingen?: Mailing[]; mag_goedkeuren?: boolean; aanwezig?: boolean };
      setAanwezig(d.aanwezig !== false);
      setMailingen(d.mailingen ?? []);
      setMagGoedkeuren(!!d.mag_goedkeuren);
    } catch { /* volgende keer */ }
  }, []);
  useEffect(() => { void laad(); }, [laad]);

  const doe = async (m: Mailing, actie: 'test' | 'goedkeuren' | 'annuleren' | 'naar_concept') => {
    if (actie === 'goedkeuren' && !confirm(`"${m.naam}" goedkeuren? Hij gaat ${moment(m.verstuur_op)} naar ${m.actieve_ontvangers.length} klanten.`)) return;
    if (actie === 'annuleren' && !confirm(`"${m.naam}" annuleren?`)) return;
    setBezig(`${m.id}:${actie}`);
    setMelding(null);
    try {
      const res = await adminFetch(`/api/admin/emails/geplande/${m.id}`, { method: 'POST', body: JSON.stringify({ actie }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; naar?: string };
      if (!res.ok) setMelding({ id: m.id, tekst: d.error || 'Mislukt', fout: true });
      else setMelding({ id: m.id, tekst: actie === 'test' ? `Testmail verstuurd naar ${d.naar}` : actie === 'goedkeuren' ? 'Goedgekeurd. Hij gaat op het geplande moment weg.' : 'Opgeslagen', fout: false });
      await laad();
    } finally {
      setBezig(null);
    }
  };

  if (aanwezig === null) return null;
  const knop = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
        <CalendarDaysIcon className="h-5 w-5 text-orange-500" /> Geplande mailingen
      </h2>
      {mailingen.length === 0 && (
        <p className="text-sm text-slate-500">
          {aanwezig
            ? 'Er staan nu geen mailingen klaar. Klaargezette mailingen verschijnen hier om te bekijken, te testen en goed te keuren.'
            : 'Nog niet actief: de database-aanpassing voor geplande mailingen (migratie 204) moet nog worden doorgevoerd.'}
        </p>
      )}
      <ul className="space-y-3">
        {mailingen.map(m => {
          const s = STATUS[m.status] ?? STATUS.concept;
          const toon = open[m.id] ?? null;
          const wissel = (w: 'voorbeeld' | 'ontvangers') => setOpen(o => ({ ...o, [m.id]: o[m.id] === w ? null : w }));
          return (
            <li key={m.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{m.naam}</p>
                  <p className="text-xs text-slate-500">
                    {moment(m.verstuur_op)} · {m.status === 'verstuurd' || m.status === 'bezig'
                      ? `${m.verstuurd} verstuurd${m.mislukt ? `, ${m.mislukt} mislukt` : ''}${m.opt_out ? `, ${m.opt_out} afgemeld` : ''}`
                      : `${m.actieve_ontvangers.length || m.aantal_ontvangers} klanten`}
                    {m.afzender_naam ? ` · afzender ${m.afzender_naam}` : ''}
                    {m.aangemaakt_door ? ` · klaargezet door ${m.aangemaakt_door}` : ''}
                  </p>
                  {m.voorbeeld && <p className="mt-1 text-sm text-slate-700">Onderwerp: <span className="font-medium">{m.voorbeeld.onderwerp}</span></p>}
                  {m.goedgekeurd_door_naam && <p className="text-xs text-emerald-700">Goedgekeurd door {m.goedgekeurd_door_naam}{m.goedgekeurd_op ? ` op ${moment(m.goedgekeurd_op)}` : ''}</p>}
                  {(m.fout || m.voorbeeld_fout) && <p className="text-xs text-rose-600">{m.fout || m.voorbeeld_fout}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
              </div>

              {(m.status === 'concept' || m.status === 'goedgekeurd') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => wissel('voorbeeld')} className={`${knop} border-slate-200 text-slate-700 hover:bg-slate-50`}><EyeIcon className="h-4 w-4" /> Voorbeeld</button>
                  <button type="button" onClick={() => wissel('ontvangers')} className={`${knop} border-slate-200 text-slate-700 hover:bg-slate-50`}><UsersIcon className="h-4 w-4" /> Ontvangers</button>
                  <button type="button" disabled={!!bezig} onClick={() => void doe(m, 'test')} className={`${knop} border-slate-200 text-slate-700 hover:bg-slate-50`}><PaperAirplaneIcon className="h-4 w-4" /> Stuur test naar mij</button>
                  {magGoedkeuren && m.status === 'concept' && (
                    <button type="button" disabled={!!bezig} onClick={() => void doe(m, 'goedkeuren')} className={`${knop} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}><CheckCircleIcon className="h-4 w-4" /> Goedkeuren</button>
                  )}
                  {magGoedkeuren && m.status === 'goedgekeurd' && (
                    <button type="button" disabled={!!bezig} onClick={() => void doe(m, 'naar_concept')} className={`${knop} border-slate-200 text-slate-700 hover:bg-slate-50`}>Terug naar concept</button>
                  )}
                  {magGoedkeuren && (
                    <button type="button" disabled={!!bezig} onClick={() => void doe(m, 'annuleren')} className={`${knop} border-rose-200 text-rose-700 hover:bg-rose-50`}><XCircleIcon className="h-4 w-4" /> Annuleren</button>
                  )}
                </div>
              )}
              {melding?.id === m.id && <p className={`mt-2 text-xs ${melding.fout ? 'text-rose-600' : 'text-emerald-700'}`}>{melding.tekst}</p>}

              {toon === 'voorbeeld' && m.voorbeeld && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-slate-500">Zoals {m.voorbeeld.aan} hem krijgt:</p>
                  <iframe title={`Voorbeeld ${m.naam}`} srcDoc={m.voorbeeld.html} sandbox="" className="h-[640px] w-full rounded-lg border border-slate-200 bg-white" />
                </div>
              )}
              {toon === 'ontvangers' && (
                <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <tbody>
                      {m.actieve_ontvangers.map(o => (
                        <tr key={o.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-1.5 font-medium text-slate-800">{o.naam}</td>
                          <td className="px-3 py-1.5 text-slate-500">{o.email ?? 'geen e-mailadres'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
