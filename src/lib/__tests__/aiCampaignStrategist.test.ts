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

    it('accepteert ad set met embedded image_briefs (v3)', () => {
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
            creative_brief: { style: 'bold_promo', framework: 'PAS', tone: 'warm', hook: 'Hoe verdien je je investering terug?' },
            creatives: [{
              label: 'overlay-promo',
              headline_hook: 'BESPAAR ELK JAAR EUR 1200',
              image_brief: {
                concept: 'Modern Nederlands huis met thuisbatterij in meterkast',
                visual_hook: 'glanzend batterij-paneel close-up',
                subject: 'thuisbatterij module',
                scene_setting: 'moderne meterkast',
                composition: 'medium close-up, rule of thirds',
                lighting: 'soft studio key + rim',
                mood: 'premium-eerlijk',
                color_focus: 'koel blauw + warm hout-accent',
                style: 'price_badge',
                overlay: { enabled: true, text: 'BESPAAR EUR 1200/JR', placement: 'badge_top_right', style_hint: 'bold sans-serif', rationale: 'cijfer in beeld stopt scroll' },
                copy_alignment: 'beeld versterkt de ROI-belofte van de headline',
              },
            }],
          }],
        }],
        overall_rationale: 'v3 met image-briefs',
        predicted_avg_cpl_cents: 1200,
      };
      const parsed = __internal.StrategySchema.parse(valid);
      expect(parsed.campaigns[0].adsets[0].creatives?.[0].image_brief.overlay.enabled).toBe(true);
    });
  });

  describe('ImageBriefSchema (v3)', () => {
    it('verwerpt brief met overlay enabled=true maar lege text/placement velden volledig leeg', () => {
      const bad = {
        concept: 'iets', visual_hook: 'iets', subject: 'iets', scene_setting: 'iets',
        composition: 'iets', lighting: 'iets', mood: 'warm', color_focus: 'warm',
        style: 'lifestyle',
        // overlay-velden incompleet:
        overlay: { enabled: true, text: 'a', placement: 'top' /* missing style_hint + rationale */ },
        copy_alignment: 'iets',
      };
      expect(() => __internal.ImageBriefSchema.parse(bad)).toThrow();
    });
  });

  describe('buildVisualDnaBlock', () => {
    it('verwerkt een lege DNA naar generieke instructies', () => {
      const block = __internal.buildVisualDnaBlock(undefined, 3);
      expect(block).toContain('IMAGE BRIEFS PER AD SET');
      expect(block).toContain('exact 3 items');
    });

    it('verwerkt admin-DNA met overlay-frequency=always tot 100%-instructie', () => {
      const block = __internal.buildVisualDnaBlock({
        audience_looks: ['gezin'],
        settings: ['woonkamer'],
        moods: ['warm-eerlijk'],
        color_focuses: ['warme-aardetinten'],
        styles_enabled: ['lifestyle', 'bold_promo'],
        overlay_frequency: 'always',
        must_include: ['zonnepaneel'],
        must_avoid: ['kinderen alleen'],
        brand_identity: 'merk',
        example_overlays: ['BESPAAR EUR 1200/JAAR'],
      }, 4);
      expect(block).toContain('VISUEEL DNA');
      expect(block).toContain('Mik op 100%');
      expect(block).toContain('zonnepaneel');
      expect(block).toContain('kinderen alleen');
      expect(block).toContain('BESPAAR EUR 1200/JAAR');
      expect(block).toContain('exact 4 items');
    });
  });
});
