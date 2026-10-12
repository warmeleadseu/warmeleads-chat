import { describe, expect, it } from 'vitest';
import { kiesNabestelSuggestie, type NabestelBatch } from '../nabestellen';

const NU = new Date('2026-10-12T10:00:00Z');
const dagenGeleden = (d: number) => new Date(NU.getTime() - d * 86_400_000).toISOString();
const batch = (b: Partial<NabestelBatch>): NabestelBatch => ({
  id: 'b1', branch: 'thuisbatterij', batch_kind: 'leads', delivery_model: 'capped', status: 'active', is_paid: true,
  batch_size: 100, leads_delivered: 50, created_at: dagenGeleden(20), completed_at: null, ...b,
});

describe('kiesNabestelSuggestie', () => {
  it('onder 80%: niets', () => {
    expect(kiesNabestelSuggestie([batch({ leads_delivered: 79 })], NU)).toBeNull();
  });
  it('80% vol: bijna vol', () => {
    expect(kiesNabestelSuggestie([batch({ leads_delivered: 85 })], NU)).toMatchObject({ batch_id: 'b1', status: 'bijna_vol', procent: 85 });
  });
  it('net afgerond: vol', () => {
    expect(kiesNabestelSuggestie([batch({ status: 'completed', leads_delivered: 100, completed_at: dagenGeleden(3) })], NU)).toMatchObject({ status: 'vol', procent: 100 });
  });
  it('langer dan 21 dagen geleden afgerond: niet meer', () => {
    expect(kiesNabestelSuggestie([batch({ status: 'completed', leads_delivered: 100, completed_at: dagenGeleden(30) })], NU)).toBeNull();
  });
  it('al nabesteld in dezelfde branche (ook als hij nog betaald moet worden): niets', () => {
    expect(kiesNabestelSuggestie([
      batch({ leads_delivered: 90 }),
      batch({ id: 'b2', status: 'pending_payment', is_paid: false, leads_delivered: 0, created_at: dagenGeleden(1) }),
    ], NU)).toBeNull();
  });
  it('nieuwe batch in een andere branche telt niet als nabesteld', () => {
    expect(kiesNabestelSuggestie([
      batch({ leads_delivered: 90 }),
      batch({ id: 'b2', branch: 'warmtepomp', leads_delivered: 0, created_at: dagenGeleden(1) }),
    ], NU)?.batch_id).toBe('b1');
  });
  it('onbetaald, bulk of niche: geen suggestie', () => {
    expect(kiesNabestelSuggestie([batch({ is_paid: false, leads_delivered: 90 })], NU)).toBeNull();
    expect(kiesNabestelSuggestie([batch({ batch_kind: 'bulk_leads', leads_delivered: 90 })], NU)).toBeNull();
    expect(kiesNabestelSuggestie([batch({ batch_kind: 'niche_research', leads_delivered: 90 })], NU)).toBeNull();
  });
  it('volle batch gaat voor een bijna volle', () => {
    expect(kiesNabestelSuggestie([
      batch({ id: 'a', leads_delivered: 95 }),
      batch({ id: 'b', branch: 'warmtepomp', status: 'completed', leads_delivered: 50, batch_size: 50, completed_at: dagenGeleden(2) }),
    ], NU)?.batch_id).toBe('b');
  });
});
