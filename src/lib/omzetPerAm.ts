import type { OmzetPost, OmzetSoort } from './omzetPerMaand';

/**
 * Omzet per accountmanager (4 nov 2026): dezelfde posten als de maandomzet op
 * het dashboard en Winst en verlies (src/lib/omzetPerMaand.ts), dus betaald,
 * excl. btw, op de dag van betalen. Alles wat een accountmanager heeft, telt
 * samen op tot de totale omzet; de rest staat onder "geen accountmanager".
 *
 * Toewijzing: de accountmanager op de batch, anders die van de klant (losse
 * en externe facturen hebben geen batch). Tot 4 nov 2026 telden het
 * leaderboard en de targets elk anders: batchprijs in de maand van aanmaken,
 * de targets ook onbetaald, en geen losse of externe facturen.
 */

export type AmBronnen = {
  /** batch-id → accountmanager op de batch */
  batchAm: Map<string, string | null>;
  /** klant-id → accountmanager van de klant */
  klantAm: Map<string, string | null>;
};

export function amVanPost(p: Pick<OmzetPost, 'batch_id' | 'customer_id'>, b: AmBronnen): string | null {
  const opBatch = p.batch_id ? b.batchAm.get(p.batch_id) : null;
  if (opBatch) return opBatch;
  return (p.customer_id ? b.klantAm.get(p.customer_id) : null) ?? null;
}

export type AmOmzet = {
  /** Alles samen, bulk inbegrepen. */
  totaal: number;
  /** Het bulkdeel van het totaal. */
  bulk: number;
  /** Aantal batches met omzet in de periode. */
  batches: number;
  perSoort: Record<OmzetSoort, number>;
};

const leeg = (): AmOmzet => ({ totaal: 0, bulk: 0, batches: 0, perSoort: { leads: 0, bulk: 0, afspraken: 0, overig: 0, credit: 0 } });
const rond = (n: number) => Math.round(n * 100) / 100;

export type PeriodeFilter = { vanDag: string; totDag: string } | { vanMoment: string; totMoment: string };

function inPeriode(p: OmzetPost, f: PeriodeFilter): boolean {
  if ('vanDag' in f) return p.dag >= f.vanDag && p.dag <= f.totDag;
  const t = Date.parse(p.moment);
  return t >= Date.parse(f.vanMoment) && t < Date.parse(f.totMoment);
}

/**
 * Telt de posten per accountmanager. Sleutel `null` = geen accountmanager.
 * `uitgeslotenBatches`: batches die een superadmin van het leaderboard heeft
 * gehaald (alleen voor het leaderboard, niet voor de targets).
 */
export function omzetPerAm(
  posten: OmzetPost[],
  periode: PeriodeFilter,
  bronnen: AmBronnen,
  uitgeslotenBatches: ReadonlySet<string> = new Set(),
): Map<string | null, AmOmzet> {
  const uit = new Map<string | null, AmOmzet>();
  const batchesPerAm = new Map<string | null, Set<string>>();
  for (const p of posten) {
    if (!inPeriode(p, periode)) continue;
    if (p.batch_id && uitgeslotenBatches.has(p.batch_id)) continue;
    const am = amVanPost(p, bronnen);
    const r = uit.get(am) ?? leeg();
    r.perSoort[p.soort] += p.bedrag;
    uit.set(am, r);
    /* Een batch telt één keer, en alleen als hij geen creditnota is. */
    if (p.batch_id && p.soort !== 'credit') {
      const s = batchesPerAm.get(am) ?? new Set<string>();
      s.add(p.batch_id);
      batchesPerAm.set(am, s);
    }
  }
  for (const [am, r] of uit) {
    for (const k of Object.keys(r.perSoort) as OmzetSoort[]) r.perSoort[k] = rond(r.perSoort[k]);
    r.totaal = rond(Object.values(r.perSoort).reduce((s, v) => s + v, 0));
    r.bulk = r.perSoort.bulk;
    r.batches = batchesPerAm.get(am)?.size ?? 0;
  }
  return uit;
}

/** Eén regel per batch of factuur, voor de uitleg op /admin/am-leaderboard. */
export type OmzetRegel = { sleutel: string; batch_id: string | null; customer_id: string | null; soort: OmzetSoort; dag: string; bedrag: number };

export function omzetRegelsVanAm(posten: OmzetPost[], periode: PeriodeFilter, bronnen: AmBronnen, am: string): OmzetRegel[] {
  const perSleutel = new Map<string, OmzetRegel>();
  posten.forEach((p, i) => {
    if (!inPeriode(p, periode) || amVanPost(p, bronnen) !== am) return;
    const sleutel = p.batch_id ? `b:${p.batch_id}` : `p:${i}`;
    const r = perSleutel.get(sleutel);
    if (r) { r.bedrag = rond(r.bedrag + p.bedrag); if (p.dag > r.dag) r.dag = p.dag; return; }
    perSleutel.set(sleutel, { sleutel, batch_id: p.batch_id, customer_id: p.customer_id, soort: p.soort, dag: p.dag, bedrag: p.bedrag });
  });
  return [...perSleutel.values()].sort((a, b) => a.dag.localeCompare(b.dag));
}
