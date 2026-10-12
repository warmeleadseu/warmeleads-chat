import { describe, expect, it } from 'vitest';
import { bepaalTerugwinlijst, segmentVoor, type TwBatch } from '../terugwinnen';

const NU = new Date('2026-10-12T10:00:00Z');
const dagen = (d: number) => new Date(NU.getTime() - d * 86_400_000).toISOString();
const b = (x: Partial<TwBatch>): TwBatch => ({
  id: 'b', customer_id: 'k1', branch: 'thuisbatterij', soort: 'leads', status: 'completed', is_paid: true,
  batch_size: 50, geleverd: 50, total_price: 1000, price_per_unit: 20, created_at: dagen(40), completed_at: dagen(20), ...x,
});

describe('bepaalTerugwinlijst', () => {
  it('afgeronde betaalde batch zonder opvolger: op de lijst', () => {
    const [k] = bepaalTerugwinlijst([b({})], new Map(), NU);
    expect(k).toMatchObject({ customer_id: 'k1', dagenStil: 20, segment: 'stil', betaaldeBatches: 1, omzet: 1000 });
  });
  it('lopende batch (actief of gepauzeerd): niet op de lijst', () => {
    expect(bepaalTerugwinlijst([b({}), b({ id: 'b2', status: 'active', completed_at: null, created_at: dagen(5) })], new Map(), NU)).toEqual([]);
    expect(bepaalTerugwinlijst([b({}), b({ id: 'b2', status: 'paused', completed_at: null })], new Map(), NU)).toEqual([]);
  });
  it('lopende afspraakbatch telt ook als lopend', () => {
    expect(bepaalTerugwinlijst([b({}), b({ id: 'a1', soort: 'afspraken', status: 'active', completed_at: null })], new Map(), NU)).toEqual([]);
  });
  it('nooit betaald: geen klant om terug te winnen', () => {
    expect(bepaalTerugwinlijst([b({ is_paid: false, status: 'pending_payment', completed_at: null })], new Map(), NU)).toEqual([]);
  });
  it('nieuwe bestelling die nog betaald moet worden: blijft op de lijst, met vlag', () => {
    const [k] = bepaalTerugwinlijst([b({}), b({ id: 'b2', is_paid: false, status: 'pending_payment', completed_at: null, created_at: dagen(3) })], new Map(), NU);
    expect(k.openstaandeBestelling).toBe(true);
  });
  it('latere levering telt als laatste activiteit', () => {
    const [k] = bepaalTerugwinlijst([b({})], new Map([['k1', dagen(2)]]), NU);
    expect(k.dagenStil).toBe(2);
    expect(k.segment).toBe('net_klaar');
  });
  it('omzet en branches over alle betaalde batches', () => {
    const [k] = bepaalTerugwinlijst([
      b({}), b({ id: 'b2', branch: 'warmtepomp', total_price: 500, created_at: dagen(100), completed_at: dagen(80) }),
    ], new Map(), NU);
    expect(k.omzet).toBe(1500);
    expect(k.branches.sort()).toEqual(['thuisbatterij', 'warmtepomp']);
    expect(k.laatsteBatch.id).toBe('b');
  });
});

describe('segmentVoor', () => {
  it('grenzen 14 en 60 dagen', () => {
    expect(segmentVoor(13)).toBe('net_klaar');
    expect(segmentVoor(14)).toBe('stil');
    expect(segmentVoor(59)).toBe('stil');
    expect(segmentVoor(60)).toBe('slapend');
  });
});
