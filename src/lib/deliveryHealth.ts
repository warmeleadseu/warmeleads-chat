import { isPipelineBatchOpenForInbound } from './distribution';

/** Zichtbaar in admin: duidelijke labels, geen intern jargon. */
export type LeveringBadge = 'goed' | 'let_op' | 'actie';

export interface BatchLeveringDag {
  datum: string;
  /** Korte leesbare datum, bv. "ma 12 mei" */
  label: string;
  aantal: number;
}

export interface BatchLeveringRij {
  batch_id: string;
  customer_id: string;
  customer_name: string;
  branch: string;
  branch_label: string;
  leads_per_day: number;
  leads_delivered: number;
  batch_size: number;
  dagen: BatchLeveringDag[];
  badge: LeveringBadge;
  kop: string;
  uitleg: string;
  tips: string[];
}

const LAAG_TEN_OPZICHTE_VAN_CAP = 0.65;
/** Minimaal zoveel kalenderdagen na aanmaak voordat we onder-cap signalen tonen (Amsterdam-datum). */
const MIN_DAGEN_NA_AANMAAK = 4;

function amsterdamYmd(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
}

function kalenderdagenSindsAanmaakAmsterdam(createdAtIso: string): number {
  const start = amsterdamYmd(createdAtIso);
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = vandaag.split('-').map(Number);
  const t0 = Date.UTC(y1, m1 - 1, d1);
  const t1 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((t1 - t0) / 86400000));
}

/** FIFO per klant én branche: alleen de “kop”-batch krijgt nieuwe leads uit de pijplijn. */
export function fifoHeadBatchIdsVoorLevering<
  T extends {
    id: string;
    customer_id: string;
    branch: string;
    created_at: string;
    leads_delivered: number | null;
    batch_size: number;
    starts_at?: string | null;
  },
>(batches: T[], now: Date = new Date()): Set<string> {
  const byKey = new Map<string, T[]>();
  for (const b of batches) {
    const key = `${b.customer_id}|${b.branch}`;
    const list = byKey.get(key);
    if (list) list.push(b);
    else byKey.set(key, [b]);
  }
  const keep = new Set<string>();
  for (const list of byKey.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const head = list.find(x => isPipelineBatchOpenForInbound(x, now));
    if (head) keep.add(head.id);
  }
  return keep;
}

function dagLabelNl(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function standaardTipsActie(): string[] {
  return [
    'Controleer of er genoeg verse leads binnenkomen voor deze branche (Meta en andere kanalen).',
    'Bekijk op de kaart of de targets van deze klant niet te smal staan ten opzichte van waar de leads vandaan komen.',
    'Meerdere klanten tegelijk in dezelfde regio: dan verdelen we eerlijk; dat kan je dagelijkse telling beïnvloeden.',
  ];
}

function standaardTipsLetOp(): string[] {
  return [
    'Houd deze batch even in de gaten. Als het patroon aanhoudt, zelfde checklist als bij “actie nodig”.',
  ];
}

export function beoordeelBatchLevering(input: {
  batch: {
    id: string;
    customer_id: string;
    branch: string;
    created_at: string;
    leads_per_day: number | null;
    leads_delivered: number | null;
    batch_size: number;
    starts_at?: string | null;
  };
  customerName: string;
  branchLabel: string;
  /** Laatste N voltooide kalenderdagen (Amsterdam), oudste eerst, bv. 3 dagen vóór vandaag. */
  dagenYmd: string[];
  countsByDay: Map<string, number>;
}): BatchLeveringRij {
  const cap = Math.max(0, Math.floor(Number(input.batch.leads_per_day ?? 0)));
  const geleverd = Number(input.batch.leads_delivered ?? 0);
  const totaal = Number(input.batch.batch_size ?? 0);
  const rest = Math.max(0, totaal - geleverd);

  const dagen: BatchLeveringDag[] = input.dagenYmd.map(d => ({
    datum: d,
    label: dagLabelNl(d),
    aantal: input.countsByDay.get(d) ?? 0,
  }));

  const basisZonderDagen: Omit<BatchLeveringRij, 'dagen' | 'badge' | 'kop' | 'uitleg' | 'tips'> = {
    batch_id: input.batch.id,
    customer_id: input.batch.customer_id,
    customer_name: input.customerName,
    branch: input.batch.branch,
    branch_label: input.branchLabel,
    leads_per_day: cap,
    leads_delivered: geleverd,
    batch_size: totaal,
  };

  if (input.dagenYmd.length === 0) {
    return {
      ...basisZonderDagen,
      dagen: [],
      badge: 'goed',
      kop: 'Nog geen meetperiode',
      uitleg:
        'De referentiedagen konden niet worden geladen. Controleer of database-migratie 103 is toegepast en tik op “Statistiek nu verversen”.',
      tips: [],
    };
  }

  const basis: Omit<BatchLeveringRij, 'badge' | 'kop' | 'uitleg' | 'tips'> = {
    ...basisZonderDagen,
    dagen,
  };

  if (rest <= 0) {
    return {
      ...basis,
      badge: 'goed',
      kop: 'Batch is vol',
      uitleg: 'Deze batch heeft zijn bestelde aantal leads bereikt. Er is geen dagelijkse levering meer nodig.',
      tips: [],
    };
  }

  if (cap <= 0) {
    return {
      ...basis,
      badge: 'goed',
      kop: 'Geen maximum per dag',
      uitleg: 'Er is geen daglimiet ingesteld; we verdelen zoveel als de pijplijn en regels toelaten.',
      tips: [],
    };
  }

  const leeftijdDagen = kalenderdagenSindsAanmaakAmsterdam(input.batch.created_at);
  const inOpstart = leeftijdDagen < MIN_DAGEN_NA_AANMAAK;

  const drempel = cap * LAAG_TEN_OPZICHTE_VAN_CAP;
  const lageDagen = dagen.filter(d => d.aantal < drempel);
  const laagAantal = lageDagen.length;

  const voorbeeld = dagen.map(d => `${d.label}: ${d.aantal}`).join(' · ');
  const basisUitleg = `Afgesproken maximum per dag: ${cap} leads (Nederlandse kalenderdag). Recent gemeten: ${voorbeeld}.`;

  const opstartVoorvoegsel = (badge: LeveringBadge): string => {
    if (!inOpstart) return '';
    if (badge === 'goed') {
      return 'Deze batch bestaat nog maar korte tijd; de eerste dagen kunnen nog bijtrekken. ';
    }
    return 'Deze batch bestaat nog maar korte tijd; op basis van de meetdagen hieronder wijkt de levering nu al af van het afgesproken maximum. ';
  };

  if (laagAantal >= 3) {
    return {
      ...basis,
      badge: 'actie',
      kop: inOpstart ? 'Nog opstartfase · levering achter' : 'Duidelijk minder leads per dag dan afgesproken',
      uitleg: `${opstartVoorvoegsel('actie')}${basisUitleg} Op de laatste drie dagen zat je telkens ruim onder dat maximum, terwijl deze batch nog ruimte heeft voor meer leads.`,
      tips: standaardTipsActie(),
    };
  }

  if (laagAantal >= 2) {
    return {
      ...basis,
      badge: 'let_op',
      kop: inOpstart ? 'Nog opstartfase · houd in de gaten' : 'Iets minder leads per dag dan afgesproken',
      uitleg: `${opstartVoorvoegsel('let_op')}${basisUitleg} Op meerdere recente dagen ligt de telling merkbaar onder het afgesproken maximum.`,
      tips: standaardTipsLetOp(),
    };
  }

  return {
    ...basis,
    badge: 'goed',
    kop: inOpstart ? 'Nog opstartfase' : 'Levering op schema',
    uitleg: `${opstartVoorvoegsel('goed')}${basisUitleg}${
      inOpstart
        ? 'Als de telling de komende dagen rond het maximum blijft hangen, zit je goed. Zakt het structureel lager, dan wordt dat hier zichtbaar.'
        : ' De laatste dagen sluiten aan bij wat je mag verwachten bij dit maximum (rekening houdend met normale schommelingen).'
    }`,
    tips: [],
  };
}
