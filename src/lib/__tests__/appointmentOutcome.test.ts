import { describe, it, expect } from 'vitest';
import {
  bereidAfboekingVoor,
  mayTransition,
  telVerzettingen,
  wachtOpAfboeking,
  isAppointmentStatus,
  isAppointmentOutcome,
  APPOINTMENT_STATUSES,
  STATUS_LABELS,
  OUTCOME_LABELS,
  NO_DEAL_REASONS,
} from '../appointmentOutcome';

const NU = new Date('2026-09-22T12:00:00.000Z');

describe('bereidAfboekingVoor', () => {
  it('boekt een deal af met bedrag', () => {
    const r = bereidAfboekingVoor(
      { status: 'completed', outcome: 'deal', deal_value: 8750 },
      NU,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.velden.outcome).toBe('deal');
    expect(r.velden.deal_value).toBe(8750);
    expect(r.velden.outcome_at).toBe(NU.toISOString());
    expect(r.velden.completed_at).toBe(NU.toISOString());
  });

  it('accepteert een bedrag met komma als decimaalteken', () => {
    /* Nederlandse invoer: iemand typt 8750,50 in plaats van 8750.50. */
    const r = bereidAfboekingVoor({ status: 'completed', outcome: 'deal', deal_value: '8750,50' }, NU);
    expect(r.ok && r.velden.deal_value).toBe(8750.5);
  });

  it('rondt een bedrag af op centen', () => {
    const r = bereidAfboekingVoor({ status: 'completed', outcome: 'deal', deal_value: 99.999 }, NU);
    expect(r.ok && r.velden.deal_value).toBe(100);
  });

  it('weigert een negatief of onleesbaar bedrag', () => {
    expect(bereidAfboekingVoor({ status: 'completed', outcome: 'deal', deal_value: -1 }, NU))
      .toEqual({ ok: false, fout: 'Ongeldig dealbedrag' });
    expect(bereidAfboekingVoor({ status: 'completed', outcome: 'deal', deal_value: 'veel' }, NU))
      .toEqual({ ok: false, fout: 'Ongeldig dealbedrag' });
  });

  it('staat een deal zonder bedrag toe', () => {
    /* Niet elke adviseur weet het bedrag meteen; de deal zelf is het signaal. */
    const r = bereidAfboekingVoor({ status: 'completed', outcome: 'deal' }, NU);
    expect(r.ok).toBe(true);
    expect(r.ok && r.velden.deal_value).toBeNull();
  });

  it('eist een reden bij geen deal', () => {
    expect(bereidAfboekingVoor({ status: 'completed', outcome: 'no_deal' }, NU))
      .toEqual({ ok: false, fout: 'Geef een reden op waarom het geen deal werd' });
  });

  it('weigert een reden die niet in de lijst staat', () => {
    expect(bereidAfboekingVoor({ status: 'completed', outcome: 'no_deal', outcome_reason: 'zomaar' }, NU))
      .toEqual({ ok: false, fout: 'Onbekende reden' });
  });

  it('accepteert elke reden uit de lijst', () => {
    for (const reden of NO_DEAL_REASONS) {
      const r = bereidAfboekingVoor(
        { status: 'completed', outcome: 'no_deal', outcome_reason: reden.value },
        NU,
      );
      expect(r.ok, reden.value).toBe(true);
    }
  });

  it('wist het dealbedrag als de uitkomst geen deal meer is', () => {
    /* De kern: iemand boekt per ongeluk een deal af en zet hem daarna op niet
       verschenen. Bleef het bedrag staan, dan telde de omzet een verkoop mee
       die nooit heeft plaatsgevonden. */
    const r = bereidAfboekingVoor({ status: 'no_show', deal_value: 8750, outcome: 'deal' }, NU);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.velden.deal_value).toBeNull();
    expect(r.velden.outcome).toBeNull();
    expect(r.velden.outcome_at).toBeNull();
    expect(r.velden.completed_at).toBeNull();
  });

  it('wist de annuleergegevens bij terugzetten naar ingepland', () => {
    const r = bereidAfboekingVoor({ status: 'scheduled', cancelled_by: 'lead' }, NU);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.velden.cancelled_at).toBeNull();
    expect(r.velden.cancelled_by).toBeNull();
  });

  it('legt vast wie er afzegde', () => {
    const r = bereidAfboekingVoor({ status: 'cancelled', cancelled_by: 'lead' }, NU);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.velden.cancelled_by).toBe('lead');
    expect(r.velden.cancelled_at).toBe(NU.toISOString());
  });

  it('weigert een onbekende afzegger en een onbekende status', () => {
    expect(bereidAfboekingVoor({ status: 'cancelled', cancelled_by: 'buurman' }, NU).ok).toBe(false);
    expect(bereidAfboekingVoor({ status: 'onzin' as never }, NU))
      .toEqual({ ok: false, fout: 'Onbekende status' });
  });

  it('staat bezocht zonder uitkomst toe', () => {
    /* Afboeken in twee stappen: eerst "ik ben geweest", de uitkomst later. */
    const r = bereidAfboekingVoor({ status: 'completed' }, NU);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.velden.outcome).toBeNull();
    expect(r.velden.completed_at).toBe(NU.toISOString());
  });
});

describe('mayTransition', () => {
  it('laat afboeken vanuit ingepland toe', () => {
    expect(mayTransition('scheduled', 'completed')).toBe(true);
    expect(mayTransition('scheduled', 'no_show')).toBe(true);
    expect(mayTransition('scheduled', 'cancelled')).toBe(true);
  });

  it('laat een vergissing herstellen', () => {
    expect(mayTransition('completed', 'no_show')).toBe(true);
    expect(mayTransition('cancelled', 'scheduled')).toBe(true);
  });

  it('houdt een verzette afspraak dicht', () => {
    /* Anders staan er twee actieve afspraken voor dezelfde lead in de agenda:
       de heropende en zijn opvolger. */
    for (const naar of APPOINTMENT_STATUSES) {
      if (naar === 'rescheduled') continue;
      expect(mayTransition('rescheduled', naar), naar).toBe(false);
    }
  });

  it('staat dezelfde status altijd toe', () => {
    for (const s of APPOINTMENT_STATUSES) expect(mayTransition(s, s)).toBe(true);
  });
});

describe('telVerzettingen', () => {
  it('telt een keten van drie verzettingen', () => {
    const keten = new Map<string, string | null>([
      ['d', 'c'], ['c', 'b'], ['b', 'a'], ['a', null],
    ]);
    expect(telVerzettingen('d', keten)).toBe(3);
    expect(telVerzettingen('a', keten)).toBe(0);
  });

  it('loopt niet vast op een kringetje in de data', () => {
    const keten = new Map<string, string | null>([['a', 'b'], ['b', 'a']]);
    expect(telVerzettingen('a', keten)).toBe(1);
  });
});

describe('wachtOpAfboeking', () => {
  it('ziet een verstreken ingeplande afspraak als open', () => {
    expect(wachtOpAfboeking({ status: 'scheduled', starts_at: '2026-09-21T10:00:00Z' }, NU)).toBe(true);
  });

  it('laat een toekomstige afspraak met rust', () => {
    expect(wachtOpAfboeking({ status: 'scheduled', starts_at: '2026-09-23T10:00:00Z' }, NU)).toBe(false);
  });

  it('laat een al afgeboekte afspraak met rust', () => {
    expect(wachtOpAfboeking({ status: 'completed', starts_at: '2026-09-21T10:00:00Z' }, NU)).toBe(false);
  });

  it('valt niet over een onleesbare datum', () => {
    expect(wachtOpAfboeking({ status: 'scheduled', starts_at: 'onzin' }, NU)).toBe(false);
  });
});

describe('labels', () => {
  it('heeft een label voor elke status en elke uitkomst', () => {
    for (const s of APPOINTMENT_STATUSES) expect(STATUS_LABELS[s]).toBeTruthy();
    expect(Object.keys(OUTCOME_LABELS).sort()).toEqual(['deal', 'follow_up', 'no_deal']);
  });

  it('herkent geldige waarden en wijst de rest af', () => {
    expect(isAppointmentStatus('scheduled')).toBe(true);
    expect(isAppointmentStatus('verzonnen')).toBe(false);
    expect(isAppointmentOutcome('deal')).toBe(true);
    expect(isAppointmentOutcome(null)).toBe(false);
  });
});
