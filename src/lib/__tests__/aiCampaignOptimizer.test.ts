import { describe, it, expect } from 'vitest';
import { __internal } from '../aiCampaignOptimizer';

describe('optimizer thresholds', () => {
  it('cold-funnel ratio is conservative', () => {
    expect(__internal.COLD_FUNNEL_SPEND_RATIO).toBeGreaterThanOrEqual(2);
  });

  it('bad and good CPL ratios bracket target', () => {
    expect(__internal.BAD_CPL_RATIO).toBeGreaterThan(1);
    expect(__internal.GOOD_CPL_RATIO).toBeLessThan(1);
    expect(__internal.BAD_CPL_RATIO).toBeGreaterThan(__internal.GOOD_CPL_RATIO);
  });

  it('scale ramp limited', () => {
    expect(__internal.SCALE_BUDGET_PCT).toBeGreaterThan(0);
    expect(__internal.SCALE_BUDGET_PCT).toBeLessThanOrEqual(0.5);
    expect(__internal.MAX_DAILY_BUDGET_MULT).toBeLessThanOrEqual(8);
  });

  it('tick interval prevents thrash', () => {
    expect(__internal.MIN_TICK_INTERVAL_MS).toBeGreaterThanOrEqual(5 * 60_000);
  });

  it('minimum leads threshold is sane', () => {
    expect(__internal.MIN_LEADS_PER_VARIANT).toBeGreaterThanOrEqual(5);
  });
});
