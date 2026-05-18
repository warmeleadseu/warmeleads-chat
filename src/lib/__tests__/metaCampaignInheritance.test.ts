import { describe, expect, it } from 'vitest';
import { applyMetaInheritanceWaterfall, metaInheritanceNoteSuffix } from '@/lib/metaCampaignInheritance';

describe('applyMetaInheritanceWaterfall', () => {
  const customerId = 'c1';
  const orderBranch = 'thuisbatterij';

  it('prefers source batch when customer, branch and pipeline match and ids non-empty', () => {
    const r = applyMetaInheritanceWaterfall({
      orderBranch,
      customerId,
      sourceBatch: {
        customer_id: customerId,
        branch: orderBranch,
        batch_kind: 'leads',
        meta_campaign_ids: ['111', '222'],
        meta_campaign_paused_ids: ['222'],
        meta_campaign_sync_enabled: false,
      },
      branchDefault: { meta_campaign_ids: ['999'], meta_campaign_sync_enabled: true },
      historical: [{ batch_kind: 'leads', meta_campaign_ids: ['333'], meta_campaign_sync_enabled: true }],
    });
    expect(r.inheritance_source).toBe('source_batch');
    expect(r.meta_campaign_ids).toEqual(['111', '222']);
    expect(r.meta_campaign_paused_ids).toEqual(['222']);
    expect(r.meta_campaign_sync_enabled).toBe(false);
  });

  it('skips source batch when branch mismatches', () => {
    const r = applyMetaInheritanceWaterfall({
      orderBranch,
      customerId,
      sourceBatch: {
        customer_id: customerId,
        branch: 'airco',
        batch_kind: 'leads',
        meta_campaign_ids: ['111'],
        meta_campaign_sync_enabled: true,
      },
      branchDefault: { meta_campaign_ids: ['999'], meta_campaign_sync_enabled: true },
      historical: [],
    });
    expect(r.inheritance_source).toBe('branch_default');
    expect(r.meta_campaign_ids).toEqual(['999']);
  });

  it('skips source batch when not pipeline', () => {
    const r = applyMetaInheritanceWaterfall({
      orderBranch,
      customerId,
      sourceBatch: {
        customer_id: customerId,
        branch: orderBranch,
        batch_kind: 'niche_research',
        meta_campaign_ids: ['111'],
        meta_campaign_sync_enabled: true,
      },
      branchDefault: null,
      historical: [{ batch_kind: 'leads', meta_campaign_ids: ['444'], meta_campaign_sync_enabled: true }],
    });
    expect(r.inheritance_source).toBe('latest_batch');
    expect(r.meta_campaign_ids).toEqual(['444']);
  });

  it('uses branch default when source empty or absent', () => {
    const r = applyMetaInheritanceWaterfall({
      orderBranch,
      customerId,
      sourceBatch: {
        customer_id: customerId,
        branch: orderBranch,
        batch_kind: 'leads',
        meta_campaign_ids: [],
        meta_campaign_sync_enabled: true,
      },
      branchDefault: { meta_campaign_ids: ['42'], meta_campaign_sync_enabled: false },
      historical: [{ batch_kind: 'leads', meta_campaign_ids: ['55'], meta_campaign_sync_enabled: true }],
    });
    expect(r.inheritance_source).toBe('branch_default');
    expect(r.meta_campaign_ids).toEqual(['42']);
    expect(r.meta_campaign_sync_enabled).toBe(false);
  });

  it('falls back to latest historical pipeline batch with ids', () => {
    const r = applyMetaInheritanceWaterfall({
      orderBranch,
      customerId,
      sourceBatch: null,
      branchDefault: null,
      historical: [
        { batch_kind: 'leads', meta_campaign_ids: [], meta_campaign_sync_enabled: true },
        { batch_kind: 'leads', meta_campaign_ids: ['77'], meta_campaign_sync_enabled: true },
      ],
    });
    expect(r.inheritance_source).toBe('latest_batch');
    expect(r.meta_campaign_ids).toEqual(['77']);
  });

  it('returns none when nothing matches', () => {
    const r = applyMetaInheritanceWaterfall({
      orderBranch,
      customerId,
      sourceBatch: null,
      branchDefault: null,
      historical: [{ batch_kind: 'leads', meta_campaign_ids: [], meta_campaign_sync_enabled: true }],
    });
    expect(r.inheritance_source).toBe('none');
    expect(r.meta_campaign_ids).toEqual([]);
    expect(r.meta_campaign_sync_enabled).toBe(true);
  });
});

describe('metaInheritanceNoteSuffix', () => {
  it('returns Dutch audit fragment', () => {
    expect(metaInheritanceNoteSuffix('source_batch')).toContain('bron-batch');
    expect(metaInheritanceNoteSuffix('branch_default')).toContain('standaardinstelling');
    expect(metaInheritanceNoteSuffix('latest_batch')).toContain('laatste');
  });
});
