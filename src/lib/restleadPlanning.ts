/**
 * Het spreiden van restlead-leveringen over de tijd.
 *
 * De gewone verdeling houdt 12 uur aan tussen de eerste en de tweede klant van
 * dezelfde lead, zodat een consument niet binnen een uur door drie bedrijven
 * wordt gebeld. In Restleads werd alles ineens uitgedeeld, waardoor precies dat
 * wél gebeurde.
 *
 * Alle kloktijden hier zijn Nederlandse tijd. De server draait op UTC, dus
 * `getHours()` en `setHours()` rekenen er twee uur (in de winter één) naast:
 * "08:00" in de code werd 10:00 bij de klant, en "20:00" werd 22:00.
 */

export const COOLDOWN_UREN = 12;

/** Buiten deze uren (Nederlandse tijd) leveren we niet: dan gaat er toch niemand achteraan. */
export const VROEGSTE_UUR = 9;
export const LAATSTE_UUR = 17;

const TIJDZONE = 'Europe/Amsterdam';

const onderdelen = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIJDZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface KlokDelen { jaar: number; maand: number; dag: number; uur: number; minuut: number }

/** Datum en kloktijd van een moment zoals het in Nederland op de klok staat. */
export function nlKlok(d: Date): KlokDelen {
  const p: Record<string, number> = {};
  for (const deel of onderdelen.formatToParts(d)) {
    if (deel.type !== 'literal') p[deel.type] = Number(deel.value);
  }
  return { jaar: p.year, maand: p.month, dag: p.day, uur: p.hour, minuut: p.minute };
}

/** Minuten dat de Nederlandse klok op dit moment voorloopt op UTC. */
function nlVoorsprongMinuten(d: Date): number {
  const k = nlKlok(d);
  const alsUtc = Date.UTC(k.jaar, k.maand - 1, k.dag, k.uur, k.minuut);
  return Math.round((alsUtc - Math.floor(d.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * Het moment waarop het in Nederland de gegeven datum en tijd is.
 * Een dag voorbij het einde van de maand mag: Date.UTC rolt dat netjes door.
 */
export function nlMoment(jaar: number, maand: number, dag: number, uur: number, minuut = 0): Date {
  const gok = Date.UTC(jaar, maand - 1, dag, uur, minuut);
  let t = gok - nlVoorsprongMinuten(new Date(gok)) * 60_000;
  /* Rond de wisseling van zomer- naar wintertijd kan de eerste gok aan de
     verkeerde kant vallen; één correctie is dan genoeg. */
  const tweede = gok - nlVoorsprongMinuten(new Date(t)) * 60_000;
  if (tweede !== t) t = tweede;
  return new Date(t);
}

/** Begin van het leververvenster op de Nederlandse dag van `d`, eventueel een aantal dagen later. */
function vensterBegin(d: Date, dagenLater = 0): Date {
  const k = nlKlok(d);
  return nlMoment(k.jaar, k.maand, k.dag + dagenLater, VROEGSTE_UUR);
}

function vensterEinde(d: Date): Date {
  const k = nlKlok(d);
  return nlMoment(k.jaar, k.maand, k.dag, LAATSTE_UUR);
}

export interface PlanInvoer {
  /** Wanneer deze lead voor het laatst aan een klant is gegeven. */
  laatsteToewijzing: Date | null;
  /** Aantal klanten dat nu geleverd moet worden, op volgorde. */
  aantal: number;
  nu?: Date;
  /** Maximaal aantal leads per dag voor deze klant. Nul of leeg = geen plafond. */
  dagplafond?: number | null;
  /** Wat er per dag al bij deze klant staat, geleverd en gepland, als {jjjj-mm-dd: aantal}. */
  alGepland?: Record<string, number>;
}

/**
 * Verschuift een moment naar de eerstvolgende werkbare tijd.
 *
 * Valt het buiten werktijd, dan naar 09:00 diezelfde of de volgende ochtend. Een
 * lead die om 03:00 binnenkomt wordt toch pas 's ochtends gebeld, en het oogt
 * slordig richting de klant.
 */
export function naarWerkbaarMoment(moment: Date): Date {
  const uur = nlKlok(moment).uur;
  if (uur < VROEGSTE_UUR) return vensterBegin(moment);
  if (uur >= LAATSTE_UUR) return vensterBegin(moment, 1);
  return new Date(moment);
}

/**
 * De momenten waarop de gekozen klanten geleverd worden.
 *
 * De eerste mag meteen zodra de cooldown sinds de vorige toewijzing verstreken
 * is. Kreeg de lead drie dagen geleden al een klant, dan is die twaalf uur
 * allang voorbij en hoeft er niet opnieuw gewacht te worden; alleen tussen de
 * nieuwe onderling.
 *
 * Dit bepaalt de dag en het vroegst toegestane moment. Het uitsmeren over de
 * dag gebeurt daarna in `herverdeel`, omdat dat pas kan als bekend is hoeveel
 * leveringen er die dag bij de klant samenkomen.
 */
export function planMomenten(invoer: PlanInvoer): Date[] {
  const nu = invoer.nu ?? new Date();
  const momenten: Date[] = [];

  /* Wat er die dag al bij de klant terechtkomt, geleverd én gepland. Zonder
     dat laatste plan je over je eigen planning heen en zit de klant alsnog
     boven zijn dagplafond. */
  const perDag = new Map<string, number>(
    Object.entries(invoer.alGepland ?? {}),
  );
  const plafond = invoer.dagplafond ?? 0;

  let vorige = invoer.laatsteToewijzing;

  for (let i = 0; i < invoer.aantal; i++) {
    let moment: Date;
    if (!vorige) {
      moment = new Date(nu);
    } else {
      const vroegst = new Date(vorige.getTime() + COOLDOWN_UREN * 3600_000);
      moment = vroegst.getTime() > nu.getTime() ? vroegst : new Date(nu);
    }

    let werkbaar = naarWerkbaarMoment(moment);

    /* Zit de klant die dag al aan zijn plafond, dan schuift de levering naar de
       eerstvolgende ochtend met ruimte. De grens van 60 dagen voorkomt dat een
       verkeerd plafond (bijvoorbeeld nul) tot een oneindige lus leidt. */
    if (plafond > 0) {
      for (let dag = 0; dag < 60; dag++) {
        if ((perDag.get(dagSleutel(werkbaar)) ?? 0) < plafond) break;
        werkbaar = vensterBegin(werkbaar, 1);
      }
    }

    const sleutel = dagSleutel(werkbaar);
    perDag.set(sleutel, (perDag.get(sleutel) ?? 0) + 1);

    momenten.push(werkbaar);
    vorige = werkbaar;
  }

  return momenten;
}

export interface WachtrijItem {
  id: string;
  customer_id: string;
  /** Het moment waarop de levering nu gepland staat. */
  gepland: Date;
  /** Eerder dan dit mag niet, vanwege de cooldown sinds de vorige klant. */
  vroegst: Date;
}

/** Hoe dicht bij nu we een levering nog mogen neerzetten; de cron draait per kwartier. */
const MARGE_NU_MINUTEN = 5;

/** Vast, klein verloop per rij zodat niet alles op ronde tijden staat. */
function variatieMinuten(id: string, maxMinuten: number): number {
  if (maxMinuten < 1) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const bereik = Math.floor(maxMinuten);
  return (h % (2 * bereik + 1)) - bereik;
}

/**
 * Verdeelt geplande leveringen per klant en per dag gelijkmatig over het
 * venster van 09:00 tot 17:00.
 *
 * Elf leads voor één klant op één dag landen zo ongeveer elke drie kwartier in
 * plaats van allemaal om 09:00. De dag verandert niet (behalve als een tijd
 * buiten werktijd viel), zodat het dagplafond blijft kloppen. Een levering komt
 * nooit vóór zijn `vroegst`; dat bewaakt de twaalf uur tussen twee klanten.
 *
 * Geeft alleen de rijen terug waarvan het moment verandert.
 */
export function herverdeel(items: WachtrijItem[], nu: Date = new Date()): Map<string, Date> {
  const ondergrens = new Date(nu.getTime() + MARGE_NU_MINUTEN * 60_000);

  /* De huidige planning bepaalt alleen de dag (en daarmee het dagplafond). De
     tijd op die dag mag vrij schuiven, maar nooit vóór de cooldown of vóór nu. */
  const basis = items.map(item => {
    const grens = Math.max(item.vroegst.getTime(), ondergrens.getTime());
    return {
      item,
      grens,
      basis: naarWerkbaarMoment(new Date(Math.max(item.gepland.getTime(), grens))),
    };
  });

  const groepen = new Map<string, typeof basis>();
  for (const b of basis) {
    const sleutel = `${b.item.customer_id}|${dagSleutel(b.basis)}`;
    const lijst = groepen.get(sleutel) ?? [];
    lijst.push(b);
    groepen.set(sleutel, lijst);
  }

  const uit = new Map<string, Date>();

  for (const groep of groepen.values()) {
    const begin = new Date(Math.max(vensterBegin(groep[0].basis).getTime(), ondergrens.getTime()));
    const einde = vensterEinde(groep[0].basis);
    const beschikbaar = (einde.getTime() - begin.getTime()) / 60_000;

    let tijden: { id: string; moment: Date; oud: Date }[];

    if (groep.length === 1 || beschikbaar <= 0) {
      /* Eén levering, of een dag die al voorbij is: niets om tegen uit te
         smeren, alleen de werktijden bewaken. */
      tijden = groep.map(g => ({ id: g.item.id, moment: g.basis, oud: g.item.gepland }));
    } else {
      /* Wie het vroegst mag, krijgt het vroegste plekje; zo schuift er niets
         onnodig achter zijn eigen cooldown aan. */
      const gesorteerd = [...groep].sort((a, b) =>
        a.item.vroegst.getTime() - b.item.vroegst.getTime() || a.item.id.localeCompare(b.item.id),
      );
      const stap = beschikbaar / gesorteerd.length;
      tijden = gesorteerd.map((g, i) => {
        const plek = begin.getTime()
          + (stap * (i + 0.5) + variatieMinuten(g.item.id, Math.min(7, stap / 4))) * 60_000;
        const moment = Math.max(plek, g.grens);
        return { id: g.item.id, moment: new Date(Math.round(moment / 60_000) * 60_000), oud: g.item.gepland };
      });
    }

    for (const t of tijden) {
      if (Math.abs(t.moment.getTime() - t.oud.getTime()) >= 60_000) uit.set(t.id, t.moment);
    }
  }

  return uit;
}

/** Datumsleutel (jjjj-mm-dd, Nederlandse dag) om leveringen per dag te tellen. */
export function dagSleutel(d: Date): string {
  const k = nlKlok(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.jaar}-${p(k.maand)}-${p(k.dag)}`;
}

/** Korte omschrijving van een gepland moment, voor in het scherm. */
export function beschrijfMoment(moment: Date, nu: Date = new Date()): string {
  const verschilMin = (moment.getTime() - nu.getTime()) / 60_000;
  if (verschilMin <= 2) return 'nu';

  const k = nlKlok(nu);
  const vandaag = dagSleutel(nu);
  const morgen = dagSleutel(nlMoment(k.jaar, k.maand, k.dag + 1, 12));
  const dag = dagSleutel(moment);

  const tijd = moment.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TIJDZONE });
  if (dag === vandaag) return `vandaag ${tijd}`;
  if (dag === morgen) return `morgen ${tijd}`;
  return `${moment.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TIJDZONE })} ${tijd}`;
}
