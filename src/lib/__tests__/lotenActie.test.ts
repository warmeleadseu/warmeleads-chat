import { describe, expect, it } from 'vitest';
import {
  NAJAARSACTIE_2026 as A, actieFase, actieLabels, actieZichtbaar, beoordeelBatch, betaalMoment, binnenActie, isGecrediteerd,
  kiesZichtbareActie, lotenVoorBatch, lotenVoorBulk, rijNaarActie, valideerNieuweActie, wijsWinnaarAan,
  type Actie, type BatchKandidaat, type FactuurRij,
} from '../lotenActie';

const batch = (o: Partial<BatchKandidaat> = {}): BatchKandidaat => ({
  id: 'b1', customer_id: 'k1', batch_kind: 'leads', batch_size: 50, is_paid: true, created_at: '2026-10-29T10:00:00Z',
  total_price: 1250, price_per_lead: 25, klant: { intern: false, demo_mode: false }, ...o,
});
const betaald = (paid_at: string, o: Partial<FactuurRij> = {}): FactuurRij => ({ id: 'f1', status: 'paid', paid_at, credit_note_of: null, ...o });

describe('acties met loten', () => {
  it('telt per volle leads-per-lot en bulk-per-lot van de actie', () => {
    expect(lotenVoorBatch(A, 50)).toBe(5);
    expect(lotenVoorBatch(A, 25)).toBe(2);
    expect(lotenVoorBatch(A, 9)).toBe(0);
    expect(lotenVoorBulk(A, 300)).toBe(3);
    expect(lotenVoorBulk(A, 99)).toBe(0);
    const ruim: Actie = { ...A, leadsPerLot: 25, bulkPerLot: 50 };
    expect(lotenVoorBatch(ruim, 50)).toBe(2);
    expect(lotenVoorBulk(ruim, 120)).toBe(2);
  });

  it('kent de grenzen in Nederlandse tijd: 30 okt 00:00 tot en met 13 nov 23:59', () => {
    expect(binnenActie(A, '2026-10-29T22:59:59Z')).toBe(false);
    expect(binnenActie(A, '2026-10-29T23:00:00Z')).toBe(true);
    expect(binnenActie(A, '2026-11-13T22:59:59Z')).toBe(true);
    expect(binnenActie(A, '2026-11-13T23:00:00Z')).toBe(false);
    expect(binnenActie(A, null)).toBe(false);
    expect(actieFase(A, new Date('2026-10-29T12:00:00Z'))).toBe('voor');
    expect(actieFase(A, new Date('2026-11-05T12:00:00Z'))).toBe('loopt');
    expect(actieFase(A, new Date(A.eind))).toBe('afgelopen');
    expect(actieLabels(A)).toEqual({ startLabel: '30 oktober 2026', eindLabel: '13 november 2026', startDag: '2026-10-30', laatsteDag: '2026-11-13' });
  });

  it('leest een rij uit de tabel', () => {
    expect(rijNaarActie({
      code: 'najaar-2026', naam: A.naam, start_op: '2026-10-29T23:00:00+00:00', eind_op: '2026-11-13T23:00:00+00:00',
      prijs_leads: 20, leads_per_lot: 10, bulk_per_lot: 100,
    })).toEqual(A);
  });

  it('bepaalt het betaalmoment uit de eerste betaalde factuur, anders het aanmaakmoment zonder factuur', () => {
    expect(betaalMoment(batch(), [betaald('2026-10-31T09:00:00Z')])).toBe('2026-10-31T09:00:00Z');
    expect(betaalMoment(batch(), [])).toBe('2026-10-29T10:00:00Z');
    expect(betaalMoment(batch(), [{ id: 'f1', status: 'open', paid_at: null, credit_note_of: null }])).toBeNull();
    expect(betaalMoment(batch({ is_paid: false }), [betaald('2026-10-31T09:00:00Z')])).toBeNull();
  });

  it('herkent een gecrediteerde factuur', () => {
    expect(isGecrediteerd([betaald('2026-10-31T09:00:00Z'), { id: 'c1', status: 'paid', paid_at: null, credit_note_of: 'f1' }])).toBe(true);
    expect(isGecrediteerd([betaald('2026-10-31T09:00:00Z')])).toBe(false);
  });

  it('beoordeelt welke batches meetellen', () => {
    const f = [betaald('2026-10-31T09:00:00Z')];
    expect(beoordeelBatch(A, batch(), f)).toEqual({ telt: true, loten: 5, betaaldOp: '2026-10-31T09:00:00Z' });
    expect(beoordeelBatch(A, batch(), [])).toMatchObject({ telt: false, reden: 'buiten de actieperiode betaald' });
    expect(beoordeelBatch(A, batch({ created_at: '2026-10-01T10:00:00Z' }), [betaald('2026-11-02T09:00:00Z')]).telt).toBe(true);
    expect(beoordeelBatch(A, batch({ batch_kind: 'bulk_leads' }), f)).toMatchObject({ reden: 'geen leadbatch' });
    expect(beoordeelBatch(A, batch({ batch_kind: 'niche_research' }), f).telt).toBe(false);
    expect(beoordeelBatch(A, batch({ klant: { intern: true } }), f)).toMatchObject({ reden: 'interne of demo-klant' });
    expect(beoordeelBatch(A, batch({ klant: { demo_mode: true } }), f).telt).toBe(false);
    expect(beoordeelBatch(A, batch({ total_price: 0, price_per_lead: 0 }), f)).toMatchObject({ reden: 'gratis batch' });
    expect(beoordeelBatch(A, batch({ batch_size: 8 }), f)).toMatchObject({ reden: 'minder dan 10 leads' });
    expect(beoordeelBatch(A, batch({ is_paid: false }), [])).toMatchObject({ reden: 'niet betaald' });
    expect(beoordeelBatch(A, batch(), [...f, { id: 'c1', status: 'paid', paid_at: null, credit_note_of: 'f1' }])).toMatchObject({ reden: 'gecrediteerd' });
    expect(beoordeelBatch(A, batch(), [betaald('2026-11-14T08:00:00Z')]).telt).toBe(false);
  });

  it('trekt gewogen en na te rekenen: elk lot wijst precies één deelnemer aan', () => {
    const d = [{ customer_id: 'b', loten: 2 }, { customer_id: 'a', loten: 3 }, { customer_id: 'c', loten: 0 }];
    expect([0, 1, 2, 3, 4].map(n => wijsWinnaarAan(d, n)?.customer_id)).toEqual(['a', 'a', 'a', 'b', 'b']);
    expect(wijsWinnaarAan(d, 5)).toBeNull();
    expect(wijsWinnaarAan(d, -1)).toBeNull();
    expect(wijsWinnaarAan([], 0)).toBeNull();
  });

  it('toont de lopende actie, anders de laatste die nog in beeld hoort', () => {
    const tweede: Actie = { ...A, code: 'actie-2026-12-01', start: '2026-11-30T23:00:00.000Z', eind: '2026-12-14T23:00:00.000Z' };
    const geen = new Map<string, string>();
    expect(kiesZichtbareActie([A, tweede], geen, new Date('2026-11-05T12:00:00Z'))?.code).toBe('najaar-2026');
    /* Tussen de acties: de najaarsactie (trekking volgt) blijft nog in beeld. */
    expect(kiesZichtbareActie([A, tweede], geen, new Date('2026-11-20T12:00:00Z'))?.code).toBe('najaar-2026');
    /* Drie dagen na de trekking verdwijnt hij. */
    const getrokken = new Map([['najaar-2026', '2026-11-15T10:00:00Z']]);
    expect(kiesZichtbareActie([A, tweede], getrokken, new Date('2026-11-20T12:00:00Z'))).toBeNull();
    expect(kiesZichtbareActie([A, tweede], getrokken, new Date('2026-12-02T12:00:00Z'))?.code).toBe('actie-2026-12-01');
    expect(actieZichtbaar(A, null, new Date('2026-10-20T12:00:00Z'))).toBe(false);
  });

  it('controleert een nieuwe actie: datums, getallen en geen overlap', () => {
    const nu = new Date('2026-11-05T12:00:00Z');
    const goed = { naam: 'Winteractie', startDag: '2026-12-01', laatsteDag: '2026-12-14', prijsLeads: 25, leadsPerLot: 10, bulkPerLot: 100 };
    const r = valideerNieuweActie(goed, [A], nu);
    expect(r).toEqual({
      ok: true,
      actie: { code: 'actie-2026-12-01', naam: 'Winteractie', start: '2026-11-30T23:00:00.000Z', eind: '2026-12-14T23:00:00.000Z', prijsLeads: 25, leadsPerLot: 10, bulkPerLot: 100 },
    });
    /* Zomertijd: 1 juni begint om 22:00 UTC de dag ervoor. */
    const zomer = valideerNieuweActie({ ...goed, startDag: '2027-06-01', laatsteDag: '2027-06-30' }, [A], nu);
    expect(zomer.ok && zomer.actie.start).toBe('2027-05-31T22:00:00.000Z');
    expect(valideerNieuweActie({ ...goed, startDag: '2026-11-10' }, [A], nu)).toMatchObject({ ok: false });
    expect(valideerNieuweActie({ ...goed, startDag: '2026-11-14' }, [A], nu).ok).toBe(true);
    expect(valideerNieuweActie({ ...goed, startDag: '2026-11-01' }, [], nu)).toMatchObject({ ok: false, fout: expect.stringContaining('verleden') });
    expect(valideerNieuweActie({ ...goed, laatsteDag: '2026-11-30' }, [], nu)).toMatchObject({ ok: false });
    expect(valideerNieuweActie({ ...goed, naam: 'x' }, [], nu).ok).toBe(false);
    expect(valideerNieuweActie({ ...goed, prijsLeads: 0 }, [], nu).ok).toBe(false);
    expect(valideerNieuweActie({ ...goed, leadsPerLot: 2.5 }, [], nu).ok).toBe(false);
    /* Eén dag is genoeg. */
    expect(valideerNieuweActie({ ...goed, laatsteDag: '2026-12-01' }, [], nu).ok).toBe(true);
  });
});
