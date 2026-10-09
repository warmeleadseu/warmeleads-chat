/**
 * Winst per batch.
 *
 * Omzet
 * - Wat er gefactureerd is, excl. btw: een extern ingevuld bedrag gaat voor,
 *   dan de factuur in het systeem (min creditnota's), en anders de
 *   batchprijs. Zo tellen batches die buiten het systeem om zijn gefactureerd
 *   en met de hand op betaald gezet volledig mee.
 * - Gerealiseerd: naar rato van wat er geleverd is. Een lopende batch heeft
 *   pas een deel verdiend. Compensaties maken de batch groter zonder dat de
 *   prijs stijgt, dus een gratis vervangende lead drukt zichtbaar de winst.
 * - Niche-onderzoek is een vast pakket: de hele prijs telt in één keer.
 *
 * Kosten
 * - Advertentiekosten van de geleverde leads (zie lead_kosten in migratie
 *   174). Een lead die naar drie klanten ging, telt per batch voor een derde.
 */

export type Betaalwijze = 'open' | 'mollie' | 'factuur' | 'extern';

export type WinstBatchInvoer = {
  batch_kind?: string | null;
  batch_size: number;
  total_price: number | string | null;
  is_paid: boolean | null;
  mollie_payment_id?: string | null;
  leads_delivered_external?: number | null;
  extern_bedrag_excl?: number | string | null;
};

export type WinstFactuur = { subtotal: number | string | null; credit?: boolean };

export type WinstKosten = {
  geleverd: number;
  kosten: number | string;
  leads_zonder_kosten?: number;
  gedeeld_gemiddeld?: number | string | null;
};

export type BatchWinst = {
  betaalwijze: Betaalwijze;
  omzetBron: 'extern' | 'factuur' | 'batchprijs';
  omzet: number;
  geleverd: number;
  geleverdExtern: number;
  grootte: number;
  voortgang: number;
  gerealiseerd: number;
  kosten: number;
  winst: number;
  marge: number | null;
  kostenPerLead: number | null;
  opbrengstPerLead: number | null;
  prognoseWinst: number | null;
  leadsZonderKosten: number;
  gedeeldGemiddeld: number | null;
};

const getal = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const euro = (n: number) => Math.round(n * 100) / 100;

export function berekenBatchWinst(
  batch: WinstBatchInvoer,
  facturen: WinstFactuur[],
  kosten: WinstKosten | null,
): BatchWinst {
  const gewoon = facturen.filter(f => !f.credit);
  const credit = facturen.filter(f => f.credit);

  let omzet: number;
  let omzetBron: BatchWinst['omzetBron'];
  if (batch.extern_bedrag_excl !== null && batch.extern_bedrag_excl !== undefined && String(batch.extern_bedrag_excl) !== '') {
    omzet = getal(batch.extern_bedrag_excl);
    omzetBron = 'extern';
  } else if (gewoon.length > 0) {
    /* Een creditnota kan als negatief of positief bedrag zijn vastgelegd;
       hij gaat er altijd af. */
    omzet = gewoon.reduce((s, f) => s + getal(f.subtotal), 0) - credit.reduce((s, f) => s + Math.abs(getal(f.subtotal)), 0);
    omzetBron = 'factuur';
  } else {
    omzet = getal(batch.total_price);
    omzetBron = 'batchprijs';
  }

  const betaalwijze: Betaalwijze = !batch.is_paid
    ? 'open'
    : batch.mollie_payment_id
      ? 'mollie'
      : gewoon.length > 0 && omzetBron !== 'extern'
        ? 'factuur'
        : 'extern';

  const grootte = Math.max(0, Math.round(getal(batch.batch_size)));
  const geleverd = Math.max(0, Math.round(getal(kosten?.geleverd)));
  const geleverdExtern = Math.max(0, Math.round(getal(batch.leads_delivered_external)));
  const totaalGeleverd = geleverd + geleverdExtern;
  const kostenTotaal = getal(kosten?.kosten);

  const pakket = batch.batch_kind === 'niche_research';
  const voortgang = pakket ? 1 : grootte > 0 ? Math.min(1, totaalGeleverd / grootte) : 0;
  const gerealiseerd = pakket ? omzet : omzet * voortgang;
  const winst = gerealiseerd - kostenTotaal;

  /* Wat de batch naar verwachting oplevert als hij vol is: de rest van de
     leads tegen de gemiddelde kosten tot nu toe. */
  let prognoseWinst: number | null = null;
  if (pakket || voortgang >= 1) prognoseWinst = winst;
  else if (geleverd > 0) {
    const rest = Math.max(0, grootte - totaalGeleverd);
    prognoseWinst = omzet - (kostenTotaal + rest * (kostenTotaal / geleverd));
  }

  return {
    betaalwijze,
    omzetBron,
    omzet: euro(omzet),
    geleverd,
    geleverdExtern,
    grootte,
    voortgang: Math.round(voortgang * 1000) / 1000,
    gerealiseerd: euro(gerealiseerd),
    kosten: euro(kostenTotaal),
    winst: euro(winst),
    marge: gerealiseerd > 0 ? Math.round((winst / gerealiseerd) * 1000) / 10 : null,
    kostenPerLead: geleverd > 0 ? euro(kostenTotaal / geleverd) : null,
    opbrengstPerLead: !pakket && grootte > 0 ? euro(omzet / grootte) : null,
    prognoseWinst: prognoseWinst === null ? null : euro(prognoseWinst),
    leadsZonderKosten: Math.max(0, Math.round(getal(kosten?.leads_zonder_kosten))),
    gedeeldGemiddeld: kosten?.gedeeld_gemiddeld == null ? null : getal(kosten.gedeeld_gemiddeld),
  };
}

export type WinstTotaal = { omzet: number; gerealiseerd: number; kosten: number; winst: number; marge: number | null; prognoseWinst: number };

export function telWinstOp(rijen: BatchWinst[]): WinstTotaal {
  const t = rijen.reduce(
    (s, r) => ({
      omzet: s.omzet + r.omzet,
      gerealiseerd: s.gerealiseerd + r.gerealiseerd,
      kosten: s.kosten + r.kosten,
      winst: s.winst + r.winst,
      prognoseWinst: s.prognoseWinst + (r.prognoseWinst ?? r.winst),
    }),
    { omzet: 0, gerealiseerd: 0, kosten: 0, winst: 0, prognoseWinst: 0 },
  );
  return {
    omzet: euro(t.omzet),
    gerealiseerd: euro(t.gerealiseerd),
    kosten: euro(t.kosten),
    winst: euro(t.winst),
    marge: t.gerealiseerd > 0 ? Math.round((t.winst / t.gerealiseerd) * 1000) / 10 : null,
    prognoseWinst: euro(t.prognoseWinst),
  };
}
