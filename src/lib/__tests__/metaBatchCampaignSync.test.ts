import { describe, it, expect } from 'vitest';
import {
  getDesiredMetaCampaignStatus,
  hasBatchAdvertisingWindowStarted,
} from '../metaBatchCampaignSync';

describe('hasBatchAdvertisingWindowStarted', () => {
  it('returns true when starts_at is null', () => {
    expect(hasBatchAdvertisingWindowStarted(null)).toBe(true);
    expect(hasBatchAdvertisingWindowStarted(undefined)).toBe(true);
  });

  it('returns false for future ISO date', () => {
    const far = new Date(Date.now() + 86400_000 * 365).toISOString();
    expect(hasBatchAdvertisingWindowStarted(far)).toBe(false);
  });

  it('returns true for past date', () => {
    expect(hasBatchAdvertisingWindowStarted('2020-01-01T00:00:00.000Z')).toBe(true);
  });
});

describe('getDesiredMetaCampaignStatus + starts_at', () => {
  const base = {
    id: '1',
    batch_kind: 'leads' as const,
    is_paid: true,
    status: 'active' as const,
    batch_size: 10,
    leads_delivered: 0,
    meta_campaign_sync_enabled: true,
    meta_campaign_ids: ['123456789'],
  };

  it('is PAUSED when paid+active but starts_at is in the future', () => {
    const future = new Date(Date.now() + 86400_000 * 7).toISOString();
    expect(getDesiredMetaCampaignStatus({ ...base, starts_at: future })).toBe('PAUSED');
  });

  it('is ACTIVE when starts_at has passed', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(getDesiredMetaCampaignStatus({ ...base, starts_at: past })).toBe('ACTIVE');
  });

  it('is PAUSED without campaign ids', () => {
    expect(getDesiredMetaCampaignStatus({ ...base, meta_campaign_ids: [] })).toBe('PAUSED');
  });

  it('is PAUSED when batch is full', () => {
    expect(getDesiredMetaCampaignStatus({ ...base, leads_delivered: 10, starts_at: null })).toBe('PAUSED');
  });

  it('is PAUSED at daily cap (assigned_at semantics via capCounts)', () => {
    expect(
      getDesiredMetaCampaignStatus({ ...base, leads_per_day: 3, starts_at: null }, { todayCount: 3, weekCount: 1 }),
    ).toBe('PAUSED');
  });

  it('is ACTIVE under daily cap', () => {
    expect(
      getDesiredMetaCampaignStatus({ ...base, leads_per_day: 3, starts_at: null }, { todayCount: 2, weekCount: 10 }),
    ).toBe('ACTIVE');
  });

  it('is PAUSED at weekly cap', () => {
    expect(
      getDesiredMetaCampaignStatus({ ...base, leads_per_week: 5, starts_at: null }, { todayCount: 0, weekCount: 5 }),
    ).toBe('PAUSED');
  });

  it('is PAUSED when limits are set but capCounts omitted (fail closed)', () => {
    expect(getDesiredMetaCampaignStatus({ ...base, leads_per_day: 1, starts_at: null })).toBe('PAUSED');
  });

  it('weekly cap blocks even if daily is under', () => {
    expect(
      getDesiredMetaCampaignStatus(
        { ...base, leads_per_day: 10, leads_per_week: 2, starts_at: null },
        { todayCount: 0, weekCount: 2 },
      ),
    ).toBe('PAUSED');
  });
});
