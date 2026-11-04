import { naamSleutel, type ExterneSoort } from './externeOmzet';

/**
 * Rompslomp-facturen indelen voor de externe omzet (migratie 191/192), puur
 * en te testen. Rompslomp bevat naast bulkfacturen ook facturen die als batch
 * al in WarmeLeads staan en facturen voor afspraken; die mogen niet nog eens
 * meetellen. Per factuur een voorstel:
 *
 * 1. Afspraken: telt niet (afspraken tellen niet in omzet en winst).
 * 2. Gekoppeld aan een batch via het externe factuurnummer: alleen wat er
 *    boven het bedrag op die batch uitkomt telt.
 * 3. Zelfde klant, bedrag en periode als een batch in WarmeLeads: telt niet.
 * 4. Creditfactuur (negatief bedrag): telt; WarmeLeads kent die niet.
 * 5. Bulk: telt.
 * 6. De rest (geen batch in WarmeLeads gevonden): telt mee zodra hij betaald is.
 */

export type RompslompFactuur = {
  id: number | string;
  date: string;
  invoice_number: string | null;
  status: string;
  payment_status: string;
  price_without_vat: string | number;
  description?: string | null;
  cached_contact?: { name?: string | null } | null;
  invoice_lines?: { description?: string | null }[] | null;
};

export type WlBatch = {
  id: string; klant: string | null; created_at: string; total_price: number | string | null;
  extern_factuurnummer?: string | null; extern_bedrag_excl?: number | string | null; factuurbedrag?: number | null;
};

export type Voorstel = {
  extern_id: string;
  datum: string;
  factuurnummer: string | null;
  klant_naam: string | null;
  customer_id: string | null;
  bedrag_excl: number;
  soort: ExterneSoort;
  omschrijving: string | null;
  betaald: boolean;
  telt_mee: boolean;
  reden: string;
};

const getal = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };
const euro = (n: number) => `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const dagNl = (iso: string) => { const [, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)}-${Number(m)}`; };
const dagen = (a: string, b: string) => Math.abs(Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86400000;

/** Dezelfde klant: gelijke naam, of de ene naam begint met de andere (minstens 5 tekens). */
export function zelfdeKlant(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = naamSleutel(a ?? ''); const y = naamSleutel(b ?? '');
  if (!x || !y) return false;
  if (x === y) return true;
  const [kort, lang] = x.length <= y.length ? [x, y] : [y, x];
  return kort.length >= 5 && lang.startsWith(kort);
}

export const BETAALD = new Set(['paid', 'overpaid']);
export const VANAF = '2026-05-01';

export function deelIn(
  facturen: RompslompFactuur[],
  batches: WlBatch[],
  klanten: { id: string; name: string | null }[],
): Voorstel[] {
  const perNaam = new Map<string, string | null>();
  for (const k of klanten) {
    if (!k.name) continue;
    const s = naamSleutel(k.name);
    perNaam.set(s, perNaam.has(s) ? null : k.id);
  }
  /* Klant in WarmeLeads: dezelfde naam, of anders precies één klant waarvan de naam ermee begint. */
  const klantId = (naam: string | null): string | null => {
    if (!naam) return null;
    const exact = perNaam.get(naamSleutel(naam));
    if (exact !== undefined) return exact;
    const kandidaten = klanten.filter(k => zelfdeKlant(k.name, naam));
    return kandidaten.length === 1 ? kandidaten[0].id : null;
  };
  const gebruikt = new Set<string>();
  const uit: Voorstel[] = [];

  /* Oudste eerst, zodat een batch aan de eerste passende factuur koppelt. */
  const lijst = facturen
    .filter(f => f.status !== 'concept' && f.date >= VANAF)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  for (const f of lijst) {
    const klant = f.cached_contact?.name?.trim() || null;
    const regels = (f.invoice_lines ?? []).map(l => l.description ?? '').filter(Boolean).join(' | ');
    const tekst = `${f.description ?? ''} ${regels}`;
    const bedrag = Math.round(getal(f.price_without_vat) * 100) / 100;
    const basis = {
      extern_id: String(f.id), datum: f.date.slice(0, 10), factuurnummer: f.invoice_number || null, klant_naam: klant,
      customer_id: klantId(klant), bedrag_excl: bedrag,
      soort: (/bulk/i.test(tekst) ? 'bulk' : 'overig') as ExterneSoort,
      omschrijving: (f.description?.trim() || regels || null)?.slice(0, 300) ?? null,
      betaald: BETAALD.has(f.payment_status),
    };
    const voorstel = (telt_mee: boolean, reden: string, extra: Partial<Voorstel> = {}) => uit.push({ ...basis, telt_mee, reden, ...extra });

    if (/afspra/i.test(tekst)) { voorstel(false, 'afspraken'); continue; }

    const gekoppeld = f.invoice_number ? batches.find(b => b.extern_factuurnummer && b.extern_factuurnummer.trim() === f.invoice_number) : undefined;
    if (gekoppeld) {
      gebruikt.add(gekoppeld.id);
      const opBatch = getal(gekoppeld.extern_bedrag_excl);
      const rest = Math.round((bedrag - opBatch) * 100) / 100;
      if (rest > 0) voorstel(true, `${euro(opBatch)} staat al op een batch; het verschil telt`, { bedrag_excl: rest });
      else voorstel(false, `staat al op een batch (${euro(opBatch)})`);
      continue;
    }

    if (bedrag < 0) { voorstel(true, 'creditfactuur'); continue; }
    if (/credit|terugbetaling/i.test(tekst)) { voorstel(false, 'beoordelen: creditfactuur met een positief bedrag'); continue; }

    const dubbel = batches.find(b => {
      if (gebruikt.has(b.id) || !zelfdeKlant(b.klant, klant) || dagen(b.created_at, f.date) > 45) return false;
      const marge = Math.max(5, bedrag * 0.01);
      return [b.factuurbedrag, getal(b.total_price), b.extern_bedrag_excl == null ? null : getal(b.extern_bedrag_excl)]
        .some(x => x !== null && x !== undefined && Math.abs(x - bedrag) <= marge);
    });
    if (dubbel) {
      gebruikt.add(dubbel.id);
      voorstel(false, `staat al in WarmeLeads (batch van ${dagNl(dubbel.created_at)}, ${euro(getal(dubbel.total_price))})`);
      continue;
    }

    if (basis.soort === 'bulk') { voorstel(true, 'bulk'); continue; }
    voorstel(true, 'geen batch in WarmeLeads gevonden');
  }
  return uit;
}
