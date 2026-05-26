import { describe, it, expect } from 'vitest';
import {
  getDesiredMetaCampaignStatus,
  getDesiredMetaCampaignStatusForCampaign,
  hasBatchAdvertisingWindowStarted,
  resolveAggregatedMetaCampaignDesiredStatus,
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

describe('getDesiredMetaCampaignStatusForCampaign', () => {
  const base = {
    id: '1',
    batch_kind: 'leads' as const,
    is_paid: true,
    status: 'active' as const,
    batch_size: 10,
    leads_delivered: 0,
    meta_campaign_sync_enabled: true,
    meta_campaign_ids: ['111', '222'],
    meta_campaign_paused_ids: ['222'],
    starts_at: null,
  };

  it('forces PAUSED for manually paused campaign', () => {
    expect(getDesiredMetaCampaignStatusForCampaign(base, '222')).toBe('PAUSED');
  });

  it('follows batch rules for non-paused campaign', () => {
    expect(getDesiredMetaCampaignStatusForCampaign(base, '111')).toBe('ACTIVE');
  });
});

describe('resolveAggregatedMetaCampaignDesiredStatus', () => {
  const sharedId = '120242306172830248';

  const activeBatch = {
    id: 'active-batch',
    batch_kind: 'leads' as const,
    is_paid: true,
    status: 'active' as const,
    batch_size: 250,
    leads_delivered: 24,
    meta_campaign_sync_enabled: true,
    meta_campaign_ids: [sharedId, '120233211895510248'],
    meta_campaign_paused_ids: [],
    starts_at: null,
  };

  const completedBatch = {
    id: 'done-batch',
    batch_kind: 'leads' as const,
    is_paid: true,
    status: 'completed' as const,
    batch_size: 250,
    leads_delivered: 250,
    meta_campaign_sync_enabled: true,
    meta_campaign_ids: [sharedId, '120245835806310248'],
    meta_campaign_paused_ids: [],
    starts_at: null,
  };

  it('stays ACTIVE when one active batch still needs the shared campaign', () => {
    expect(
      resolveAggregatedMetaCampaignDesiredStatus(sharedId, [activeBatch, completedBatch]),
    ).toBe('ACTIVE');
  });

  it('is PAUSED when only completed batches link the campaign', () => {
    expect(resolveAggregatedMetaCampaignDesiredStatus(sharedId, [completedBatch])).toBe('PAUSED');
  });

  it('is PAUSED when manually paused on any linked batch', () => {
    expect(
      resolveAggregatedMetaCampaignDesiredStatus(sharedId, [
        { ...activeBatch, meta_campaign_paused_ids: [sharedId] },
        completedBatch,
      ]),
    ).toBe('PAUSED');
  });
});
