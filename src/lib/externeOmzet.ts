import { leesBedrag } from './bedrag';

/**
 * Externe omzet (migratie 191): facturen die buiten WarmeLeads om zijn
 * verstuurd, vooral bulkfacturen uit Rompslomp. Puur en te testen: het lezen
 * van een geïmporteerde lijst en het controleren van regels vóór opslaan.
 */

export type ExterneSoort = 'bulk' | 'overig';

export type ExterneInvoer = {
  datum?: unknown; factuurnummer?: unknown; klant?: unknown; customer_id?: unknown;
  bedrag_excl?: unknown; soort?: unknown; omschrijving?: unknown;
};

export type ExterneRegel = {
  datum: string; factuurnummer: string | null; customer_id: string | null; klant_naam: string | null;
  bedrag_excl: number; soort: ExterneSoort; omschrijving: string | null;
};

export type Beoordeling = {
  regel: number;
  status: 'goed' | 'dubbel' | 'fout';
  reden?: string;
  rij?: ExterneRegel;
  /** De klantnaam herkende geen klant in WarmeLeads (mag, dan blijft alleen de naam staan). */
  klantOnbekend?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tekst = (v: unknown, max: number) => {
  const t = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  return t ? t.slice(0, max) : null;
};
/** Klantnamen vergelijken zonder hoofdletters, leestekens en "B.V.". */
export const naamSleutel = (n: string) =>
  n.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\bb\.?\s?v\.?(?=\s|$)/g, '').replace(/[^a-z0-9]/g, '');

/** Een datum zoals hij uit Excel of een export komt: 2026-10-15, 15-10-2026, 15/10/2026, een Excel-getal of een Date. */
export function leesDatum(v: unknown): string | null {
  const geldig = (j: number, m: number, d: number) => {
    const x = new Date(Date.UTC(j, m - 1, d));
    return x.getUTCFullYear() === j && x.getUTCMonth() === m - 1 && x.getUTCDate() === d && j >= 2000 && j <= 2100
      ? `${j}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  };
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : geldig(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    /* Excel-dagnummer: dag 25569 is 1 januari 1970. */
    const x = new Date(Math.round((v - 25569) * 86400000));
    return geldig(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
  }
  const t = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return geldig(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m) return geldig(+m[3], +m[2], +m[1]);
  return null;
}

/** Bedrag uit een export: ook "€ 1.234,56", "1,234.56" en "-250". */
export function leesExternBedrag(v: unknown): number {
  if (typeof v === 'number') return v;
  const t = String(v ?? '').trim().replace(/[€\s]/g, '');
  /* Engelse notatie: punt als decimaalteken achter de laatste komma. */
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''));
  return leesBedrag(t);
}

export type Kolommen = Partial<Record<'datum' | 'factuurnummer' | 'klant' | 'bedrag_excl' | 'soort' | 'omschrijving', string>>;

/**
 * Herkent de kolommen van een geïmporteerde lijst aan hun kop. Bij het bedrag
 * gaat "excl. btw" voor een los "bedrag" of "totaal"; een kolom met "incl" of
 * alleen "btw" is nooit het bedrag.
 */
export function herkenKolommen(koppen: string[]): Kolommen {
  const uit: Kolommen = {};
  const norm = (k: string) => k.toLowerCase().replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
  const zoek = (pred: (k: string) => boolean) => koppen.find(k => pred(norm(k)));
  uit.factuurnummer = zoek(k => /factuur ?n(umme)?r|factuurnummer|^nummer$|invoice ?(number|no)|^nr$/.test(k));
  uit.datum = zoek(k => /factuurdatum|^datum$|^date$|invoice date|^datum /.test(k)) ?? zoek(k => /datum|date/.test(k) && !/verval|due|betaal/.test(k));
  uit.klant = zoek(k => /^klant|relatie|debiteur|bedrijf|contact|customer|^naam$|company/.test(k));
  uit.bedrag_excl = zoek(k => /excl/.test(k) && !/incl/.test(k))
    ?? zoek(k => /subtotaal|subtotal|netto/.test(k))
    ?? zoek(k => /^(bedrag|totaal|total|amount)$/.test(k));
  uit.soort = zoek(k => /^soort$|^type$|categorie/.test(k));
  uit.omschrijving = zoek(k => /omschrijving|beschrijving|description|onderwerp|referentie/.test(k));
  return Object.fromEntries(Object.entries(uit).filter(([, v]) => v)) as Kolommen;
}

export function leesSoort(v: unknown, standaard: ExterneSoort = 'bulk'): ExterneSoort {
  const t = String(v ?? '').trim().toLowerCase();
  if (!t) return standaard;
  return /bulk/.test(t) ? 'bulk' : 'overig';
}

/**
 * Controleert regels vóór opslaan: geldige datum en bedrag, en geen
 * factuurnummer dat al bestaat of twee keer in de lijst staat. Een klantnaam
 * koppelt aan een klant in WarmeLeads als de naam (zonder B.V. en leestekens)
 * precies overeenkomt.
 */
export function beoordeelRegels(
  invoer: ExterneInvoer[],
  bestaandeNummers: Iterable<string>,
  klanten: { id: string; name: string | null }[],
  standaardSoort: ExterneSoort = 'bulk',
): Beoordeling[] {
  const bezet = new Set([...bestaandeNummers].map(n => n.trim().toLowerCase()));
  const perNaam = new Map<string, string | null>();
  for (const k of klanten) {
    if (!k.name) continue;
    const s = naamSleutel(k.name);
    /* Twee klanten met dezelfde naam: niet raden. */
    perNaam.set(s, perNaam.has(s) ? null : k.id);
  }
  const klantIds = new Set(klanten.map(k => k.id));
  const inLijst = new Set<string>();

  return invoer.map((r, i): Beoordeling => {
    const regel = i + 1;
    const datum = leesDatum(r.datum);
    if (!datum) return { regel, status: 'fout', reden: 'geen geldige datum' };
    const bedrag = leesExternBedrag(r.bedrag_excl);
    if (!Number.isFinite(bedrag) || bedrag === 0 || Math.abs(bedrag) > 1_000_000) return { regel, status: 'fout', reden: 'geen geldig bedrag' };
    const nummer = tekst(r.factuurnummer, 60);
    const klantNaam = tekst(r.klant, 160);
    let customerId = typeof r.customer_id === 'string' && UUID.test(r.customer_id) && klantIds.has(r.customer_id) ? r.customer_id : null;
    if (!customerId && klantNaam) customerId = perNaam.get(naamSleutel(klantNaam)) ?? null;
    if (!customerId && !klantNaam) return { regel, status: 'fout', reden: 'geen klant' };
    const rij: ExterneRegel = {
      datum, factuurnummer: nummer, customer_id: customerId,
      klant_naam: customerId ? (klanten.find(k => k.id === customerId)?.name ?? klantNaam) : klantNaam,
      bedrag_excl: Math.round(bedrag * 100) / 100, soort: leesSoort(r.soort, standaardSoort), omschrijving: tekst(r.omschrijving, 300),
    };
    if (nummer) {
      const s = nummer.toLowerCase();
      if (bezet.has(s)) return { regel, status: 'dubbel', reden: `factuur ${nummer} staat er al in`, rij };
      if (inLijst.has(s)) return { regel, status: 'dubbel', reden: `factuur ${nummer} staat twee keer in de lijst`, rij };
      inLijst.add(s);
    }
    return { regel, status: 'goed', rij, klantOnbekend: !customerId };
  });
}
