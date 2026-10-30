/**
 * Standaard bonusstaffels voor accountmanagers (30 okt 2026), puur en te testen.
 *
 * Een staffel is een rij treden ("bij €12.500 omzet €500 bonus, bij €17.500
 * €750, ..."). Elke maand worden de treden als gewone targets aangemaakt,
 * zodat voortgang en de viering bij het halen van een trede werken zoals bij
 * elke target. Uitbetaald wordt alleen de bonus van de hoogste gehaalde trede.
 *
 * De staffels staan in app_settings onder STAFFEL_SLEUTEL; de aangemaakte
 * targets zijn herkenbaar aan STAFFEL_NOTITIE, zodat het dashboard ze als één
 * staffel kan tonen.
 */

export const STAFFEL_SLEUTEL = 'am_target_staffels';
export const STAFFEL_NOTITIE = 'Staffel: alleen de bonus van de hoogste gehaalde trede wordt uitbetaald.';

export type Trede = { waarde: number; bonus: number };

export type StaffelInstelling = {
  admin_user_id: string;
  /** Alleen omzet wordt nu gebruikt; het veld houdt andere soorten open. */
  target_type: 'revenue' | 'batches' | 'new_customers' | 'leads_delivered';
  treden: Trede[];
  /** Eerste maand (YYYY-MM) waarvoor de staffel geldt. */
  vanaf: string;
};

const MAAND = /^\d{4}-(0[1-9]|1[0-2])$/;
const SOORTEN = new Set(['revenue', 'batches', 'new_customers', 'leads_delivered']);

/** Leest en controleert de opgeslagen staffels; ongeldige regels vallen weg. */
export function leesStaffels(ruw: string | null | undefined): StaffelInstelling[] {
  if (!ruw) return [];
  let data: unknown;
  try { data = JSON.parse(ruw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  return data.flatMap(x => {
    const s = x as Partial<StaffelInstelling>;
    if (typeof s.admin_user_id !== 'string' || !s.admin_user_id) return [];
    if (!s.target_type || !SOORTEN.has(s.target_type)) return [];
    if (typeof s.vanaf !== 'string' || !MAAND.test(s.vanaf)) return [];
    const treden = (Array.isArray(s.treden) ? s.treden : [])
      .map(t => ({ waarde: Number(t?.waarde), bonus: Number(t?.bonus) }))
      .filter(t => Number.isFinite(t.waarde) && t.waarde > 0 && Number.isFinite(t.bonus) && t.bonus >= 0)
      .sort((a, b) => a.waarde - b.waarde);
    if (treden.length === 0) return [];
    return [{ admin_user_id: s.admin_user_id, target_type: s.target_type, treden, vanaf: s.vanaf }];
  });
}

const SOORT_LABEL: Record<StaffelInstelling['target_type'], string> = {
  revenue: 'Omzet', batches: 'Batches', new_customers: 'Klanten', leads_delivered: 'Leads',
};

function laatsteDag(maand: string): string {
  const [j, m] = maand.split('-').map(Number);
  const d = new Date(Date.UTC(j, m, 0)).getUTCDate();
  return `${maand}-${String(d).padStart(2, '0')}`;
}

function maandNaam(maand: string): string {
  const [j, m] = maand.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, 15)).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export type NieuweTarget = {
  admin_user_id: string; label: string; target_type: string; target_value: number; bonus_amount: number;
  period_start: string; period_end: string; notes: string; status: 'active';
};

/** De targets die een staffel in een maand oplevert; leeg vóór de startmaand. */
export function maandTargets(s: StaffelInstelling, maand: string): NieuweTarget[] {
  if (!MAAND.test(maand) || maand < s.vanaf) return [];
  return s.treden.map((t, i) => ({
    admin_user_id: s.admin_user_id,
    label: `${SOORT_LABEL[s.target_type]} ${maandNaam(maand)} · trede ${i + 1}/${s.treden.length}`,
    target_type: s.target_type,
    target_value: t.waarde,
    bonus_amount: t.bonus,
    period_start: `${maand}-01`,
    period_end: laatsteDag(maand),
    notes: STAFFEL_NOTITIE,
    status: 'active',
  }));
}

/** Welke treden ontbreken nog (op waarde), zodat de ronde nooit dubbel aanmaakt. */
export function ontbrekend(
  gewenst: NieuweTarget[],
  bestaand: { admin_user_id: string; target_type: string; target_value: number | string; period_start: string }[],
): NieuweTarget[] {
  const sleutel = (t: { admin_user_id: string; target_type: string; target_value: number | string; period_start: string }) =>
    `${t.admin_user_id}|${t.target_type}|${Number(t.target_value)}|${t.period_start}`;
  const er = new Set(bestaand.map(sleutel));
  return gewenst.filter(t => !er.has(sleutel(t)));
}

/* ── Weergave ── */

export type StaffelTarget = {
  id: string; admin_user_id: string; am_name: string; target_type: string; target_value: number; bonus_amount: number;
  current_value: number; period_start: string; period_end: string; notes?: string | null;
};

export type StaffelWeergave = {
  soort: 'staffel';
  sleutel: string;
  am_name: string;
  target_type: string;
  period_end: string;
  huidig: number;
  treden: { waarde: number; bonus: number; gehaald: boolean }[];
  /** Bonus van de hoogste gehaalde trede (0 als er nog geen is). */
  bonus: number;
  volgende: { waarde: number; bonus: number; nog: number } | null;
};

/**
 * Groepeert staffeltargets (zelfde medewerker, soort en periode, met de
 * staffelnotitie) tot één regel; andere targets blijven los.
 */
export function groepeerStaffels<T extends StaffelTarget>(targets: T[]): (StaffelWeergave | { soort: 'los'; target: T })[] {
  const groepen = new Map<string, T[]>();
  const uit: (StaffelWeergave | { soort: 'los'; target: T })[] = [];
  for (const t of targets) {
    if (t.notes !== STAFFEL_NOTITIE) { uit.push({ soort: 'los', target: t }); continue; }
    const k = `${t.admin_user_id}|${t.target_type}|${t.period_start}|${t.period_end}`;
    groepen.set(k, [...(groepen.get(k) ?? []), t]);
  }
  for (const [k, lijst] of groepen) {
    const gesorteerd = [...lijst].sort((a, b) => Number(a.target_value) - Number(b.target_value));
    const huidig = Math.max(...gesorteerd.map(t => Number(t.current_value) || 0));
    const treden = gesorteerd.map(t => ({ waarde: Number(t.target_value), bonus: Number(t.bonus_amount) || 0, gehaald: huidig >= Number(t.target_value) }));
    const gehaald = treden.filter(t => t.gehaald);
    const volgende = treden.find(t => !t.gehaald);
    uit.push({
      soort: 'staffel',
      sleutel: k,
      am_name: gesorteerd[0].am_name,
      target_type: gesorteerd[0].target_type,
      period_end: gesorteerd[0].period_end,
      huidig,
      treden,
      bonus: gehaald.length > 0 ? gehaald[gehaald.length - 1].bonus : 0,
      volgende: volgende ? { waarde: volgende.waarde, bonus: volgende.bonus, nog: Math.max(0, volgende.waarde - huidig) } : null,
    });
  }
  return uit;
}
