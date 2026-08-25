'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import {
  HANDBOEK,
  ALLE_SECTIES,
  CURSUS_SECTIES,
  CURSUS_MINUTEN,
  type HandboekBlok,
  type HandboekSectie,
} from './content';

type Notitie = { section_id: string; body: string; updated_by_name: string | null; updated_at: string };
type Modus = 'naslag' | 'cursus';

/* ─────────────────────────── blokken renderen ─────────────────────────── */

/** Minimale opmaak: **vet** en `code`. Bewust geen volledige markdown-parser. */
function metOpmaak(tekst: string) {
  const delen = tekst.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return delen.map((deel, i) => {
    if (deel.startsWith('**') && deel.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{deel.slice(2, -2)}</strong>;
    }
    if (deel.startsWith('`') && deel.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-purple">
          {deel.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{deel}</span>;
  });
}

function Blok({ blok }: { blok: HandboekBlok }) {
  switch (blok.soort) {
    case 'tekst':
      return <p className="text-[15px] leading-7 text-slate-600">{metOpmaak(blok.body)}</p>;

    case 'stappen':
      return (
        <ol className="space-y-2.5">
          {blok.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-7 text-slate-600">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-xs font-bold tabular-nums text-brand-purple">
                {i + 1}
              </span>
              <span>{metOpmaak(item)}</span>
            </li>
          ))}
        </ol>
      );

    case 'lijst':
      return (
        <ul className="space-y-2">
          {blok.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-7 text-slate-600">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span>{metOpmaak(item)}</span>
            </li>
          ))}
        </ul>
      );

    case 'let-op':
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-700">Let op</p>
          <p className="text-[15px] leading-7 text-amber-900">{metOpmaak(blok.body)}</p>
        </div>
      );

    case 'tip':
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">Uit de praktijk</p>
          <p className="text-[15px] leading-7 text-emerald-900">{metOpmaak(blok.body)}</p>
        </div>
      );

    case 'invullen':
      return (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">In te vullen</p>
          <p className="text-[15px] leading-7 text-slate-600">{metOpmaak(blok.body)}</p>
        </div>
      );

    case 'tabel':
      return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead>
              <tr className="bg-slate-50">
                {blok.kop.map((k, i) => (
                  <th key={i} className="border-b border-slate-200 px-4 py-2.5 font-semibold text-slate-700">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blok.rijen.map((rij, i) => (
                <tr key={i} className={i % 2 ? 'bg-slate-50/50' : ''}>
                  {rij.map((cel, j) => (
                    <td key={j} className="border-b border-slate-100 px-4 py-2.5 align-top leading-6 text-slate-600">
                      {j === 0 ? <span className="font-medium text-slate-800">{metOpmaak(cel)}</span> : metOpmaak(cel)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'code':
      return (
        <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-[13px] leading-6 text-slate-100">
          <code>{blok.body}</code>
        </pre>
      );

    case 'link':
      return (
        <a
          href={blok.href}
          target={blok.extern ? '_blank' : undefined}
          rel={blok.extern ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-1.5 text-[15px] font-medium text-brand-purple hover:underline"
        >
          {blok.label}
          {blok.extern && <span aria-hidden>↗</span>}
        </a>
      );

    default:
      return null;
  }
}

/* ─────────────────────────── aantekeningen ─────────────────────────── */

function Aantekening({
  sectieId,
  notitie,
  onOpgeslagen,
}: {
  sectieId: string;
  notitie: Notitie | undefined;
  onOpgeslagen: (n: Notitie | null) => void;
}) {
  const [bewerken, setBewerken] = useState(false);
  const [tekst, setTekst] = useState(notitie?.body ?? '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  useEffect(() => {
    setTekst(notitie?.body ?? '');
  }, [notitie?.body]);

  const opslaan = async () => {
    setBezig(true);
    setFout('');
    try {
      const res = await adminFetch('/api/admin/handbook', {
        method: 'PUT',
        body: JSON.stringify({ section_id: sectieId, body: tekst }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Opslaan mislukt');
      onOpgeslagen(tekst.trim() ? (d.note as Notitie) : null);
      setBewerken(false);
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  if (!bewerken) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Eigen aantekeningen</p>
          <button
            type="button"
            onClick={() => setBewerken(true)}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-purple hover:bg-brand-purple/5"
          >
            {notitie ? 'Bewerken' : 'Toevoegen'}
          </button>
        </div>
        {notitie ? (
          <>
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{notitie.body}</p>
            <p className="mt-2 text-xs text-slate-400">
              Laatst bijgewerkt door {notitie.updated_by_name || 'onbekend'} op{' '}
              {new Date(notitie.updated_at).toLocaleDateString('nl-NL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </>
        ) : (
          <p className="text-[15px] text-slate-400">
            Nog geen aantekeningen. Gebruik dit voor afspraken, uitzonderingen en correcties.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-purple/30 bg-white p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Eigen aantekeningen</p>
      <textarea
        id={`notitie-${sectieId}`}
        value={tekst}
        onChange={e => setTekst(e.target.value)}
        rows={6}
        placeholder="Wat je hier schrijft is zichtbaar voor iedereen met toegang tot het handboek."
        className="w-full rounded-lg border border-slate-200 p-3 text-[15px] leading-7 text-slate-700 outline-none focus:border-brand-purple"
      />
      {fout && <p className="mt-2 text-sm text-red-600">{fout}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={opslaan}
          disabled={bezig}
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {bezig ? 'Opslaan...' : 'Opslaan'}
        </button>
        <button
          type="button"
          onClick={() => {
            setTekst(notitie?.body ?? '');
            setBewerken(false);
            setFout('');
          }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── sectie ─────────────────────────── */

function Sectie({
  sectie,
  notitie,
  voltooid,
  onNotitie,
  onVoltooid,
}: {
  sectie: HandboekSectie & { hoofdstukTitel: string; icoon: string };
  notitie: Notitie | undefined;
  voltooid: boolean;
  onNotitie: (n: Notitie | null) => void;
  onVoltooid: (v: boolean) => void;
}) {
  return (
    <article className="space-y-5">
      <header className="border-b border-slate-200 pb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {sectie.icoon} {sectie.hoofdstukTitel}
        </p>
        <h1 className="text-2xl font-bold text-slate-900">{sectie.titel}</h1>
        <p className="mt-1 text-[15px] text-slate-500">{sectie.samenvatting}</p>
      </header>

      {sectie.blokken.map((blok, i) => (
        <Blok key={i} blok={blok} />
      ))}

      <div className="space-y-3 pt-2">
        <Aantekening sectieId={sectie.id} notitie={notitie} onOpgeslagen={onNotitie} />
        {sectie.cursus && (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={voltooid}
              onChange={e => onVoltooid(e.target.checked)}
              className="h-4 w-4 accent-brand-purple"
            />
            <span className="text-sm font-medium text-slate-700">
              Ik heb dit onderdeel gelezen en begrepen
            </span>
          </label>
        )}
      </div>
    </article>
  );
}

/* ─────────────────────────── pagina ─────────────────────────── */

export default function HandboekPagina() {
  const [modus, setModus] = useState<Modus>('naslag');
  const [actief, setActief] = useState<string>(ALLE_SECTIES[0].id);
  const [zoek, setZoek] = useState('');
  const [notities, setNotities] = useState<Record<string, Notitie>>({});
  const [voltooid, setVoltooid] = useState<string[]>([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/handbook');
        if (res.ok) {
          const d = await res.json();
          setNotities(d.notes || {});
          setVoltooid(d.completed || []);
        }
      } catch {
        /* het handboek blijft leesbaar zonder aantekeningen */
      } finally {
        setLaden(false);
      }
    })();
  }, []);

  const zetVoltooid = useCallback(async (sectieId: string, waarde: boolean) => {
    setVoltooid(v => (waarde ? [...new Set([...v, sectieId])] : v.filter(x => x !== sectieId)));
    try {
      await adminFetch('/api/admin/handbook', {
        method: 'POST',
        body: JSON.stringify({ section_id: sectieId, completed: waarde }),
      });
    } catch {
      /* de vinkjes zijn een hulpmiddel, geen administratie */
    }
  }, []);

  const zichtbareSecties = useMemo(() => {
    const basis = modus === 'cursus' ? CURSUS_SECTIES : ALLE_SECTIES;
    const q = zoek.trim().toLowerCase();
    if (!q) return basis;
    return basis.filter(s => {
      const hooi = [
        s.titel,
        s.samenvatting,
        s.hoofdstukTitel,
        ...s.blokken.flatMap(b => {
          if (b.soort === 'tekst' || b.soort === 'let-op' || b.soort === 'tip' || b.soort === 'invullen') return [b.body];
          if (b.soort === 'stappen' || b.soort === 'lijst') return b.items;
          if (b.soort === 'tabel') return [...b.kop, ...b.rijen.flat()];
          if (b.soort === 'code') return [b.body];
          return [];
        }),
        notities[s.id]?.body ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hooi.includes(q);
    });
  }, [modus, zoek, notities]);

  const huidige = useMemo(
    () => zichtbareSecties.find(s => s.id === actief) ?? zichtbareSecties[0],
    [zichtbareSecties, actief],
  );

  const cursusVoltooid = CURSUS_SECTIES.filter(s => voltooid.includes(s.id)).length;
  const cursusPct = Math.round((cursusVoltooid / CURSUS_SECTIES.length) * 100);

  const index = huidige ? zichtbareSecties.findIndex(s => s.id === huidige.id) : -1;
  const vorige = index > 0 ? zichtbareSecties[index - 1] : null;
  const volgende = index >= 0 && index < zichtbareSecties.length - 1 ? zichtbareSecties[index + 1] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Handboek</h1>
          <p className="text-sm text-slate-500">
            Werkinstructie voor het beheer van het CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(['naslag', 'cursus'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModus(m);
                  const eerste = (m === 'cursus' ? CURSUS_SECTIES : ALLE_SECTIES)[0];
                  if (eerste) setActief(eerste.id);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  modus === m ? 'bg-brand-purple text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m === 'naslag' ? 'Naslag' : 'Cursus'}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={zoek}
            onChange={e => setZoek(e.target.value)}
            placeholder="Zoeken..."
            aria-label="Zoeken in het handboek"
            className="w-52 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple"
          />
        </div>
      </div>

      {modus === 'cursus' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">
              Inwerken: {cursusVoltooid} van {CURSUS_SECTIES.length} onderdelen
            </span>
            <span className="tabular-nums text-slate-500">
              {cursusPct}% · ongeveer {CURSUS_MINUTEN} minuten totaal
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-purple transition-all duration-500"
              style={{ width: `${cursusPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <nav className="space-y-4 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto lg:pr-1">
          {zichtbareSecties.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Niets gevonden voor &ldquo;{zoek}&rdquo;.
            </p>
          )}
          {(modus === 'cursus' ? [{ id: 'cursus', titel: 'Inwerktraject', icoon: '🎓' }] : HANDBOEK).map(h => {
            const secties = zichtbareSecties.filter(s => modus === 'cursus' || s.hoofdstukId === h.id);
            if (secties.length === 0) return null;
            return (
              <div key={h.id}>
                <p className="mb-1.5 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {h.icoon} {h.titel}
                </p>
                <ul className="space-y-0.5">
                  {secties.map(s => {
                    const isActief = huidige?.id === s.id;
                    const isVoltooid = voltooid.includes(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setActief(s.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                            isActief
                              ? 'bg-brand-purple/10 font-semibold text-brand-purple'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {/* Altijd een rondje reserveren, ook bij secties buiten
                              de cursus, anders verspringt de tekst per regel. */}
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                              !s.cursus
                                ? ''
                                : isVoltooid
                                  ? 'bg-emerald-500 text-white'
                                  : 'border border-slate-300'
                            }`}
                            aria-hidden
                          >
                            {s.cursus && isVoltooid ? '✓' : ''}
                          </span>
                          <span className="min-w-0 flex-1">{s.titel}</span>
                          {notities[s.id] && (
                            <span className="shrink-0 text-xs text-amber-500" title="Heeft eigen aantekeningen">
                              ✎
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 lg:p-8">
          {laden ? (
            <p className="text-sm text-slate-400">Handboek laden...</p>
          ) : huidige ? (
            <>
              <Sectie
                sectie={huidige}
                notitie={notities[huidige.id]}
                voltooid={voltooid.includes(huidige.id)}
                onNotitie={n =>
                  setNotities(vorigeStaat => {
                    const kopie = { ...vorigeStaat };
                    if (n) kopie[huidige.id] = n;
                    else delete kopie[huidige.id];
                    return kopie;
                  })
                }
                onVoltooid={v => zetVoltooid(huidige.id, v)}
              />

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
                {vorige ? (
                  <button
                    type="button"
                    onClick={() => setActief(vorige.id)}
                    className="min-w-0 text-left text-sm text-slate-500 hover:text-brand-purple"
                  >
                    <span className="block text-xs uppercase tracking-wider text-slate-400">Vorige</span>
                    <span className="block truncate font-medium">{vorige.titel}</span>
                  </button>
                ) : (
                  <span />
                )}
                {volgende && (
                  <button
                    type="button"
                    onClick={() => setActief(volgende.id)}
                    className="min-w-0 text-right text-sm text-slate-500 hover:text-brand-purple"
                  >
                    <span className="block text-xs uppercase tracking-wider text-slate-400">Volgende</span>
                    <span className="block truncate font-medium">{volgende.titel}</span>
                  </button>
                )}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
