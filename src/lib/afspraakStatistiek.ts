
/**
 * Conversiecijfers over afspraken.
 *
 * Pas zinvol sinds het afboeken bestaat: daarvoor stond alles op 'ingepland' en
 * viel er niets te meten. Alles wordt uit de afspraken zelf gerekend, zodat er
 * geen tweede telling kan ontstaan die met het scherm uit de pas loopt.
 */

export interface StatistiekAfspraak {
  status: string;
  outcome?: string | null;
  outcome_reason?: string | null;
  deal_value?: number | null;
  branch?: string | null;
  portal_user_id?: string | null;
  starts_at: string;
}

export interface AfspraakStatistiek {
  totaal: number;
  ingepland: number;
  bezocht: number;
  nietVerschenen: number;
  geannuleerd: number;
  verzet: number;
  deals: number;
  geenDeal: number;
  vervolg: number;
  omzet: number;
  gemiddeldeDeal: number;
  /** Van de bezochte afspraken: welk deel werd een deal. */
  conversiePct: number;
  /** Van de afspraken die hadden moeten plaatsvinden: welk deel werd een no-show. */
  noShowPct: number;
  /** Nog niet afgeboekt terwijl de tijd verstreken is. */
  openstaand: number;
}

export function berekenStatistiek(
  afspraken: StatistiekAfspraak[],
  nu: Date = new Date(),
): AfspraakStatistiek {
  const leeg: AfspraakStatistiek = {
    totaal: 0, ingepland: 0, bezocht: 0, nietVerschenen: 0, geannuleerd: 0, verzet: 0,
    deals: 0, geenDeal: 0, vervolg: 0, omzet: 0, gemiddeldeDeal: 0,
    conversiePct: 0, noShowPct: 0, openstaand: 0,
  };

  const s = { ...leeg, totaal: afspraken.length };

  for (const a of afspraken) {
    switch (a.status) {
      case 'scheduled':
        s.ingepland += 1;
        if (new Date(a.starts_at).getTime() < nu.getTime()) s.openstaand += 1;
        break;
      case 'completed': s.bezocht += 1; break;
      case 'no_show': s.nietVerschenen += 1; break;
      case 'cancelled': s.geannuleerd += 1; break;
      case 'rescheduled': s.verzet += 1; break;
    }

    if (a.status !== 'completed') continue;
    if (a.outcome === 'deal') {
      s.deals += 1;
      if (a.deal_value != null) s.omzet += Number(a.deal_value) || 0;
    } else if (a.outcome === 'no_deal') {
      s.geenDeal += 1;
    } else if (a.outcome === 'follow_up') {
      s.vervolg += 1;
    }
  }

  s.omzet = Math.round(s.omzet * 100) / 100;
  /* Gemiddeld over de deals mét bedrag: deals zonder bedrag meetellen zou het
     gemiddelde kunstmatig omlaag trekken. */
  const dealsMetBedrag = afspraken.filter(
    a => a.status === 'completed' && a.outcome === 'deal' && a.deal_value != null,
  ).length;
  s.gemiddeldeDeal = dealsMetBedrag > 0 ? Math.round((s.omzet / dealsMetBedrag) * 100) / 100 : 0;

  s.conversiePct = s.bezocht > 0 ? Math.round((s.deals / s.bezocht) * 1000) / 10 : 0;

  /* Noemer: afspraken waar iemand had moeten zijn. Een geannuleerde afspraak
     telt niet mee, want die is vooraf afgezegd en is geen no-show. */
  const zouPlaatsvinden = s.bezocht + s.nietVerschenen;
  s.noShowPct = zouPlaatsvinden > 0 ? Math.round((s.nietVerschenen / zouPlaatsvinden) * 1000) / 10 : 0;

  return s;
}

/** Dezelfde cijfers, maar opgesplitst per sleutel (branche of adviseur). */
export function berekenPerSleutel<K extends keyof StatistiekAfspraak>(
  afspraken: StatistiekAfspraak[],
  sleutel: K,
  nu: Date = new Date(),
): { waarde: string; stat: AfspraakStatistiek }[] {
  const groepen = new Map<string, StatistiekAfspraak[]>();
  for (const a of afspraken) {
    const k = (a[sleutel] as string | null | undefined) ?? '(onbekend)';
    const lijst = groepen.get(k) || [];
    lijst.push(a);
    groepen.set(k, lijst);
  }
  return [...groepen.entries()]
    .map(([waarde, lijst]) => ({ waarde, stat: berekenStatistiek(lijst, nu) }))
    .sort((a, b) => b.stat.totaal - a.stat.totaal);
}

/** Meest genoemde redenen waarom het geen deal werd. */
export function topRedenen(
  afspraken: StatistiekAfspraak[],
  max = 5,
): { reden: string; aantal: number }[] {
  const tel = new Map<string, number>();
  for (const a of afspraken) {
    if (a.status !== 'completed' || a.outcome !== 'no_deal' || !a.outcome_reason) continue;
    tel.set(a.outcome_reason, (tel.get(a.outcome_reason) ?? 0) + 1);
  }
  return [...tel.entries()]
    .map(([reden, aantal]) => ({ reden, aantal }))
    .sort((a, b) => b.aantal - a.aantal)
    .slice(0, max);
}
