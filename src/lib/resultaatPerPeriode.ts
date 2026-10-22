/**
 * Resultaat per periode (winst en verlies), voor de winstpagina.
 *
 *   Omzet (verdiend)       wat er in de periode geleverd is, naar rato
 * − Advertentiekosten      de werkelijke Meta-uitgaven in de periode
 * = Brutowinst
 * − Personeel              vaste personeelskosten, per dag verdeeld
 * = Nettoresultaat
 *
 * Verdiend: per batch is de opbrengst per lead de batchomzet gedeeld door de
 * batchgrootte (zelfde als de winst per batch). Elke geleverde lead telt op
 * zijn leverdag, tot het batchbedrag bereikt is. Wordt een batch afgerond
 * met minder leads dan zijn grootte (opgeruimde leads, of handmatig
 * afgerond), dan telt het restant op de afrondingsdag. Niche-onderzoek is
 * een vast pakket en telt in één keer, op de aanmaakdag. Leads die buiten
 * het systeem zijn geleverd tellen op de aanmaakdag. Losse facturen zonder
 * batch tellen op hun betaaldag.
 *
 * Alle dagen zijn Nederlandse kalenderdagen (YYYY-MM-DD).
 */

export type PeriodeSoort = 'week' | 'maand' | 'kwartaal' | 'jaar';

export type WinstBatch = {
  id: string;
  batch_kind: string | null;
  status: string | null;
  /** Omzet excl. btw, zoals de winst per batch hem bepaalt. */
  omzet: number;
  grootte: number;
  geleverdExtern: number;
  /** Aanmaakdag en afrondingsdag (Nederlandse kalenderdag). */
  aangemaakt: string;
  afgerond: string | null;
  /** Geleverde leads per dag. */
  leveringen: { dag: string; aantal: number }[];
};

export type PersoneelsRegel = { bedrag_per_maand: number; ingang: string; einde: string | null };

const euro = (n: number) => Math.round(n * 100) / 100;

function voegToe(m: Map<string, number>, dag: string, bedrag: number) {
  if (!bedrag) return;
  m.set(dag, (m.get(dag) ?? 0) + bedrag);
}

/** Verdiende omzet per dag van één batch. */
export function verdiendPerDag(b: WinstBatch): Map<string, number> {
  const uit = new Map<string, number>();
  if (b.omzet === 0) return uit;
  if (b.batch_kind === 'niche_research' || b.grootte <= 0) {
    voegToe(uit, b.aangemaakt, b.omzet);
    return uit;
  }
  const perLead = b.omzet / b.grootte;
  let verdiend = 0;
  const pak = (dag: string, aantal: number) => {
    if (aantal <= 0) return;
    const ruimte = b.omzet - verdiend;
    if (Math.abs(ruimte) < 1e-9) return;
    const bedrag = b.omzet >= 0 ? Math.min(ruimte, aantal * perLead) : Math.max(ruimte, aantal * perLead);
    verdiend += bedrag;
    voegToe(uit, dag, bedrag);
  };
  pak(b.aangemaakt, b.geleverdExtern);
  for (const l of [...b.leveringen].sort((x, y) => x.dag.localeCompare(y.dag))) pak(l.dag, l.aantal);
  /* Afgerond met minder leads dan de grootte: het restant op de afrondingsdag
     (de winst per batch telt een afgeronde batch ook volledig). */
  if (b.status === 'completed') {
    const rest = b.omzet - verdiend;
    if (Math.abs(rest) > 1e-9) {
      const laatste = b.leveringen.reduce((m, l) => (l.dag > m ? l.dag : m), b.aangemaakt);
      voegToe(uit, b.afgerond ?? laatste, rest);
    }
  }
  return uit;
}

function dagenInMaand(dag: string): number {
  const [j, m] = dag.split('-').map(Number);
  return new Date(Date.UTC(j, m, 0)).getUTCDate();
}

/** Personeelskosten van één dag: het maandbedrag van de regels die die dag gelden, gedeeld door de dagen van die maand. */
export function personeelOpDag(regels: PersoneelsRegel[], dag: string): number {
  let som = 0;
  for (const r of regels) {
    if (dag < r.ingang) continue;
    if (r.einde && dag > r.einde) continue;
    som += Number(r.bedrag_per_maand) || 0;
  }
  return som / dagenInMaand(dag);
}

/** Alle dagen van `van` tot en met `tot`. */
export function dagenTussen(van: string, tot: string): string[] {
  const uit: string[] = [];
  const d = new Date(`${van}T12:00:00Z`);
  const eind = new Date(`${tot}T12:00:00Z`);
  for (let i = 0; d <= eind && i < 5000; i++) {
    uit.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return uit;
}

/** Sleutel en eerste en laatste dag van de periode waar een dag in valt. */
export function periodeVan(dag: string, soort: PeriodeSoort): { sleutel: string; van: string; tot: string } {
  const [j, m] = dag.split('-').map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (soort === 'jaar') return { sleutel: `${j}`, van: `${j}-01-01`, tot: `${j}-12-31` };
  if (soort === 'kwartaal') {
    const k = Math.floor((m - 1) / 3);
    return { sleutel: `${j}-K${k + 1}`, van: iso(new Date(Date.UTC(j, k * 3, 1))), tot: iso(new Date(Date.UTC(j, k * 3 + 3, 0))) };
  }
  if (soort === 'maand') {
    return { sleutel: `${j}-${String(m).padStart(2, '0')}`, van: iso(new Date(Date.UTC(j, m - 1, 1))), tot: iso(new Date(Date.UTC(j, m, 0))) };
  }
  /* Week van maandag tot en met zondag. */
  const d = new Date(`${dag}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  const maandag = new Date(d.getTime() - dow * 86_400_000);
  const zondag = new Date(maandag.getTime() + 6 * 86_400_000);
  return { sleutel: iso(maandag), van: iso(maandag), tot: iso(zondag) };
}

export type PeriodeResultaat = {
  sleutel: string;
  van: string;
  tot: string;
  /** Lopende periode: telt tot en met vandaag. */
  lopend: boolean;
  verdiend: number;
  gefactureerd: number;
  advertentie: number;
  brutowinst: number;
  personeel: number;
  netto: number;
  /** Nettoresultaat als deel van de verdiende omzet. */
  marge: number | null;
  /** Omzet die nodig is om quitte te spelen (advertentie + personeel). */
  breakEven: number;
  leveringen: number;
  personeelPerLead: number | null;
  kostenPerLead: number | null;
  /** Lopende periode: doorgetrokken naar de hele periode (personeel volledig). */
  prognose: { verdiend: number; advertentie: number; personeel: number; netto: number } | null;
};

/**
 * Het resultaat per periode van `start` tot en met `vandaag`. Bedragen per dag
 * komen binnen als Map dag → bedrag.
 */
export function bouwResultaat(opties: {
  soort: PeriodeSoort;
  start: string;
  vandaag: string;
  verdiend: Map<string, number>;
  gefactureerd: Map<string, number>;
  advertentie: Map<string, number>;
  leveringen: Map<string, number>;
  personeel: PersoneelsRegel[];
}): PeriodeResultaat[] {
  const perPeriode = new Map<string, PeriodeResultaat & { dagen: number; dagenTotaal: number }>();
  for (const dag of dagenTussen(opties.start, opties.vandaag)) {
    const p = periodeVan(dag, opties.soort);
    let r = perPeriode.get(p.sleutel);
    if (!r) {
      r = {
        sleutel: p.sleutel, van: p.van < opties.start ? opties.start : p.van, tot: p.tot,
        lopend: p.tot >= opties.vandaag, verdiend: 0, gefactureerd: 0, advertentie: 0, brutowinst: 0, personeel: 0,
        netto: 0, marge: null, breakEven: 0, leveringen: 0, personeelPerLead: null, kostenPerLead: null, prognose: null,
        dagen: 0, dagenTotaal: dagenTussen(p.van < opties.start ? opties.start : p.van, p.tot).length,
      };
      perPeriode.set(p.sleutel, r);
    }
    r.dagen++;
    r.verdiend += opties.verdiend.get(dag) ?? 0;
    r.gefactureerd += opties.gefactureerd.get(dag) ?? 0;
    r.advertentie += opties.advertentie.get(dag) ?? 0;
    r.leveringen += opties.leveringen.get(dag) ?? 0;
    r.personeel += personeelOpDag(opties.personeel, dag);
  }

  return [...perPeriode.values()].map(({ dagen, dagenTotaal, ...r }) => {
    const brutowinst = r.verdiend - r.advertentie;
    const netto = brutowinst - r.personeel;
    let prognose: PeriodeResultaat['prognose'] = null;
    if (r.lopend && dagen > 0 && dagenTotaal > dagen) {
      const factor = dagenTotaal / dagen;
      const personeelHeel = dagenTussen(r.van, r.tot).reduce((s, d) => s + personeelOpDag(opties.personeel, d), 0);
      const pv = r.verdiend * factor;
      const pa = r.advertentie * factor;
      prognose = { verdiend: euro(pv), advertentie: euro(pa), personeel: euro(personeelHeel), netto: euro(pv - pa - personeelHeel) };
    }
    return {
      ...r,
      verdiend: euro(r.verdiend),
      gefactureerd: euro(r.gefactureerd),
      advertentie: euro(r.advertentie),
      personeel: euro(r.personeel),
      brutowinst: euro(brutowinst),
      netto: euro(netto),
      marge: r.verdiend > 0 ? Math.round((netto / r.verdiend) * 1000) / 10 : null,
      breakEven: euro(r.advertentie + r.personeel),
      personeelPerLead: r.leveringen > 0 ? euro(r.personeel / r.leveringen) : null,
      kostenPerLead: r.leveringen > 0 ? euro((r.advertentie + r.personeel) / r.leveringen) : null,
      prognose,
    };
  });
}
