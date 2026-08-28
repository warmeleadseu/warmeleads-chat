import { describe, it, expect } from 'vitest';
import {
  isExcludedCampaign,
  splitSpend,
  sumSpendBetween,
  clampToSpendStart,
  leadExclusionOrFilter,
  type SpendRow,
} from './metaCpl';

/**
 * Regressietests voor de CPL-boekhouding van augustus 2026. De bruto CPL stond
 * op 6,64 terwijl de werkelijke kosten ruim tweeënhalf keer hoger lagen; de
 * oorzaken (stille 1000-rijenafkapping en spend die buiten de campagnefilter
 * viel) zijn verholpen met de definitie die deze module vastlegt.
 */
describe('isExcludedCampaign', () => {
  it('sluit campagnes met het woord energie uit', () => {
    expect(isExcludedCampaign('Energie Zakelijk | Rick en Don 6 - Space')).toBe(true);
    expect(isExcludedCampaign('Energie VvE')).toBe(true);
    expect(isExcludedCampaign('PakketAdvies | Energie leads')).toBe(true);
  });

  it('sluit campagnes met het woord pakketadvies uit, hoofdletterongevoelig', () => {
    expect(isExcludedCampaign('PakketAdvies | Energie leads - Kopie')).toBe(true);
    expect(isExcludedCampaign('pakketadvies test')).toBe(true);
  });

  it('laat Energiekompas staan: dat is een klantnaam, niet het woord energie', () => {
    expect(isExcludedCampaign('Warmtepomp | Energiekompas - Almelo')).toBe(false);
  });

  it('laat gewone campagnes staan', () => {
    expect(isExcludedCampaign('Thuisbatterij | Mediabink (Jensie) Heel NL')).toBe(false);
    expect(isExcludedCampaign(null)).toBe(false);
    expect(isExcludedCampaign('')).toBe(false);
  });
});

const rij = (over: Partial<SpendRow>): SpendRow => ({
  campaign_id: 'c1',
  campaign_name: 'Thuisbatterij | Test',
  date: '2026-06-01',
  spend: '10',
  leads_count: 1,
  ...over,
});

describe('splitSpend', () => {
  it('telt meetellende en uitgesloten spend apart', () => {
    const t = splitSpend([
      rij({ spend: '100' }),
      rij({ campaign_id: 'c2', campaign_name: 'Energie VvE', spend: '40' }),
      rij({ campaign_id: 'c1', spend: 25.5 }),
    ]);
    expect(t.includedTotal).toBe(125.5);
    expect(t.excludedTotal).toBe(40);
    expect(t.excludedCampaignIds).toEqual(['c2']);
    expect(t.rows).toHaveLength(2);
  });

  it('is bestand tegen onparseerbare bedragen', () => {
    const t = splitSpend([rij({ spend: 'kapot' as unknown as string })]);
    expect(t.includedTotal).toBe(0);
  });
});

describe('sumSpendBetween', () => {
  const rows = [
    rij({ date: '2026-05-01', spend: '10' }),
    rij({ date: '2026-05-31', spend: '20' }),
    rij({ date: '2026-06-01', spend: '40' }),
  ];
  it('is inclusief op beide grenzen', () => {
    expect(sumSpendBetween(rows, '2026-05-01', '2026-05-31')).toBe(30);
    expect(sumSpendBetween(rows, '2026-05-01', '2026-06-01')).toBe(70);
    expect(sumSpendBetween(rows, '2026-06-02', '2026-12-31')).toBe(0);
  });
});

describe('clampToSpendStart', () => {
  it('begrenst een jaarvenster dat voor 1 mei begint', () => {
    expect(clampToSpendStart('2026-01-01')).toBe('2026-05-01');
    expect(clampToSpendStart('2026-01-01T00:00:00.000Z')).toBe('2026-05-01');
  });
  it('laat latere startdata met rust', () => {
    expect(clampToSpendStart('2026-08-01')).toBe('2026-08-01');
  });
});

describe('leadExclusionOrFilter', () => {
  it('bouwt een filter dat attributieloze leads behoudt', () => {
    expect(leadExclusionOrFilter(['a', 'b'])).toBe(
      'meta_campaign_id.is.null,meta_campaign_id.not.in.(a,b)',
    );
  });
  it('geeft null zonder uitgesloten campagnes', () => {
    expect(leadExclusionOrFilter([])).toBeNull();
  });
});
