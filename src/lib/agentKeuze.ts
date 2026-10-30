import { agentDektLocatie, leesGebieden, type AgentRegels, type Locatie } from './agentGebied';
import { haversineKm } from './portalDistanceOrigin';

/**
 * Welke medewerker van een klant krijgt een binnengekomen lead? Puur en te testen.
 *
 * Afspraak (30 okt 2026): een lead wordt altijd verdeeld zodra de klant
 * medewerkers op automatisch heeft. Aanleiding: bij Smart Sales Company was
 * het leveringsgebied groter dan de werkgebieden van het team samen, en 35
 * leads bleven op "Niet toegewezen" staan.
 *
 * 1. Medewerkers wiens werkgebied de lead dekt, onder hun limiet: eerlijk
 *    verdeeld (gewogen round-robin), zoals altijd.
 * 2. Dekt niemand de lead: naar wie het dichtst bij werkt (afstand tot de
 *    rand van zijn dichtstbijzijnde cirkel). Bij een gelijke afstand, zoals
 *    twee mensen met hetzelfde gebied, eerlijk verdeeld tussen hen.
 * 3. Zonder bruikbare afstand (lead zonder coördinaten, of alleen provincies
 *    ingesteld): eerlijk verdeeld over alle medewerkers op automatisch.
 *
 * Limieten per dag en week tellen eerst mee. Zit iedereen eraan, dan krijgt
 * de best passende medewerker de lead toch: liever iets boven de limiet dan
 * een lead die niemand belt. Branches tellen mee zolang er iemand voor die
 * branche is; anders gaat de lead naar het hele automatische team.
 * Medewerkers op handmatig krijgen nooit automatisch een lead.
 */

export interface ToewijsRegels extends AgentRegels {
  max_leads_per_day?: number;
  max_leads_per_week?: number;
  round_robin_weight?: number;
}

export interface Medewerker {
  id: string;
  regels: ToewijsRegels | null;
}

export interface Tellingen {
  dag: Record<string, number>;
  week: Record<string, number>;
}

export type Keuze = {
  id: string;
  reden: 'werkgebied' | 'dichtstbij' | 'verdeeld';
  /** De medewerker zat al aan zijn limiet, maar niemand anders kon. */
  bovenLimiet: boolean;
  /** Afstand tot het werkgebied in km (alleen bij "dichtstbij"). */
  afstandKm?: number;
};

/** Twee medewerkers binnen deze marge gelden als even dichtbij. */
const GELIJK_KM = 1;

function isAutomatisch(r: ToewijsRegels | null): boolean {
  return !!r?.mode && r.mode !== 'manual';
}

/** Afstand van de lead tot de rand van het dichtstbijzijnde gebied (0 = erbinnen); null als onbekend. */
export function afstandTotWerkgebied(regels: ToewijsRegels | null, locatie: Locatie): number | null {
  if (locatie.lat == null || locatie.lng == null) return null;
  const gebieden = leesGebieden(regels);
  if (gebieden.length === 0) return null;
  return Math.min(...gebieden.map(g => Math.max(0, haversineKm(locatie.lat!, locatie.lng!, g.lat, g.lng) - g.radius_km)));
}

function onderLimiet(m: Medewerker, t: Tellingen): boolean {
  const r = m.regels || {};
  if (r.max_leads_per_day && (t.dag[m.id] || 0) >= r.max_leads_per_day) return false;
  if (r.max_leads_per_week && (t.week[m.id] || 0) >= r.max_leads_per_week) return false;
  return true;
}

/** Gewogen round-robin: wie (relatief aan zijn gewicht) deze week het minst kreeg. Bij gelijkstand vaste volgorde op id. */
function eerlijk(lijst: Medewerker[], t: Tellingen): Medewerker {
  return [...lijst].sort((a, b) => {
    const sa = (t.week[a.id] || 0) / (a.regels?.round_robin_weight || 1);
    const sb = (t.week[b.id] || 0) / (b.regels?.round_robin_weight || 1);
    return sa - sb || a.id.localeCompare(b.id);
  })[0];
}

/** Eerst wie onder de limiet zit; zit iedereen eraan, dan toch de hele groep. */
function metLimiet(lijst: Medewerker[], t: Tellingen): { groep: Medewerker[]; bovenLimiet: boolean } {
  const onder = lijst.filter(m => onderLimiet(m, t));
  return onder.length > 0 ? { groep: onder, bovenLimiet: false } : { groep: lijst, bovenLimiet: true };
}

export function kiesMedewerker(
  medewerkers: Medewerker[],
  lead: Locatie & { branch?: string | null },
  tellingen: Tellingen,
): Keuze | null {
  const auto = medewerkers.filter(m => isAutomatisch(m.regels));
  if (auto.length === 0) return null;

  /* Branche: wie erop staat (of op alle branches); niemand, dan het hele team. */
  const metBranche = auto.filter(m => {
    const b = m.regels?.branches;
    return m.regels?.mode === 'all' || !b || b.length === 0 || (!!lead.branch && b.includes(lead.branch));
  });
  const team = metBranche.length > 0 ? metBranche : auto;

  /* 1. Werkgebied dekt de lead. */
  const dekkend = team.filter(m => m.regels?.mode === 'all' || agentDektLocatie(m.regels, lead));
  const dekkendOnder = dekkend.filter(m => onderLimiet(m, tellingen));
  if (dekkendOnder.length > 0) {
    return { id: eerlijk(dekkendOnder, tellingen).id, reden: 'werkgebied', bovenLimiet: false };
  }

  /* 2. Niemand dekt hem (of iedereen die hem dekt zit vol): wie het dichtst bij werkt. */
  const { groep, bovenLimiet } = metLimiet(team, tellingen);
  const afstanden = groep
    .map(m => ({ m, km: afstandTotWerkgebied(m.regels, lead) }))
    .filter((x): x is { m: Medewerker; km: number } => x.km !== null);
  if (afstanden.length > 0) {
    const kortst = Math.min(...afstanden.map(x => x.km));
    const dichtstbij = afstanden.filter(x => x.km <= kortst + GELIJK_KM).map(x => x.m);
    return { id: eerlijk(dichtstbij, tellingen).id, reden: 'dichtstbij', bovenLimiet, afstandKm: Math.round(kortst * 10) / 10 };
  }

  /* 3. Geen afstand te bepalen: eerlijk over het team. */
  return { id: eerlijk(groep, tellingen).id, reden: 'verdeeld', bovenLimiet };
}
