import { describe, expect, it } from 'vitest';
import { GEEN_REGELS } from '../campagneExclusiviteit';
import { redenNietGekoppeld, redenVoorBatch, type RedenBatch, type RedenLead } from '../campagneRedenen';

/* Dinsdag 10 nov 2026, 15:00 Nederlandse tijd: de dagdosering staat dan vrijwel open. */
const BINNEN = '2026-11-10T14:00:00Z';
const ms = (s: string) => new Date(s).getTime();

const lead = (over: Partial<RedenLead> = {}): RedenLead => ({
  id: 'L1', branch: 'thuisbatterij', created_at: BINNEN, lat: 52.09, lng: 5.12, provincie: 'Utrecht', land: 'NL', postcode: '3511AB',
  phone_valid: true, custom_fields: {}, meta_campaign_id: 'C1', klanten: [{ customer_id: 'K2', assigned_at: BINNEN }], ...over,
});
const batch = (over: Partial<RedenBatch> = {}): RedenBatch => ({
  id: 'B1', customer_id: 'K1', branch: 'thuisbatterij', batch_size: 100, leads_per_day: null, leads_per_week: null, dagdosering: null,
  starts_at: null, created_at: '2026-11-01T00:00:00Z', lookback_days: null, lead_filters: null,
  targets: [{ target_type: 'radius', lat: 52.09, lng: 5.12, radius_km: 25 }], leveringen: [], ...over,
});
const ctx = { regels: GEEN_REGELS, uitsluitingen: new Map<string, string[]>() };

describe('reden waarom een lead niet bij de gekoppelde klant kwam', () => {
  it('binnen gebied en alles in orde: een andere klant ging voor', () => {
    expect(redenVoorBatch(lead(), batch(), ctx)).toBe('andere_klant_eerst');
  });
  it('buiten het werkgebied (straal), en zonder werkgebied', () => {
    expect(redenVoorBatch(lead({ lat: 53.2, lng: 6.56, provincie: 'Groningen' }), batch(), ctx)).toBe('buiten_gebied');
    expect(redenVoorBatch(lead(), batch({ targets: [] }), ctx)).toBe('geen_gebied');
  });
  it('provinciegebied', () => {
    const prov = batch({ targets: [{ target_type: 'province', provinces: ['Utrecht'] }] });
    expect(redenVoorBatch(lead(), prov, ctx)).toBe('andere_klant_eerst');
    expect(redenVoorBatch(lead({ provincie: 'Zeeland', lat: 51.5, lng: 3.6 }), prov, ctx)).toBe('buiten_gebied');
  });
  it('andere branche, nog niet gestart, ongeldig nummer', () => {
    expect(redenVoorBatch(lead({ branch: 'warmtepomp' }), batch(), ctx)).toBe('andere_branche');
    expect(redenVoorBatch(lead(), batch({ starts_at: '2026-11-12T00:00:00Z' }), ctx)).toBe('nog_niet_gestart');
    expect(redenVoorBatch(lead({ phone_valid: false }), batch(), ctx)).toBe('ongeldig_nummer');
  });
  it('batch gepauzeerd of wacht op betaling', () => {
    expect(redenVoorBatch(lead(), batch({ status: 'paused' }), ctx)).toBe('batch_niet_actief');
    expect(redenVoorBatch(lead(), batch({ status: 'pending' }), ctx)).toBe('batch_niet_actief');
    expect(redenVoorBatch(lead(), batch({ status: 'active' }), ctx)).toBe('andere_klant_eerst');
  });
  it('campagne hing aan geen batch: niet "andere branche"', () => {
    expect(redenNietGekoppeld(lead(), [], ctx)).toBe('geen_batch');
  });
  it('campagne uitgesloten voor de batch', () => {
    const regels = { ...GEEN_REGELS, uitgesloten: new Map([['B1', new Set(['C1'])]]) };
    expect(redenVoorBatch(lead(), batch(), { ...ctx, regels })).toBe('campagne_regel');
  });
  it('leadfilter', () => {
    const b = batch({ lead_filters: [{ field: 'dak', operator: 'eq', value: 'plat' }] as RedenBatch['lead_filters'] });
    expect(redenVoorBatch(lead({ custom_fields: { dak: 'schuin' } }), b, ctx)).toBe('filter');
  });
  it('uitsluiting tussen klanten, beide kanten op', () => {
    expect(redenVoorBatch(lead(), batch(), { ...ctx, uitsluitingen: new Map([['K1', ['K2']]]) })).toBe('uitsluiting');
    expect(redenVoorBatch(lead(), batch(), { ...ctx, uitsluitingen: new Map([['K2', ['K1']]]) })).toBe('uitsluiting');
  });
  it('vol, week- en dagmaximum op het moment van binnenkomst', () => {
    const eerder = (n: number, iso: string) => Array.from({ length: n }, () => ms(iso));
    expect(redenVoorBatch(lead(), batch({ batch_size: 3, leveringen: eerder(3, '2026-11-05T10:00:00Z') }), ctx)).toBe('batch_vol');
    expect(redenVoorBatch(lead(), batch({ leads_per_week: 2, leveringen: eerder(2, '2026-11-09T10:00:00Z') }), ctx)).toBe('weekmaximum');
    expect(redenVoorBatch(lead(), batch({ leads_per_day: 2, leveringen: eerder(2, '2026-11-10T09:00:00Z') }), ctx)).toBe('dagmaximum');
    /* Leveringen van na de binnenkomst tellen niet. */
    expect(redenVoorBatch(lead(), batch({ batch_size: 3, leveringen: eerder(3, '2026-11-11T10:00:00Z') }), ctx)).toBe('andere_klant_eerst');
  });
  it('maximum aantal klanten per lead', () => {
    const vol = lead({ klanten: ['K2', 'K3', 'K4'].map(customer_id => ({ customer_id, assigned_at: BINNEN })) });
    expect(redenVoorBatch(vol, batch(), ctx)).toBe('max_klanten');
    expect(redenVoorBatch(lead({ custom_fields: { max_customer_assignments: '1' } }), batch(), ctx)).toBe('max_klanten');
  });
  it('meerdere gekoppelde batches: de batch die het dichtst bij de lead kwam telt', () => {
    expect(redenNietGekoppeld(lead(), [batch({ targets: [] }), batch({ id: 'B2', leads_per_day: 1, leveringen: [ms('2026-11-10T08:00:00Z')] })], ctx)).toBe('dagmaximum');
  });
});
