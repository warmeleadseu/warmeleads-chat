import { describe, expect, it } from 'vitest';
import { __internal, BRANCH_HINTS } from '@/lib/aiCampaignStrategist';

describe('aiCampaignStrategist', () => {
  describe('BRANCH_HINTS', () => {
    it('bevat ten minste de kernbranches', () => {
      expect(BRANCH_HINTS.thuisbatterij).toBeDefined();
      expect(BRANCH_HINTS.airco).toBeDefined();
      expect(BRANCH_HINTS.zonnepanelen).toBeDefined();
      expect(BRANCH_HINTS.warmtepomp).toBeDefined();
    });

    it('per branche minstens 3 motivations en interests-keywords', () => {
      for (const [slug, hint] of Object.entries(BRANCH_HINTS)) {
        expect(hint.motivations.length, slug).toBeGreaterThanOrEqual(3);
        expect(hint.default_interest_keywords.length, slug).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('getBranchHint', () => {
    it('valt terug op default voor onbekende branche', () => {
      const h = __internal.getBranchHint('iets-randoms');
      expect(h.persona).toContain('Huiseigenaar');
      expect(h.default_age_min).toBeGreaterThanOrEqual(18);
    });

    it('gebruikt branche-specifieke hint indien aanwezig', () => {
      const h = __internal.getBranchHint('thuisbatterij');
      expect(h.motivations.join(' ')).toMatch(/saldering|terugleveren|opvangen/i);
    });
  });

  describe('buildSystemPrompt', () => {
    it('vermeldt branche, doel-CPL, en strategy_params in het prompt', () => {
      const prompt = __internal.buildSystemPrompt({
        brief: {
          id: 'b1',
          branch: 'thuisbatterij',
          branchName: 'Thuisbatterij',
          countries: ['NL'],
          daily_budget_cents: 5000,
          target_cpl_cents: 1500,
        },
        params: {
          angles: 3,
          adsets_per_angle: 2,
          creatives_per_adset: 3,
          use_lookalike: true,
          use_exclusion: true,
        },
        available: {
          lookalike_audience_id: 'lal_123',
          exclusion_audience_id: 'exc_123',
          branch_lead_count: 250,
          known_interests: [{ id: '1', name: 'Zonnepanelen', topic: 'Home' }],
        },
      });
      expect(prompt).toContain('Thuisbatterij');
      expect(prompt).toContain('EUR 50.00');           // daily budget
      expect(prompt).toContain('EUR 15.00');           // target CPL
      expect(prompt).toContain('Exact 3 campagnes');
      expect(prompt).toContain('Exact 3 campagnes, elk met een UNIEK angle');
      expect(prompt).toContain('Per campagne exact 2 ad sets');
      expect(prompt).toContain('lal_123');
      expect(prompt).toContain('Zonnepanelen');
    });

    it('zegt expliciet GEEN lookalike als seed onvoldoende', () => {
      const prompt = __internal.buildSystemPrompt({
        brief: { id: 'b1', branch: 'airco', countries: ['NL'], daily_budget_cents: 3000 },
        params: { angles: 2, adsets_per_angle: 1, creatives_per_adset: 2, use_lookalike: true, use_exclusion: false },
        available: { lookalike_audience_id: null },
      });
      expect(prompt).toMatch(/GEEN lookalike beschikbaar/i);
    });
  });

  describe('StrategySchema', () => {
    it('accepteert geldige minimale strategie', () => {
      const valid = {
        campaigns: [{
          angle: 'ROI',
          rationale: 'voor besparingsgevoelige doelgroep',
          daily_budget_share: 1.0,
          adsets: [{
            strategy_type: 'broad',
            name: 'Broad NL',
            rationale: 'leer eerst breed',
            predicted_cpl_cents: 1200,
            targeting: { age_min: 30, age_max: 65 },
            creative_brief: { style: 'lifestyle', framework: 'PAS', tone: 'warm', hook: 'Hoe verdien je je investering terug?' },
          }],
        }],
        overall_rationale: 'Begin breed en valideer angle',
        predicted_avg_cpl_cents: 1200,
      };
      const parsed = __internal.StrategySchema.parse(valid);
      expect(parsed.campaigns.length).toBe(1);
    });

    it('weigert adset zonder verplichte velden', () => {
      const invalid = {
        campaigns: [{ angle: 'X', rationale: 'y', daily_budget_share: 1.0, adsets: [{}] }],
        overall_rationale: 'r',
        predicted_avg_cpl_cents: 800,
      };
      expect(() => __internal.StrategySchema.parse(invalid)).toThrow();
    });
  });
});
