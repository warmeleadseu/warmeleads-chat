/**
 * Winstdeling (25 nov 2026): van sommige klanten gaat een deel van de winst
 * naar iemand buiten WarmeLeads. Dat deel is geen winst van WarmeLeads en gaat
 * er daarom overal af waar winst staat: Winst en verlies, de batchkaart, het
 * dashboard en het live-dashboard. De omzet verandert niet, dus het
 * leaderboard en de omzettargets ook niet.
 *
 * Een afspraak geldt voor één klant en een periode: batches tellen op hun
 * aanmaakdag, losse en externe facturen (bulk) op hun eigen dag.
 *
 * - Batch: deel × (gerealiseerde omzet − leadkosten).
 * - Factuur zonder batch (bulk): deel × bedrag. Aan zo'n factuur hangen geen
 *   leads, dus ook geen leadkosten.
 * - Verlies wordt niet gedeeld.
 */

/** De afspraken staan als JSON in app_settings onder deze sleutel. */
export const WINSTDELING_SLEUTEL = 'winstdeling_afspraken';

export type WinstAfspraak = {
  customer_id: string;
  /** Eerste en laatste dag (YYYY-MM-DD, inclusief); geen laatste dag = loopt door. */
  vanaf: string;
  tot: string | null;
  /** Het deel dat WarmeLeads afstaat, tussen 0 en 1. */
  deel: number;
};

export type WinstdelingPost = { dag: string; bedrag: number; customer_id: string; batch_id: string | null };

const DAG = /^\d{4}-\d{2}-\d{2}$/;
const rond = (n: number) => Math.round(n * 100) / 100;

/** Leest de afspraken; een ongeldige instelling is een fout, want anders zou de winst ongemerkt te hoog zijn. */
export function leesWinstAfspraken(waarde: string | null | undefined): WinstAfspraak[] {
  if (!waarde?.trim()) return [];
  const ruw: unknown = JSON.parse(waarde);
  if (!Array.isArray(ruw)) throw new Error('winstdeling: de instelling is geen lijst');
  return ruw.map((r, i) => {
    const a = (r ?? {}) as Record<string, unknown>;
    const tot = a.tot === null || a.tot === undefined || a.tot === '' ? null : String(a.tot);
    const deel = Number(a.deel);
    if (typeof a.customer_id !== 'string' || !DAG.test(String(a.vanaf)) || (tot !== null && !DAG.test(tot)) || !(deel > 0 && deel <= 1)) {
      throw new Error(`winstdeling: afspraak ${i + 1} is ongeldig`);
    }
    return { customer_id: a.customer_id, vanaf: String(a.vanaf), tot, deel };
  });
}

/** Het deel dat op deze dag voor deze klant wordt afgestaan; 0 zonder afspraak. */
export function winstdeelVan(afspraken: WinstAfspraak[], customerId: string | null | undefined, dag: string): number {
  if (!customerId) return 0;
  const a = afspraken.find(x => x.customer_id === customerId && dag >= x.vanaf && (x.tot === null || dag <= x.tot));
  return a?.deel ?? 0;
}

/** Het bedrag dat van deze winst wordt afgestaan; verlies wordt niet gedeeld. */
export function afTeStaan(winst: number, deel: number): number {
  return deel > 0 && winst > 0 ? rond(winst * deel) : 0;
}

/** Verdeelt een bedrag over dagen naar rato van (verdiende) omzet, samen precies het bedrag. */
export function verdeelOverDagen(bedrag: number, perDag: Map<string, number>): Map<string, number> {
  const uit = new Map<string, number>();
  const totaal = [...perDag.values()].reduce((s, v) => s + v, 0);
  if (!bedrag || totaal <= 0) return uit;
  for (const [dag, v] of perDag) uit.set(dag, (bedrag * v) / totaal);
  return uit;
}

type BetaaldePost = { dag: string; bedrag: number; batch_id: string | null; customer_id: string | null };
export type GedeeldeBatch = { deel: number; omzet: number; winst: number };

/**
 * De winstdeling bij de betaalde omzet (dashboard en live-dashboard): per post
 * het afgestane deel, op de dag van betalen. `batches` bevat alleen de batches
 * met een afspraak, met hun omzet en de winst vóór deling (van een lopende
 * batch de prognose, want de omzet staat er ook al helemaal in).
 */
export function winstdelingBijPosten(
  posten: BetaaldePost[],
  batches: Map<string, GedeeldeBatch>,
  afspraken: WinstAfspraak[],
): WinstdelingPost[] {
  const uit: WinstdelingPost[] = [];
  for (const p of posten) {
    if (!p.customer_id) continue;
    let bedrag = 0;
    if (p.batch_id) {
      const b = batches.get(p.batch_id);
      if (b && b.omzet > 0) bedrag = afTeStaan(b.winst, b.deel) * (p.bedrag / b.omzet);
    } else {
      bedrag = p.bedrag * winstdeelVan(afspraken, p.customer_id, p.dag);
    }
    if (bedrag) uit.push({ dag: p.dag, bedrag: rond(bedrag), customer_id: p.customer_id, batch_id: p.batch_id });
  }
  return uit;
}

/** Telt de winstdeling van dag `van` tot en met dag `tot`. */
export function telWinstdeling(posten: WinstdelingPost[], van: string, tot: string): number {
  return rond(posten.reduce((s, p) => (p.dag >= van && p.dag <= tot ? s + p.bedrag : s), 0));
}
