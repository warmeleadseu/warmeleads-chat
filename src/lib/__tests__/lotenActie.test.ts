import { describe, expect, it } from 'vitest';
import {
  ACTIE, actieFase, beoordeelBatch, betaalMoment, binnenActie, isGecrediteerd, lotenVoorBatch, lotenVoorBulk, wijsWinnaarAan,
  type BatchKandidaat, type FactuurRij,
} from '../lotenActie';

const batch = (o: Partial<BatchKandidaat> = {}): BatchKandidaat => ({
  id: 'b1', customer_id: 'k1', batch_kind: 'leads', batch_size: 50, is_paid: true, created_at: '2026-10-29T10:00:00Z',
  total_price: 1250, price_per_lead: 25, klant: { intern: false, demo_mode: false }, ...o,
});
const betaald = (paid_at: string, o: Partial<FactuurRij> = {}): FactuurRij => ({ id: 'f1', status: 'paid', paid_at, credit_note_of: null, ...o });

describe('najaarsactie loten', () => {
  it('telt per volle 10 leads en per volle 100 bulkleads', () => {
    expect(lotenVoorBatch(50)).toBe(5);
    expect(lotenVoorBatch(25)).toBe(2);
    expect(lotenVoorBatch(9)).toBe(0);
    expect(lotenVoorBulk(300)).toBe(3);
    expect(lotenVoorBulk(199)).toBe(1);
    expect(lotenVoorBulk(99)).toBe(0);
  });

  it('kent de grenzen in Nederlandse tijd: 30 okt 00:00 tot en met 13 nov 23:59', () => {
    expect(binnenActie('2026-10-29T22:59:59Z')).toBe(false); // 29 okt 23:59 NL
    expect(binnenActie('2026-10-29T23:00:00Z')).toBe(true); // 30 okt 00:00 NL
    expect(binnenActie('2026-11-13T22:59:59Z')).toBe(true); // 13 nov 23:59 NL
    expect(binnenActie('2026-11-13T23:00:00Z')).toBe(false); // 14 nov 00:00 NL
    expect(binnenActie(null)).toBe(false);
    expect(actieFase(new Date('2026-10-29T12:00:00Z'))).toBe('voor');
    expect(actieFase(new Date('2026-11-05T12:00:00Z'))).toBe('loopt');
    expect(actieFase(new Date(ACTIE.eind))).toBe('afgelopen');
  });

  it('bepaalt het betaalmoment uit de eerste betaalde factuur, anders het aanmaakmoment zonder factuur', () => {
    expect(betaalMoment(batch(), [betaald('2026-10-31T09:00:00Z')])).toBe('2026-10-31T09:00:00Z');
    expect(betaalMoment(batch(), [])).toBe('2026-10-29T10:00:00Z');
    /* Wel een factuur maar die is nog open: niet als betaald zien, ook al staat is_paid aan. */
    expect(betaalMoment(batch(), [{ id: 'f1', status: 'open', paid_at: null, credit_note_of: null }])).toBeNull();
    expect(betaalMoment(batch({ is_paid: false }), [betaald('2026-10-31T09:00:00Z')])).toBeNull();
  });

  it('herkent een gecrediteerde factuur', () => {
    expect(isGecrediteerd([betaald('2026-10-31T09:00:00Z'), { id: 'c1', status: 'paid', paid_at: null, credit_note_of: 'f1' }])).toBe(true);
    expect(isGecrediteerd([betaald('2026-10-31T09:00:00Z')])).toBe(false);
  });

  it('beoordeelt welke batches meetellen', () => {
    expect(beoordeelBatch(batch(), [betaald('2026-10-31T09:00:00Z')])).toEqual({ telt: true, loten: 5, betaaldOp: '2026-10-31T09:00:00Z' });
    /* Batch van vóór de actie zonder factuur (zoals een batch die beheer al betaald aanmaakte). */
    expect(beoordeelBatch(batch(), [])).toMatchObject({ telt: false, reden: 'buiten de actieperiode betaald' });
    /* Oud aangemaakt, maar in de actie betaald: telt. */
    expect(beoordeelBatch(batch({ created_at: '2026-10-01T10:00:00Z' }), [betaald('2026-11-02T09:00:00Z')]).telt).toBe(true);
    expect(beoordeelBatch(batch({ batch_kind: 'bulk_leads' }), [betaald('2026-10-31T09:00:00Z')])).toMatchObject({ reden: 'geen leadbatch' });
    expect(beoordeelBatch(batch({ batch_kind: 'niche_research' }), [betaald('2026-10-31T09:00:00Z')]).telt).toBe(false);
    expect(beoordeelBatch(batch({ klant: { intern: true } }), [betaald('2026-10-31T09:00:00Z')])).toMatchObject({ reden: 'interne of demo-klant' });
    expect(beoordeelBatch(batch({ klant: { demo_mode: true } }), [betaald('2026-10-31T09:00:00Z')]).telt).toBe(false);
    expect(beoordeelBatch(batch({ total_price: 0, price_per_lead: 0 }), [betaald('2026-10-31T09:00:00Z')])).toMatchObject({ reden: 'gratis batch' });
    expect(beoordeelBatch(batch({ batch_size: 8 }), [betaald('2026-10-31T09:00:00Z')])).toMatchObject({ reden: 'minder dan 10 leads' });
    expect(beoordeelBatch(batch({ is_paid: false }), [])).toMatchObject({ reden: 'niet betaald' });
    expect(beoordeelBatch(batch(), [betaald('2026-10-31T09:00:00Z'), { id: 'c1', status: 'paid', paid_at: null, credit_note_of: 'f1' }]))
      .toMatchObject({ reden: 'gecrediteerd' });
    expect(beoordeelBatch(batch(), [betaald('2026-11-14T08:00:00Z')]).telt).toBe(false);
  });

  it('trekt gewogen en na te rekenen: elk lot wijst precies één deelnemer aan', () => {
    const d = [{ customer_id: 'b', loten: 2 }, { customer_id: 'a', loten: 3 }, { customer_id: 'c', loten: 0 }];
    /* Vaste volgorde op id: a (lot 0-2), b (lot 3-4). */
    expect([0, 1, 2, 3, 4].map(n => wijsWinnaarAan(d, n)?.customer_id)).toEqual(['a', 'a', 'a', 'b', 'b']);
    expect(wijsWinnaarAan(d, 5)).toBeNull();
    expect(wijsWinnaarAan(d, -1)).toBeNull();
    expect(wijsWinnaarAan([], 0)).toBeNull();
  });
});
