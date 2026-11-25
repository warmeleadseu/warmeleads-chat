import { afTeStaan } from './winstdeling';

/**
 * "Winst per batch" en "Marge per klant" op het dashboard, over de leveringen
 * in de gekozen periode. Zelfde bouwstenen als Winst en verlies:
 *
 * - omzet: het gefactureerde bedrag van de batch gedeeld door de
 *   batchgrootte, per geleverde lead. Gratis vervangende leads maken de batch
 *   groter en leveren dus geen extra omzet op.
 * - kosten: de echte kosten van elke lead, gedeeld door het aantal betalende
 *   klanten dat hem kreeg.
 * - winstdeling: wat er naar een derde gaat (winstdeling.ts).
 *
 * Tot 25 nov 2026 stond hier prijs per lead × geleverd (ook over gratis
 * compensatie) min één gemiddelde kostprijs voor alle leads van alle branches,
 * en telden Infinite Scale en interne klanten mee.
 */

export type DashboardBatch = {
  id: string;
  customer_id: string;
  klant: string;
  branch: string;
  batch_kind: string | null;
  batch_size: number;
  status: string;
  price_per_lead: number | null;
  /** Nederlandse aanmaakdag. */
  aangemaakt: string;
  /** Gefactureerde omzet excl. btw (berekenBatchWinst). */
  omzet: number;
  winstdeel: number;
};
export type DashboardLevering = { lead_id: string; customer_id: string; batch_id: string | null; assigned_at: string; source: string | null };

export type BatchRegel = {
  id: string; customer_id: string; customer: string; branch: string; batchSize: number; delivered: number; pricePerLead: number; status: string;
  revenue: number; cost: number; winstdeling: number; profit: number; marginPct: number; startDate: string;
};
export type KlantRegel = { name: string; revenue: number; cost: number; winstdeling: number; margin: number; leads: number; marginPct: number };

const rond = (n: number) => Math.round(n * 100) / 100;
const pct = (deel: number, geheel: number) => (geheel > 0 ? Math.round((deel / geheel) * 100) : 0);
const telt = (source: string | null) => source !== 'mirror' && source !== 'demo';

/** Aantal betalende klanten per lead; interne klanten en afspraakpartners dragen geen kosten. */
export function betalendeKlantenPerLead(leveringen: DashboardLevering[], zonderKostendeel: ReadonlySet<string>): Map<string, number> {
  const sets = new Map<string, Set<string>>();
  for (const l of leveringen) {
    if (!telt(l.source) || zonderKostendeel.has(l.customer_id)) continue;
    const s = sets.get(l.lead_id) ?? new Set<string>();
    s.add(l.customer_id);
    sets.set(l.lead_id, s);
  }
  return new Map([...sets].map(([id, s]) => [id, s.size]));
}

export function batchRegels(opties: {
  batches: DashboardBatch[];
  /** Alle leveringen (ook van vóór de periode, voor de verdeling van de kosten). */
  leveringen: DashboardLevering[];
  /** Kosten per lead. */
  kosten: Map<string, number>;
  zonderKostendeel: ReadonlySet<string>;
  periodeStartIso: string;
  periodeStartDag: string;
}): BatchRegel[] {
  const klanten = betalendeKlantenPerLead(opties.leveringen, opties.zonderKostendeel);
  const perBatch = new Map<string, { geleverd: number; kosten: number }>();
  for (const l of opties.leveringen) {
    if (!l.batch_id || !telt(l.source) || Date.parse(l.assigned_at) < Date.parse(opties.periodeStartIso)) continue;
    const r = perBatch.get(l.batch_id) ?? { geleverd: 0, kosten: 0 };
    r.geleverd += 1;
    r.kosten += (opties.kosten.get(l.lead_id) ?? 0) / Math.max(1, klanten.get(l.lead_id) ?? 1);
    perBatch.set(l.batch_id, r);
  }

  const uit: BatchRegel[] = [];
  for (const b of opties.batches) {
    if (opties.zonderKostendeel.has(b.customer_id)) continue;
    const r = perBatch.get(b.id) ?? { geleverd: 0, kosten: 0 };
    const pakket = b.batch_kind === 'niche_research';
    const pakketTelt = pakket && b.aangemaakt >= opties.periodeStartDag;
    if (r.geleverd === 0 && !pakketTelt) continue;
    const revenue = pakket ? (pakketTelt ? b.omzet : 0) : b.batch_size > 0 ? Math.min(b.omzet, (b.omzet / b.batch_size) * r.geleverd) : 0;
    const voorDeling = revenue - r.kosten;
    const winstdeling = afTeStaan(voorDeling, b.winstdeel);
    const profit = voorDeling - winstdeling;
    uit.push({
      id: b.id, customer_id: b.customer_id, customer: b.klant, branch: b.branch, batchSize: b.batch_size, delivered: r.geleverd,
      /* Wat een geleverde lead echt opbrengt; bij een pakket de ingestelde prijs. */
      pricePerLead: pakket || b.batch_size <= 0 ? Number(b.price_per_lead) || 0 : rond(b.omzet / b.batch_size),
      status: b.status, revenue: rond(revenue), cost: rond(r.kosten), winstdeling, profit: rond(profit),
      marginPct: pct(profit, revenue), startDate: b.aangemaakt,
    });
  }
  return uit.sort((a, b) => b.profit - a.profit);
}

/** Per klant: de batchregels plus de facturen zonder batch (bulk, Rompslomp). */
export function klantRegels(
  regels: BatchRegel[],
  losseOmzet: { customer_id: string | null; bedrag: number; winstdeling: number }[],
  naam: (customerId: string) => string,
): KlantRegel[] {
  const uit = new Map<string, KlantRegel>();
  const pak = (id: string, n: string) => {
    const r = uit.get(id) ?? { name: n, revenue: 0, cost: 0, winstdeling: 0, margin: 0, leads: 0, marginPct: 0 };
    uit.set(id, r);
    return r;
  };
  for (const b of regels) {
    const r = pak(b.customer_id, b.customer);
    r.revenue += b.revenue;
    r.cost += b.cost;
    r.winstdeling += b.winstdeling;
    r.leads += b.delivered;
  }
  for (const l of losseOmzet) {
    if (!l.customer_id) continue;
    const r = pak(l.customer_id, naam(l.customer_id));
    r.revenue += l.bedrag;
    r.winstdeling += l.winstdeling;
  }
  return [...uit.values()]
    .map(r => {
      const margin = r.revenue - r.cost - r.winstdeling;
      return { ...r, revenue: rond(r.revenue), cost: rond(r.cost), winstdeling: rond(r.winstdeling), margin: rond(margin), marginPct: pct(margin, r.revenue) };
    })
    .sort((a, b) => b.margin - a.margin);
}
