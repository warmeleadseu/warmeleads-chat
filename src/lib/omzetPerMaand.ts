/**
 * Gefactureerde omzet per dag: één definitie voor het live-dashboard en
 * Winst en verlies (2 nov 2026). Alles excl. btw, op de dag van betalen.
 *
 * Wat telt
 * - Lead-, bulk- en niche-batches die betaald zijn. Een extern ingevuld
 *   bedrag gaat voor; dan de facturen in het systeem (elk op zijn betaaldag);
 *   een batch zonder factuur telt de batchprijs op de aanmaakdag (de
 *   betaaldag is dan niet bekend).
 * - Afsprakenbatches op dezelfde manier, als de aanroeper ze meeneemt.
 * - Losse facturen zonder batch, op de betaaldag.
 * - Creditnota's eraf, op hun aanmaakdag.
 * - Externe omzet (facturen buiten het systeem, zie migratie 191) op de
 *   factuurdatum.
 *
 * Wat niet telt: interne klanten, uitgesloten klanten, onbetaalde batches en
 * facturen. Tot 2 nov 2026 telde het dashboard de batchprijs in de maand van
 * aanmaken (ook als de factuur lager was, of de batch pas later betaald werd),
 * interne klanten wel en losse facturen, afspraken en externe facturen niet.
 */

export type OmzetSoort = 'leads' | 'bulk' | 'afspraken' | 'overig' | 'credit';
export type OmzetPost = { dag: string; bedrag: number; soort: OmzetSoort };

export type OmzetBatch = {
  id: string; customer_id: string; batch_kind: string; created_at: string;
  total_price: number | string | null; extern_bedrag_excl?: number | string | null; intern?: boolean;
};
export type OmzetFactuur = {
  id: string; customer_id: string | null; batch_id: string | null; appointment_batch_id: string | null;
  credit_note_of: string | null; subtotal: number | string | null; status: string; paid_at: string | null;
  created_at: string; intern?: boolean;
};
export type OmzetAfspraakBatch = { id: string; customer_id: string; total_price: number | string | null; created_at: string; intern?: boolean };
export type ExterneOmzetRij = { datum: string; bedrag_excl: number | string; soort: 'bulk' | 'overig' | string; customer_id?: string | null };

export type OmzetInvoer = {
  /** Alleen betaalde batches. */
  batches: OmzetBatch[];
  facturen: OmzetFactuur[];
  /** Betaalde afsprakenbatches; null = afspraken tellen niet mee. */
  afspraakBatches: OmzetAfspraakBatch[] | null;
  extern: ExterneOmzetRij[];
  uitgesloten?: Set<string>;
  /** Zet een tijdstip om naar een kalenderdag (Nederlandse tijd). */
  dagVan: (iso: string) => string;
};

const getal = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const heeftWaarde = (v: unknown) => v !== null && v !== undefined && String(v) !== '';

export function omzetPosten(i: OmzetInvoer): OmzetPost[] {
  const uit: OmzetPost[] = [];
  const weg = i.uitgesloten ?? new Set<string>();
  const telt = (x: { intern?: boolean; customer_id: string | null }) => !x.intern && !(x.customer_id && weg.has(x.customer_id));
  const post = (dag: string, bedrag: number, soort: OmzetSoort) => { if (bedrag) uit.push({ dag, bedrag: Math.round(bedrag * 100) / 100, soort }); };

  const batches = new Map(i.batches.filter(telt).map(b => [b.id, b]));
  const afspraken = new Map((i.afspraakBatches ?? []).filter(telt).map(b => [b.id, b]));
  const gewoon = i.facturen.filter(f => !f.credit_note_of);
  const perBatch = new Map<string, OmzetFactuur[]>();
  for (const f of gewoon) {
    const k = f.batch_id ? `b:${f.batch_id}` : f.appointment_batch_id ? `a:${f.appointment_batch_id}` : null;
    if (k) perBatch.set(k, [...(perBatch.get(k) ?? []), f]);
  }
  const betaald = (f: OmzetFactuur) => f.status === 'paid' && Boolean(f.paid_at);

  /* Een batch (of afsprakenbatch): extern bedrag, anders zijn betaalde
     facturen, anders de batchprijs. */
  const boekBatch = (b: { created_at: string; total_price: number | string | null; extern_bedrag_excl?: number | string | null }, facturen: OmzetFactuur[], soort: OmzetSoort) => {
    const betaaldeFacturen = facturen.filter(betaald).sort((x, y) => String(x.paid_at).localeCompare(String(y.paid_at)));
    if (heeftWaarde(b.extern_bedrag_excl)) {
      post(i.dagVan(betaaldeFacturen[0]?.paid_at ?? b.created_at), getal(b.extern_bedrag_excl), soort);
    } else if (betaaldeFacturen.length > 0) {
      for (const f of betaaldeFacturen) post(i.dagVan(f.paid_at as string), getal(f.subtotal), soort);
    } else if (facturen.length > 0) {
      /* Betaald gemeld terwijl de factuur nog open staat: het factuurbedrag
         op de aanmaakdag, tot de factuur zelf op betaald gaat. */
      post(i.dagVan(b.created_at), facturen.reduce((s, f) => s + getal(f.subtotal), 0), soort);
    } else {
      post(i.dagVan(b.created_at), getal(b.total_price), soort);
    }
  };
  for (const b of batches.values()) boekBatch(b, perBatch.get(`b:${b.id}`) ?? [], b.batch_kind === 'bulk_leads' ? 'bulk' : 'leads');
  for (const b of afspraken.values()) boekBatch(b, perBatch.get(`a:${b.id}`) ?? [], 'afspraken');

  /* Losse facturen, zonder batch. */
  for (const f of gewoon) {
    if (f.batch_id || f.appointment_batch_id || !betaald(f) || !telt(f)) continue;
    post(i.dagVan(f.paid_at as string), getal(f.subtotal), 'overig');
  }

  /* Creditnota's: alleen op omzet die hier meetelt. Bij een extern bedrag op
     de batch is dat bedrag al het eindbedrag. */
  const perId = new Map(i.facturen.map(f => [f.id, f]));
  for (const c of i.facturen) {
    if (!c.credit_note_of) continue;
    const o = perId.get(c.credit_note_of);
    if (!o || !telt(o)) continue;
    if (o.batch_id) {
      const b = batches.get(o.batch_id);
      if (!b || heeftWaarde(b.extern_bedrag_excl)) continue;
    } else if (o.appointment_batch_id) {
      if (!afspraken.has(o.appointment_batch_id)) continue;
    } else if (!betaald(o)) continue;
    post(i.dagVan(c.created_at), -Math.abs(getal(c.subtotal)), 'credit');
  }

  /* Externe facturen (Rompslomp e.d.): een negatief bedrag is een creditfactuur. */
  for (const e of i.extern) {
    if (e.customer_id && weg.has(e.customer_id)) continue;
    post(String(e.datum).slice(0, 10), getal(e.bedrag_excl), e.soort === 'bulk' ? 'bulk' : 'overig');
  }
  return uit;
}

export type OmzetTotaal = { totaal: number; perSoort: Record<OmzetSoort, number> };

/** Telt de posten op van dag `van` tot en met dag `tot` (YYYY-MM-DD). */
export function telOmzet(posten: OmzetPost[], van: string, tot: string): OmzetTotaal {
  const perSoort: Record<OmzetSoort, number> = { leads: 0, bulk: 0, afspraken: 0, overig: 0, credit: 0 };
  for (const p of posten) if (p.dag >= van && p.dag <= tot) perSoort[p.soort] += p.bedrag;
  for (const k of Object.keys(perSoort) as OmzetSoort[]) perSoort[k] = Math.round(perSoort[k] * 100) / 100;
  const totaal = Math.round(Object.values(perSoort).reduce((s, v) => s + v, 0) * 100) / 100;
  return { totaal, perSoort };
}
