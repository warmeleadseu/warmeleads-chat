import { addCivilDays, amsterdamWallTimeToUtc, amsterdamYmd } from '@/lib/appointmentSlots';

/**
 * Acties met loten (sinds 30 okt 2026), puur en te testen. De eerste was de
 * najaarsactie: 20 gratis leads, 30 oktober t/m 13 november 2026.
 *
 * Per actie (tabel `acties`):
 * - Per nieuwe leadbatch die binnen de actie betaald wordt: 1 lot per volle
 *   `leadsPerLot` leads. Betaald vóór de start telt niet.
 * - Bulk: 1 lot per volle `bulkPerLot` bulkleads die in de actie geleverd
 *   zijn, opgeteld per klant. Bulkkopers krijgen geen mail.
 * - Niet: afsprakenbatches, gratis batches, interne en demo-klanten.
 *   Gecrediteerd of niet meer betaald: de loten van die batch vervallen.
 * - Na afloop één trekking: één winnaar krijgt alle leads, elk lot even zwaar.
 *
 * Acties overlappen nooit in tijd, zodat een batch altijd bij hooguit één
 * actie hoort. Elke actie heeft haar eigen loten, deelnemers en trekking.
 */

export type Actie = {
  code: string;
  naam: string;
  /** Eerste moment dat meetelt (UTC). */
  start: string;
  /** Eerste moment dat niet meer meetelt (UTC), dus de dag na de laatste dag 00:00 Nederlandse tijd. */
  eind: string;
  prijsLeads: number;
  leadsPerLot: number;
  bulkPerLot: number;
};

/** De eerste actie; staat ook als eerste rij in de tabel (migratie 190). */
export const NAJAARSACTIE_2026: Actie = {
  code: 'najaar-2026',
  naam: 'Najaarsactie: 20 gratis leads',
  start: '2026-10-29T23:00:00.000Z',
  eind: '2026-11-13T23:00:00.000Z',
  prijsLeads: 20,
  leadsPerLot: 10,
  bulkPerLot: 100,
};

export type ActieRij = {
  code: string; naam: string; start_op: string; eind_op: string;
  prijs_leads: number; leads_per_lot: number; bulk_per_lot: number;
};

export function rijNaarActie(r: ActieRij): Actie {
  return {
    code: r.code, naam: r.naam,
    start: new Date(r.start_op).toISOString(), eind: new Date(r.eind_op).toISOString(),
    prijsLeads: Number(r.prijs_leads), leadsPerLot: Number(r.leads_per_lot), bulkPerLot: Number(r.bulk_per_lot),
  };
}

const LANG = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });

/** Eerste dag en laatste dag als tekst ("30 oktober 2026"), in Nederlandse tijd. */
export function actieLabels(a: Actie): { startLabel: string; eindLabel: string; startDag: string; laatsteDag: string } {
  const start = new Date(a.start);
  const laatste = new Date(Date.parse(a.eind) - 1);
  return { startLabel: LANG(start), eindLabel: LANG(laatste), startDag: amsterdamYmd(start), laatsteDag: amsterdamYmd(laatste) };
}

export function lotenVoorBatch(a: Actie, batchSize: number): number {
  return batchSize > 0 ? Math.floor(batchSize / a.leadsPerLot) : 0;
}

export function lotenVoorBulk(a: Actie, bulkLeads: number): number {
  return bulkLeads > 0 ? Math.floor(bulkLeads / a.bulkPerLot) : 0;
}

export function binnenActie(a: Actie, moment: string | Date | null | undefined): boolean {
  if (!moment) return false;
  const t = new Date(moment).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.parse(a.start) && t < Date.parse(a.eind);
}

export type ActieFase = 'voor' | 'loopt' | 'afgelopen';
export function actieFase(a: Actie, nu: Date = new Date()): ActieFase {
  const t = nu.getTime();
  if (t < Date.parse(a.start)) return 'voor';
  if (t < Date.parse(a.eind)) return 'loopt';
  return 'afgelopen';
}

/** Hoe lang na de trekking de actie nog op het live-dashboard en in het portaal staat. */
const ZICHTBAAR_NA_TREKKING_MS = 3 * 86_400_000;
/** Zonder trekking: zo lang na afloop nog tonen ("trekking volgt"). */
const ZICHTBAAR_NA_EIND_MS = 14 * 86_400_000;

/** Hoort deze actie nu in beeld (dashboard, portaal)? */
export function actieZichtbaar(a: Actie, getrokkenOp: string | null, nu: Date = new Date()): boolean {
  const t = nu.getTime();
  if (t < Date.parse(a.start)) return false;
  if (getrokkenOp) return t - Date.parse(getrokkenOp) < ZICHTBAAR_NA_TREKKING_MS;
  return t < Date.parse(a.eind) + ZICHTBAAR_NA_EIND_MS;
}

/**
 * De actie voor het dashboard en het portaal: de lopende, anders de meest
 * recente die nog in beeld hoort, anders geen.
 */
export function kiesZichtbareActie(acties: Actie[], getrokkenOp: Map<string, string>, nu: Date = new Date()): Actie | null {
  const lopend = acties.find(a => actieFase(a, nu) === 'loopt');
  if (lopend) return lopend;
  return [...acties]
    .filter(a => actieZichtbaar(a, getrokkenOp.get(a.code) ?? null, nu))
    .sort((x, y) => Date.parse(y.eind) - Date.parse(x.eind))[0] ?? null;
}

export type FactuurRij = {
  id: string;
  status: string;
  paid_at: string | null;
  credit_note_of: string | null;
};

/**
 * Wanneer is de batch betaald? Via de eerste betaalde factuur. Een batch
 * zonder enige factuur die als betaald is aangemaakt (bijvoorbeeld door
 * beheer) geldt als betaald op zijn aanmaakmoment. Zo telt een batch die al
 * vóór de actie betaald was nooit mee, ook al ziet de ronde hem pas later.
 */
export function betaalMoment(
  batch: { is_paid: boolean | null; created_at: string },
  facturen: FactuurRij[],
): string | null {
  if (batch.is_paid !== true) return null;
  const gewoon = facturen.filter(f => !f.credit_note_of);
  const betaald = gewoon
    .filter(f => f.status === 'paid' && f.paid_at)
    .map(f => f.paid_at as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  if (betaald.length > 0) return betaald[0];
  return gewoon.length === 0 ? batch.created_at : null;
}

/** Is een betaalde factuur van deze batch gecrediteerd? */
export function isGecrediteerd(facturen: FactuurRij[]): boolean {
  const gewoon = new Set(facturen.filter(f => !f.credit_note_of).map(f => f.id));
  return facturen.some(f => f.credit_note_of && gewoon.has(f.credit_note_of));
}

export type BatchKandidaat = {
  id: string;
  customer_id: string;
  batch_kind: string | null;
  batch_size: number | null;
  is_paid: boolean | null;
  created_at: string;
  total_price: number | string | null;
  price_per_lead: number | string | null;
  klant: { intern?: boolean | null; demo_mode?: boolean | null } | null;
};

export type Beoordeling =
  | { telt: true; loten: number; betaaldOp: string }
  | { telt: false; reden: string };

export function beoordeelBatch(a: Actie, b: BatchKandidaat, facturen: FactuurRij[]): Beoordeling {
  if ((b.batch_kind ?? 'leads') !== 'leads') return { telt: false, reden: 'geen leadbatch' };
  if (b.klant?.intern || b.klant?.demo_mode) return { telt: false, reden: 'interne of demo-klant' };
  if (!(Number(b.total_price) > 0 || Number(b.price_per_lead) > 0)) return { telt: false, reden: 'gratis batch' };
  const loten = lotenVoorBatch(a, Number(b.batch_size) || 0);
  if (loten < 1) return { telt: false, reden: `minder dan ${a.leadsPerLot} leads` };
  if (isGecrediteerd(facturen)) return { telt: false, reden: 'gecrediteerd' };
  const betaaldOp = betaalMoment(b, facturen);
  if (!betaaldOp) return { telt: false, reden: 'niet betaald' };
  if (!binnenActie(a, betaaldOp)) return { telt: false, reden: 'buiten de actieperiode betaald' };
  return { telt: true, loten, betaaldOp };
}

export type Deelnemer = { customer_id: string; loten: number };

/**
 * Gewogen trekking: lotnummer 0..totaal-1 wijst één deelnemer aan. De
 * volgorde staat vast (op klant-id), zodat de uitslag met het vastgelegde
 * lotnummer en de deelnemerslijst altijd na te rekenen is.
 */
export function wijsWinnaarAan(deelnemers: Deelnemer[], lotnummer: number): Deelnemer | null {
  const lijst = [...deelnemers].filter(d => d.loten > 0).sort((a, b) => a.customer_id.localeCompare(b.customer_id));
  const totaal = lijst.reduce((s, d) => s + d.loten, 0);
  if (totaal === 0 || !Number.isInteger(lotnummer) || lotnummer < 0 || lotnummer >= totaal) return null;
  let teller = lotnummer;
  for (const d of lijst) {
    if (teller < d.loten) return d;
    teller -= d.loten;
  }
  return null;
}

/* ── Nieuwe actie ── */

const DAG = /^\d{4}-\d{2}-\d{2}$/;

export type NieuweActieInvoer = {
  naam?: unknown; startDag?: unknown; laatsteDag?: unknown;
  prijsLeads?: unknown; leadsPerLot?: unknown; bulkPerLot?: unknown;
};

function geheel(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * Controleert een nieuwe actie: geldige dagen (laatste dag tot en met),
 * niet in het verleden beginnen, niet overlappen met een andere actie.
 */
export function valideerNieuweActie(
  invoer: NieuweActieInvoer,
  bestaande: Actie[],
  nu: Date = new Date(),
): { ok: true; actie: Actie } | { ok: false; fout: string } {
  const naam = typeof invoer.naam === 'string' ? invoer.naam.trim() : '';
  if (naam.length < 3 || naam.length > 80) return { ok: false, fout: 'Geef de actie een naam van 3 tot 80 tekens.' };
  const startDag = String(invoer.startDag ?? '');
  const laatsteDag = String(invoer.laatsteDag ?? '');
  if (!DAG.test(startDag) || !DAG.test(laatsteDag)) return { ok: false, fout: 'Kies een begin- en einddatum.' };
  if (laatsteDag < startDag) return { ok: false, fout: 'De einddatum ligt vóór de begindatum.' };
  if (startDag < amsterdamYmd(nu)) return { ok: false, fout: 'Een actie kan niet in het verleden beginnen.' };
  const prijsLeads = geheel(invoer.prijsLeads, 1, 1000);
  const leadsPerLot = geheel(invoer.leadsPerLot, 1, 1000);
  const bulkPerLot = geheel(invoer.bulkPerLot, 1, 10000);
  if (!prijsLeads) return { ok: false, fout: 'Het aantal gratis leads moet een heel getal van 1 tot 1000 zijn.' };
  if (!leadsPerLot) return { ok: false, fout: 'Leads per lot moet een heel getal van 1 tot 1000 zijn.' };
  if (!bulkPerLot) return { ok: false, fout: 'Bulkleads per lot moet een heel getal van 1 tot 10.000 zijn.' };

  const start = amsterdamWallTimeToUtc(startDag, '00:00').toISOString();
  const eind = amsterdamWallTimeToUtc(addCivilDays(laatsteDag, 1), '00:00').toISOString();
  const botsing = bestaande.find(b => Date.parse(start) < Date.parse(b.eind) && Date.parse(b.start) < Date.parse(eind));
  if (botsing) {
    const l = actieLabels(botsing);
    return { ok: false, fout: `Deze periode overlapt met "${botsing.naam}" (${l.startLabel} t/m ${l.eindLabel}). Acties mogen niet overlappen.` };
  }
  const code = bestaande.some(b => b.code === `actie-${startDag}`) ? `actie-${startDag}-${Date.now().toString(36)}` : `actie-${startDag}`;
  return { ok: true, actie: { code, naam, start, eind, prijsLeads, leadsPerLot, bulkPerLot } };
}
