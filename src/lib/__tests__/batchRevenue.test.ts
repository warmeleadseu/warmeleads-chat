import { describe, it, expect } from 'vitest';
import { batchRevenueForCosts } from '../batchRevenue';

describe('batchRevenueForCosts', () => {
  describe('reguliere lead-batches (per geleverde lead)', () => {
    it('schaalt revenue met aantal geleverde leads in periode', () => {
      expect(
        batchRevenueForCosts({ batch_kind: 'leads', price_per_lead: 30, total_price: 900 }, 5),
      ).toBe(150);
    });

    it('default batch_kind (null/undefined) wordt als reguliere lead-batch behandeld', () => {
      expect(batchRevenueForCosts({ price_per_lead: 25 }, 4)).toBe(100);
      expect(batchRevenueForCosts({ batch_kind: null, price_per_lead: 25 }, 4)).toBe(100);
    });

    it('zonder geldige price_per_lead = 0', () => {
      expect(batchRevenueForCosts({ batch_kind: 'leads', price_per_lead: null }, 5)).toBe(0);
      expect(batchRevenueForCosts({ batch_kind: 'leads', price_per_lead: 0 }, 5)).toBe(0);
    });
  });

  describe('niche-onderzoeksbatches (eenmalig pakketbedrag)', () => {
    it('telt total_price slechts één keer, ongeacht aantal geleverde leads', () => {
      const niche = { batch_kind: 'niche_research', price_per_lead: 1000, total_price: 1000 };
      // Bug-case: 50 leads in batch zou €50.000 omzet geven (was de oude bug).
      expect(batchRevenueForCosts(niche, 50)).toBe(1000);
      expect(batchRevenueForCosts(niche, 1)).toBe(1000);
      expect(batchRevenueForCosts(niche, 100)).toBe(1000);
    });

    it('zonder total_price = 0', () => {
      expect(batchRevenueForCosts({ batch_kind: 'niche_research', total_price: null }, 5)).toBe(0);
    });

    it('negeert price_per_lead bij niche_research', () => {
      // Zelfs als price_per_lead per ongeluk anders staat dan total_price,
      // moet niche-onderzoek het total_price-pakketbedrag volgen.
      expect(
        batchRevenueForCosts(
          { batch_kind: 'niche_research', price_per_lead: 999, total_price: 1500 },
          7,
        ),
      ).toBe(1500);
    });
  });

  describe('edge cases', () => {
    it('0 leveringen → 0 omzet, voor elk type batch', () => {
      expect(batchRevenueForCosts({ batch_kind: 'leads', price_per_lead: 30 }, 0)).toBe(0);
      expect(batchRevenueForCosts({ batch_kind: 'niche_research', total_price: 1000 }, 0)).toBe(0);
    });

    it('numeric strings worden correct geparsed', () => {
      expect(
        batchRevenueForCosts({ batch_kind: 'leads', price_per_lead: '37.50' as unknown as number }, 4),
      ).toBe(150);
      expect(
        batchRevenueForCosts({ batch_kind: 'niche_research', total_price: '1000' as unknown as number }, 10),
      ).toBe(1000);
    });
  });
});
