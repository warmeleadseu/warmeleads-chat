import { describe, expect, it, vi } from 'vitest';

vi.mock('../distribution', () => ({ distributeLead: vi.fn() }));
vi.mock('../pdok', () => ({ resolveAddress: vi.fn(), isValidPlace: () => true }));

import { selecteerVangnetLeads, vangnetMinuutOverslaan, type VangnetLead } from '../directVangnet';

const NU = new Date('2026-10-20T10:07:30Z');
const secGeleden = (s: number) => new Date(NU.getTime() - s * 1000).toISOString();
const lead = (x: Partial<VangnetLead>): VangnetLead => ({
  id: 'l', branch: 'thuisbatterij', bron: 'zapier', phone_valid: true, created_at: secGeleden(120), assigned_customer_ids: [], ...x,
});
const DIRECT = new Set(['thuisbatterij']);
const SPIEGEL = ['spiegel'];
const ids = (l: VangnetLead[]) => l.map(x => x.id);

describe('selecteerVangnetLeads', () => {
  it('lead van 2 minuten zonder klant in een direct-branche: opgepakt', () => {
    expect(ids(selecteerVangnetLeads([lead({ id: 'a' })], DIRECT, SPIEGEL, NU))).toEqual(['a']);
  });
  it('jonger dan 45 seconden: nog niet (de verdeling bij binnenkomst is bezig)', () => {
    expect(selecteerVangnetLeads([lead({ created_at: secGeleden(30) })], DIRECT, SPIEGEL, NU)).toEqual([]);
  });
  it('ouder dan 30 minuten: niet meer, dat doet de verdeelronde', () => {
    expect(selecteerVangnetLeads([lead({ created_at: secGeleden(31 * 60) })], DIRECT, SPIEGEL, NU)).toEqual([]);
  });
  it('branche zonder direct-klant: niets', () => {
    expect(selecteerVangnetLeads([lead({ branch: 'warmtepomp' })], DIRECT, SPIEGEL, NU)).toEqual([]);
  });
  it('heeft al een klant: niets; alleen een spiegelkopie telt niet', () => {
    expect(selecteerVangnetLeads([lead({ assigned_customer_ids: ['k1'] })], DIRECT, SPIEGEL, NU)).toEqual([]);
    expect(ids(selecteerVangnetLeads([lead({ id: 's', assigned_customer_ids: ['spiegel'] })], DIRECT, SPIEGEL, NU))).toEqual(['s']);
  });
  it('demo, Excel-import en ongeldig telefoonnummer: niet', () => {
    expect(selecteerVangnetLeads([
      lead({ bron: 'demo' }), lead({ bron: 'excel_import' }), lead({ phone_valid: false }),
    ], DIRECT, SPIEGEL, NU)).toEqual([]);
  });
  it('telefoonnummer nog niet gecontroleerd (null): wel', () => {
    expect(selecteerVangnetLeads([lead({ phone_valid: null })], DIRECT, SPIEGEL, NU)).toHaveLength(1);
  });
});

describe('vangnetMinuutOverslaan', () => {
  it('slaat de minuut van de kwartierronde en die ervoor over', () => {
    const om = (m: number) => new Date(Date.UTC(2026, 9, 20, 10, m, 5));
    expect([0, 14, 15, 29, 30, 44, 45, 59].map(m => vangnetMinuutOverslaan(om(m)))).toEqual([true, true, true, true, true, true, true, true]);
    expect([1, 7, 13, 16, 31, 46].map(m => vangnetMinuutOverslaan(om(m)))).toEqual([false, false, false, false, false, false]);
  });
});
