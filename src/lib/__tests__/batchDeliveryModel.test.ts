import { describe, it, expect } from 'vitest';
import {
  deliveryModelFromBatchKind,
  getBatchProgressView,
  isCappedDeliveryModel,
} from '../batchDeliveryModel';

describe('batchDeliveryModel', () => {
  it('maps batch_kind to delivery_model', () => {
    expect(deliveryModelFromBatchKind('leads')).toBe('capped');
    expect(deliveryModelFromBatchKind('niche_research')).toBe('unlimited');
    expect(deliveryModelFromBatchKind('bulk_leads')).toBe('manual');
  });

  it('unlimited never shows overlevering', () => {
    const view = getBatchProgressView({
      delivery_model: 'unlimited',
      batch_kind: 'niche_research',
      batch_size: 1,
      leads_delivered: 6,
    });
    expect(view.showOverdelivery).toBe(false);
    expect(view.progressPercent).toBeNull();
    expect(view.primaryLabel).toContain('6');
    expect(view.primaryLabel).toContain('onderzoeksleads');
  });

  it('capped shows overlevering when above batch_size', () => {
    const view = getBatchProgressView({
      delivery_model: 'capped',
      batch_size: 100,
      leads_delivered: 110,
    });
    expect(view.showOverdelivery).toBe(true);
    expect(view.progressPercent).toBe(100);
  });

  it('isCappedDeliveryModel respects explicit model', () => {
    expect(isCappedDeliveryModel('unlimited', 'leads')).toBe(false);
    expect(isCappedDeliveryModel('capped', 'niche_research')).toBe(true);
  });
});
