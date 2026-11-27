'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch } from '@/lib/adminAuth';
import { maakCampagneVeilig } from '@/lib/email/templates/campagne';

/**
 * Bewerken van een geplande mailing in het admin-paneel: de tekst (direct in
 * de opgemaakte mail, of als HTML), het onderwerp, de voorbeeldtekst en het
 * verzendmoment; en de ontvangers met vinkjes. Alleen bij een concept.
 */

type Opties = Record<string, unknown>;

const veld = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none';
const knop = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50';

/** ISO → waarde voor <input type="datetime-local"> in de tijd van de browser. */
function naarLokaal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function bewaar(id: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await adminFetch(`/api/admin/emails/geplande/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (res.ok) return null;
  const d = (await res.json().catch(() => ({}))) as { error?: string };
  return d.error || 'Opslaan mislukt';
}

export function TekstBewerken({ id, options, verstuurOp, onKlaar }: {
  id: string; options: Opties; verstuurOp: string; onKlaar: (opgeslagen: boolean) => void;
}) {
  const [onderwerp, setOnderwerp] = useState(String(options.subject_override ?? ''));
  const [preheader, setPreheader] = useState(String(options.preheader ?? ''));
  const [moment, setMoment] = useState(naarLokaal(verstuurOp));
  const [htmlModus, setHtmlModus] = useState(false);
  const [html, setHtml] = useState(String(options.body ?? ''));
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const editor = useRef<HTMLDivElement>(null);

  /* De opgemaakte weergave één keer vullen (en na terugschakelen uit HTML);
     daarna houdt de browser de inhoud bij, anders springt de cursor. */
  useEffect(() => {
    if (!htmlModus && editor.current) editor.current.innerHTML = maakCampagneVeilig(html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlModus]);

  const huidigeHtml = () => (htmlModus ? html : editor.current?.innerHTML ?? html);
  const wisselModus = () => {
    if (!htmlModus) setHtml(editor.current?.innerHTML ?? html);
    setHtmlModus(m => !m);
  };
  const opmaak = (cmd: 'bold' | 'italic' | 'createLink' | 'unlink') => {
    editor.current?.focus();
    if (cmd === 'createLink') {
      const url = prompt('Link (begint met https://, mailto: of tel:)', 'https://');
      if (!url || !/^(https?:|mailto:|tel:)/i.test(url)) return;
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd);
    }
  };

  const opslaan = async () => {
    setBezig(true);
    setFout(null);
    try {
      const f = await bewaar(id, {
        options: { subject_override: onderwerp, preheader, body: huidigeHtml() },
        verstuur_op: new Date(moment).toISOString(),
      });
      if (f) setFout(f);
      else onKlaar(true);
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-orange-200 bg-orange-50/40 p-3">
      <label className="block text-xs font-semibold text-slate-700">Onderwerp
        <input className={`${veld} mt-1`} value={onderwerp} onChange={e => setOnderwerp(e.target.value)} />
      </label>
      <label className="block text-xs font-semibold text-slate-700">Voorbeeldtekst (de regel naast het onderwerp in de inbox)
        <input className={`${veld} mt-1`} value={preheader} onChange={e => setPreheader(e.target.value)} />
      </label>
      <label className="block text-xs font-semibold text-slate-700">Verzendmoment
        <input type="datetime-local" className={`${veld} mt-1 max-w-xs`} value={moment} onChange={e => setMoment(e.target.value)} />
      </label>

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Tekst van de mail</span>
          {!htmlModus && (
            <>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => opmaak('bold')} className={`${knop} border-slate-200 bg-white font-bold`}>B</button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => opmaak('italic')} className={`${knop} border-slate-200 bg-white italic`}>I</button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => opmaak('createLink')} className={`${knop} border-slate-200 bg-white`}>Link</button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => opmaak('unlink')} className={`${knop} border-slate-200 bg-white`}>Link weg</button>
            </>
          )}
          <button type="button" onClick={wisselModus} className={`${knop} ml-auto border-slate-200 bg-white text-slate-600`}>
            {htmlModus ? 'Terug naar opgemaakt' : 'HTML bewerken'}
          </button>
        </div>
        {htmlModus ? (
          <textarea className={`${veld} h-96 font-mono text-xs`} value={html} onChange={e => setHtml(e.target.value)} spellCheck={false} />
        ) : (
          <div
            ref={editor}
            contentEditable
            suppressContentEditableWarning
            className="max-h-[560px] min-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 text-[15px] leading-relaxed focus:border-orange-400 focus:outline-none"
          />
        )}
        <p className="mt-1 text-[11px] text-slate-500">
          Klik in de tekst om te typen. <code>{'{{first_name}}'}</code> wordt per klant de voornaam. De handtekening en de afmeldlink komen er bij versturen vanzelf onder.
        </p>
      </div>

      {fout && <p className="text-xs text-rose-600">{fout}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={bezig} onClick={() => void opslaan()} className={`${knop} border-orange-500 bg-orange-500 text-white hover:bg-orange-600`}>
          {bezig ? 'Opslaan…' : 'Opslaan'}
        </button>
        <button type="button" disabled={bezig} onClick={() => onKlaar(false)} className={`${knop} border-slate-200 bg-white text-slate-700`}>Annuleren</button>
      </div>
    </div>
  );
}

type Klant = { id: string; naam: string; contact: string | null; email: string | null; branches: string[]; lopend: string[]; afgemeld: boolean };

export function OntvangersKiezen({ id, ontvangers, onKlaar }: {
  id: string; ontvangers: string[]; onKlaar: (opgeslagen: boolean) => void;
}) {
  const [klanten, setKlanten] = useState<Klant[] | null>(null);
  const [laadFout, setLaadFout] = useState<string | null>(null);
  const [gekozen, setGekozen] = useState<Set<string>>(() => new Set(ontvangers));
  const [zoek, setZoek] = useState('');
  const [branche, setBranche] = useState('');
  const [toon, setToon] = useState<'gekozen' | 'alle'>('gekozen');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    void (async () => {
      try {
        const res = await adminFetch('/api/admin/emails/geplande/klanten');
        if (!res.ok) throw new Error();
        const d = (await res.json()) as { klanten: Klant[] };
        if (!weg) setKlanten(d.klanten);
      } catch {
        if (!weg) setLaadFout('Klanten laden mislukt');
      }
    })();
    return () => { weg = true; };
  }, []);

  const bekend = useMemo(() => new Set((klanten ?? []).map(k => k.id)), [klanten]);
  /* Ontvangers die geen actief account met e-mailadres meer hebben, krijgen
     de mail toch niet; die vallen bij opslaan weg. */
  const onbereikbaar = klanten ? ontvangers.filter(o => !bekend.has(o)).length : 0;
  const alleBranches = useMemo(() => [...new Set((klanten ?? []).flatMap(k => k.branches))].sort(), [klanten]);

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return (klanten ?? [])
      .filter(k => toon === 'alle' || gekozen.has(k.id))
      .filter(k => !branche || k.branches.includes(branche))
      .filter(k => !q || `${k.naam} ${k.contact ?? ''} ${k.email ?? ''}`.toLowerCase().includes(q));
  }, [klanten, toon, gekozen, branche, zoek]);

  const selectie = [...gekozen].filter(x => bekend.has(x));
  const erbij = selectie.filter(x => !ontvangers.includes(x)).length;
  const eraf = ontvangers.filter(x => bekend.has(x) && !gekozen.has(x)).length;

  const wissel = (kid: string) => setGekozen(s => {
    const n = new Set(s);
    if (n.has(kid)) n.delete(kid); else n.add(kid);
    return n;
  });
  const zetZichtbaar = (aan: boolean) => setGekozen(s => {
    const n = new Set(s);
    for (const k of zichtbaar) { if (aan) n.add(k.id); else n.delete(k.id); }
    return n;
  });

  /* Klanten met een lopende batch: in de gekozen branche, of in welke branche dan ook. */
  const loopt = (k: Klant) => (branche ? k.lopend.includes(branche) : k.lopend.length > 0);
  const lopendGekozen = (klanten ?? []).filter(k => gekozen.has(k.id) && loopt(k)).length;
  const sluitLopendUit = () => setGekozen(s => {
    const n = new Set(s);
    for (const k of klanten ?? []) if (loopt(k)) n.delete(k.id);
    return n;
  });

  const opslaan = async () => {
    setBezig(true);
    setFout(null);
    try {
      const f = await bewaar(id, { ontvangers: selectie });
      if (f) setFout(f);
      else onKlaar(true);
    } finally {
      setBezig(false);
    }
  };

  if (laadFout) return <p className="mt-3 text-xs text-rose-600">{laadFout}</p>;
  if (!klanten) return <p className="mt-3 text-xs text-slate-500">Klanten laden…</p>;

  const allesAan = zichtbaar.length > 0 && zichtbaar.every(k => gekozen.has(k.id));

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
          <button type="button" onClick={() => setToon('gekozen')} className={`px-3 py-1.5 ${toon === 'gekozen' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>Geselecteerd ({selectie.length})</button>
          <button type="button" onClick={() => setToon('alle')} className={`px-3 py-1.5 ${toon === 'alle' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>Alle klanten ({klanten.length})</button>
        </div>
        <select value={branche} onChange={e => setBranche(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
          <option value="">Alle branches</option>
          {alleBranches.map(b => <option key={b} value={b}>Kocht ooit {b}</option>)}
        </select>
        <input value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoek op naam of e-mail" className="min-w-40 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs" />
        <button
          type="button"
          disabled={lopendGekozen === 0}
          onClick={sluitLopendUit}
          title={branche ? `Haalt klanten met een actieve, gepauzeerde of nog te betalen ${branche}-batch uit de selectie` : 'Haalt klanten met een actieve, gepauzeerde of nog te betalen batch (welke branche ook) uit de selectie'}
          className={`${knop} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          Sluit actieve klanten/batches uit{branche ? ` (${branche})` : ''} ({lopendGekozen})
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-8 px-3 py-1.5">
                <input type="checkbox" aria-label="Alles in deze lijst" checked={allesAan} onChange={e => zetZichtbaar(e.target.checked)} />
              </th>
              <th className="px-2 py-1.5 font-semibold">Klant ({zichtbaar.length})</th>
              <th className="px-2 py-1.5 font-semibold">E-mail</th>
              <th className="hidden px-2 py-1.5 font-semibold sm:table-cell">Kocht ooit</th>
            </tr>
          </thead>
          <tbody>
            {zichtbaar.map(k => (
              <tr key={k.id} onClick={() => wissel(k.id)} className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${gekozen.has(k.id) ? '' : 'text-slate-400'}`}>
                <td className="px-3 py-1.5">
                  <input type="checkbox" checked={gekozen.has(k.id)} onChange={() => wissel(k.id)} onClick={e => e.stopPropagation()} aria-label={k.naam} />
                </td>
                <td className="px-2 py-1.5">
                  <span className="font-medium text-slate-800">{k.naam}</span>
                  {k.contact && <span className="text-slate-500"> · {k.contact}</span>}
                  {k.lopend.length > 0 && <span className="ml-1 rounded bg-emerald-50 px-1 text-[10px] text-emerald-700">loopt: {k.lopend.join(', ')}</span>}
                  {k.afgemeld && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">afgemeld, krijgt hem niet</span>}
                </td>
                <td className="px-2 py-1.5 text-slate-500">{k.email}</td>
                <td className="hidden px-2 py-1.5 text-slate-500 sm:table-cell">{k.branches.join(', ')}</td>
              </tr>
            ))}
            {zichtbaar.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">Geen klanten in deze lijst</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500">
        {selectie.length} ontvangers{erbij || eraf ? ` (${erbij ? `+${erbij}` : ''}${erbij && eraf ? ', ' : ''}${eraf ? `−${eraf}` : ''} t.o.v. nu)` : ''}.
        {onbereikbaar > 0 && ` ${onbereikbaar} eerdere ontvanger${onbereikbaar === 1 ? ' heeft' : 's hebben'} geen actief account met e-mailadres meer en ${onbereikbaar === 1 ? 'valt' : 'vallen'} weg.`}
      </p>
      {fout && <p className="text-xs text-rose-600">{fout}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={bezig || selectie.length === 0} onClick={() => void opslaan()} className={`${knop} border-orange-500 bg-orange-500 text-white hover:bg-orange-600`}>
          {bezig ? 'Opslaan…' : `Ontvangers opslaan (${selectie.length})`}
        </button>
        <button type="button" disabled={bezig} onClick={() => onKlaar(false)} className={`${knop} border-slate-200 bg-white text-slate-700`}>Sluiten</button>
      </div>
    </div>
  );
}
